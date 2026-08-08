import type { DayTotals } from "@/lib/types";

/** 상납금 기본 단가. 실제 값은 app_settings.weekday_levy 에서 읽습니다. */
export const DEFAULT_WEEKDAY_LEVY = 100_000;

/**
 * 상납금은 **평일(월~금) 근무일에만** 붙습니다. 토·일 근무는 면제입니다.
 */
export function isLevyDay(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0=일 … 6=토
  return day >= 1 && day <= 5;
}

/** 그날 실제로 일했는지 (건수든 금액이든 하나라도 있으면 근무로 봅니다) */
export function isWorked(d: Pick<DayTotals, "count" | "total">) {
  return d.count > 0 || d.total > 0;
}

export type Settlement = {
  /** 매출 합계 (신용+착불+추가금) */
  total: number;
  /** 근무일수 */
  workedDays: number;
  /** 그중 상납금이 붙는 평일 근무일수 */
  levyDays: number;
  /** 상납금 = levyDays × 단가 */
  levy: number;
  /** 실수령 = 매출 - 상납금 */
  net: number;
  /** 기간 내 출금 합계 */
  withdrawn: number;
  /** 아직 안 찾아간 금액 = 실수령 - 출금 */
  remaining: number;
};

/** 날짜별 집계에서 상납금·실수령을 계산합니다. */
export function settleFromDaily(
  daily: DayTotals[],
  weekdayLevy: number,
  withdrawn = 0,
): Settlement {
  const worked = daily.filter(isWorked);
  const levyDays = worked.filter((d) => isLevyDay(d.work_date)).length;
  const total = worked.reduce((a, d) => a + d.total, 0);
  const levy = levyDays * weekdayLevy;

  return {
    total,
    workedDays: worked.length,
    levyDays,
    levy,
    net: total - levy,
    withdrawn,
    remaining: total - levy - withdrawn,
  };
}

/** 관리자 집계 함수(admin_totals_by_user)의 결과에서 계산합니다. */
export function settleFromUserTotals(
  row: { total: number; days: number; weekday_days: number; withdrawn: number },
  weekdayLevy: number,
): Settlement {
  const levy = row.weekday_days * weekdayLevy;
  return {
    total: row.total,
    workedDays: row.days,
    levyDays: row.weekday_days,
    levy,
    net: row.total - levy,
    withdrawn: row.withdrawn,
    remaining: row.total - levy - row.withdrawn,
  };
}
