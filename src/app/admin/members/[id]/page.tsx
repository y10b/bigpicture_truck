import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fillDailySeries, resolvePeriod } from "@/lib/period";
import { endOfWeek, prettyDate, prettyPhone, startOfWeek, won } from "@/lib/format";
import { settleFromDaily } from "@/lib/settlement";
import type { DayTotals, Entry, Profile, Withdrawal } from "@/lib/types";
import { Badge, Card, CardHeader, Empty } from "@/components/ui";
import PeriodPicker from "@/components/PeriodPicker";
import SettlementCard from "@/components/SettlementCard";
import TotalsCard, { sumTotals } from "@/components/TotalsCard";
import { AmountChart, ChartLegend, CountChart } from "@/components/charts/SettlementChart";

export default async function MemberDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { period: rawPeriod, from: rawFrom, to: rawTo } = await searchParams;
  const period = resolvePeriod(rawPeriod, rawFrom, rawTo);

  const supabase = await createClient();
  const [
    { data: profileData },
    { data: dailyData },
    { data: entryData },
    { data: wdData },
  ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
      // 합계·그래프는 날짜별로 합쳐진 뷰에서 (1000행 제한을 타지 않게)
      // 사납금 순번이 맞도록 주 단위로 넓혀 읽고, 표시할 때 기간으로 자릅니다.
      supabase
        .from("v_daily_totals")
        .select("work_date, count, credit, cod, extra, total")
        .eq("user_id", id)
        .gte("work_date", startOfWeek(period.from))
        .lte("work_date", endOfWeek(period.to))
        .order("work_date", { ascending: true }),
      // 입력 원본은 최근 것만 보여주면 충분합니다
      supabase
        .from("entries")
        .select("*")
        .eq("user_id", id)
        .gte("work_date", period.from)
        .lte("work_date", period.to)
        .order("work_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("withdrawals")
        .select("*")
        .eq("user_id", id)
        .gte("work_date", period.from)
        .lte("work_date", period.to)
        .order("work_date", { ascending: false }),
    ]);

  if (!profileData) notFound();
  const profile = profileData as Profile;
  const fullWeeks = (dailyData ?? []) as DayTotals[];
  const daily = fullWeeks.filter(
    (d) => d.work_date >= period.from && d.work_date <= period.to,
  );
  const entries = (entryData ?? []) as Entry[];
  const withdrawals = (wdData ?? []) as Withdrawal[];
  const series = fillDailySeries(daily, period.from, period.to);
  const totals = sumTotals(daily);
  const workedDays = series.filter((d) => d.total > 0 || d.count > 0);
  const withdrawn = withdrawals.reduce((a, w) => a + w.amount, 0);
  const settlement = settleFromDaily(series, withdrawn);

  return (
    <div className="space-y-4 rise">
      <Link
        href="/admin/members"
        className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-3"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
        직원 관리
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 text-[15px] font-extrabold text-white">
          {profile.name.slice(-2)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="text-[19px] font-extrabold tracking-tight">{profile.name}</h1>
            {profile.role === "admin" && <Badge tone="brand">관리자</Badge>}
            {!profile.active && <Badge tone="danger">비활성</Badge>}
          </div>
          <p className="tnum text-[13px] text-ink-3">{prettyPhone(profile.phone)}</p>
        </div>
      </div>

      <PeriodPicker
        basePath={`/admin/members/${id}`}
        current={period.key}
        from={period.from}
        to={period.to}
      />

      <SettlementCard label={`${period.label} 매출`} s={settlement} />

      <TotalsCard label={`${period.label} 구성`} totals={totals} />

      {totals.count === 0 && totals.total === 0 ? (
        <Card>
          <Empty icon="📊" title="이 기간에는 기록이 없습니다" />
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader title="일별 정산액" />
            <div className="px-3 pb-1">
              <div className="mb-2 px-1">
                <ChartLegend />
              </div>
              <AmountChart data={series} />
            </div>
          </Card>

          <Card>
            <CardHeader title="일별 건수" />
            <div className="px-3 pb-2">
              <CountChart data={series} />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="날짜별 상세" desc={`일한 날 ${workedDays.length}일`} />
            <ul className="divide-y divide-ink/6">
              {[...workedDays].reverse().map((d) => (
                <li key={d.work_date} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[14px] font-bold">{prettyDate(d.work_date)}</p>
                    <span className="tnum shrink-0 text-[15px] font-extrabold">
                      {won(d.total)}
                      <span className="ml-0.5 text-[11px] font-semibold text-ink-4">원</span>
                    </span>
                  </div>
                  <p className="tnum mt-0.5 text-[12px] text-ink-4">
                    {d.count}건 · 신용 {won(d.credit)} · 착불 {won(d.cod)}
                    {d.extra > 0 && ` · 추가 ${won(d.extra)}`}
                  </p>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="출금 내역"
              desc={
                withdrawals.length
                  ? `${period.label} 합계 ${won(withdrawn)}원`
                  : "이 기간에 출금 기록이 없습니다"
              }
            />
            {withdrawals.length > 0 && (
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
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="입력 원본" desc="직원이 실제로 적은 내용 (최근 100건)" />
            <ul className="divide-y divide-ink/6">
              {entries.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold">
                      {prettyDate(e.work_date)}{" "}
                      <span className="font-semibold text-ink-4">
                        {e.mode === "bulk" ? `일괄 ${e.count}건` : e.credit > 0 ? "신용" : e.cod > 0 ? "착불" : "추가금"}
                      </span>
                    </p>
                    {e.memo && <p className="mt-0.5 truncate text-[12px] text-ink-4">{e.memo}</p>}
                  </div>
                  <span className="tnum shrink-0 text-[13px] font-bold">{won(e.total)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
