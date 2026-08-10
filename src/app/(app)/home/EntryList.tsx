"use client";

import { Card, Empty } from "@/components/ui";
import EntryRow from "@/components/EntryRow";
import { isWrittenToday } from "@/lib/format";
import type { Entry, EntryLog } from "@/lib/types";

export default function EntryList({
  entries,
  logs,
  isAdmin,
  editorNames,
}: {
  entries: Entry[];
  /** 이 날짜 항목들의 수정 이력 (최신순) */
  logs: EntryLog[];
  /** 관리자는 지난 것도 고칠 수 있습니다 */
  isAdmin: boolean;
  editorNames: Record<string, string>;
}) {
  if (entries.length === 0) {
    return (
      <Card>
        <Empty
          icon="🚚"
          title="아직 입력한 내역이 없습니다"
          desc="위에서 오늘 배송 건을 추가해 주세요."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((e) => {
        const editable = isAdmin || isWrittenToday(e.created_at);
        return (
          <EntryRow
            key={e.id}
            entry={e}
            logs={logs.filter((l) => l.entry_id === e.id)}
            canEdit={editable}
            lockedReason={editable ? undefined : "수정은 관리자에게"}
            editorNames={editorNames}
          />
        );
      })}
    </div>
  );
}
