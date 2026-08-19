import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fillDailySeries, resolvePeriod } from "@/lib/period";
import { won } from "@/lib/format";
import type { DayTotals } from "@/lib/types";
import { Badge, Card, CardHeader, Empty } from "@/components/ui";
import PeriodPicker from "@/components/PeriodPicker";
import TotalsCard, { sumTotals } from "@/components/TotalsCard";
import { AmountChart, ChartLegend, CountChart } from "@/components/charts/SettlementChart";

export const metadata = { title: "팀 내역 · BIG PICTURE" };

type TeamRow = {
  user_id: string;
  name: string;
  vehicle_type: string | null;
  total: number;
  count: number;
  days: number;
};

export default async function TeamMemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const me = await requireProfile();
  const { id } = await params;
  const { period: rawPeriod, from: rawFrom, to: rawTo } = await searchParams;
  const period = resolvePeriod(rawPeriod, rawFrom, rawTo);
  const query = `?period=${period.key}&from=${period.from}&to=${period.to}`;

  const supabase = await createClient();
  const [{ data: dailyData }, { data: userData }] = await Promise.all([
    supabase.rpc("team_daily_by_user", {
      target: id,
      from_date: period.from,
      to_date: period.to,
    }),
    // 이름·차종은 사람별 합계 함수에서 같이 옵니다
    supabase.rpc("team_totals_by_user", {
      from_date: period.from,
      to_date: period.to,
    }),
  ]);

  const who = ((userData ?? []) as TeamRow[]).find((r) => r.user_id === id);
  if (!who) notFound();

  const daily = (dailyData ?? []) as DayTotals[];
  const series = fillDailySeries(daily, period.from, period.to);
  const totals = sumTotals(daily);
  const workedDays = daily.filter((d) => d.total > 0 || d.count > 0).length;
  const avgPerDay = workedDays ? Math.round(totals.total / workedDays) : 0;

  return (
    <div className="space-y-4 rise">
      <Link
        href={`/history/team${query}`}
        className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-4"
      >
        ← 팀 내역
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-[20px] font-extrabold tracking-tight">
          {who.name}
        </h1>
        {who.user_id === me.id && <Badge tone="brand">나</Badge>}
        {who.vehicle_type && <Badge tone="neutral">{who.vehicle_type}</Badge>}
      </div>

      <PeriodPicker
        basePath={`/history/team/${id}`}
        current={period.key}
        from={period.from}
        to={period.to}
      />

      <Card className="overflow-hidden">
        <div className="bg-ink px-4 py-3.5 text-paper">
          <div className="flex items-baseline justify-between">
            <p className="text-[12px] font-semibold text-paper/60">
              {period.label} 매출
            </p>
            <p className="tnum text-[12px] font-semibold text-paper/60">
              총 <span className="text-accent">{totals.count}</span>건
            </p>
          </div>
          <p className="tnum mt-1 text-[26px] leading-none font-extrabold">
            {won(totals.total)}
            <span className="ml-1 text-[13px] font-semibold text-paper/70">
              원
            </span>
          </p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-ink/8">
          <Stat label="일한 날" value={`${workedDays}일`} />
          <Stat label="하루 평균" value={`${won(avgPerDay)}원`} />
        </div>
      </Card>

      {totals.count === 0 && totals.total === 0 ? (
        <Card>
          <Empty icon="📈" title="이 기간에는 기록이 없습니다" />
        </Card>
      ) : (
        <>
          <TotalsCard label={`${period.label} 구성`} totals={totals} />

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
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[11px] font-semibold text-ink-4">{label}</p>
      <p className="tnum mt-0.5 text-[15px] font-extrabold">{value}</p>
    </div>
  );
}
