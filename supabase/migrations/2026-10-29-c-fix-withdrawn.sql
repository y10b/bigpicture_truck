-- 고침: admin_totals_by_user 가 withdrawn 을 안 돌려줘서
-- 관리자 대시보드의 '출금 합계 / 아직 안 나간 돈' 이 NaN 으로 떴습니다.
-- cash·taxable_total 을 더하면서 기존 칸을 빠뜨린 것이 원인입니다.
drop function if exists public.admin_totals_by_user(date, date);

create function public.admin_totals_by_user(from_date date, to_date date)
returns table (
  user_id       uuid,
  name          text,
  phone         text,
  count         int,
  credit        int,
  cod           int,
  extra         int,
  cash          int,
  total         int,
  taxable_total int,
  days          int,
  withdrawn     int
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
    coalesce(e.cash, 0)::int,
    coalesce(e.total, 0)::int,
    coalesce(e.taxable_total, 0)::int,
    coalesce(e.days, 0)::int,
    coalesce(w.withdrawn, 0)::int
  from public.profiles p
  left join lateral (
    select
      sum(en.count)  as cnt,
      sum(en.credit) as credit,
      sum(en.cod)    as cod,
      sum(en.extra)  as extra,
      sum(en.cash)   as cash,
      sum(en.credit + en.cod + en.extra + en.cash) as total,
      sum((en.credit + en.cod + en.extra + en.cash)
          * case when en.taxable then 1 else 0 end) as taxable_total,
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
  order by coalesce(e.total, 0) desc, p.name;
$$;

grant execute on function public.admin_totals_by_user(date, date) to authenticated;

notify pgrst, 'reload schema';
