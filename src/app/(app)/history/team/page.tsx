import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fillDailySeries, resolvePeriod } from "@/lib/period";
import { won } from "@/lib/format";
import type { DayTotals } from "@/lib/types";
import { Badge, Card, CardHeader, Empty, cn } from "@/components/ui";
import PeriodPicker from "@/components/PeriodPicker";
import TotalsCard, { sumTotals } from "@/components/TotalsCard";
import { AmountChart, ChartLegend } from "@/components/charts/SettlementChart";
import HistoryTabs from "../HistoryTabs";

export const metadata = { title: "팀 내역 · BIG PICTURE" };

type TeamRow = {
  user_id: string;
  name: string;
  vehicle_type: string | null;
  count: number;
  credit: number;
  cod: number;
  extra: number;
  total: number;
  days: number;
};

export default async function TeamHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const me = await requireProfile();
  const { period: rawPeriod, from: rawFrom, to: rawTo } = await searchParams;
  const period = resolvePeriod(rawPeriod, rawFrom, rawTo);
  const query = `?period=${period.key}&from=${period.from}&to=${period.to}`;

  const supabase = await createClient();
  // 합계는 전부 DB 함수에서 만들어 옵니다.
  // 원본 entries 는 여전히 본인 것만 읽히고, 1000행 제한에도 걸리지 않습니다.
  const [{ data: userData }, { data: dayData }] = await Promise.all([
    supabase.rpc("team_totals_by_user", {
      from_date: period.from,
      to_date: period.to,
    }),
    supabase.rpc("team_totals_by_day", {
      from_date: period.from,
      to_date: period.to,
    }),
  ]);

  const rows = ((userData ?? []) as TeamRow[]).filter(
    (r) => r.total > 0 || r.count > 0,
  );
  const series = fillDailySeries(
    (dayData ?? []) as DayTotals[],
    period.from,
    period.to,
  );
  const totals = sumTotals(rows);
  const topTotal = rows[0]?.total ?? 0;

  return (
    <div className="space-y-4 rise">
      <h1 className="text-[20px] font-extrabold tracking-tight">내 정산 내역</h1>

      <HistoryTabs active="team" query={query} />

      <PeriodPicker
        basePath="/history/team"
        current={period.key}
        from={period.from}
        to={period.to}
      />

      <Card className="overflow-hidden">
        <div className="bg-ink px-4 py-3.5 text-paper">
          <div className="flex items-baseline justify-between">
            <p className="text-[12px] font-semibold text-paper/60">
              {period.label} 팀 전체 매출
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
      </Card>

      {rows.length === 0 ? (
        <Card>
          <Empty
            icon="👥"
            title="이 기간에는 기록이 없습니다"
            desc="다른 기간을 선택해 보세요."
          />
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <CardHeader
              title="사람별 매출"
              desc="많이 한 순서입니다. 누르면 하루하루 볼 수 있습니다"
            />
            <ul className="divide-y divide-ink/6">
              {rows.map((r, i) => {
                const isMe = r.user_id === me.id;
                const share = topTotal > 0 ? (r.total / topTotal) * 100 : 0;
                return (
                  <li key={r.user_id}>
                    <Link
                      href={`/history/team/${r.user_id}${query}`}
                      className={cn(
                        "block px-4 py-3 transition-colors active:bg-paper-2",
                        isMe && "bg-brand-50/60",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "tnum w-5 shrink-0 text-[13px] font-extrabold",
                            i === 0 ? "text-brand-600" : "text-ink-4",
                          )}
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[14px] font-extrabold">
                              {r.name}
                            </span>
                            {isMe && <Badge tone="brand">나</Badge>}
                            {r.vehicle_type && (
                              <Badge tone="neutral">{r.vehicle_type}</Badge>
                            )}
                          </div>
                          <p className="tnum mt-0.5 text-[12px] text-ink-4">
                            {r.days}일 · {r.count}건
                            {r.count > 0 &&
                              ` · 건당 ${won(Math.round(r.total / r.count))}원`}
                          </p>
                        </div>
                        <p className="tnum shrink-0 text-[15px] font-extrabold">
                          {won(r.total)}
                          <span className="ml-0.5 text-[11px] font-semibold text-ink-4">
                            원
                          </span>
                        </p>
                      </div>
                      {/* 1등 대비 막대 — 숫자만 보면 차이가 잘 안 잡힙니다 */}
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink/6">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            isMe ? "bg-brand-500" : "bg-ink/25",
                          )}
                          style={{ width: `${share}%` }}
                        />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>

          <TotalsCard label={`${period.label} 팀 구성`} totals={totals} />

          <Card>
            <CardHeader
              title="날짜별 팀 매출"
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
        </>
      )}
    </div>
  );
}
