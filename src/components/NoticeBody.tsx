import { cn } from "@/components/ui";
import type { NoticeBlock } from "@/lib/notice-blocks";

/**
 * 공지 본문 렌더러.
 * 서식(blocks)이 있으면 4단계 강조로 그리고, 없으면 평문 그대로 보여줍니다.
 */
export default function NoticeBody({
  blocks,
  body,
  className,
}: {
  blocks: NoticeBlock[] | null;
  body: string;
  className?: string;
}) {
  if (!blocks) {
    return (
      <p
        className={cn(
          "text-[15px] leading-[1.75] whitespace-pre-wrap text-ink-2",
          className,
        )}
      >
        {body}
      </p>
    );
  }

  return (
    <div className={cn("space-y-2.5", className)}>
      {blocks.map((b, i) => {
        if (b.style === "title") {
          return (
            <h3
              key={i}
              className="pt-2 text-[17px] leading-snug font-extrabold tracking-tight text-ink first:pt-0"
            >
              {b.text}
            </h3>
          );
        }

        if (b.style === "warn") {
          return (
            <div
              key={i}
              className="flex gap-2.5 rounded-xl border-l-4 border-danger bg-danger-soft px-3.5 py-3"
            >
              <span aria-hidden className="text-[15px] leading-[1.6]">
                ⚠️
              </span>
              <p className="text-[15px] leading-[1.6] font-bold whitespace-pre-wrap text-danger">
                {b.text}
              </p>
            </div>
          );
        }

        if (b.style === "strong") {
          return (
            <p
              key={i}
              className="text-[16px] leading-[1.7] font-bold whitespace-pre-wrap text-brand-700"
            >
              {b.text}
            </p>
          );
        }

        return (
          <p
            key={i}
            className="text-[15px] leading-[1.75] whitespace-pre-wrap text-ink-2"
          >
            {b.text}
          </p>
        );
      })}
    </div>
  );
}
