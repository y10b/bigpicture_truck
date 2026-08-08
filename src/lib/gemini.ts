import "server-only";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * 작업마다 모델과 사고량(thinkingBudget)을 따로 잡습니다.
 *
 * Gemini 3.x 는 기본적으로 생각을 길게 합니다. 실측해 보니 849토큰짜리 공지를
 * 만드는 데 사고에만 6,000토큰을 썼습니다. 서식 매기기처럼 판단이 단순한
 * 작업은 예산을 조여야 비용이 새지 않습니다.
 */
const MODEL = "gemini-3.5-flash";

export type GeminiOptions = {
  /** 사고 예산(토큰). 0에 가까울수록 싸고 빠릅니다. */
  thinkingBudget?: number;
  temperature?: number;
  /** 응답으로 받을 JSON 스키마 (있으면 구조화 출력 강제) */
  schema?: Record<string, unknown>;
};

export class GeminiError extends Error {}

/** Gemini 를 호출해 JSON 을 받아옵니다. */
export async function askGeminiJson<T>(
  prompt: string,
  { thinkingBudget = 512, temperature = 0.4, schema }: GeminiOptions = {},
): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("GEMINI_API_KEY 환경변수가 없습니다.");

  const res = await fetch(`${ENDPOINT}/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        responseMimeType: "application/json",
        ...(schema ? { responseSchema: schema } : {}),
        thinkingConfig: { thinkingBudget },
      },
    }),
    // 서버리스 함수가 오래 매달려 있지 않게 자릅니다.
    signal: AbortSignal.timeout(45_000),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    throw new GeminiError(
      `Gemini 호출 실패 (${res.status}) ${JSON.stringify(data)?.slice(0, 300)}`,
    );
  }

  // 사고 과정(thought) 파트가 섞여 오므로 실제 답변만 골라냅니다.
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .filter((p: { thought?: boolean; text?: string }) => !p.thought && typeof p.text === "string")
    .map((p: { text: string }) => p.text)
    .join("")
    .trim();

  if (!text) throw new GeminiError("Gemini 가 빈 응답을 돌려줬습니다.");

  try {
    return JSON.parse(text) as T;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new GeminiError("Gemini 응답을 해석하지 못했습니다.");
    return JSON.parse(m[0]) as T;
  }
}

/**
 * 회사 말투 규칙 — 모든 프롬프트에 공통으로 붙입니다.
 * 사내에서는 서로 형·형님이라 부르지만, 공지·리포트는 글로 남는 것이라
 * 호칭 없이 정중한 존댓말로 씁니다.
 */
export const TONE_RULES = `
말투 규칙:
- '기사님들', '형님들', '여러분' 같은 호칭이나 부르는 말을 절대 쓰지 마세요. 호칭 없이 바로 내용을 쓰세요.
- 정중한 존댓말(~합니다, ~해 주세요)로 쓰되 딱딱하지 않게 쓰세요.
- 읽는 사람은 40~60대이고 스마트폰에 익숙하지 않을 수 있습니다. 짧고 쉬운 문장으로 쓰세요.
- 영어 단어와 전문 용어를 쓰지 마세요.
- 인사말이나 맺음말로 분량을 채우지 마세요. 필요한 내용만 쓰세요.
`.trim();
