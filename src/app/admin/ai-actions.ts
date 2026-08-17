"use server";

import { requireAdmin } from "@/lib/auth";
import { askGeminiJson, GeminiError, TONE_RULES } from "@/lib/gemini";
import { BLOCK_STYLES, normalizeBlocks, type NoticeBlock } from "@/lib/notice-blocks";

export type PolishResult = {
  ok: boolean;
  error?: string;
  title?: string;
  blocks?: NoticeBlock[];
  /** 맞춤법·표현을 고친 목록 (관리자가 확인하고 승인) */
  changes?: { before: string; after: string; why: string }[];
};

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    blocks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          style: { type: "string", enum: [...BLOCK_STYLES] },
          text: { type: "string" },
        },
        required: ["style", "text"],
      },
    },
    changes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          before: { type: "string" },
          after: { type: "string" },
          why: { type: "string" },
        },
        required: ["before", "after", "why"],
      },
    },
  },
  required: ["title", "blocks", "changes"],
};

/**
 * 관리자가 쓴 공지를 다듬습니다.
 *  - 맞춤법·띄어쓰기를 고치고 무엇을 고쳤는지 목록으로 돌려줍니다 (관리자가 승인)
 *  - 문단마다 강조 단계를 매깁니다 (소제목 / 꼭 지켜야 할 것 / 강조 / 일반)
 *
 * 저장할 때 한 번만 호출하고 결과를 DB에 넣어두므로, 직원들이 몇 번을 열어봐도
 * 토큰이 더 들지 않습니다.
 */
export async function polishNotice(
  title: string,
  body: string,
): Promise<PolishResult> {
  await requireAdmin();

  if (!title.trim() && !body.trim()) {
    return { ok: false, error: "내용을 먼저 적어 주세요." };
  }

  const prompt = `당신은 화물 운송 회사의 공지사항을 다듬는 편집자입니다.

${TONE_RULES}

아래 공지를 두 가지로 손봐 주세요.

[1] 맞춤법과 띄어쓰기를 고칩니다.
- 뜻이 바뀌는 수정은 하지 마세요. 문장을 새로 쓰지도 마세요.
- 사람 이름, 지역명, 차량번호, 회사에서 쓰는 말(착불, 신용, 일비 등)은 절대 바꾸지 마세요.
- 고친 것이 있으면 changes 에 하나씩 적으세요. 고칠 게 없으면 changes 는 빈 배열로 두세요.

[2] 문단마다 강조 단계를 하나씩 매깁니다.
- "title"  : 소제목. 내용이 여러 갈래일 때 구간을 나누는 짧은 제목.
- "warn"   : 꼭 지켜야 하거나 안 지키면 문제가 되는 것. 마감, 필수 입력, 금지 사항 등.
- "strong" : 중요해서 눈에 띄어야 하지만 경고까지는 아닌 것. 바뀐 금액, 새 규칙 등.
- "body"   : 나머지 일반 문장.
- 원문의 문단 순서를 그대로 지키세요. 문단을 합치거나 나누지 마세요.
- 강조를 남발하면 오히려 안 읽힙니다. warn 은 정말 중요한 것만, 전체의 두세 개 이내로 하세요.
- 대부분의 문단은 body 여야 합니다.
- 원문에 있던 ●, ▶, - 같은 글머리 기호는 지우고 text 에는 내용만 담으세요.

제목:
${title}

본문:
${body}`;

  try {
    const out = await askGeminiJson<{
      title: string;
      blocks: unknown;
      changes: { before: string; after: string; why: string }[];
    }>(prompt, { thinkingBudget: 1024, temperature: 0.2, schema: SCHEMA });

    const blocks = normalizeBlocks(out.blocks);
    if (!blocks) return { ok: false, error: "다듬은 결과를 읽지 못했습니다." };

    return {
      ok: true,
      title: out.title?.trim() || title,
      blocks,
      changes: Array.isArray(out.changes) ? out.changes.slice(0, 20) : [],
    };
  } catch (e) {
    const msg =
      e instanceof GeminiError
        ? "AI 서버가 응답하지 않습니다. 잠시 후 다시 시도해 주세요."
        : "다듬기에 실패했습니다.";
    console.error("polishNotice:", e);
    return { ok: false, error: msg };
  }
}
