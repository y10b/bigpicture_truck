"use client";

import { useState, useTransition } from "react";
import { deleteEntry, updateEntry } from "../entry-actions";
import { Badge, Button, Card, Empty, Field, Input, cn } from "@/components/ui";
import MoneyInput from "@/components/MoneyInput";
import { won } from "@/lib/format";
import type { Entry } from "@/lib/types";

export default function EntryList({ entries }: { entries: Entry[] }) {
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
      {entries.map((e) => (
        <EntryRow key={e.id} entry={e} />
      ))}
    </div>
  );
}

function EntryRow({ entry }: { entry: Entry }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (editing) return <EditForm entry={entry} onClose={() => setEditing(false)} />;

  const kindLabel =
    entry.mode === "bulk"
      ? `일괄 ${entry.count}건`
      : entry.credit > 0
        ? "신용"
        : entry.cod > 0
          ? "착불"
          : "추가금";

  return (
    <Card className={cn("p-3.5 transition-opacity", pending && "opacity-40")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              tone={
                entry.mode === "bulk"
                  ? "neutral"
                  : entry.credit > 0
                    ? "brand"
                    : "accent"
              }
            >
              {kindLabel}
            </Badge>
            {entry.extra > 0 && (
              <span className="text-[12px] font-medium text-ink-4">
                추가 {won(entry.extra)}
              </span>
            )}
          </div>

          {entry.mode === "bulk" && (
            <p className="tnum mt-1.5 text-[12px] text-ink-3">
              신용 {won(entry.credit)} · 착불 {won(entry.cod)}
            </p>
          )}

          {entry.memo && (
            <p className="mt-1.5 truncate text-[13px] text-ink-3">{entry.memo}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="tnum text-[17px] font-extrabold">
            {won(entry.total)}
            <span className="ml-0.5 text-[12px] font-semibold text-ink-4">원</span>
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg px-2 py-1 text-[12px] font-semibold text-ink-3 transition-colors active:bg-ink/5"
            >
              수정
            </button>
            <button
              onClick={() => {
                if (!confirming) {
                  setConfirming(true);
                  setTimeout(() => setConfirming(false), 3000);
                  return;
                }
                startTransition(() => {
                  void deleteEntry(entry.id);
                });
              }}
              className={cn(
                "rounded-lg px-2 py-1 text-[12px] font-semibold transition-colors",
                confirming ? "bg-danger-soft text-danger" : "text-ink-4",
              )}
            >
              {confirming ? "정말?" : "삭제"}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function EditForm({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const [pending, startTransition] = useTransition();

  return (
    <Card className="border-brand-300 p-4">
      <form
        action={(fd) => {
          fd.set("id", entry.id);
          startTransition(async () => {
            const res = await updateEntry(fd);
            if (res.ok) onClose();
          });
        }}
        className="space-y-3"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="신용">
            <MoneyInput name="credit" defaultValue={entry.credit} />
          </Field>
          <Field label="착불">
            <MoneyInput name="cod" defaultValue={entry.cod} />
          </Field>
          <Field label="추가금">
            <MoneyInput name="extra" defaultValue={entry.extra} />
          </Field>
          <Field label="건수">
            <Input
              name="count"
              inputMode="numeric"
              defaultValue={entry.count}
              className="tnum text-right text-[17px] font-semibold"
            />
          </Field>
        </div>

        <Field label="메모">
          <Input name="memo" defaultValue={entry.memo ?? ""} maxLength={100} />
        </Field>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" className="flex-1" disabled={pending}>
            {pending ? "저장 중…" : "저장"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
