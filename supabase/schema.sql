-- ═══════════════════════════════════════════════════════════════
--  BIG PICTURE 정산관리 — Supabase 스키마
--  Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 실행하세요.
--  (여러 번 실행해도 안전하도록 작성했습니다)
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────
-- 1. profiles — auth.users 와 1:1로 붙는 직원 정보
-- ───────────────────────────────────────────────
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  name            text not null,
  phone           text not null unique,           -- 숫자만 저장 (예: 01012345678)
  role            text not null default 'employee' check (role in ('employee', 'admin')),
  active          boolean not null default true,  -- false 면 로그인 차단
  memo            text,                           -- 관리자 메모 (차량번호 등)
  notices_seen_at timestamptz,                    -- 공지 읽음 배지용
  -- 관리자가 발급한 임시 비밀번호 상태. true 면 로그인 직후 변경 화면으로 보냅니다.
  must_change_password boolean not null default false,
  created_at      timestamptz not null default now()
);

-- 이미 만들어진 프로젝트에도 적용되도록 (재실행 안전)
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

comment on table public.profiles is '직원 계정 정보. auth.users 와 1:1';

-- ───────────────────────────────────────────────
-- 2. entries — 정산 내역
--    mode='single' : 배송 1건씩 입력 (count = 1)
--    mode='bulk'   : 하루치 몰아서 입력 (count = 건수)
--    총액(total)은 신용+착불+추가금 자동 합산
-- ───────────────────────────────────────────────
create table if not exists public.entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  work_date  date not null default (now() at time zone 'Asia/Seoul')::date,
  mode       text not null default 'single' check (mode in ('single', 'bulk')),
  count      integer not null default 1 check (count >= 0),
  credit     integer not null default 0 check (credit >= 0),  -- 신용
  cod        integer not null default 0 check (cod    >= 0),  -- 착불
  extra      integer not null default 0 check (extra  >= 0),  -- 추가금
  total      integer generated always as (credit + cod + extra) stored,
  memo       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.entries.credit is '신용 (원)';
comment on column public.entries.cod    is '착불 (원)';
comment on column public.entries.extra  is '추가금 (원)';

create index if not exists entries_user_date_idx on public.entries (user_id, work_date desc);
create index if not exists entries_date_idx      on public.entries (work_date desc);

-- updated_at 자동 갱신
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists entries_touch on public.entries;
create trigger entries_touch before update on public.entries
  for each row execute function public.touch_updated_at();

-- ───────────────────────────────────────────────
-- 3. notices — 공지사항 (관리자 작성 / 직원 열람)
-- ───────────────────────────────────────────────
create table if not exists public.notices (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null default '',
  pinned     boolean not null default false,
  author_id  uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notices_created_idx on public.notices (pinned desc, created_at desc);

drop trigger if exists notices_touch on public.notices;
create trigger notices_touch before update on public.notices
  for each row execute function public.touch_updated_at();

-- ───────────────────────────────────────────────
-- 4. 관리자 판별 헬퍼
--    RLS 정책 안에서 profiles 를 직접 조회하면 정책이 무한재귀하므로
--    security definer 함수로 우회합니다.
-- ───────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active
  );
$$;

-- ───────────────────────────────────────────────
-- 5. RLS
-- ───────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.entries  enable row level security;
alter table public.notices  enable row level security;

-- profiles ------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- entries -------------------------------------------------
drop policy if exists entries_own on public.entries;
create policy entries_own on public.entries for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists entries_admin on public.entries;
create policy entries_admin on public.entries for all
  using (public.is_admin()) with check (public.is_admin());

-- notices -------------------------------------------------
drop policy if exists notices_read on public.notices;
create policy notices_read on public.notices for select
  using (auth.uid() is not null);

drop policy if exists notices_admin on public.notices;
create policy notices_admin on public.notices for all
  using (public.is_admin()) with check (public.is_admin());

-- ───────────────────────────────────────────────
-- 6. 집계 뷰 (security_invoker = 호출자 권한 → RLS 그대로 적용됨)
-- ───────────────────────────────────────────────
create or replace view public.v_daily_totals
with (security_invoker = true) as
select
  e.user_id,
  e.work_date,
  sum(e.count)::int  as count,
  sum(e.credit)::int as credit,
  sum(e.cod)::int    as cod,
  sum(e.extra)::int  as extra,
  sum(e.total)::int  as total
from public.entries e
group by e.user_id, e.work_date;

-- 관리자 대시보드: 기간 내 직원별 합계
create or replace function public.admin_totals_by_user(from_date date, to_date date)
returns table (
  user_id uuid,
  name    text,
  phone   text,
  count   int,
  credit  int,
  cod     int,
  extra   int,
  total   int,
  days    int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.name,
    p.phone,
    coalesce(sum(e.count), 0)::int,
    coalesce(sum(e.credit), 0)::int,
    coalesce(sum(e.cod), 0)::int,
    coalesce(sum(e.extra), 0)::int,
    coalesce(sum(e.total), 0)::int,
    count(distinct e.work_date)::int
  from public.profiles p
  left join public.entries e
    on e.user_id = p.id
   and e.work_date between from_date and to_date
  where public.is_admin()          -- 관리자가 아니면 결과 없음
  group by p.id, p.name, p.phone   -- 관리자도 직접 배송을 하므로 role 로 거르지 않습니다
  order by 8 desc, p.name;
$$;

-- 관리자 대시보드: 기간 내 일자별 전사 합계 (그래프용)
create or replace function public.admin_totals_by_day(from_date date, to_date date)
returns table (
  work_date date,
  count int,
  credit int,
  cod    int,
  extra  int,
  total  int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.work_date,
    sum(e.count)::int,
    sum(e.credit)::int,
    sum(e.cod)::int,
    sum(e.extra)::int,
    sum(e.total)::int
  from public.entries e
  where public.is_admin()
    and e.work_date between from_date and to_date
  group by e.work_date
  order by e.work_date;
$$;

grant execute on function public.admin_totals_by_user(date, date) to authenticated;
grant execute on function public.admin_totals_by_day(date, date)  to authenticated;

-- ═══════════════════════════════════════════════════════════════
--  ⚑ 첫 관리자 계정 만들기
--  1) Supabase 대시보드 → Authentication → Users → "Add user"
--     Email:    01012345678@bigpicture.local   (본인 휴대폰번호 + 도메인)
--     Password: 원하는 비밀번호
--     ✅ Auto Confirm User 체크
--  2) 생성된 유저의 UUID를 복사해서 아래를 실행
-- ═══════════════════════════════════════════════════════════════
-- insert into public.profiles (id, name, phone, role)
-- values ('여기에-복사한-UUID', '홍길동', '01012345678', 'admin')
-- on conflict (id) do update set role = 'admin', active = true;

-- ═══════════════════════════════════════════════════════════════
--  사납금 · 출금  (2026-08 추가)
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────
-- 7. app_settings — 회사 공통 설정 (한 행만 존재)
--    weekday_levy: 평일 근무 하루당 사납금. 주말(토·일)은 면제입니다.
-- ───────────────────────────────────────────────
create table if not exists public.app_settings (
  id           integer primary key default 1 check (id = 1),
  weekday_levy integer not null default 100000 check (weekday_levy >= 0),
  updated_at   timestamptz not null default now()
);

insert into public.app_settings (id) values (1) on conflict (id) do nothing;

drop trigger if exists app_settings_touch on public.app_settings;
create trigger app_settings_touch before update on public.app_settings
  for each row execute function public.touch_updated_at();

alter table public.app_settings enable row level security;

drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings for select
  using (auth.uid() is not null);

drop policy if exists app_settings_admin on public.app_settings;
create policy app_settings_admin on public.app_settings for all
  using (public.is_admin()) with check (public.is_admin());

-- ───────────────────────────────────────────────
-- 8. withdrawals — 출금 기록
--    직원은 보통 그 주 마지막 근무일에 출금합니다.
-- ───────────────────────────────────────────────
create table if not exists public.withdrawals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  work_date  date not null default (now() at time zone 'Asia/Seoul')::date,
  amount     integer not null check (amount >= 0),
  memo       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists withdrawals_user_date_idx
  on public.withdrawals (user_id, work_date desc);

drop trigger if exists withdrawals_touch on public.withdrawals;
create trigger withdrawals_touch before update on public.withdrawals
  for each row execute function public.touch_updated_at();

alter table public.withdrawals enable row level security;

drop policy if exists withdrawals_own on public.withdrawals;
create policy withdrawals_own on public.withdrawals for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists withdrawals_admin on public.withdrawals;
create policy withdrawals_admin on public.withdrawals for all
  using (public.is_admin()) with check (public.is_admin());

-- ───────────────────────────────────────────────
-- 9. 집계 함수 갱신
--    weekday_days = 평일 근무일수 (사납금 계산 기준)
--    withdrawn    = 기간 내 출금 합계
-- ───────────────────────────────────────────────
drop function if exists public.admin_totals_by_user(date, date);
create function public.admin_totals_by_user(from_date date, to_date date)
returns table (
  user_id      uuid,
  name         text,
  phone        text,
  count        int,
  credit       int,
  cod          int,
  extra        int,
  total        int,
  days         int,
  weekday_days int,
  withdrawn    int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.name,
    p.phone,
    coalesce(e.cnt, 0)::int,
    coalesce(e.credit, 0)::int,
    coalesce(e.cod, 0)::int,
    coalesce(e.extra, 0)::int,
    coalesce(e.total, 0)::int,
    coalesce(e.days, 0)::int,
    coalesce(e.weekday_days, 0)::int,
    coalesce(w.withdrawn, 0)::int
  from public.profiles p
  left join lateral (
    select
      sum(en.count)  as cnt,
      sum(en.credit) as credit,
      sum(en.cod)    as cod,
      sum(en.extra)  as extra,
      sum(en.total)  as total,
      count(distinct en.work_date) as days,
      -- ISO 요일: 1=월 … 5=금, 6=토, 7=일 → 평일만 사납금 대상
      count(distinct en.work_date) filter (
        where extract(isodow from en.work_date) <= 5
      ) as weekday_days
    from public.entries en
    where en.user_id = p.id
      and en.work_date between from_date and to_date
  ) e on true
  left join lateral (
    select sum(wd.amount) as withdrawn
    from public.withdrawals wd
    where wd.user_id = p.id
      and wd.work_date between from_date and to_date
  ) w on true
  where public.is_admin()   -- 관리자가 아니면 결과 없음
  order by 8 desc, p.name;  -- 관리자도 직접 배송을 하므로 role 로 거르지 않습니다
$$;

grant execute on function public.admin_totals_by_user(date, date) to authenticated;

notify pgrst, 'reload schema';

-- ───────────────────────────────────────────────
-- 10. 지출 · 운행시간 (선택 입력)
--     정산(매출)에는 넣지 않습니다. 적은 사람과 안 적은 사람의
--     실수령이 서로 다른 기준으로 비교되면 안 되기 때문입니다.
--     AI 조언 기능에서만 참고합니다.
-- ───────────────────────────────────────────────
alter table public.entries
  add column if not exists expense integer not null default 0 check (expense >= 0),
  add column if not exists minutes integer check (minutes is null or minutes >= 0);

comment on column public.entries.expense is '지출 — 충전비·주유·톨 등 (선택, 매출에서 차감하지 않음)';
comment on column public.entries.minutes is '운행 시간(분) (선택)';

-- 일자별 집계 뷰에도 함께 노출
create or replace view public.v_daily_totals
with (security_invoker = true) as
select
  e.user_id,
  e.work_date,
  sum(e.count)::int   as count,
  sum(e.credit)::int  as credit,
  sum(e.cod)::int     as cod,
  sum(e.extra)::int   as extra,
  sum(e.total)::int   as total,
  sum(e.expense)::int as expense,
  sum(coalesce(e.minutes, 0))::int as minutes
from public.entries e
group by e.user_id, e.work_date;

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
--  AI (Gemini) 관련  (2026-08 추가)
-- ═══════════════════════════════════════════════════════════════

-- 공지 서식: 저장할 때 AI가 한 번만 매기고, 이후에는 조회만 합니다.
-- [{ "style": "title"|"warn"|"strong"|"body", "text": "..." }, ...]
alter table public.notices
  add column if not exists blocks jsonb;

comment on column public.notices.blocks is
  '문단별 강조 서식. null 이면 body 를 그대로 렌더링합니다.';

-- AI 생성물 캐시 — 같은 내용을 다시 만들지 않도록 하루 1건만 저장합니다.
create table if not exists public.ai_reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  report_date date not null,
  kind        text not null check (kind in ('coach', 'daily')),
  content     jsonb not null,
  created_at  timestamptz not null default now(),
  unique (user_id, report_date, kind)
);

create index if not exists ai_reports_lookup_idx
  on public.ai_reports (user_id, report_date desc, kind);

alter table public.ai_reports enable row level security;

drop policy if exists ai_reports_own on public.ai_reports;
create policy ai_reports_own on public.ai_reports for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists ai_reports_admin on public.ai_reports;
create policy ai_reports_admin on public.ai_reports for all
  using (public.is_admin()) with check (public.is_admin());

-- 코칭에 쓸 "전 직원 평균" — 개인 식별 정보 없이 숫자만 돌려줍니다.
create or replace function public.team_daily_stats(from_date date, to_date date)
returns table (
  worker_days      int,   -- (직원 × 근무일) 수
  avg_day_total    int,   -- 1인 1일 평균 매출
  avg_day_count    numeric, -- 1인 1일 평균 건수
  avg_unit_price   int,   -- 건당 평균 단가
  median_day_total int
)
language sql
stable
security definer
set search_path = public
as $$
  with d as (
    select user_id, work_date, sum(total)::int as total, sum(count)::int as cnt
    from public.entries
    where work_date between from_date and to_date
    group by user_id, work_date
    having sum(total) > 0
  )
  select
    count(*)::int,
    coalesce(avg(total), 0)::int,
    round(coalesce(avg(cnt), 0), 1),
    case when sum(cnt) > 0 then (sum(total) / sum(cnt))::int else 0 end,
    coalesce(percentile_cont(0.5) within group (order by total), 0)::int
  from d;
$$;

grant execute on function public.team_daily_stats(date, date) to authenticated;

notify pgrst, 'reload schema';

-- ───────────────────────────────────────────────
-- 11. 직원 상세 정보 (차량번호 · 차종 · 계좌)
--     기존 memo 하나로 뭉쳐 쓰던 것을 칸으로 나눕니다.
-- ───────────────────────────────────────────────
alter table public.profiles
  add column if not exists vehicle_no   text,  -- 차량번호 (예: 12가3456)
  add column if not exists vehicle_type text,  -- 차종 (예: 1톤 냉장)
  add column if not exists bank_account text;  -- 계좌 (은행 + 번호)

comment on column public.profiles.bank_account is '급여 입금 계좌. 관리자와 본인만 볼 수 있습니다(RLS).';

-- 기존 memo 에 적어둔 내용을 차량번호 칸으로 한 번만 옮겨 둡니다.
update public.profiles
   set vehicle_no = memo
 where vehicle_no is null and memo is not null and memo <> '';

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
--  사납금 제거 (2026-08)
--  기사들에게 압박이 된다는 판단으로 앱에서 사납금 개념을 뺐습니다.
--  정산은 매출 - 출금 = 미출금 으로만 봅니다.
-- ═══════════════════════════════════════════════════════════════
alter table public.app_settings
  drop column if exists weekday_levy,
  drop column if exists levy_amount,
  drop column if exists levy_days_per_week;

drop function if exists public.admin_totals_by_user(date, date);
create function public.admin_totals_by_user(from_date date, to_date date)
returns table (
  user_id   uuid,
  name      text,
  phone     text,
  count     int,
  credit    int,
  cod       int,
  extra     int,
  total     int,
  days      int,
  withdrawn int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.name, p.phone,
    coalesce(e.cnt, 0)::int,
    coalesce(e.credit, 0)::int,
    coalesce(e.cod, 0)::int,
    coalesce(e.extra, 0)::int,
    coalesce(e.total, 0)::int,
    coalesce(e.days, 0)::int,
    coalesce(w.withdrawn, 0)::int
  from public.profiles p
  left join lateral (
    select
      sum(en.count) as cnt, sum(en.credit) as credit, sum(en.cod) as cod,
      sum(en.extra) as extra, sum(en.total) as total,
      count(distinct en.work_date) as days
    from public.entries en
    where en.user_id = p.id and en.work_date between from_date and to_date
  ) e on true
  left join lateral (
    select sum(wd.amount) as withdrawn
    from public.withdrawals wd
    where wd.user_id = p.id and wd.work_date between from_date and to_date
  ) w on true
  where public.is_admin()
  order by 8 desc, p.name;
$$;

grant execute on function public.admin_totals_by_user(date, date) to authenticated;

notify pgrst, 'reload schema';
-- ───────────────────────────────────────────────
-- 12. entry_logs — 정산 내역 수정·삭제 이력
--     화면 코드가 아니라 DB 트리거로 남깁니다.
--     어느 경로로 고치든 빠짐없이 기록되게 하려는 것입니다.
-- ───────────────────────────────────────────────
create table if not exists public.entry_logs (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid,                       -- 삭제된 뒤에도 이력은 남습니다
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  editor_id  uuid references public.profiles(id) on delete set null,
  action     text not null check (action in ('update', 'delete')),
  before     jsonb not null,
  after      jsonb,
  created_at timestamptz not null default now()
);

create index if not exists entry_logs_owner_idx on public.entry_logs (owner_id, created_at desc);
create index if not exists entry_logs_entry_idx on public.entry_logs (entry_id, created_at desc);

alter table public.entry_logs enable row level security;

drop policy if exists entry_logs_own on public.entry_logs;
create policy entry_logs_own on public.entry_logs for select
  using (owner_id = auth.uid());

drop policy if exists entry_logs_admin on public.entry_logs;
create policy entry_logs_admin on public.entry_logs for select
  using (public.is_admin());

-- 이력은 트리거만 씁니다. 사람이 직접 넣거나 고치지 못하게 둡니다.

create or replace function public.log_entry_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  snap_before jsonb;
  snap_after  jsonb;
begin
  -- 비교할 값만 추립니다 (updated_at 같은 건 빼야 '안 바뀐 수정'이 안 남습니다)
  snap_before := jsonb_build_object(
    'work_date', old.work_date, 'mode', old.mode, 'count', old.count,
    'credit', old.credit, 'cod', old.cod, 'extra', old.extra,
    'expense', old.expense, 'minutes', old.minutes, 'memo', old.memo
  );

  if (tg_op = 'DELETE') then
    insert into public.entry_logs (entry_id, owner_id, editor_id, action, before, after)
    values (old.id, old.user_id, auth.uid(), 'delete', snap_before, null);
    return old;
  end if;

  snap_after := jsonb_build_object(
    'work_date', new.work_date, 'mode', new.mode, 'count', new.count,
    'credit', new.credit, 'cod', new.cod, 'extra', new.extra,
    'expense', new.expense, 'minutes', new.minutes, 'memo', new.memo
  );

  -- 실제로 달라진 게 없으면 이력을 남기지 않습니다
  if snap_before = snap_after then
    return new;
  end if;

  insert into public.entry_logs (entry_id, owner_id, editor_id, action, before, after)
  values (new.id, new.user_id, auth.uid(), 'update', snap_before, snap_after);

  return new;
end $$;

drop trigger if exists entries_log_update on public.entries;
create trigger entries_log_update after update on public.entries
  for each row execute function public.log_entry_change();

drop trigger if exists entries_log_delete on public.entries;
create trigger entries_log_delete after delete on public.entries
  for each row execute function public.log_entry_change();

notify pgrst, 'reload schema';
-- 직원이 지난 내역을 고치지 못하게 DB 에서도 막습니다.
-- 서버 코드만 믿으면, anon 키가 공개돼 있는 만큼 직접 호출로 우회할 수 있습니다.
--
-- 기준은 "오늘 적은 것" 입니다. 지난 날짜를 뒤늦게 입력하는 일이 있어서,
-- 적은 날(created_at) 기준으로 잡아야 방금 적은 걸 바로 고칠 수 있습니다.

drop policy if exists entries_own on public.entries;

create policy entries_own_select on public.entries for select
  using (user_id = auth.uid());

create policy entries_own_insert on public.entries for insert
  with check (user_id = auth.uid());

create policy entries_own_update on public.entries for update
  using (
    user_id = auth.uid()
    and (created_at at time zone 'Asia/Seoul')::date
        = (now() at time zone 'Asia/Seoul')::date
  )
  with check (user_id = auth.uid());

create policy entries_own_delete on public.entries for delete
  using (
    user_id = auth.uid()
    and (created_at at time zone 'Asia/Seoul')::date
        = (now() at time zone 'Asia/Seoul')::date
  );

-- 관리자는 기존 정책(entries_admin)으로 제한 없이 다룹니다.

notify pgrst, 'reload schema';
-- 계정을 지우면 profiles → entries 순으로 연쇄 삭제되는데,
-- 그때 이 트리거가 이미 사라진 프로필을 가리키는 이력을 넣으려다 실패했습니다.
-- (직원 삭제 기능이 통째로 막히는 문제)
-- 계정 자체가 없어지는 중이면 남길 대상도 없으므로 그냥 넘어갑니다.

alter table public.entry_logs
  drop constraint if exists entry_logs_owner_id_fkey;

alter table public.entry_logs
  add constraint entry_logs_owner_id_fkey
  foreign key (owner_id) references public.profiles(id) on delete cascade;

create or replace function public.log_entry_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  snap_before jsonb;
  snap_after  jsonb;
begin
  -- 계정이 통째로 지워지는 중이면 이력을 남기지 않습니다.
  if not exists (select 1 from public.profiles where id = old.user_id) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  snap_before := jsonb_build_object(
    'work_date', old.work_date, 'mode', old.mode, 'count', old.count,
    'credit', old.credit, 'cod', old.cod, 'extra', old.extra,
    'expense', old.expense, 'minutes', old.minutes, 'memo', old.memo
  );

  if (tg_op = 'DELETE') then
    insert into public.entry_logs (entry_id, owner_id, editor_id, action, before, after)
    values (old.id, old.user_id, auth.uid(), 'delete', snap_before, null);
    return old;
  end if;

  snap_after := jsonb_build_object(
    'work_date', new.work_date, 'mode', new.mode, 'count', new.count,
    'credit', new.credit, 'cod', new.cod, 'extra', new.extra,
    'expense', new.expense, 'minutes', new.minutes, 'memo', new.memo
  );

  if snap_before = snap_after then
    return new;
  end if;

  insert into public.entry_logs (entry_id, owner_id, editor_id, action, before, after)
  values (new.id, new.user_id, auth.uid(), 'update', snap_before, snap_after);

  return new;
end $$;

notify pgrst, 'reload schema';
-- ───────────────────────────────────────────────
-- 13. driver_locations — 기사 현재 위치
--     "지금 어디 있는지"만 보므로 사람당 한 줄입니다.
--     이동 경로를 쌓지 않아 저장량이 거의 들지 않고,
--     퇴근 후 위치가 남지 않아 개인 생활 시간도 덜 건드립니다.
-- ───────────────────────────────────────────────
create table if not exists public.driver_locations (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  lat         double precision not null,
  lng         double precision not null,
  -- 위치 오차(m). 균형 정확도로 받으므로 보통 30~150m 입니다.
  accuracy    real,
  -- 속도(m/s) · 방향(도). 없을 수 있습니다.
  speed       real,
  heading     real,
  -- 기기에서 위치를 잡은 시각. 서버 도착 시각과 다를 수 있습니다.
  recorded_at timestamptz not null,
  updated_at  timestamptz not null default now()
);

comment on table public.driver_locations is
  '기사 현재 위치. 경로는 쌓지 않고 최신 한 건만 덮어씁니다.';

alter table public.driver_locations enable row level security;

-- 본인 것만 쓰고, 본인 것만 봅니다.
drop policy if exists driver_locations_own on public.driver_locations;
create policy driver_locations_own on public.driver_locations for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 관리자는 전부 봅니다 (읽기만 — 남의 위치를 고칠 이유가 없습니다).
drop policy if exists driver_locations_admin on public.driver_locations;
create policy driver_locations_admin on public.driver_locations for select
  using (public.is_admin());

drop trigger if exists driver_locations_touch on public.driver_locations;
create trigger driver_locations_touch before update on public.driver_locations
  for each row execute function public.touch_updated_at();

-- 위치 공유 여부를 기사 본인이 끌 수 있게 (동의는 받았지만 스위치는 있어야 합니다)
alter table public.profiles
  add column if not exists share_location boolean not null default true;

comment on column public.profiles.share_location is
  '위치 공유 사용 여부. 끄면 앱이 위치를 보내지 않습니다.';

notify pgrst, 'reload schema';
-- ───────────────────────────────────────────────
-- 14. daily_distance — 하루 주행거리
--     위치는 최신 한 점만 두지만, 거리는 날짜별로 남깁니다.
--     "어제보다 얼마나 뛰었나", "1km당 얼마 벌었나" 를 보려면 필요합니다.
--     사람×날짜 한 줄이라 10명이면 1년에 3,650줄 — 부담 없습니다.
-- ───────────────────────────────────────────────
create table if not exists public.daily_distance (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  work_date date not null,
  -- 미터. 위치가 올라올 때마다 직전 점과의 거리를 더합니다.
  meters    integer not null default 0 check (meters >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, work_date)
);

alter table public.daily_distance enable row level security;

drop policy if exists daily_distance_own on public.daily_distance;
create policy daily_distance_own on public.daily_distance for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists daily_distance_admin on public.daily_distance;
create policy daily_distance_admin on public.daily_distance for select
  using (public.is_admin());

/**
 * 새 위치가 올라올 때 직전 점과의 거리를 더합니다.
 *
 * 서버에서 계산하는 이유: 앱이 보낸 거리를 그대로 믿으면 조작할 수 있고,
 * 앱이 꺼졌다 켜져도 이어서 쌓여야 하기 때문입니다.
 *
 * 튀는 값은 버립니다. GPS 는 건물 사이나 터널에서 수백 미터씩 순간이동한
 * 것처럼 찍히는 일이 흔해서, 그걸 거르지 않으면 주행거리가 부풀려집니다.
 */
create or replace function public.add_distance(
  p_lat double precision,
  p_lng double precision,
  p_accuracy real,
  p_recorded_at timestamptz
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  prev      public.driver_locations%rowtype;
  today     date := (now() at time zone 'Asia/Seoul')::date;
  seg_m     double precision := 0;
  gap_s     double precision;
  kmh       double precision;
  total     integer;
begin
  if auth.uid() is null then
    return 0;
  end if;

  -- 오차가 심한 점은 거리 계산에 쓰지 않습니다 (터널·건물 사이)
  if p_accuracy is not null and p_accuracy > 300 then
    select coalesce(meters, 0) into total
      from public.daily_distance
     where user_id = auth.uid() and work_date = today;
    return coalesce(total, 0);
  end if;

  select * into prev from public.driver_locations where user_id = auth.uid();

  if found then
    -- 하버사인 (지구 반지름 6371km)
    seg_m := 6371000 * 2 * asin(sqrt(
      power(sin(radians(p_lat - prev.lat) / 2), 2)
      + cos(radians(prev.lat)) * cos(radians(p_lat))
      * power(sin(radians(p_lng - prev.lng) / 2), 2)
    ));

    gap_s := greatest(extract(epoch from (p_recorded_at - prev.recorded_at)), 1);
    kmh := (seg_m / gap_s) * 3.6;

    -- 시속 150km 를 넘으면 GPS 가 튄 것으로 보고 버립니다.
    -- 하루가 바뀌었으면 어제 마지막 점과 이어 붙이지 않습니다.
    if kmh > 150
       or (prev.recorded_at at time zone 'Asia/Seoul')::date <> today then
      seg_m := 0;
    end if;
  end if;

  insert into public.daily_distance (user_id, work_date, meters)
  values (auth.uid(), today, round(seg_m)::int)
  on conflict (user_id, work_date) do update
    set meters = public.daily_distance.meters + round(seg_m)::int,
        updated_at = now()
  returning meters into total;

  return coalesce(total, 0);
end $$;

grant execute on function public.add_distance(double precision, double precision, real, timestamptz) to authenticated;

-- ───────────────────────────────────────────────
-- 15. unsettled_today — 오늘 뛰었는데 정산을 안 넣은 사람
--     (2026-08 추가)
--
--     "일했는지" 는 주행거리로 판단합니다. 앱을 켜고 일을 시작하면
--     위치가 쌓이므로, 하루 min_meters 이상 움직였는데 정산 기록이
--     하나도 없으면 아직 안 넣은 것으로 봅니다.
--
--     GPS 가 조금씩 튀는 것과 구분해야 해서 기본 3km 로 잡았습니다.
--     (add_distance 가 이미 말도 안 되는 구간은 버리고 쌓습니다)
-- ───────────────────────────────────────────────
create or replace function public.unsettled_today(min_meters integer default 3000)
returns table (
  user_id uuid,
  name    text,
  meters  int
)
language sql
stable
security definer
set search_path = public
as $$
  select d.user_id, p.name, d.meters
  from public.daily_distance d
  join public.profiles p on p.id = d.user_id
  where public.is_admin()
    and d.work_date = (now() at time zone 'Asia/Seoul')::date
    and d.meters >= min_meters
    and p.active
    and not exists (
      select 1
      from public.entries e
      where e.user_id  = d.user_id
        and e.work_date = d.work_date
    )
  order by d.meters desc;
$$;

grant execute on function public.unsettled_today(integer) to authenticated;

-- ───────────────────────────────────────────────
-- 16. 팀 내역 — 직원도 서로의 실적을 볼 수 있게 (2026-08 추가)
--
--     entries 의 RLS 는 "본인 것 + 관리자" 그대로 둡니다.
--     원본 행을 열어 주면 메모까지 다 보이고 되돌리기도 어렵습니다.
--     대신 합계만 돌려주는 함수를 따로 두고 로그인한 사람에게 열어 줍니다.
--
--     출금·계좌·전화번호는 넣지 않습니다. 서로 볼 이유가 없는 정보입니다.
-- ───────────────────────────────────────────────

-- 기간 내 사람별 합계
create or replace function public.team_totals_by_user(from_date date, to_date date)
returns table (
  user_id      uuid,
  name         text,
  vehicle_type text,
  count  int,
  credit int,
  cod    int,
  extra  int,
  total  int,
  days   int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.name,
    p.vehicle_type,
    coalesce(sum(e.count), 0)::int,
    coalesce(sum(e.credit), 0)::int,
    coalesce(sum(e.cod), 0)::int,
    coalesce(sum(e.extra), 0)::int,
    coalesce(sum(e.total), 0)::int,
    count(distinct e.work_date)::int
  from public.profiles p
  left join public.entries e
    on e.user_id = p.id
   and e.work_date between from_date and to_date
  where auth.uid() is not null   -- 로그인만 하면 됩니다
    and p.active                 -- 그만둔 사람은 빼고 봅니다
  group by p.id, p.name, p.vehicle_type
  order by 8 desc, p.name;
$$;

-- 기간 내 팀 전체의 날짜별 합계 (그래프용)
create or replace function public.team_totals_by_day(from_date date, to_date date)
returns table (
  work_date date,
  count  int,
  credit int,
  cod    int,
  extra  int,
  total  int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.work_date,
    sum(e.count)::int,
    sum(e.credit)::int,
    sum(e.cod)::int,
    sum(e.extra)::int,
    sum(e.total)::int
  from public.entries e
  join public.profiles p on p.id = e.user_id and p.active
  where auth.uid() is not null
    and e.work_date between from_date and to_date
  group by e.work_date
  order by e.work_date;
$$;

-- 한 사람의 날짜별 합계 (팀 내역에서 눌러 들어갔을 때)
create or replace function public.team_daily_by_user(
  target uuid, from_date date, to_date date
)
returns table (
  work_date date,
  count  int,
  credit int,
  cod    int,
  extra  int,
  total  int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.work_date,
    sum(e.count)::int,
    sum(e.credit)::int,
    sum(e.cod)::int,
    sum(e.extra)::int,
    sum(e.total)::int
  from public.entries e
  join public.profiles p on p.id = e.user_id and p.active
  where auth.uid() is not null
    and e.user_id = target
    and e.work_date between from_date and to_date
  group by e.work_date
  order by e.work_date;
$$;

grant execute on function public.team_totals_by_user(date, date)      to authenticated;
grant execute on function public.team_totals_by_day(date, date)       to authenticated;
grant execute on function public.team_daily_by_user(uuid, date, date) to authenticated;

-- ───────────────────────────────────────────────
-- 17. 사장님께 — 비밀 소통 창구 (2026-08 추가)
--
--     누구나 쓸 수 있고, 정해진 사람만 읽습니다.
--     "관리자면 다 본다" 가 아닙니다. 관리자 중에도 못 보는 사람이 있어야 해서
--     역할이 아니라 사람별 권한(can_read_voice)으로 둡니다.
--
--     익명으로 보내면 읽는 쪽에 이름이 아예 가지 않습니다.
--     그래서 읽는 사람에게는 테이블 select 권한을 주지 않고,
--     이름을 지운 뒤 돌려주는 함수만 열어 둡니다.
-- ───────────────────────────────────────────────

alter table public.profiles
  add column if not exists can_read_voice boolean not null default false;

comment on column public.profiles.can_read_voice is
  '사장님께 들어온 이야기를 읽을 수 있는 사람. 관리자 여부와 무관합니다.';

create table if not exists public.voice_messages (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles(id) on delete cascade,
  -- 이름을 밝히지 않고 보냈는지
  anonymous  boolean not null default true,
  body       text not null check (length(btrim(body)) > 0),
  -- 읽는 사람이 남기는 답장
  reply      text,
  replied_by uuid references public.profiles(id) on delete set null,
  replied_at timestamptz,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists voice_messages_created_idx
  on public.voice_messages (created_at desc);
create index if not exists voice_messages_author_idx
  on public.voice_messages (author_id, created_at desc);

alter table public.voice_messages enable row level security;

-- 읽을 수 있는 사람인지. RLS 안에서 profiles 를 직접 보면 정책이 무한재귀합니다.
create or replace function public.can_read_voice()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.can_read_voice from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

grant execute on function public.can_read_voice() to authenticated;

-- 쓴 사람은 본인 것만 봅니다. 읽는 사람에게는 select 를 주지 않습니다
-- (아래 voice_inbox 함수로만 봅니다 — 익명 글의 author_id 가 새면 안 됩니다).
drop policy if exists voice_own_select on public.voice_messages;
create policy voice_own_select on public.voice_messages for select
  using (author_id = auth.uid());

drop policy if exists voice_own_insert on public.voice_messages;
create policy voice_own_insert on public.voice_messages for insert
  with check (author_id = auth.uid());

-- 아직 읽히지 않았으면 거둬들일 수 있습니다.
drop policy if exists voice_own_delete on public.voice_messages;
create policy voice_own_delete on public.voice_messages for delete
  using (author_id = auth.uid() and read_at is null);

-- 읽는 쪽 목록. 익명이면 이름 자리에 null 을 넣어 돌려줍니다.
create or replace function public.voice_inbox()
returns table (
  id         uuid,
  body       text,
  anonymous  boolean,
  author_name text,
  created_at timestamptz,
  read_at    timestamptz,
  reply      text,
  replied_at timestamptz,
  replier_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id,
    v.body,
    v.anonymous,
    case when v.anonymous then null else p.name end,
    v.created_at,
    v.read_at,
    v.reply,
    v.replied_at,
    r.name
  from public.voice_messages v
  join public.profiles p on p.id = v.author_id
  left join public.profiles r on r.id = v.replied_by
  where public.can_read_voice()
  order by v.created_at desc;
$$;

grant execute on function public.voice_inbox() to authenticated;

-- 아직 안 읽은 건수 (배지용)
create or replace function public.voice_unread_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.can_read_voice()
      then (select count(*)::int from public.voice_messages where read_at is null)
    else 0
  end;
$$;

grant execute on function public.voice_unread_count() to authenticated;

create or replace function public.voice_mark_read(target uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.voice_messages
     set read_at = now()
   where id = target
     and read_at is null
     and public.can_read_voice();
$$;

grant execute on function public.voice_mark_read(uuid) to authenticated;

create or replace function public.voice_reply(target uuid, reply_text text)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.voice_messages
     set reply      = nullif(btrim(reply_text), ''),
         replied_by = case when nullif(btrim(reply_text), '') is null then null else auth.uid() end,
         replied_at = case when nullif(btrim(reply_text), '') is null then null else now() end,
         read_at    = coalesce(read_at, now())
   where id = target
     and public.can_read_voice();
$$;

grant execute on function public.voice_reply(uuid, text) to authenticated;

-- 읽을 사람 지정: 사장님(곽풀잎)과 화면 확인용 관리자(김승준) 두 명뿐입니다.
update public.profiles set can_read_voice = (phone in ('01025225858', '01000000000'));

notify pgrst, 'reload schema';
