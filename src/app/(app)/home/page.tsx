import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { endOfWeek, prettyDate, startOfWeek, todayKST } from "@/lib/format";
import { settleFromDaily } from "@/lib/settlement";
import type { DayTotals, Entry, Withdrawal } from "@/lib/types";
import type { Coach, DailyReport } from "../ai-actions";
import DateNav from "@/components/DateNav";
import TotalsCard, { sumTotals } from "@/components/TotalsCard";
import AiPanel from "./AiPanel";
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
  const [{ data: entryData }, { data: weekDaily }, { data: weekWithdrawals }] =
    await Promise.all([
      supabase
        .from("entries")
        .select("*")
        .eq("user_id", profile.id)
        .eq("work_date", workDate)
        .order("created_at", { ascending: false })
        .limit(300),
      // 이번 주(월~일) 출금 잔액을 계산하려면 주 단위 집계가 필요합니다.
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
    ]);

  // 이미 만들어 둔 AI 결과가 있으면 바로 보여줍니다 (없으면 버튼만).
  const { data: aiRows } = await supabase
    .from("ai_reports")
    .select("kind, content")
    .eq("user_id", profile.id)
    .eq("report_date", workDate);

  const cachedCoach =
    (aiRows?.find((r) => r.kind === "coach")?.content as Coach | undefined) ?? null;
  const cachedReport =
    (aiRows?.find((r) => r.kind === "daily")?.content as DailyReport | undefined) ??
    null;

  const entries = (entryData ?? []) as Entry[];
  const totals = sumTotals(entries);
  const weekSeries = (weekDaily ?? []) as DayTotals[];
  const allWithdrawals = (weekWithdrawals ?? []) as Withdrawal[];
  const weekWithdrawn = allWithdrawals.reduce((a, w) => a + w.amount, 0);
  const week = settleFromDaily(weekSeries, weekWithdrawn);

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

      <EntryComposer workDate={workDate} />

      <section>
        <h2 className="mb-2 px-1 text-[14px] font-bold text-ink-2">
          입력한 내역{" "}
          <span className="tnum font-semibold text-ink-4">{entries.length}</span>
        </h2>
        <EntryList entries={entries} />
      </section>

      <AiPanel
        workDate={workDate}
        isToday={workDate === today}
        hasEntries={entries.length > 0}
        initialCoach={cachedCoach}
        initialReport={cachedReport}
      />

      <WithdrawalPanel
        workDate={workDate}
        withdrawals={allWithdrawals.filter((w) => w.work_date === workDate)}
        remaining={week.remaining}
        isLastWorkdayOfWeek={isLastWorkdayOfWeek}
      />
    </div>
  );
}
