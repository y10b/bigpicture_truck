import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fillDailySeries, resolvePeriod } from "@/lib/period";
import { prettyDate, todayKST, won } from "@/lib/format";
import { settleFromUserTotals } from "@/lib/settlement";
import { getUnsettledToday } from "@/lib/unsettled";
import type { DayTotals, Profile, UserTotals } from "@/lib/types";
import { Card, CardHeader, Empty } from "@/components/ui";
import RankingView from "./RankingView";
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
    supabase.from("profiles").select("id, role, active, vehicle_no, vehicle_type"),
  ]);

  const daily = (dayData ?? []) as DayTotals[];
  const todayRows = (todayData ?? []) as (Totals & { user_id: string })[];
  const profiles = (profileData ?? []) as Pick<
    Profile,
    "id" | "role" | "active" | "vehicle_no" | "vehicle_type"
  >[];
  const metaOf = new Map(profiles.map((p) => [p.id, p]));

  const ranking = ((userData ?? []) as UserTotals[]).map((r) => ({
    ...r,
    role: metaOf.get(r.user_id)?.role ?? "employee",
    active: metaOf.get(r.user_id)?.active ?? true,
    vehicle_no: metaOf.get(r.user_id)?.vehicle_no ?? null,
    vehicle_type: metaOf.get(r.user_id)?.vehicle_type ?? null,
    s: settleFromUserTotals(r),
  }));

  // 회사 전체로 아직 안 나간 돈
  const totalRemaining = ranking.reduce((a, r) => a + r.s.remaining, 0);
  const totalWithdrawn = ranking.reduce((a, r) => a + r.s.withdrawn, 0);

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

  // 오늘 뛴 기록은 있는데 정산이 안 들어온 사람 (레이아웃과 같은 요청이라 재조회 없음)
  const unsettled = await getUnsettledToday();

  return (
    <div className="space-y-4 rise">
      <h1 className="text-[20px] font-extrabold tracking-tight">전체 정산 현황</h1>

      {unsettled.length > 0 && (
        <Card className="overflow-hidden border-accent/40">
          <div className="border-b border-accent/25 bg-accent-soft px-4 py-3">
            <p className="text-[14px] font-extrabold text-accent-deep">
              오늘 정산이 안 들어온 사람{" "}
              <span className="tnum">{unsettled.length}</span>명
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-accent-deep/80">
              운행 기록은 있는데 정산 입력이 없습니다. 밤 9시에 알림도 갑니다.
            </p>
          </div>
          <ul className="divide-y divide-ink/6">
            {unsettled.map((u) => (
              <li key={u.user_id}>
                <Link
                  href={`/admin/members/${u.user_id}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors active:bg-paper-2"
                >
                  <span className="text-[14px] font-semibold">{u.name}</span>
                  <span className="tnum text-[12px] font-semibold text-ink-4">
                    오늘 {Math.round(u.meters / 100) / 10}km 운행
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

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

      {/* 엑셀 내려받기 — 지금 보고 있는 기간 그대로 */}
      <a href={`/admin/export?${periodQuery}`} download>
        <Card className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-paper-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12M7 11l5 5 5-5M4 20h16" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-extrabold">엑셀로 내려받기</p>
            <p className="mt-0.5 text-[12px] text-ink-4">
              {period.label} · 직원마다 탭이 나뉘어 나옵니다
            </p>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-4">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </Card>
      </a>

      <div className="grid grid-cols-2 gap-3">
        <Card className="px-4 py-3">
          <p className="text-[12px] font-semibold text-ink-4">출금 합계</p>
          <p className="tnum mt-0.5 text-[17px] font-extrabold">
            {won(totalWithdrawn)}원
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

          <RankingView
            rows={ranking}
            desc={`${prettyDate(period.from)} ~ ${prettyDate(period.to)}`}
            periodQuery={periodQuery}
            meId={me.id}
          />
        </>
      )}
    </div>
  );
}
