"use client";

import { useMemo, useState, useTransition } from "react";
import { addLeave, removeLeave } from "../leave-actions";
import MonthGrid, { type DayCell } from "@/components/MonthGrid";
import { Alert, Badge, Card, CardHeader, Empty } from "@/components/ui";
import { prettyDate, prettyMonth, todayKST } from "@/lib/format";

export type Leave = {
  id: string;
  leave_date: string;
  memo: string | null;
  created_by: string | null;
};

/**
 * 달력에서 날짜를 눌러 월차를 잡습니다.
 * 이미 잡아 둔 날을 다시 누르면 취소됩니다 — 버튼을 따로 찾지 않아도 되게요.
 */
export default function LeavePicker({
  userId,
  leaves,
  workedDates,
}: {
  userId: string;
  leaves: Leave[];
  workedDates: string[];
}) {
  const today = todayKST();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const byDate = useMemo(
    () => new Map(leaves.map((l) => [l.leave_date, l])),
    [leaves],
  );
  const worked = useMemo(() => new Set(workedDates), [workedDates]);

  // 보고 있는 달에 이미 잡아 둔 월차
  const thisMonth = leaves.find((l) => l.leave_date.startsWith(month));

  const cell = (date: string): DayCell => {
    const leave = byDate.get(date);
    if (leave) {
      return {
        tone: "leave",
        mark: "월차",
        onClick: () =>
          startTransition(async () => {
            setError(undefined);
            const res = await removeLeave(leave.id);
            if (!res.ok) setError(res.error);
          }),
      };
    }

    if (worked.has(date)) return { tone: "worked", mark: "근무" };

    // 이미 이 달에 하루 잡아 뒀으면 다른 날은 못 고릅니다 (DB 에서도 막힙니다).
    const blocked = Boolean(thisMonth) && date.startsWith(month);

    return {
      disabled: blocked,
      onClick: blocked
        ? undefined
        : () =>
            startTransition(async () => {
              setError(undefined);
              const fd = new FormData();
              fd.set("leave_date", date);
              fd.set("user_id", userId);
              const res = await addLeave(fd);
              if (!res.ok) setError(res.error);
            }),
    };
  };

  return (
    <>
      <Card className={pending ? "p-4 opacity-50" : "p-4"}>
        <MonthGrid month={month} onMonthChange={setMonth} cell={cell} />

        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-ink/8 pt-3">
          <Legend className="bg-accent" label="월차" />
          <Legend className="bg-brand-500" label="일한 날" />
        </div>

        <p className="mt-2.5 text-[12px] leading-relaxed text-ink-4">
          {thisMonth
            ? `${prettyMonth(month)}에는 ${prettyDate(thisMonth.leave_date)}로 잡혀 있습니다. 다시 누르면 취소됩니다.`
            : `${prettyMonth(month)}에는 아직 월차를 안 잡으셨습니다.`}
        </p>

        {error && (
          <div className="mt-3">
            <Alert>{error}</Alert>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="잡아 둔 월차" desc="최근 것부터 보여줍니다" />
        {leaves.length === 0 ? (
          <Empty icon="🌴" title="아직 잡아 둔 월차가 없습니다" />
        ) : (
          <ul className="divide-y divide-ink/6">
            {leaves.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-[14px] font-bold">
                    {prettyDate(l.leave_date)}
                  </p>
                  {l.created_by && l.created_by !== userId && (
                    <p className="mt-0.5 text-[11px] text-ink-4">
                      관리자가 등록했습니다
                    </p>
                  )}
                </div>
                {l.leave_date < today ? (
                  <Badge>지난 월차</Badge>
                ) : (
                  <button
                    onClick={() =>
                      startTransition(async () => {
                        setError(undefined);
                        const res = await removeLeave(l.id);
                        if (!res.ok) setError(res.error);
                      })
                    }
                    className="shrink-0 rounded-lg px-2.5 py-1 text-[12px] font-semibold text-ink-4 transition-colors active:bg-ink/5"
                  >
                    취소
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-4">
      <span className={`h-2.5 w-2.5 rounded-[4px] ${className}`} />
      {label}
    </span>
  );
}
