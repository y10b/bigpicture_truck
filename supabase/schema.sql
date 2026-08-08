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
