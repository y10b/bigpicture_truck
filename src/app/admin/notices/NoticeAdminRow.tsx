"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteNotice, toggleNoticePin } from "../notice-actions";
import { Badge, Card, cn } from "@/components/ui";
import { prettyDateTime } from "@/lib/format";
import type { Notice } from "@/lib/types";

export default function NoticeAdminRow({ notice }: { notice: Notice }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Card className={cn("overflow-hidden transition-opacity", pending && "opacity-40")}>
      <Link href={`/admin/notices/${notice.id}`} className="block p-4">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          {notice.pinned && <Badge tone="accent">📌 고정</Badge>}
          <span className="text-[12px] text-ink-4">
            {prettyDateTime(notice.created_at)}
          </span>
        </div>
        <p className="text-[15px] leading-snug font-bold">{notice.title}</p>
        {notice.body && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-3">
            {notice.body}
          </p>
        )}
      </Link>

      <div className="flex divide-x divide-ink/8 border-t border-ink/8 text-[12px] font-bold text-ink-3">
        <button
          className="flex-1 py-2.5 transition-colors active:bg-paper-2"
          onClick={() =>
            startTransition(() => {
              void toggleNoticePin(notice.id, !notice.pinned);
            })
          }
        >
          {notice.pinned ? "고정 해제" : "맨 위 고정"}
        </button>
        <Link
          href={`/admin/notices/${notice.id}`}
          className="flex-1 py-2.5 text-center transition-colors active:bg-paper-2"
        >
          수정
        </Link>
        <button
          className={cn(
            "flex-1 py-2.5 transition-colors",
            confirming ? "bg-danger-soft text-danger" : "text-danger/80",
          )}
          onClick={() => {
            if (!confirming) {
              setConfirming(true);
              setTimeout(() => setConfirming(false), 3000);
              return;
            }
            startTransition(() => {
              void deleteNotice(notice.id);
            });
          }}
        >
          {confirming ? "정말 삭제?" : "삭제"}
        </button>
      </div>
    </Card>
  );
}
