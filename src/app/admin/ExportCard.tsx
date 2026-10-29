"use client";

import { useState } from "react";
import { Card, cn } from "@/components/ui";

/**
 * 엑셀 내려받기.
 *
 * 개인 거래와 추가금은 빼고 뽑아야 할 때가 있어 체크로 고릅니다.
 * 빼면 그 칸만 사라지는 게 아니라 합계에서도 빠집니다 —
 * 칸은 없는데 합계에는 들어 있으면 숫자가 안 맞아 보입니다.
 */
export default function ExportCard({
  periodQuery,
  periodLabel,
}: {
  periodQuery: string;
  periodLabel: string;
}) {
  const [cash, setCash] = useState(true);
  const [extra, setExtra] = useState(true);

  const href =
    `/admin/export?${periodQuery}` +
    `&cash=${cash ? 1 : 0}&extra=${extra ? 1 : 0}`;

  const both = cash && extra;

  return (
    <Card className="overflow-hidden">
      <a href={href} download>
        <div className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-paper-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12M7 11l5 5 5-5M4 20h16" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-extrabold">엑셀로 내려받기</p>
            <p className="mt-0.5 text-[12px] text-ink-4">
              {periodLabel} · 직원마다 탭이 나뉘어 나옵니다
            </p>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-4">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </a>

      <div className="border-t border-ink/8 px-4 py-3">
        <p className="mb-2 text-[12px] font-semibold text-ink-4">
          넣을 항목 고르기
        </p>
        <div className="flex gap-2">
          <Toggle on={cash} onClick={() => setCash((v) => !v)} label="개인 거래" />
          <Toggle on={extra} onClick={() => setExtra((v) => !v)} label="추가금" />
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-4">
          {both
            ? "신용 · 착불 · 개인 거래 · 추가금을 모두 넣어 뽑습니다."
            : `뺀 항목은 칸도 합계도 빠집니다. 지금은 신용 · 착불${
                cash ? " · 개인 거래" : ""
              }${extra ? " · 추가금" : ""} 만 나옵니다.`}
        </p>
      </div>
    </Card>
  );
}

function Toggle({
  on,
  onClick,
  label,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[13px] font-bold transition-colors",
        on
          ? "border-brand-500 bg-brand-50 text-brand-700"
          : "border-dashed border-ink/25 bg-card text-ink-4",
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded-[5px] text-[10px] text-white",
          on ? "bg-brand-500" : "bg-ink/20",
        )}
      >
        {on ? "✓" : ""}
      </span>
      {label}
    </button>
  );
}
