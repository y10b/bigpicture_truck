import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fillDailySeries, resolvePeriod } from "@/lib/period";
import { prettyDate, todayKST, won } from "@/lib/format";
import { DEFAULT_WEEKDAY_LEVY, settleFromUserTotals } from "@/lib/settlement";
import type { DayTotals, Profile, UserTotals } from "@/lib/types";
import { Badge, Card, CardHeader, Empty } from "@/components/ui";
import PeriodPicker from "@/components/PeriodPicker";
import TotalsCard, { sumTotals, type Totals } from "@/components/TotalsCard";
import { AmountChart, ChartLegend, CountChart } from "@/components/charts/SettlementChart";

export const metadata = { title: "관리자 대시보드 · BIG PICTURE" };

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const me = await requireAdmin();
  const { period: rawPeriod, from: rawFrom, to: rawTo } = await searchParams;
  const period = resolvePeriod(rawPeriod, rawFrom, rawTo);
  const today = todayKST();

  const supabase = await createClient();

  // ⚠️ 원본 entries 를 통째로 읽지 않습니다.
  //    PostgREST 가 한 번에 1000행까지만 주기 때문에, 직원이 늘거나 기간이 길어지면
  //    합계가 조용히 틀어집니다. 그래서 집계는 전부 DB 쪽 함수/뷰에 맡깁니다.
  const [
    { data: dayData },
    { data: userData },
    { data: todayData },
    { data: profileData },
    { data: settings },
  ] = await Promise.all([
    // 일자별 전사 합계 — 기간 길이만큼(최대 366행)
    supabase.rpc("admin_totals_by_day", {
      from_date: period.from,
      to_date: period.to,
    }),
    // 직원별 합계 — 직원 수만큼
    supabase.rpc("admin_totals_by_user", {
      from_date: period.from,
      to_date: period.to,
    }),
    // 오늘 입력 현황 — 오늘 일한 사람 수만큼
    supabase
      .from("v_daily_totals")
      .select("user_id, count, credit, cod, extra, total")
      .eq("work_date", today),
    // 직원 표는 작으므로 그대로 읽어 뱃지(관리자/비활성)에 씁니다.
    supabase.from("profiles").select("id, role, active"),
    supabase.from("app_settings").select("weekday_levy").eq("id", 1).maybeSingle(),
  ]);

  const daily = (dayData ?? []) as DayTotals[];
  const todayRows = (todayData ?? []) as (Totals & { user_id: string })[];
  const profiles = (profileData ?? []) as Pick<Profile, "id" | "role" | "active">[];
  const metaOf = new Map(profiles.map((p) => [p.id, p]));

  const levyRate = settings?.weekday_levy ?? DEFAULT_WEEKDAY_LEVY;

  const ranking = ((userData ?? []) as UserTotals[]).map((r) => ({
    ...r,
    role: metaOf.get(r.user_id)?.role ?? "employee",
    active: metaOf.get(r.user_id)?.active ?? true,
    s: settleFromUserTotals(r, levyRate),
  }));

  // 회사 전체로 아직 안 나간 돈
  const totalRemaining = ranking.reduce((a, r) => a + r.s.remaining, 0);
  const totalLevy = ranking.reduce((a, r) => a + r.s.levy, 0);

  const series = fillDailySeries(daily, period.from, period.to);
  const totals = sumTotals(daily);

  const todayTotals = sumTotals(todayRows);
  // 관리자도 직접 배송을 뛰므로 role 을 가리지 않고 활성 계정 전부를 셉니다.
  const activeCount = profiles.filter((p) => p.active).length;
  const reportedToday = todayRows.length;
  const myTodayTotals = sumTotals(todayRows.filter((r) => r.user_id === me.id));

  // 직원 상세로 넘어갈 때 보고 있던 기간을 그대로 물려줍니다.
  const periodQuery = new URLSearchParams(
    period.key === "custom"
      ? { period: "custom", from: period.from, to: period.to }
      : { period: period.key },
  ).toString();

  return (
    <div className="space-y-4 rise">
      <h1 className="text-[20px] font-extrabold tracking-tight">전체 정산 현황</h1>

      {/* 관리자도 직접 배송을 뛰므로 본인 정산 입력을 대시보드 맨 위에 둡니다 */}
      <Link href="/home">
        <Card className="flex items-center gap-3 border-brand-200 bg-brand-50 px-4 py-3.5 transition-colors active:bg-brand-100">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-extrabold text-brand-700">
              내 정산 입력하기
            </p>
            <p className="tnum mt-0.5 text-[12px] font-semibold text-brand-600/80">
              {myTodayTotals.count > 0
                ? `오늘 ${myTodayTotals.count}건 · ${won(myTodayTotals.total)}원 입력함`
                : "오늘 아직 입력 안 하셨습니다"}
            </p>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-brand-500">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </Card>
      </Link>

      {/* 오늘 상황은 기간과 무관하게 항상 위에 */}
      <Card className="flex items-center justify-between gap-3 px-4 py-3.5">
        <div>
          <p className="text-[12px] font-semibold text-ink-4">오늘 입력</p>
          <p className="mt-0.5 text-[15px] font-extrabold">
            <span className="tnum">{reportedToday}</span>
            <span className="text-ink-4"> / {activeCount}명</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[12px] font-semibold text-ink-4">오늘 합계</p>
          <p className="tnum mt-0.5 text-[15px] font-extrabold">
            {won(todayTotals.total)}원
            <span className="ml-1.5 text-[12px] font-semibold text-ink-4">
              {todayTotals.count}건
            </span>
          </p>
        </div>
      </Card>

      <PeriodPicker
        basePath="/admin"
        current={period.key}
        from={period.from}
        to={period.to}
      />

      <TotalsCard label={`${period.label} 전체 매출`} totals={totals} />

      <div className="grid grid-cols-2 gap-3">
        <Card className="px-4 py-3">
          <p className="text-[12px] font-semibold text-ink-4">상납금 합계</p>
          <p className="tnum mt-0.5 text-[17px] font-extrabold">
            {won(totalLevy)}원
          </p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-[12px] font-semibold text-ink-4">아직 안 나간 돈</p>
          <p
            className={
              totalRemaining < 0
                ? "tnum mt-0.5 text-[17px] font-extrabold text-danger"
                : "tnum mt-0.5 text-[17px] font-extrabold"
            }
          >
            {totalRemaining < 0 ? `−${won(-totalRemaining)}` : won(totalRemaining)}원
          </p>
        </Card>
      </div>

      {totals.count === 0 && totals.total === 0 ? (
        <Card>
          <Empty icon="📊" title="이 기간에는 기록이 없습니다" />
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader title="일별 정산액" desc="전 직원 합계" />
            <div className="px-3 pb-1">
              <div className="mb-2 px-1">
                <ChartLegend />
              </div>
              <AmountChart data={series} />
            </div>
          </Card>

          <Card>
            <CardHeader title="일별 건수" desc="전 직원 합계" />
            <div className="px-3 pb-2">
              <CountChart data={series} />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="직원별 실적"
              desc={`${prettyDate(period.from)} ~ ${prettyDate(period.to)} · 금액은 실수령`}
            />
            <ul className="divide-y divide-ink/6">
              {ranking.map((r, i) => (
                <li key={r.user_id}>
                  <Link
                    href={`/admin/members/${r.user_id}?${periodQuery}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors active:bg-paper-2"
                  >
                    <span className="tnum w-5 shrink-0 text-[13px] font-extrabold text-ink-4">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-[14px] font-bold">{r.name}</p>
                        {r.role === "admin" && <Badge tone="brand">관리자</Badge>}
                        {!r.active && <Badge>비활성</Badge>}
                      </div>
                      <p className="tnum mt-0.5 text-[12px] text-ink-4">
                        {r.count}건 · {r.days}일 (평일 {r.weekday_days}) · 상납{" "}
                        {won(r.s.levy)}
                      </p>
                      <p className="tnum mt-0.5 text-[12px] font-semibold text-ink-3">
                        출금 {won(r.s.withdrawn)} · 미출금{" "}
                        <span
                          className={
                            r.s.remaining < 0 ? "font-bold text-danger" : "font-bold"
                          }
                        >
                          {r.s.remaining < 0
                            ? `−${won(-r.s.remaining)}`
                            : won(r.s.remaining)}
                        </span>
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="tnum text-[15px] font-extrabold text-brand-600">
                        {won(r.s.net)}
                        <span className="ml-0.5 text-[11px] font-semibold text-ink-4">
                          원
                        </span>
                      </span>
                      <p className="tnum text-[11px] text-ink-4">
                        매출 {won(r.total)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
