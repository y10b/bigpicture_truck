-- ───────────────────────────────────────────────
-- 개인 거래(현금) 항목 추가 — 아직 실행하지 않았습니다
--
-- 지금까지 결제 종류가 신용·착불 둘뿐이었습니다. 현장에서는
--   착불      = 앱을 통해 현금 결제가 일어난 것
--   개인 거래 = 제3자 없이 고객과 1:1 로 직접 현금을 받은 것
-- 을 나눠 적어야 해서 칸을 하나 늘립니다.
--
-- ⚠️ total 은 생성 컬럼이라 그대로는 못 바꿉니다. 지우고 다시 만듭니다.
--    total 은 credit + cod + extra 로만 계산되는 값이고 원본이 아니므로,
--    다시 만들면 같은 값이 그대로 계산됩니다. cash 기본값이 0 이라
--    기존 행의 total 은 달라지지 않습니다. (실행 전 아래 확인 쿼리로 검증)
-- ───────────────────────────────────────────────

begin;

alter table public.entries
  add column if not exists cash integer not null default 0 check (cash >= 0);

comment on column public.entries.cash is
  '개인 거래(현금). 제3자 없이 고객과 1:1 로 직접 받은 현금입니다.';

-- 바꾸기 전 합계를 남겨 두고, 끝나고 같은지 비교합니다
create temporary table _total_before on commit drop as
  select coalesce(sum(total), 0) as s, count(*) as n from public.entries;

alter table public.entries drop column if exists total;
alter table public.entries
  add column total integer generated always as (credit + cod + extra + cash) stored;

-- 값이 하나라도 달라지면 전체를 되돌립니다
do $$
declare before_s bigint; before_n bigint; after_s bigint; after_n bigint;
begin
  select s, n into before_s, before_n from _total_before;
  select coalesce(sum(total), 0), count(*) into after_s, after_n from public.entries;
  if before_s <> after_s or before_n <> after_n then
    raise exception '합계가 달라졌습니다 (전 % / 후 %)', before_s, after_s;
  end if;
  raise notice '합계 그대로: % (행 %)', after_s, after_n;
end $$;

-- 날짜별 합계 뷰 -------------------------------------------------
drop view if exists public.v_daily_totals;
create view public.v_daily_totals
with (security_invoker = true) as
select
  e.user_id,
  e.work_date,
  sum(e.count)::int  as count,
  sum(e.credit)::int as credit,
  sum(e.cod)::int    as cod,
  sum(e.extra)::int  as extra,
  sum(e.cash)::int   as cash,
  sum(e.total)::int  as total
from public.entries e
group by e.user_id, e.work_date;

-- 집계 함수들 ----------------------------------------------------
create or replace function public.admin_totals_by_user(from_date date, to_date date)
returns table (
  user_id uuid, name text, phone text,
  count int, credit int, cod int, extra int, cash int, total int, days int
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.name, p.phone,
    coalesce(sum(e.count), 0)::int,
    coalesce(sum(e.credit), 0)::int,
    coalesce(sum(e.cod), 0)::int,
    coalesce(sum(e.extra), 0)::int,
    coalesce(sum(e.cash), 0)::int,
    coalesce(sum(e.total), 0)::int,
    count(distinct e.work_date)::int
  from public.profiles p
  left join public.entries e
    on e.user_id = p.id and e.work_date between from_date and to_date
  where public.is_admin()
  group by p.id, p.name, p.phone
  order by 9 desc, p.name;
$$;

create or replace function public.admin_totals_by_day(from_date date, to_date date)
returns table (
  work_date date, count int, credit int, cod int, extra int, cash int, total int
)
language sql stable security definer set search_path = public as $$
  select e.work_date,
    sum(e.count)::int, sum(e.credit)::int, sum(e.cod)::int,
    sum(e.extra)::int, sum(e.cash)::int, sum(e.total)::int
  from public.entries e
  where public.is_admin() and e.work_date between from_date and to_date
  group by e.work_date order by e.work_date;
$$;

create or replace function public.team_totals_by_user(from_date date, to_date date)
returns table (
  user_id uuid, name text, vehicle_type text,
  count int, credit int, cod int, extra int, cash int, total int, days int
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.name, p.vehicle_type,
    coalesce(sum(e.count), 0)::int,
    coalesce(sum(e.credit), 0)::int,
    coalesce(sum(e.cod), 0)::int,
    coalesce(sum(e.extra), 0)::int,
    coalesce(sum(e.cash), 0)::int,
    coalesce(sum(e.total), 0)::int,
    count(distinct e.work_date)::int
  from public.profiles p
  left join public.entries e
    on e.user_id = p.id and e.work_date between from_date and to_date
  where auth.uid() is not null and p.active
  group by p.id, p.name, p.vehicle_type
  order by 9 desc, p.name;
$$;

create or replace function public.team_totals_by_day(from_date date, to_date date)
returns table (
  work_date date, count int, credit int, cod int, extra int, cash int, total int
)
language sql stable security definer set search_path = public as $$
  select e.work_date,
    sum(e.count)::int, sum(e.credit)::int, sum(e.cod)::int,
    sum(e.extra)::int, sum(e.cash)::int, sum(e.total)::int
  from public.entries e
  join public.profiles p on p.id = e.user_id and p.active
  where auth.uid() is not null and e.work_date between from_date and to_date
  group by e.work_date order by e.work_date;
$$;

create or replace function public.team_daily_by_user(
  target uuid, from_date date, to_date date
)
returns table (
  work_date date, count int, credit int, cod int, extra int, cash int, total int
)
language sql stable security definer set search_path = public as $$
  select e.work_date,
    sum(e.count)::int, sum(e.credit)::int, sum(e.cod)::int,
    sum(e.extra)::int, sum(e.cash)::int, sum(e.total)::int
  from public.entries e
  join public.profiles p on p.id = e.user_id and p.active
  where auth.uid() is not null and e.user_id = target
    and e.work_date between from_date and to_date
  group by e.work_date order by e.work_date;
$$;

grant execute on function public.admin_totals_by_user(date, date)     to authenticated;
grant execute on function public.admin_totals_by_day(date, date)      to authenticated;
grant execute on function public.team_totals_by_user(date, date)      to authenticated;
grant execute on function public.team_totals_by_day(date, date)       to authenticated;
grant execute on function public.team_daily_by_user(uuid, date, date) to authenticated;

notify pgrst, 'reload schema';

commit;
