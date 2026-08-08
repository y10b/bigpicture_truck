import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  endOfWeek,
  prettyDate,
  startOfWeek,
  todayKST,
  won,
} from "@/lib/format";
import {
  DEFAULT_WEEKDAY_LEVY,
  isLevyDay,
  settleFromDaily,
} from "@/lib/settlement";
import type { DayTotals, Entry, Withdrawal } from "@/lib/types";
import DateNav from "@/components/DateNav";
import TotalsCard, { sumTotals } from "@/components/TotalsCard";
import { Card } from "@/components/ui";
import EntryComposer from "./EntryComposer";
import EntryList from "./EntryList";
import WithdrawalPanel from "./WithdrawalPanel";

export const metadata = { title: "정산 입력 · BIG PICTURE" };

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const profile = await requireProfile();
  const { date } = await searchParams;

  const today = todayKST();
  const workDate = /^\d{4}-\d{2}-\d{2}$/.test(date ?? "") ? date! : today;
  const weekFrom = startOfWeek(workDate);
  const weekTo = endOfWeek(workDate);

  const supabase = await createClient();
  const [
    { data: entryData },
    { data: weekDaily },
    { data: weekWithdrawals },
    { data: settings },
  ] = await Promise.all([
    supabase
      .from("entries")
      .select("*")
      .eq("user_id", profile.id)
      .eq("work_date", workDate)
      .order("created_at", { ascending: false })
      .limit(300),
    // 이번 주(월~일) 실수령을 계산하려면 주 단위 집계가 필요합니다.
    supabase
      .from("v_daily_totals")
      .select("work_date, count, credit, cod, extra, total")
      .eq("user_id", profile.id)
      .gte("work_date", weekFrom)
      .lte("work_date", weekTo),
    supabase
      .from("withdrawals")
      .select("*")
      .eq("user_id", profile.id)
      .gte("work_date", weekFrom)
      .lte("work_date", weekTo)
      .order("created_at", { ascending: false }),
    supabase.from("app_settings").select("weekday_levy").eq("id", 1).maybeSingle(),
  ]);

  const entries = (entryData ?? []) as Entry[];
  const totals = sumTotals(entries);
  const levyRate = settings?.weekday_levy ?? DEFAULT_WEEKDAY_LEVY;

  const weekSeries = (weekDaily ?? []) as DayTotals[];
  const allWithdrawals = (weekWithdrawals ?? []) as Withdrawal[];
  const weekWithdrawn = allWithdrawals.reduce((a, w) => a + w.amount, 0);
  const week = settleFromDaily(weekSeries, levyRate, weekWithdrawn);

  // 그날 상납금 — 평일이고 실제로 일한 날에만 붙습니다.
  const worked = totals.count > 0 || totals.total > 0;
  const dayLevy = worked && isLevyDay(workDate) ? levyRate : 0;

  // 이번 주에 일한 날 중 가장 마지막 날이면 출금할 때가 된 겁니다.
  const workedDates = weekSeries
    .filter((d) => d.count > 0 || d.total > 0)
    .map((d) => d.work_date)
    .sort();
  const isLastWorkdayOfWeek =
    workedDates.length > 0 && workedDates[workedDates.length - 1] === workDate;

  return (
    <div className="space-y-4 rise">
      <div>
        <h1 className="mb-3 text-[20px] font-extrabold tracking-tight">
          {profile.name}님, 오늘도 안전운행 하세요
        </h1>
        <DateNav date={workDate} />
      </div>

      <TotalsCard label={`${prettyDate(workDate)} 정산`} totals={totals} />

      {/* 그날 상납금 · 실수령 */}
      {worked && (
        <Card className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-ink-4">
              {dayLevy > 0 ? "오늘 상납금" : "주말이라 상납금 없음"}
            </p>
            <p className="tnum mt-0.5 text-[14px] font-bold text-ink-3">
              {dayLevy > 0 ? `−${won(dayLevy)}원` : "면제"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[12px] font-semibold text-ink-4">이 날 실수령</p>
            <p className="tnum mt-0.5 text-[17px] font-extrabold text-brand-600">
              {won(totals.total - dayLevy)}
              <span className="ml-0.5 text-[11px] font-semibold text-ink-4">원</span>
            </p>
          </div>
        </Card>
      )}

      <EntryComposer workDate={workDate} />

      <section>
        <h2 className="mb-2 px-1 text-[14px] font-bold text-ink-2">
          입력한 내역{" "}
          <span className="tnum font-semibold text-ink-4">{entries.length}</span>
        </h2>
        <EntryList entries={entries} />
      </section>

      <WithdrawalPanel
        workDate={workDate}
        withdrawals={allWithdrawals.filter((w) => w.work_date === workDate)}
        remaining={week.remaining}
        isLastWorkdayOfWeek={isLastWorkdayOfWeek}
      />
    </div>
  );
}
