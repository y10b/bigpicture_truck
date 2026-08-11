"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Calendar from "@/components/Calendar";
import { cn } from "@/components/ui";
import { prettyDate } from "@/lib/format";

export type PeriodKey = "week" | "prevWeek" | "month" | "prevMonth" | "custom";

/** 주는 월요일 시작 ~ 일요일 끝 기준입니다. */
export const PRESETS: { key: Exclude<PeriodKey, "custom">; label: string }[] = [
  { key: "week", label: "이번 주" },
  { key: "prevWeek", label: "지난주" },
  { key: "month", label: "이번 달" },
  { key: "prevMonth", label: "지난 달" },
];

export default function PeriodPicker({
  basePath,
  current,
  from,
  to,
}: {
  basePath: string;
  current: PeriodKey;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const go = (params: Record<string, string>) => {
    router.push(`${basePath}?${new URLSearchParams(params).toString()}`, {
      scroll: false,
    });
  };

  return (
    <div className="space-y-2">
      {/* 프리셋 네 개를 한 줄에 꽉 채웁니다 — 옆으로 밀지 않아도 다 보이게 */}
      <div className="grid grid-cols-4 gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => {
              setOpen(false);
              go({ period: p.key });
            }}
            className={cn(
              "rounded-full py-2 text-[13px] font-bold whitespace-nowrap transition-colors",
              current === p.key
                ? "bg-ink text-paper"
                : "border border-ink/10 bg-card text-ink-3",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* 달력은 아래 줄에 따로 — 프리셋과 겹치지 않게 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-bold transition-colors",
          current === "custom"
            ? "bg-ink text-paper"
            : open
              ? "border border-brand-400 bg-brand-50 text-brand-700"
              : "border border-ink/10 bg-card text-ink-3",
        )}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
          <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
        </svg>
        {current === "custom" ? "날짜 다시 고르기" : "날짜로 고르기"}
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          className={cn("transition-transform", open && "rotate-180")}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* 현재 보고 있는 기간이 프리셋이 아니면 알려줍니다 */}
      {current === "custom" && !open && (
        <p className="px-1 text-[12px] font-semibold text-ink-3">
          {from === to ? (
            <>{prettyDate(from)} 하루</>
          ) : (
            <>
              {prettyDate(from)} <span className="text-ink-4">~</span>{" "}
              {prettyDate(to)}
            </>
          )}
        </p>
      )}

      {open && (
        <div className="rise">
          <Calendar
            initialFrom={current === "custom" ? from : undefined}
            initialTo={current === "custom" ? to : undefined}
            onCancel={() => setOpen(false)}
            onApply={(f, t) => {
              setOpen(false);
              go({ period: "custom", from: f, to: t });
            }}
          />
        </div>
      )}
    </div>
  );
}
