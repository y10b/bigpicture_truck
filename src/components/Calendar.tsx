"use client";

import { useState } from "react";
import { cn } from "@/components/ui";
import { addDays, prettyDate, startOfMonth, startOfWeek, todayKST } from "@/lib/format";

// 한 주는 월요일에 시작합니다.
const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

/** YYYY-MM 의 1일이 월요일 기준 몇 번째 칸인지 (0=월 … 6=일) */
function firstWeekday(ym: string) {
  return (new Date(`${ym}-01T00:00:00Z`).getUTCDay() + 6) % 7;
}

/** YYYY-MM 의 마지막 날짜 숫자 */
function daysInMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * 기간 선택 달력.
 * 첫 탭 = 시작일, 두 번째 탭 = 종료일. 거꾸로 찍으면 알아서 뒤집습니다.
 * 하루만 보고 싶으면 같은 날을 두 번 누르면 됩니다.
 */
export default function Calendar({
  initialFrom,
  initialTo,
  onApply,
  onCancel,
}: {
  initialFrom?: string;
  initialTo?: string;
  onApply: (from: string, to: string) => void;
  onCancel: () => void;
}) {
  const today = todayKST();
  const [month, setMonth] = useState(() =>
    (initialFrom ?? today).slice(0, 7),
  );
  const [from, setFrom] = useState<string | undefined>(initialFrom);
  const [to, setTo] = useState<string | undefined>(initialTo);

  const pick = (date: string) => {
    if (!from || (from && to)) {
      // 새로 시작
      setFrom(date);
      setTo(undefined);
      return;
    }
    if (date < from) {
      setTo(from);
      setFrom(date);
    } else {
      setTo(date);
    }
  };

  const cells: (string | null)[] = [];
  const pad = firstWeekday(month);
  for (let i = 0; i < pad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth(month); d++) {
    cells.push(`${month}-${String(d).padStart(2, "0")}`);
  }

  const rangeEnd = to ?? from;
  const canApply = Boolean(from);
  const isFutureMonth = month >= today.slice(0, 7);

  return (
    <div className="rounded-2xl border border-ink/10 bg-card p-3.5 shadow-[0_8px_24px_rgba(20,22,26,0.10)]">
      {/* 월 이동 */}
      <div className="mb-2 flex items-center justify-between">
        <MonthButton onClick={() => setMonth(shiftMonth(month, -1))} dir="prev" />
        <p className="text-[15px] font-extrabold tracking-tight">
          {month.slice(0, 4)}년 {Number(month.slice(5, 7))}월
        </p>
        <MonthButton
          onClick={() => setMonth(shiftMonth(month, 1))}
          dir="next"
          disabled={isFutureMonth}
        />
      </div>

      {/* 요일 */}
      <div className="grid grid-cols-7">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={cn(
              "py-1.5 text-center text-[11px] font-bold",
              i === 6 ? "text-danger/70" : "text-ink-4",
            )}
          >
            {w}
          </div>
        ))}
      </div>

      {/* 날짜 */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} />;

          const disabled = date > today;
          const isFrom = date === from;
          const isTo = date === rangeEnd;
          const inRange = Boolean(
            from && rangeEnd && date > from && date < rangeEnd,
          );
          const isToday = date === today;
          const sunday = i % 7 === 6;

          return (
            <div key={date} className="relative flex justify-center py-0.5">
              {/* 범위 배경 띠 */}
              {(inRange || (isFrom && to && from !== to) || (isTo && from !== to)) && (
                <span
                  className={cn(
                    "absolute inset-y-1 bg-brand-50",
                    inRange && "inset-x-0",
                    isFrom && to && from !== to && "right-0 left-1/2",
                    isTo && from !== to && "right-1/2 left-0",
                  )}
                />
              )}

              <button
                type="button"
                disabled={disabled}
                onClick={() => pick(date)}
                className={cn(
                  "relative flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold transition-colors",
                  disabled && "text-ink-4/40",
                  !disabled && !isFrom && !isTo && sunday && "text-danger/80",
                  !disabled && !isFrom && !isTo && !sunday && "text-ink-2",
                  (isFrom || isTo) && "bg-brand-500 text-white",
                  isToday && !isFrom && !isTo && "ring-1 ring-brand-400",
                  !disabled && !isFrom && !isTo && "active:bg-ink/5",
                )}
              >
                {Number(date.slice(8))}
              </button>
            </div>
          );
        })}
      </div>

      {/* 빠른 선택 */}
      <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-ink/8 pt-2.5">
        <Quick
          label="어제"
          onClick={() => {
            const y = addDays(today, -1);
            setFrom(y);
            setTo(y);
            setMonth(y.slice(0, 7));
          }}
        />
        <Quick
          label="이번 주"
          onClick={() => {
            setFrom(startOfWeek(today));
            setTo(today);
            setMonth(startOfWeek(today).slice(0, 7));
          }}
        />
        <Quick
          label="이번 달"
          onClick={() => {
            setFrom(startOfMonth(today));
            setTo(today);
            setMonth(today.slice(0, 7));
          }}
        />
      </div>

      {/* 선택 결과 + 적용 */}
      <div className="mt-3 border-t border-ink/8 pt-3">
        {!from ? (
          <p className="mb-2.5 text-center text-[13px] text-ink-4">
            보고 싶은 날짜를 눌러 주세요
          </p>
        ) : (
          <p className="mb-2.5 text-center text-[13px] font-semibold text-ink-2">
            {to && to !== from ? (
              <>
                {prettyDate(from)} <span className="text-ink-4">~</span>{" "}
                {prettyDate(to)}
              </>
            ) : (
              <>
                {prettyDate(from)}
                <span className="ml-1 font-normal text-ink-4">
                  · 하루만 보려면 그대로, 기간으로 보려면 끝 날짜를 한 번 더
                  누르세요
                </span>
              </>
            )}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 flex-1 rounded-xl border border-ink/15 bg-card text-[14px] font-bold text-ink transition-colors active:bg-paper-2"
          >
            취소
          </button>
          <button
            type="button"
            disabled={!canApply}
            onClick={() => from && onApply(from, to ?? from)}
            className="h-11 flex-[1.6] rounded-xl bg-brand-500 text-[14px] font-bold text-white transition-colors active:bg-brand-700 disabled:opacity-40"
          >
            {!from
              ? "날짜를 골라 주세요"
              : to && to !== from
                ? "이 기간 보기"
                : `${prettyDate(from)} 하루만 보기`}
          </button>
        </div>
      </div>
    </div>
  );
}

function MonthButton({
  onClick,
  dir,
  disabled,
}: {
  onClick: () => void;
  dir: "prev" | "next";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "이전 달" : "다음 달"}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-2 transition-colors active:bg-ink/5 disabled:opacity-25"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d={dir === "prev" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
      </svg>
    </button>
  );
}

function Quick({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-ink/12 bg-card px-3 py-1.5 text-[12px] font-bold text-ink-3 transition-colors active:bg-paper-2"
    >
      {label}
    </button>
  );
}
