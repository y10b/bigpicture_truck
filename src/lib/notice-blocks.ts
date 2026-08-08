/**
 * 공지 강조 4단계.
 * AI 가 색을 자유롭게 고르면 공지마다 모양이 달라지고 브랜드가 깨지므로,
 * 고를 수 있는 선택지를 네 가지로 못 박아 둡니다.
 */
export const BLOCK_STYLES = ["title", "warn", "strong", "body"] as const;
export type BlockStyle = (typeof BLOCK_STYLES)[number];

export type NoticeBlock = { style: BlockStyle; text: string };

export const STYLE_LABEL: Record<BlockStyle, string> = {
  title: "소제목",
  warn: "꼭 지켜야 할 것",
  strong: "강조",
  body: "일반",
};

/** 알 수 없는 값이 섞여 와도 화면이 깨지지 않게 걸러냅니다. */
export function normalizeBlocks(raw: unknown): NoticeBlock[] | null {
  if (!Array.isArray(raw)) return null;

  const blocks = raw
    .map((b) => {
      if (!b || typeof b !== "object") return null;
      const { style, text } = b as { style?: unknown; text?: unknown };
      if (typeof text !== "string" || !text.trim()) return null;
      return {
        style: BLOCK_STYLES.includes(style as BlockStyle)
          ? (style as BlockStyle)
          : "body",
        text: text.trim(),
      } satisfies NoticeBlock;
    })
    .filter((b): b is NoticeBlock => b !== null);

  return blocks.length ? blocks : null;
}

/** 서식 블록을 평문으로 되돌립니다 (검색·미리보기·되돌리기용). */
export function blocksToText(blocks: NoticeBlock[]) {
  return blocks.map((b) => b.text).join("\n");
}
