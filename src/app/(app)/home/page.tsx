import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { endOfWeek, prettyDate, startOfWeek, todayKST, won } from "@/lib/format";
import { settleFromDaily } from "@/lib/settlement";
import type { DayTotals, Entry, EntryLog, Withdrawal } from "@/lib/types";
import type { Coach } from "../ai-actions";
import DateNav from "@/components/DateNav";
import TotalsCard, { sumTotals } from "@/components/TotalsCard";
import { Card } from "@/components/ui";
import Reminders from "@/components/Reminders";
import AiPanel from "./AiPanel";
import EntryComposer from "./EntryComposer";
import EntryList from "./EntryList";

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
    { data: aiRows },
    { data: logRows },
    { data: peopleRows },
    { data: distRow },
  ] = await Promise.all([
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
      // 이미 만들어 둔 AI 결과가 있으면 바로 보여줍니다 (없으면 버튼만).
      // 위 조회들과 함께 보내야 왕복이 한 번으로 끝납니다.
      supabase
        .from("ai_reports")
        .select("kind, content")
        .eq("user_id", profile.id)
        .eq("report_date", workDate),
      // 이 날 내역의 수정 이력 (누가 언제 무엇을 고쳤는지)
      supabase
        .from("entry_logs")
        .select("*")
        .eq("owner_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(100),
      // 고친 사람 이름 (관리자가 고쳤을 수 있으므로 이름표가 필요합니다)
      supabase.from("profiles").select("id, name"),
      // 오늘 주행거리 (앱이 위치를 보낸 만큼만 쌓입니다)
      supabase
        .from("daily_distance")
        .select("meters")
        .eq("user_id", profile.id)
        .eq("work_date", workDate)
        .maybeSingle(),
    ]);

  const cachedCoach =
    (aiRows?.find((r) => r.kind === "coach")?.content as Coach | undefined) ?? null;

  const entries = (entryData ?? []) as Entry[];
  const meters = (distRow as { meters?: number } | null)?.meters ?? 0;
  const entryIds = new Set(entries.map((e) => e.id));
  const logs = ((logRows ?? []) as EntryLog[]).filter(
    (l) => l.entry_id && entryIds.has(l.entry_id),
  );
  const editorNames = Object.fromEntries(
    ((peopleRows ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]),
  );
  // 직원은 오늘 적은 것만 고칠 수 있습니다. 관리자는 제한 없이.
  const isAdmin = profile.role === "admin";
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

  // 오늘 마감을 했는지 / 출금을 남겨야 하는지 — 알림 예약에 씁니다.
  const settledToday = workDate === today && entries.length > 0;
  const needsWithdrawal = isLastWorkdayOfWeek && weekWithdrawn === 0;

  return (
    <div className="space-y-4 rise">
      <Reminders
        settledToday={settledToday}
        needsWithdrawal={needsWithdrawal}
      />
      <div>
        <h1 className="mb-3 text-[20px] font-extrabold tracking-tight">
          {profile.name}님, 오늘도 안전운행 하세요
        </h1>
        <DateNav date={workDate} />
      </div>

      <TotalsCard label={`${prettyDate(workDate)} 정산`} totals={totals} />

      {meters > 0 && (
        <Card className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[12px] font-semibold text-ink-4">오늘 주행거리</p>
            <p className="tnum mt-0.5 text-[17px] font-extrabold">
              {Math.round(meters / 100) / 10}
              <span className="ml-0.5 text-[12px] font-semibold text-ink-4">km</span>
            </p>
          </div>
          {totals.total > 0 && meters > 1000 && (
            <div className="text-right">
              <p className="text-[12px] font-semibold text-ink-4">1km당</p>
              <p className="tnum mt-0.5 text-[17px] font-extrabold text-brand-600">
                {won(Math.round(totals.total / (meters / 1000)))}
                <span className="ml-0.5 text-[11px] font-semibold text-ink-4">원</span>
              </p>
            </div>
          )}
        </Card>
      )}

      <EntryComposer
        workDate={workDate}
        withdrawals={allWithdrawals}
        weekTotal={week.total}
        weekWithdrawn={week.withdrawn}
        remaining={week.remaining}
        isLastWorkdayOfWeek={isLastWorkdayOfWeek}
      />

      <section>
        <h2 className="mb-2 px-1 text-[14px] font-bold text-ink-2">
          입력한 내역{" "}
          <span className="tnum font-semibold text-ink-4">{entries.length}</span>

        </h2>
        <EntryList
          entries={entries}
          logs={logs}
          isAdmin={isAdmin}
          editorNames={editorNames}
        />
      </section>

      <AiPanel isToday={workDate === today} initialCoach={cachedCoach} />
    </div>
  );
}
