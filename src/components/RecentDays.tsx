"use client";

import Link from "next/link";
import { todayKST } from "@/lib/format";
import { cn } from "@/components/ui";

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

export type DayMark = {
  date: string;
  /** 그날 정산을 넣었는지 */
  done: boolean;
  /** 월차로 잡아 둔 날인지 */
  leave: boolean;
};

/**
 * 최근 며칠이 비어 있는지 한눈에 보여 줍니다.
 *
 * 전에는 어제가 비어 있어도 알 방법이 없었습니다. 그래서 다음 날 정산을
 * 올리면서 날짜를 안 바꾸고 오늘로 넣어 버리는 일이 생겼고,
 * 정작 일한 날은 출근이 비어 보였습니다.
 */
export default function RecentDays({
  days,
  selected,
}: {
  days: DayMark[];
  selected: string;
}) {
  const today = todayKST();
  // 오늘은 아직 안 넣은 게 당연하므로 '빠진 날' 로 세지 않습니다.
  const missing = days.filter((d) => !d.done && !d.leave && d.date !== today);

  return (
    <div>
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-1.5">
          {days.map((d) => {
            const dow = new Date(`${d.date}T00:00:00Z`).getUTCDay();
            const isToday = d.date === today;
            const isSelected = d.date === selected;
            return (
              <Link
                key={d.date}
                href={`/home?date=${d.date}`}
                aria-label={`${d.date} ${d.done ? "입력함" : d.leave ? "월차" : "비어 있음"}`}
                className={cn(
                  "flex w-[46px] shrink-0 flex-col items-center gap-0.5 rounded-xl border py-2 transition-colors",
                  d.leave
                    ? "border-accent bg-accent text-ink"
                    : d.done
                      ? "border-brand-500 bg-brand-500 text-white"
                      : "border-dashed border-ink/25 bg-card text-ink-4",
                  isSelected && "ring-2 ring-brand-600 ring-offset-1",
                )}
              >
                <span className="text-[10px] leading-none font-semibold opacity-75">
                  {isToday ? "오늘" : WEEKDAY[dow]}
                </span>
                <span className="tnum text-[14px] leading-none font-extrabold">
                  {Number(d.date.slice(8))}
                </span>
                <span className="text-[10px] leading-none">
                  {d.leave ? "월차" : d.done ? "✓" : "—"}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {missing.length > 0 && (
        <p className="mt-2 text-[12px] leading-relaxed text-accent-deep">
          <b>
            아직 안 넣은 날이 {missing.length}일 있습니다
            {missing.length <= 3 &&
              ` (${missing.map((m) => `${Number(m.date.slice(5, 7))}/${Number(m.date.slice(8))}`).join(", ")})`}
            .
          </b>{" "}
          그날 날짜를 눌러서 넣어 주세요. 오늘 날짜로 넣으면 그날 출근이
          비어 버립니다.
        </p>
      )}
    </div>
  );
}
