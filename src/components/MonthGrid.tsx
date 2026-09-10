"use client";

import { cn } from "@/components/ui";
import { prettyMonth, todayKST } from "@/lib/format";

// 한 주는 월요일에 시작합니다 (회사 주 단위와 같게).
const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

/** YYYY-MM 의 1일이 월요일 기준 몇 번째 칸인지 (0=월 … 6=일) */
function firstWeekday(ym: string) {
  return (new Date(`${ym}-01T00:00:00Z`).getUTCDay() + 6) % 7;
}

function daysInMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type DayCell = {
  /** 칸 안에 크게 들어갈 표시 (없으면 날짜만) */
  mark?: React.ReactNode;
  /** 칸 배경/글자 색 */
  tone?: "worked" | "leave" | "opened" | "absent";
  /** 눌렀을 때 */
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
};

const TONE: Record<NonNullable<DayCell["tone"]>, string> = {
  worked: "bg-brand-500 text-white font-extrabold",
  leave: "bg-accent text-ink font-extrabold",
  opened: "bg-brand-100 text-brand-700 font-bold",
  absent: "text-ink-4",
};

/**
 * 한 달치 달력 판.
 * 날짜별로 무엇을 칠할지는 쓰는 쪽에서 정합니다 — 출근 현황에도, 월차 고르기에도 씁니다.
 */
export default function MonthGrid({
  month,
  onMonthChange,
  cell,
  /** 이 달보다 뒤로는 못 가게 (미래 달 보기 방지) */
  maxMonth,
  minMonth,
}: {
  month: string;
  onMonthChange: (ym: string) => void;
  cell: (date: string) => DayCell;
  maxMonth?: string;
  minMonth?: string;
}) {
  const today = todayKST();
  const pad = firstWeekday(month);
  const total = daysInMonth(month);
  const canPrev = !minMonth || shiftMonth(month, -1) >= minMonth;
  const canNext = !maxMonth || shiftMonth(month, 1) <= maxMonth;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <NavBtn
          label="지난달"
          disabled={!canPrev}
          onClick={() => onMonthChange(shiftMonth(month, -1))}
        >
          ‹
        </NavBtn>
        <p className="text-[15px] font-extrabold">{prettyMonth(month)}</p>
        <NavBtn
          label="다음달"
          disabled={!canNext}
          onClick={() => onMonthChange(shiftMonth(month, 1))}
        >
          ›
        </NavBtn>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={cn(
              "pb-1 text-center text-[11px] font-bold",
              i === 5 && "text-brand-600",
              i === 6 && "text-danger",
              i < 5 && "text-ink-4",
            )}
          >
            {w}
          </div>
        ))}

        {Array.from({ length: pad }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}

        {Array.from({ length: total }).map((_, i) => {
          const day = i + 1;
          const date = `${month}-${String(day).padStart(2, "0")}`;
          const c = cell(date);
          const isToday = date === today;

          return (
            <button
              key={date}
              type="button"
              disabled={c.disabled || !c.onClick}
              onClick={c.onClick}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-xl text-[13px] transition-colors",
                c.tone ? TONE[c.tone] : "text-ink-2",
                c.onClick && !c.disabled && "active:scale-95",
                c.disabled && "opacity-30",
                c.selected && "ring-2 ring-brand-600 ring-offset-1",
                isToday && !c.tone && "bg-ink/6 font-bold",
              )}
            >
              <span className={cn(Boolean(c.mark) && "text-[10px] leading-none opacity-80")}>
                {day}
              </span>
              {c.mark && (
                <span className="mt-0.5 text-[11px] leading-none">{c.mark}</span>
              )}
              {isToday && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute bottom-1 h-1 w-1 rounded-full",
                    c.tone === "worked" || c.tone === "leave"
                      ? "bg-white/80"
                      : "bg-brand-500",
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NavBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-ink/12 text-[17px] font-bold text-ink-3 transition-colors active:bg-paper-2 disabled:opacity-25"
    >
      {children}
    </button>
  );
}
