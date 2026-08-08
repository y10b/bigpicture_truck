import {
  addDays,
  dateRange,
  endOfMonth,
  endOfWeek,
  prettyDate,
  startOfMonth,
  startOfWeek,
  todayKST,
} from "@/lib/format";
import type { DayTotals } from "@/lib/types";
import type { PeriodKey } from "@/components/PeriodPicker";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const KEYS: PeriodKey[] = ["week", "prevWeek", "month", "prevMonth", "custom"];

/** 최대 조회 범위 — 그래프가 감당 못 할 만큼 넓어지는 걸 막습니다. */
const MAX_DAYS = 366;

export type ResolvedPeriod = {
  key: PeriodKey;
  from: string;
  to: string;
  label: string;
};

export function resolvePeriod(
  raw?: string,
  rawFrom?: string,
  rawTo?: string,
): ResolvedPeriod {
  const today = todayKST();
  const key = KEYS.includes(raw as PeriodKey) ? (raw as PeriodKey) : "7d";

  switch (key) {
    // 한 주는 월요일에 시작해 일요일에 끝납니다.
    case "prevWeek": {
      const lastWeekDay = addDays(startOfWeek(today), -1);
      return {
        key,
        from: startOfWeek(lastWeekDay),
        to: endOfWeek(lastWeekDay),
        label: "지난주",
      };
    }

    case "month":
      return { key, from: startOfMonth(today), to: today, label: "이번 달" };

    case "prevMonth": {
      const lastMonthDay = addDays(startOfMonth(today), -1);
      return {
        key,
        from: startOfMonth(lastMonthDay),
        to: endOfMonth(lastMonthDay),
        label: "지난 달",
      };
    }

    case "custom": {
      // 값이 이상하면 조용히 기본값(최근 7일)으로 되돌립니다.
      if (!DATE_RE.test(rawFrom ?? "") || !DATE_RE.test(rawTo ?? "")) break;

      let from = rawFrom!;
      let to = rawTo!;
      if (from > to) [from, to] = [to, from];
      if (to > today) to = today;
      if (from > today) from = today;
      if (dateRange(from, to).length > MAX_DAYS) from = addDays(to, -(MAX_DAYS - 1));

      return {
        key,
        from,
        to,
        label:
          from === to
            ? prettyDate(from)
            : `${prettyDate(from)} ~ ${prettyDate(to)}`,
      };
    }
  }

  // 기본값: 이번 주 (월요일 ~ 오늘)
  return { key: "week", from: startOfWeek(today), to: today, label: "이번 주" };
}

/**
 * 날짜별 집계 결과를 받아 기록이 없는 날을 0으로 채웁니다 (그래프가 끊기지 않게).
 *
 * ⚠️ 여기에 넘기는 값은 반드시 **DB에서 이미 날짜별로 합쳐진** 행이어야 합니다.
 *    PostgREST 는 한 번에 1000행까지만 돌려주기 때문에, 원본 entries 를 통째로
 *    가져와 앱에서 더하면 데이터가 늘었을 때 합계가 조용히 틀어집니다.
 *    (v_daily_totals 뷰 또는 admin_totals_by_day 함수를 쓰세요.)
 */
export function fillDailySeries(
  rows: Pick<DayTotals, "work_date" | "count" | "credit" | "cod" | "extra" | "total">[],
  from: string,
  to: string,
): DayTotals[] {
  const byDate = new Map<string, DayTotals>();
  for (const d of dateRange(from, to)) {
    byDate.set(d, { work_date: d, count: 0, credit: 0, cod: 0, extra: 0, total: 0 });
  }
  for (const r of rows) {
    const row = byDate.get(r.work_date);
    if (!row) continue;
    row.count += r.count;
    row.credit += r.credit;
    row.cod += r.cod;
    row.extra += r.extra;
    row.total += r.total;
  }
  return [...byDate.values()];
}
