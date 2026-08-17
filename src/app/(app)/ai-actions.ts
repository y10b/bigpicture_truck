"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { askGeminiJson, GeminiError, TONE_RULES } from "@/lib/gemini";
import { addDays, prettyDate, todayKST, won } from "@/lib/format";
import type { DayTotals } from "@/lib/types";

/* ── 코칭 (오늘 목표) ─────────────────────────────────── */

export type Coach = {
  /** 한 줄 요약 */
  headline: string;
  /** 오늘 권하는 매출 목표 (원) */
  targetTotal: number;
  /** 목표를 그렇게 잡은 이유 */
  reason: string;
  /** 실천 팁 2~3개 */
  tips: string[];
};

const COACH_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    targetTotal: { type: "integer" },
    reason: { type: "string" },
    tips: { type: "array", items: { type: "string" } },
  },
  required: ["headline", "targetTotal", "reason", "tips"],
};

type TeamStats = {
  worker_days: number;
  avg_day_total: number;
  avg_day_count: number;
  avg_unit_price: number;
  median_day_total: number;
};

/**
 * 오늘 목표 코칭.
 * 전 직원의 최근 30일 평균과 본인의 최근 흐름을 견줘 오늘 목표를 제안합니다.
 * 하루에 한 번만 만들고 ai_reports 에 캐시합니다.
 */
export async function getCoach(force = false): Promise<{
  ok: boolean;
  error?: string;
  data?: Coach;
  cached?: boolean;
}> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const today = todayKST();

  if (!force) {
    const { data: cached } = await supabase
      .from("ai_reports")
      .select("content")
      .eq("user_id", profile.id)
      .eq("report_date", today)
      .eq("kind", "coach")
      .maybeSingle();
    if (cached) return { ok: true, data: cached.content as Coach, cached: true };
  }

  const from = addDays(today, -29);
  const [{ data: mine }, { data: team }] = await Promise.all([
    supabase
      .from("v_daily_totals")
      .select("work_date, count, credit, cod, extra, total")
      .eq("user_id", profile.id)
      .gte("work_date", from)
      .lte("work_date", today)
      .order("work_date", { ascending: false }),
    supabase.rpc("team_daily_stats", { from_date: from, to_date: today }),
  ]);

  const days = (mine ?? []) as DayTotals[];
  const worked = days.filter((d) => d.total > 0);
  if (worked.length === 0) {
    return { ok: false, error: "아직 정산 기록이 없어서 목표를 잡을 수 없습니다." };
  }

  const stats = (Array.isArray(team) ? team[0] : team) as TeamStats | undefined;
  const myAvg = Math.round(worked.reduce((a, d) => a + d.total, 0) / worked.length);
  const myAvgCount =
    Math.round((worked.reduce((a, d) => a + d.count, 0) / worked.length) * 10) / 10;
  const last7 = worked.slice(0, 7);
  const last7Avg = Math.round(last7.reduce((a, d) => a + d.total, 0) / last7.length);
  const yesterday = days.find((d) => d.work_date === addDays(today, -1));

  const prompt = `당신은 화물 운송 회사에서 기사들의 하루 목표를 잡아주는 사람입니다.

${TONE_RULES}

오늘은 ${prettyDate(today)}입니다.

[이 사람의 최근 30일]
- 일한 날: ${worked.length}일
- 하루 평균 매출: ${won(myAvg)}원
- 하루 평균 건수: ${myAvgCount}건
- 최근 7일 평균: ${won(last7Avg)}원
- 어제: ${yesterday && yesterday.total > 0 ? `${won(yesterday.total)}원 / ${yesterday.count}건` : "기록 없음(쉼)"}

[전 직원 최근 30일 평균]
- 표본: ${stats?.worker_days ?? 0}일치
- 하루 평균 매출: ${won(stats?.avg_day_total ?? 0)}원
- 하루 평균 건수: ${stats?.avg_day_count ?? 0}건
- 건당 평균 단가: ${won(stats?.avg_unit_price ?? 0)}원
- 하루 매출 중앙값: ${won(stats?.median_day_total ?? 0)}원

할 일:
- 오늘 권할 매출 목표(targetTotal)를 원 단위 정수로 정하세요. 만원 단위로 떨어지게 하세요.
- 목표는 본인 최근 평균과 전체 평균을 함께 보고 잡되, 무리한 숫자를 부르지 마세요.
  본인 평균보다 크게 높이면 오히려 안 지킵니다. 보통 본인 최근 평균의 100~115% 안에서 잡으세요.
- headline 은 25자 안팎의 짧은 한 문장으로, 오늘 무엇을 노리면 되는지 적으세요.
- reason 은 두 문장 이내로, 왜 그 숫자인지 구체적인 수치를 들어 설명하세요.
- tips 는 2개나 3개. 오늘 바로 할 수 있는 것만 적으세요. 뻔한 말(안전운전 하세요) 대신
  건수와 단가 중 무엇을 올려야 하는지처럼 실제로 판단에 도움이 되는 것을 적으세요.
- 다른 사람과 대놓고 비교하거나 등수를 매기지 마세요. 기분 상하지 않게 쓰세요.`;

  try {
    const data = await askGeminiJson<Coach>(prompt, {
      thinkingBudget: 1024,
      temperature: 0.5,
      schema: COACH_SCHEMA,
    });

    await supabase.from("ai_reports").upsert(
      {
        user_id: profile.id,
        report_date: today,
        kind: "coach",
        content: data,
      },
      { onConflict: "user_id,report_date,kind" },
    );

    revalidatePath("/home");
    return { ok: true, data };
  } catch (e) {
    console.error("getCoach:", e);
    return {
      ok: false,
      error:
        e instanceof GeminiError
          ? "AI 서버가 응답하지 않습니다. 잠시 후 다시 시도해 주세요."
          : "목표를 만들지 못했습니다.",
    };
  }
}
