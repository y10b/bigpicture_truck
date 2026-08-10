"use client";

import { useState } from "react";
import EntryRow from "@/components/EntryRow";
import { Empty, cn } from "@/components/ui";
import { prettyDate } from "@/lib/format";
import type { Entry, EntryLog } from "@/lib/types";

/**
 * 관리자용 정산 내역 목록.
 * 직원이 잘못 올린 금액·건수·결제구분을 여기서 바로 고칩니다.
 * 날짜 제한이 없습니다 — 지난 날짜를 바로잡는 게 관리자의 일이라서요.
 */
export default function EntryAdminList({
  entries,
  logs,
  editorNames,
}: {
  entries: Entry[];
  logs: EntryLog[];
  editorNames: Record<string, string>;
}) {
  const [openDate, setOpenDate] = useState<string | null>(
    entries[0]?.work_date ?? null,
  );

  if (entries.length === 0) {
    return <Empty icon="📋" title="이 기간에는 입력한 내역이 없습니다" />;
  }

  // 날짜별로 접어 둡니다. 한 달치를 다 펼치면 너무 길어집니다.
  const byDate = new Map<string, Entry[]>();
  for (const e of entries) {
    const list = byDate.get(e.work_date);
    if (list) list.push(e);
    else byDate.set(e.work_date, [e]);
  }

  return (
    <div className="divide-y divide-ink/6">
      {[...byDate.entries()].map(([date, list]) => {
        const open = openDate === date;
        const dayTotal = list.reduce((a, e) => a + e.total, 0);
        const edited = list.some((e) =>
          logs.some((l) => l.entry_id === e.id),
        );

        return (
          <div key={date}>
            <button
              onClick={() => setOpenDate(open ? null : date)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors active:bg-paper-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round"
                  className={cn(
                    "shrink-0 text-ink-4 transition-transform",
                    open && "rotate-90",
                  )}
                >
                  <path d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-[14px] font-bold">{prettyDate(date)}</span>
                <span className="tnum text-[12px] text-ink-4">
                  {list.length}건
                </span>
                {edited && (
                  <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-bold text-accent-deep">
                    수정됨
                  </span>
                )}
              </div>
              <span className="tnum shrink-0 text-[14px] font-extrabold">
                {dayTotal.toLocaleString("ko-KR")}
                <span className="ml-0.5 text-[11px] font-semibold text-ink-4">원</span>
              </span>
            </button>

            {open && (
              <div className="space-y-2 bg-paper-2/40 px-4 pt-1 pb-4">
                {list.map((e) => (
                  <EntryRow
                    key={e.id}
                    entry={e}
                    logs={logs.filter((l) => l.entry_id === e.id)}
                    canEdit
                    editorNames={editorNames}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
