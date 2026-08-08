import { startOfWeek } from "@/lib/format";
import type { DayTotals } from "@/lib/types";

/** 사납금 기본 단가. 실제 값은 app_settings.levy_amount 에서 읽습니다. */
export const DEFAULT_LEVY_AMOUNT = 100_000;

/** 한 주에 사납금이 붙는 최대 근무일수. app_settings.levy_days_per_week. */
export const DEFAULT_LEVY_DAYS_PER_WEEK = 5;

/** 그날 실제로 일했는지 (건수든 금액이든 하나라도 있으면 근무로 봅니다) */
export function isWorked(d: Pick<DayTotals, "count" | "total">) {
  return d.count > 0 || d.total > 0;
}

/**
 * 사납금이 붙는 날짜를 가려냅니다.
 *
 * 규칙: 주 5일까지는 사납금을 냅니다. 평일이냐 주말이냐는 상관없습니다.
 *   - 월~금 5일 다 나오고 토요일에 더 나오면 → 그 토요일은 면제
 *   - 평일 하루 쉬고 토요일에 대신 나오면   → 그 토요일은 사납금 있음
 * 그래서 "그 주에 일한 날을 날짜순으로 세어 앞 5일"에만 붙입니다.
 *
 * ⚠️ daily 에는 **해당 주 전체**가 들어 있어야 정확합니다.
 *    기간을 수요일부터 잘라서 넘기면 앞 5일 계산이 틀어집니다.
 */
export function levyDates(
  daily: Pick<DayTotals, "work_date" | "count" | "total">[],
  daysPerWeek = DEFAULT_LEVY_DAYS_PER_WEEK,
): Set<string> {
  const byWeek = new Map<string, string[]>();

  for (const d of daily) {
    if (!isWorked(d)) continue;
    const week = startOfWeek(d.work_date);
    const list = byWeek.get(week);
    if (list) list.push(d.work_date);
    else byWeek.set(week, [d.work_date]);
  }

  const out = new Set<string>();
  for (const dates of byWeek.values()) {
    dates.sort();
    for (const date of dates.slice(0, daysPerWeek)) out.add(date);
  }
  return out;
}

export type Settlement = {
  /** 매출 합계 (신용+착불+추가금) */
  total: number;
  /** 근무일수 */
  workedDays: number;
  /** 그중 사납금이 붙는 날 수 */
  levyDays: number;
  /** 사납금이 면제된 날 수 (주 5일을 채우고 더 나온 날) */
  freeDays: number;
  /** 사납금 = levyDays × 단가 */
  levy: number;
  /** 실수령 = 매출 - 사납금 */
  net: number;
  /** 기간 내 출금 합계 */
  withdrawn: number;
  /** 아직 안 찾아간 금액 = 실수령 - 출금 */
  remaining: number;
};

/**
 * 날짜별 집계에서 사납금·실수령을 계산합니다.
 *
 * @param inPeriod   화면에 보여줄 기간의 날짜별 집계
 * @param fullWeeks  그 기간이 걸친 **주 전체**의 날짜별 집계 (사납금 판정용).
 *                   생략하면 inPeriod 를 그대로 씁니다.
 */
export function settleFromDaily(
  inPeriod: DayTotals[],
  levyAmount: number,
  withdrawn = 0,
  fullWeeks?: DayTotals[],
  daysPerWeek = DEFAULT_LEVY_DAYS_PER_WEEK,
): Settlement {
  const charged = levyDates(fullWeeks ?? inPeriod, daysPerWeek);

  const worked = inPeriod.filter(isWorked);
  const levyDays = worked.filter((d) => charged.has(d.work_date)).length;
  const total = worked.reduce((a, d) => a + d.total, 0);
  const levy = levyDays * levyAmount;

  return {
    total,
    workedDays: worked.length,
    levyDays,
    freeDays: worked.length - levyDays,
    levy,
    net: total - levy,
    withdrawn,
    remaining: total - levy - withdrawn,
  };
}

/** 관리자 집계 함수(admin_totals_by_user)의 결과에서 계산합니다. */
export function settleFromUserTotals(
  row: { total: number; days: number; levy_days: number; withdrawn: number },
  levyAmount: number,
): Settlement {
  const levy = row.levy_days * levyAmount;
  return {
    total: row.total,
    workedDays: row.days,
    levyDays: row.levy_days,
    freeDays: row.days - row.levy_days,
    levy,
    net: row.total - levy,
    withdrawn: row.withdrawn,
    remaining: row.total - levy - row.withdrawn,
  };
}
