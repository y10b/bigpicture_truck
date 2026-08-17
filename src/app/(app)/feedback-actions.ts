"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { askGeminiJson, GeminiError, TONE_RULES } from "@/lib/gemini";
import { addDays, prettyDate, todayKST, won } from "@/lib/format";
import type { DayTotals, Entry } from "@/lib/types";

/** 마감 피드백 한 건 */
export type Feedback = {
  /** 오늘 하루를 한 문장으로 */
  headline: string;
  /** 잘한 점 */
  good: string[];
  /** 다음엔 이렇게 */
  improve: string[];
  /** 화면에 같이 보여줄 수치 — AI가 만든 게 아니라 우리가 계산한 값입니다 */
  facts: {
    total: number;
    count: number;
    meters: number;
    /** 1km 당 매출 (거리 기록이 없으면 null) */
    perKm: number | null;
    /** 건당 단가 */
    perCount: number | null;
    /** 어제와 비교 (%). 어제 기록이 없으면 null */
    vsYesterdayTotal: number | null;
    vsYesterdayMeters: number | null;
  };
};

const SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    good: { type: "array", items: { type: "string" } },
    improve: { type: "array", items: { type: "string" } },
  },
  required: ["headline", "good", "improve"],
};

const km = (m: number) => Math.round(m / 100) / 10;
const pct = (now: number, before: number) =>
  before > 0 ? Math.round(((now - before) / before) * 100) : null;

/**
 * 하루 마감 피드백을 만듭니다.
 *
 * 마감을 저장하면 자동으로 불립니다. 이미 만들어 둔 게 있으면 그걸 돌려주고,
 * 다시 만들지 않습니다 (같은 날 여러 번 저장해도 토큰이 더 들지 않게).
 */
export async function generateFeedback(
  workDate: string,
  force = false,
): Promise<{ ok: boolean; error?: string; data?: Feedback }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    return { ok: false, error: "날짜가 올바르지 않습니다." };
  }

  if (!force) {
    const { data: cached } = await supabase
      .from("ai_reports")
      .select("content")
      .eq("user_id", profile.id)
      .eq("report_date", workDate)
      .eq("kind", "daily")
      .maybeSingle();
    if (cached) return { ok: true, data: cached.content as Feedback };
  }

  const yesterday = addDays(workDate, -1);
  const from = addDays(workDate, -29);

  const [{ data: entryData }, { data: dailyData }, { data: distData }, { data: team }] =
    await Promise.all([
      supabase
        .from("entries")
        .select("*")
        .eq("user_id", profile.id)
        .eq("work_date", workDate)
        .limit(100),
      supabase
        .from("v_daily_totals")
        .select("work_date, count, credit, cod, extra, total")
        .eq("user_id", profile.id)
        .gte("work_date", from)
        .lte("work_date", workDate),
      supabase
        .from("daily_distance")
        .select("work_date, meters")
        .eq("user_id", profile.id)
        .gte("work_date", from)
        .lte("work_date", workDate),
      supabase.rpc("team_daily_stats", { from_date: from, to_date: workDate }),
    ]);

  const entries = (entryData ?? []) as Entry[];
  if (entries.length === 0) {
    return { ok: false, error: "이 날은 입력한 내역이 없습니다." };
  }

  const daily = (dailyData ?? []) as DayTotals[];
  const distances = new Map(
    ((distData ?? []) as { work_date: string; meters: number }[]).map((d) => [
      d.work_date,
      d.meters,
    ]),
  );

  const today = daily.find((d) => d.work_date === workDate);
  const yday = daily.find((d) => d.work_date === yesterday);
  const total = today?.total ?? entries.reduce((a, e) => a + e.total, 0);
  const count = today?.count ?? entries.reduce((a, e) => a + e.count, 0);
  const meters = distances.get(workDate) ?? 0;
  const ydayMeters = distances.get(yesterday) ?? 0;

  const past = daily.filter((d) => d.work_date < workDate && d.total > 0);
  const myAvg = past.length
    ? Math.round(past.reduce((a, d) => a + d.total, 0) / past.length)
    : 0;

  // 최근 며칠의 1km당 매출 — "오늘 운행이 값이 됐나" 를 보는 기준
  const pastPerKm = past
    .map((d) => {
      const m = distances.get(d.work_date) ?? 0;
      return m > 1000 ? d.total / (m / 1000) : null;
    })
    .filter((v): v is number => v !== null);
  const avgPerKm = pastPerKm.length
    ? Math.round(pastPerKm.reduce((a, v) => a + v, 0) / pastPerKm.length)
    : null;

  const facts: Feedback["facts"] = {
    total,
    count,
    meters,
    perKm: meters > 1000 ? Math.round(total / (meters / 1000)) : null,
    perCount: count > 0 ? Math.round(total / count) : null,
    vsYesterdayTotal: yday ? pct(total, yday.total) : null,
    vsYesterdayMeters: ydayMeters > 0 ? pct(meters, ydayMeters) : null,
  };

  const stats = (Array.isArray(team) ? team[0] : team) as
    | { avg_day_total: number; avg_unit_price: number; avg_day_count: number }
    | undefined;

  const memos = entries
    .map((e) => e.memo)
    .filter(Boolean)
    .join(" / ");
  const expense = entries.reduce((a, e) => a + (e.expense ?? 0), 0);
  const minutes = entries.reduce((a, e) => a + (e.minutes ?? 0), 0);

  const prompt = `당신은 화물 운송 회사에서 기사의 하루 운행을 되짚어 주는 사람입니다.

${TONE_RULES}

${prettyDate(workDate)} 기록입니다.

[오늘]
- 매출 ${won(total)}원 / ${count}건
- 건당 ${facts.perCount ? `${won(facts.perCount)}원` : "계산 불가"}
- 주행거리 ${meters > 0 ? `${km(meters)}km` : "기록 없음(앱이 위치를 못 받았습니다)"}
- 1km당 매출 ${facts.perKm ? `${won(facts.perKm)}원` : "계산 불가"}
- 본인이 적은 지출 ${expense > 0 ? `${won(expense)}원` : "없음"}
- 본인이 적은 운행시간 ${minutes > 0 ? `${minutes}분` : "없음"}
- 메모: ${memos || "없음"}

[어제]
${
  yday
    ? `- 매출 ${won(yday.total)}원 / ${yday.count}건${ydayMeters > 0 ? ` / ${km(ydayMeters)}km` : ""}`
    : "- 기록 없음 (비교할 수 없습니다)"
}

[본인 최근 30일]
- 하루 평균 매출 ${myAvg > 0 ? `${won(myAvg)}원` : "기록 부족"}
- 1km당 평균 매출 ${avgPerKm ? `${won(avgPerKm)}원` : "기록 부족"}

[전 직원 평균]
- 하루 매출 ${won(stats?.avg_day_total ?? 0)}원 / 건당 ${won(stats?.avg_unit_price ?? 0)}원

할 일:
- headline: 오늘 하루를 한 문장(25자 안팎)으로. 무엇이 좋았고 무엇이 아쉬웠는지가 드러나게.
- good: 잘한 점 1~2개.
- improve: 아쉬운 점과 다음에 이렇게 하면 좋겠다는 제안 1~3개.
  거리 대비 매출(1km당 얼마)을 중심으로 봐 주세요. 멀리 갔는데 돈이 안 됐는지,
  가까이서 알차게 돌았는지가 이 일에서 제일 중요합니다.
  어제 기록이 있으면 어제와 견줘서 말해 주세요.

매우 중요한 규칙:
- 위에 주어진 숫자만 쓰세요. 없는 숫자를 지어내지 마세요.
- "기록 없음"이나 "계산 불가"라고 적힌 것은 아예 언급하지 말고, 그것으로
  어떤 계산도 하지 마세요.
- 어제 기록이 없으면 어제와 비교하지 마세요.
- 혼내는 말투로 쓰지 마세요. 담담하게 사실과 제안만 쓰세요.`;

  try {
    const out = await askGeminiJson<Omit<Feedback, "facts">>(prompt, {
      thinkingBudget: 2048,
      temperature: 0.4,
      schema: SCHEMA,
    });

    const data: Feedback = { ...out, facts };

    await supabase.from("ai_reports").upsert(
      { user_id: profile.id, report_date: workDate, kind: "daily", content: data },
      { onConflict: "user_id,report_date,kind" },
    );

    revalidatePath("/home");
    revalidatePath("/feedback");
    return { ok: true, data };
  } catch (e) {
    console.error("generateFeedback:", e);
    return {
      ok: false,
      error:
        e instanceof GeminiError
          ? "AI 서버가 응답하지 않습니다. 잠시 후 다시 시도해 주세요."
          : "피드백을 만들지 못했습니다.",
    };
  }
}

/** 오늘 마감 피드백을 만듭니다 (마감 저장 직후 자동 호출) */
export async function generateTodayFeedback() {
  return generateFeedback(todayKST());
}
