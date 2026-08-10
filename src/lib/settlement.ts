import type { DayTotals } from "@/lib/types";

/** 그날 실제로 일했는지 (건수든 금액이든 하나라도 있으면 근무로 봅니다) */
export function isWorked(d: Pick<DayTotals, "count" | "total">) {
  return d.count > 0 || d.total > 0;
}

export type Settlement = {
  /** 매출 합계 (신용+착불+추가금) */
  total: number;
  /** 근무일수 */
  workedDays: number;
  /** 기간 내 출금 합계 */
  withdrawn: number;
  /** 아직 안 찾아간 금액 = 매출 - 출금 */
  remaining: number;
};

/** 날짜별 집계에서 정산 요약을 만듭니다. */
export function settleFromDaily(
  daily: DayTotals[],
  withdrawn = 0,
): Settlement {
  const worked = daily.filter(isWorked);
  const total = worked.reduce((a, d) => a + d.total, 0);

  return {
    total,
    workedDays: worked.length,
    withdrawn,
    remaining: total - withdrawn,
  };
}

/** 관리자 집계 함수(admin_totals_by_user)의 결과에서 만듭니다. */
export function settleFromUserTotals(row: {
  total: number;
  days: number;
  withdrawn: number;
}): Settlement {
  return {
    total: row.total,
    workedDays: row.days,
    withdrawn: row.withdrawn,
    remaining: row.total - row.withdrawn,
  };
}
