"use client";

import { useState, useTransition } from "react";
import { deleteEntry, updateEntry } from "@/app/(app)/entry-actions";
import { Alert, Badge, Button, Card, Field, Input, cn } from "@/components/ui";
import MoneyInput from "@/components/MoneyInput";
import { prettyDate, prettyDateTime, won } from "@/lib/format";
import type { Entry, EntryLog } from "@/lib/types";

/** 신용/착불 구분 — 잘못 고르는 일이 잦아 수정할 때도 바꿀 수 있게 합니다. */
type Kind = "credit" | "cod";

function kindOf(e: Entry): Kind {
  return e.cod > 0 && e.credit === 0 ? "cod" : "credit";
}

function kindLabel(e: Entry) {
  if (e.mode === "bulk") return `하루 마감 ${e.count}건`;
  if (e.credit > 0) return "신용";
  if (e.cod > 0) return "착불";
  return "추가금";
}

/* 이력에 보여줄 항목 이름과 형식 */
const FIELD_LABEL: Record<string, string> = {
  count: "건수",
  credit: "신용",
  cod: "착불",
  extra: "추가금",
  expense: "지출",
  minutes: "운행시간",
  memo: "메모",
  work_date: "날짜",
  mode: "입력 방식",
};

function fmt(field: string, v: unknown) {
  if (v === null || v === undefined || v === "") return "없음";
  if (field === "count") return `${v}건`;
  if (field === "minutes") return `${v}분`;
  if (field === "memo" || field === "mode") return String(v);
  if (field === "work_date") return prettyDate(String(v));
  return `${won(Number(v))}원`;
}

function diffOf(log: EntryLog) {
  const before = (log.before ?? {}) as Record<string, unknown>;
  const after = (log.after ?? {}) as Record<string, unknown>;
  if (log.action === "delete") return [];
  return Object.keys(FIELD_LABEL)
    .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .map((k) => ({ field: k, from: before[k], to: after[k] }));
}

export default function EntryRow({
  entry,
  logs,
  canEdit,
  lockedReason,
  editorNames,
}: {
  entry: Entry;
  /** 이 항목의 수정 이력 (최신순) */
  logs: EntryLog[];
  canEdit: boolean;
  /** 수정할 수 없을 때 이유 한 줄 */
  lockedReason?: string;
  /** 수정한 사람 id → 이름 */
  editorNames: Record<string, string>;
}) {
  const [editing, setEditing] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (editing) {
    return (
      <EditForm
        entry={entry}
        onClose={() => setEditing(false)}
        onError={setError}
      />
    );
  }

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
              {kindLabel(entry)}
            </Badge>
            {entry.extra > 0 && (
              <span className="text-[12px] font-medium text-ink-4">
                추가 {won(entry.extra)}
              </span>
            )}
            {logs.length > 0 && (
              <button
                onClick={() => setShowLogs((v) => !v)}
                className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-bold text-accent-deep"
              >
                수정 {logs.length}회
              </button>
            )}
          </div>

          {entry.mode === "bulk" && (
            <p className="tnum mt-1.5 text-[12px] text-ink-3">
              신용 {won(entry.credit)} · 착불 {won(entry.cod)}
            </p>
          )}

          {(entry.expense > 0 || entry.minutes) && (
            <p className="tnum mt-1 text-[12px] text-ink-4">
              {entry.expense > 0 && `지출 ${won(entry.expense)}`}
              {entry.expense > 0 && entry.minutes ? " · " : ""}
              {entry.minutes ? `${entry.minutes}분` : ""}
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

          {canEdit ? (
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
                  setError(undefined);
                  startTransition(async () => {
                    const res = await deleteEntry(entry.id);
                    if (!res.ok) setError(res.error);
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
          ) : (
            lockedReason && (
              <span className="text-right text-[11px] leading-tight text-ink-4">
                {lockedReason}
              </span>
            )
          )}
        </div>
      </div>

      {error && (
        <div className="mt-2.5">
          <Alert>{error}</Alert>
        </div>
      )}

      {showLogs && logs.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-ink/8 pt-3">
          {logs.map((log) => {
            const changes = diffOf(log);
            return (
              <div key={log.id} className="text-[12px] leading-relaxed">
                <p className="font-bold text-ink-2">
                  {prettyDateTime(log.created_at)}
                  <span className="ml-1.5 font-semibold text-ink-4">
                    {log.editor_id
                      ? (editorNames[log.editor_id] ?? "알 수 없음")
                      : "알 수 없음"}
                  </span>
                </p>
                {changes.length === 0 ? (
                  <p className="text-ink-4">내용 변경</p>
                ) : (
                  <ul className="mt-0.5 space-y-0.5">
                    {changes.map((c) => (
                      <li key={c.field} className="tnum text-ink-3">
                        {FIELD_LABEL[c.field]}{" "}
                        <span className="text-ink-4 line-through">
                          {fmt(c.field, c.from)}
                        </span>
                        <span className="mx-1 text-ink-4">→</span>
                        <span className="font-bold text-ink">
                          {fmt(c.field, c.to)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function EditForm({
  entry,
  onClose,
  onError,
}: {
  entry: Entry;
  onClose: () => void;
  onError: (msg?: string) => void;
}) {
  const [kind, setKind] = useState<Kind>(kindOf(entry));
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const isBulk = entry.mode === "bulk";
  // 건별은 금액이 신용/착불 중 한쪽에만 들어갑니다.
  const single = entry.credit + entry.cod;

  return (
    <Card className="border-brand-300 p-4">
      <form
        action={(fd) => {
          fd.set("id", entry.id);
          if (!isBulk) {
            const amount = String(fd.get("amount") ?? "");
            fd.set("credit", kind === "credit" ? amount : "0");
            fd.set("cod", kind === "cod" ? amount : "0");
          }
          setError(undefined);
          startTransition(async () => {
            const res = await updateEntry(fd);
            if (res.ok) {
              onError(undefined);
              onClose();
            } else setError(res.error);
          });
        }}
        className="space-y-3"
      >
        {!isBulk ? (
          <>
            <div>
              <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">
                결제 구분
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(["credit", "cod"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={cn(
                      "flex h-11 items-center justify-center gap-2 rounded-xl border-2 text-[14px] font-bold transition-all",
                      kind === k
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-ink/10 bg-card text-ink-3",
                    )}
                  >
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        k === "credit" ? "bg-brand-400" : "bg-accent",
                      )}
                    />
                    {k === "credit" ? "신용" : "착불"}
                  </button>
                ))}
              </div>
            </div>

            <Field label="운임">
              <MoneyInput name="amount" defaultValue={single || undefined} />
            </Field>
            <input type="hidden" name="count" value={entry.count} />
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="신용">
              <MoneyInput name="credit" defaultValue={entry.credit} />
            </Field>
            <Field label="착불">
              <MoneyInput name="cod" defaultValue={entry.cod} />
            </Field>
            <Field label="건수">
              <Input
                name="count"
                inputMode="numeric"
                defaultValue={entry.count}
                className="tnum text-right text-[17px] font-semibold"
              />
            </Field>
            <Field label="추가금">
              <MoneyInput name="extra" defaultValue={entry.extra} />
            </Field>
          </div>
        )}

        {!isBulk && (
          <Field label="추가금">
            <MoneyInput name="extra" defaultValue={entry.extra} />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="지출" optional>
            <MoneyInput name="expense" defaultValue={entry.expense || undefined} />
          </Field>
          <Field label="운행시간" optional>
            <div className="relative">
              <Input
                name="minutes"
                inputMode="numeric"
                defaultValue={entry.minutes ?? ""}
                className="tnum pr-8 text-right text-[17px] font-semibold"
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] font-medium text-ink-4">
                분
              </span>
            </div>
          </Field>
        </div>

        <Field label="메모" optional>
          <Input name="memo" defaultValue={entry.memo ?? ""} maxLength={100} />
        </Field>

        {error && <Alert>{error}</Alert>}

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
