"use client";

import { useRouter } from "next/navigation";
import { addDays, prettyDate, todayKST } from "@/lib/format";

export default function DateNav({ date }: { date: string }) {
  const router = useRouter();
  const today = todayKST();
  const isToday = date === today;

  const go = (d: string) => router.push(`/home?date=${d}`);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => go(addDays(date, -1))}
        aria-label="이전 날짜"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ink/10 bg-card text-ink-2 transition-colors active:bg-paper-2"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>

      <label className="relative flex h-10 flex-1 items-center justify-center rounded-xl border border-ink/10 bg-card px-3">
        <span className="text-[15px] font-bold">
          {prettyDate(date)}
          {isToday && (
            <span className="ml-1.5 rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-bold text-accent-deep">
              오늘
            </span>
          )}
        </span>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => e.target.value && go(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="날짜 선택"
        />
      </label>

      <button
        onClick={() => go(addDays(date, 1))}
        disabled={isToday}
        aria-label="다음 날짜"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ink/10 bg-card text-ink-2 transition-colors active:bg-paper-2 disabled:opacity-30"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
