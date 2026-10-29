-- 2단계: 합계에 cash 를 반영합니다.
--
-- entries.total 은 generated 컬럼이라 지웠다 다시 만들어야 바꿀 수 있는데,
-- 살아 있는 금액 테이블에 그런 수술을 할 이유가 없습니다.
-- 대신 뷰와 집계 함수에서 credit+cod+extra+cash 를 직접 더합니다.
-- (뷰·함수는 데이터를 들고 있지 않아 다시 만들어도 안전합니다)
--
-- entries.total 은 cash 가 빠진 옛 값이므로 앱에서 더는 읽지 않습니다.

comment on column public.entries.total is
  '[옛 칸] credit+cod+extra 만 더합니다. cash 가 빠져 있으니 쓰지 마세요.
   실제 합계는 v_daily_totals.total 또는 credit+cod+extra+cash 를 보세요.';

drop view if exists public.v_daily_totals;
create view public.v_daily_totals
with (security_invoker = true) as
select
  e.user_id,
  e.work_date,
  sum(e.count)::int                                   as count,
  sum(e.credit)::int                                  as credit,
  sum(e.cod)::int                                     as cod,
  sum(e.extra)::int                                   as extra,
  sum(e.cash)::int                                    as cash,
  sum(e.credit + e.cod + e.extra + e.cash)::int       as total,
  -- 관리자가 신고 대상으로 체크해 둔 금액만
  sum((e.credit + e.cod + e.extra + e.cash)
      * case when e.taxable then 1 else 0 end)::int   as taxable_total
from public.entries e
group by e.user_id, e.work_date;

-- 반환 칸이 늘어나 replace 로는 안 됩니다. 함수는 데이터가 없어 지워도 안전합니다.
drop function if exists public.admin_totals_by_user(date, date);
drop function if exists public.admin_totals_by_day(date, date);
drop function if exists public.team_totals_by_user(date, date);
drop function if exists public.team_totals_by_day(date, date);
drop function if exists public.team_daily_by_user(uuid, date, date);

create function public.admin_totals_by_user(from_date date, to_date date)
returns table (
  user_id uuid, name text, phone text,
  count int, credit int, cod int, extra int, cash int, total int,
  taxable_total int, days int
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.name, p.phone,
    coalesce(sum(e.count), 0)::int,
    coalesce(sum(e.credit), 0)::int,
    coalesce(sum(e.cod), 0)::int,
    coalesce(sum(e.extra), 0)::int,
    coalesce(sum(e.cash), 0)::int,
    coalesce(sum(e.credit + e.cod + e.extra + e.cash), 0)::int,
    coalesce(sum((e.credit + e.cod + e.extra + e.cash)
                 * case when e.taxable then 1 else 0 end), 0)::int,
    count(distinct e.work_date)::int
  from public.profiles p
  left join public.entries e
    on e.user_id = p.id and e.work_date between from_date and to_date
  where public.is_admin()
  group by p.id, p.name, p.phone
  order by 9 desc, p.name;
$$;

create function public.admin_totals_by_day(from_date date, to_date date)
returns table (
  work_date date, count int, credit int, cod int, extra int, cash int, total int
)
language sql stable security definer set search_path = public as $$
  select e.work_date,
    sum(e.count)::int, sum(e.credit)::int, sum(e.cod)::int,
    sum(e.extra)::int, sum(e.cash)::int,
    sum(e.credit + e.cod + e.extra + e.cash)::int
  from public.entries e
  where public.is_admin() and e.work_date between from_date and to_date
  group by e.work_date order by e.work_date;
$$;

create function public.team_totals_by_user(from_date date, to_date date)
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
    coalesce(sum(e.credit + e.cod + e.extra + e.cash), 0)::int,
    count(distinct e.work_date)::int
  from public.profiles p
  left join public.entries e
    on e.user_id = p.id and e.work_date between from_date and to_date
  where auth.uid() is not null and p.active
  group by p.id, p.name, p.vehicle_type
  order by 9 desc, p.name;
$$;

create function public.team_totals_by_day(from_date date, to_date date)
returns table (
  work_date date, count int, credit int, cod int, extra int, cash int, total int
)
language sql stable security definer set search_path = public as $$
  select e.work_date,
    sum(e.count)::int, sum(e.credit)::int, sum(e.cod)::int,
    sum(e.extra)::int, sum(e.cash)::int,
    sum(e.credit + e.cod + e.extra + e.cash)::int
  from public.entries e
  join public.profiles p on p.id = e.user_id and p.active
  where auth.uid() is not null and e.work_date between from_date and to_date
  group by e.work_date order by e.work_date;
$$;

create function public.team_daily_by_user(
  target uuid, from_date date, to_date date
)
returns table (
  work_date date, count int, credit int, cod int, extra int, cash int, total int
)
language sql stable security definer set search_path = public as $$
  select e.work_date,
    sum(e.count)::int, sum(e.credit)::int, sum(e.cod)::int,
    sum(e.extra)::int, sum(e.cash)::int,
    sum(e.credit + e.cod + e.extra + e.cash)::int
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

-- 신고 대상 체크는 관리자만 --------------------------------------
-- RLS 는 행 단위라 컬럼을 못 막습니다. 기사분이 본인 정산을 고칠 때
-- taxable 을 같이 보내도 원래 값으로 되돌립니다.
create or replace function public.protect_entry_taxable()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  new.taxable := old.taxable;
  return new;
end $$;

drop trigger if exists entries_protect_taxable on public.entries;
create trigger entries_protect_taxable
  before update on public.entries
  for each row execute function public.protect_entry_taxable();

notify pgrst, 'reload schema';
