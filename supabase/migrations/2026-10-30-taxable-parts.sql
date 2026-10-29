-- 엑셀에서 개인 거래·추가금을 빼고 뽑을 수 있게 하면서,
-- '신고 대상' 합계도 같은 기준으로 맞춰야 합니다.
-- 그러려면 신고 대상 금액을 항목별로 나눠 줘야 합니다.
drop view if exists public.v_daily_totals;
create view public.v_daily_totals
with (security_invoker = true) as
select
  e.user_id,
  e.work_date,
  sum(e.count)::int                              as count,
  sum(e.credit)::int                             as credit,
  sum(e.cod)::int                                as cod,
  sum(e.extra)::int                              as extra,
  sum(e.cash)::int                               as cash,
  sum(e.credit + e.cod + e.extra + e.cash)::int  as total,
  -- 관리자가 신고 대상으로 체크해 둔 금액을 항목별로
  sum(e.credit * case when e.taxable then 1 else 0 end)::int as taxable_credit,
  sum(e.cod    * case when e.taxable then 1 else 0 end)::int as taxable_cod,
  sum(e.extra  * case when e.taxable then 1 else 0 end)::int as taxable_extra,
  sum(e.cash   * case when e.taxable then 1 else 0 end)::int as taxable_cash,
  sum((e.credit + e.cod + e.extra + e.cash)
      * case when e.taxable then 1 else 0 end)::int          as taxable_total
from public.entries e
group by e.user_id, e.work_date;

notify pgrst, 'reload schema';
