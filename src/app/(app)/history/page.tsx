import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fillDailySeries, resolvePeriod } from "@/lib/period";
import { endOfWeek, prettyDate, startOfWeek, won } from "@/lib/format";
import { DEFAULT_LEVY_AMOUNT, levyDates, settleFromDaily } from "@/lib/settlement";
import type { DayTotals, Withdrawal } from "@/lib/types";
import { Badge, Card, CardHeader, Empty } from "@/components/ui";
import PeriodPicker from "@/components/PeriodPicker";
import SettlementCard from "@/components/SettlementCard";
import TotalsCard, { sumTotals } from "@/components/TotalsCard";
import { AmountChart, ChartLegend, CountChart } from "@/components/charts/SettlementChart";

export const metadata = { title: "내 내역 · BIG PICTURE" };

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const profile = await requireProfile();
  const { period: rawPeriod, from: rawFrom, to: rawTo } = await searchParams;
  const period = resolvePeriod(rawPeriod, rawFrom, rawTo);

  const supabase = await createClient();
  // 원본 entries 가 아니라 날짜별로 이미 합쳐진 뷰를 읽습니다.
  // (PostgREST 가 1000행까지만 주기 때문에 원본을 통째로 가져오면 합계가 틀어집니다)
  const [{ data }, { data: wdData }, { data: settings }] = await Promise.all([
    // 사납금은 "그 주에 일한 앞 N일"에 붙으므로, 기간이 주 중간에서 잘려도
    // 순번이 맞도록 주 단위로 넓혀서 읽습니다.
    supabase
      .from("v_daily_totals")
      .select("work_date, count, credit, cod, extra, total")
      .eq("user_id", profile.id)
      .gte("work_date", startOfWeek(period.from))
      .lte("work_date", endOfWeek(period.to))
      .order("work_date", { ascending: true }),
    supabase
      .from("withdrawals")
      .select("*")
      .eq("user_id", profile.id)
      .gte("work_date", period.from)
      .lte("work_date", period.to)
      .order("work_date", { ascending: false }),
    supabase.from("app_settings").select("levy_amount, levy_days_per_week").eq("id", 1).maybeSingle(),
  ]);

  const fullWeeks = (data ?? []) as DayTotals[];
  const daily = fullWeeks.filter(
    (d) => d.work_date >= period.from && d.work_date <= period.to,
  );
  const withdrawals = (wdData ?? []) as Withdrawal[];
  const levyRate = settings?.levy_amount ?? DEFAULT_LEVY_AMOUNT;
  const levyPerWeek = settings?.levy_days_per_week ?? 5;

  const series = fillDailySeries(daily, period.from, period.to);
  const totals = sumTotals(daily);
  const workedDays = series.filter((d) => d.total > 0 || d.count > 0);
  const withdrawn = withdrawals.reduce((a, w) => a + w.amount, 0);
  const settlement = settleFromDaily(
    series,
    levyRate,
    withdrawn,
    fullWeeks,
    levyPerWeek,
  );
  const charged = levyDates(fullWeeks, levyPerWeek);
  const avgPerDay = workedDays.length
    ? Math.round(totals.total / workedDays.length)
    : 0;

  return (
    <div className="space-y-4 rise">
      <h1 className="text-[20px] font-extrabold tracking-tight">내 정산 내역</h1>

      <PeriodPicker
        basePath="/history"
        current={period.key}
        from={period.from}
        to={period.to}
      />

      <SettlementCard
        label={`${period.label} 실수령`}
        s={settlement}
        levyRate={levyRate}
        levyDaysPerWeek={levyPerWeek}
      />

      <TotalsCard label={`${period.label} 매출 구성`} totals={totals} />

      <div className="grid grid-cols-2 gap-3">
        <MiniStat label="일한 날" value={`${workedDays.length}일`} />
        <MiniStat label="하루 평균" value={`${won(avgPerDay)}원`} />
      </div>

      {totals.count === 0 && totals.total === 0 ? (
        <Card>
          <Empty
            icon="📈"
            title="이 기간에는 기록이 없습니다"
            desc="다른 기간을 선택하거나 정산을 입력해 보세요."
          />
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader
              title="일별 정산액"
              desc="신용 · 착불 · 추가금을 쌓아서 보여줍니다"
              right={null}
            />
            <div className="px-3 pb-1">
              <div className="mb-2 px-1">
                <ChartLegend />
              </div>
              <AmountChart data={series} />
            </div>
          </Card>

          <Card>
            <CardHeader title="일별 건수" desc="하루에 몇 건 했는지" />
            <div className="px-3 pb-2">
              <CountChart data={series} />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="날짜별 상세" desc="날짜를 누르면 그날 입력으로 이동합니다" />
            <ul className="divide-y divide-ink/6">
              {[...workedDays].reverse().map((d) => (
                <li key={d.work_date}>
                  <Link
                    href={`/home?date=${d.work_date}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors active:bg-paper-2"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[14px] font-bold">
                        {prettyDate(d.work_date)}
                        {!charged.has(d.work_date) && (
                          <Badge tone="brand">사납금 면제</Badge>
                        )}
                      </p>
                      <p className="tnum mt-0.5 text-[12px] text-ink-4">
                        {d.count}건 · 신용 {won(d.credit)} · 착불 {won(d.cod)}
                        {d.extra > 0 && ` · 추가 ${won(d.extra)}`}
                      </p>
                    </div>
                    <span className="tnum shrink-0 text-[15px] font-extrabold">
                      {won(d.total)}
                      <span className="ml-0.5 text-[11px] font-semibold text-ink-4">
                        원
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          {withdrawals.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader
                title="출금 내역"
                desc={`${period.label} 합계 ${won(withdrawn)}원`}
              />
              <ul className="divide-y divide-ink/6">
                {withdrawals.map((w) => (
                  <li
                    key={w.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold">
                        {prettyDate(w.work_date)}
                      </p>
                      {w.memo && (
                        <p className="mt-0.5 truncate text-[12px] text-ink-4">
                          {w.memo}
                        </p>
                      )}
                    </div>
                    <span className="tnum shrink-0 text-[15px] font-extrabold">
                      {won(w.amount)}
                      <span className="ml-0.5 text-[11px] font-semibold text-ink-4">
                        원
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-[12px] font-semibold text-ink-4">{label}</p>
      <p className="tnum mt-0.5 text-[17px] font-extrabold">{value}</p>
    </Card>
  );
}
