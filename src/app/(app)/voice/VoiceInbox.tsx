"use client";

import { useState, useTransition } from "react";
import { markVoiceRead, replyVoice } from "../voice-actions";
import { Alert, Badge, Button, Card, CardHeader, Empty, Textarea, cn } from "@/components/ui";
import { prettyDateTime } from "@/lib/format";

export type InboxItem = {
  id: string;
  body: string;
  anonymous: boolean;
  /** 익명이면 서버에서 아예 null 로 옵니다 */
  author_name: string | null;
  created_at: string;
  read_at: string | null;
  reply: string | null;
  replied_at: string | null;
  replier_name: string | null;
};

/**
 * 받은 이야기 — 읽을 권한이 있는 사람에게만 보입니다.
 * 익명 글은 author_name 이 서버에서 비워진 채로 오므로,
 * 화면에서 실수로 이름을 흘릴 방법이 없습니다.
 */
export default function VoiceInbox({ items }: { items: InboxItem[] }) {
  const unread = items.filter((m) => !m.read_at).length;

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="받은 이야기"
        desc="사장님과 지정된 분만 볼 수 있습니다"
        right={
          unread > 0 ? (
            <span className="tnum rounded-full bg-danger px-2 py-0.5 text-[11px] font-bold text-white">
              새 {unread}
            </span>
          ) : null
        }
      />

      {items.length === 0 ? (
        <Empty icon="✉️" title="아직 들어온 이야기가 없습니다" />
      ) : (
        <ul className="divide-y divide-ink/6">
          {items.map((m) => (
            <InboxRow key={m.id} m={m} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function InboxRow({ m }: { m: InboxItem }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <li className={cn("px-4 py-3.5", !m.read_at && "bg-accent-soft/40")}>
      <div className="flex items-center gap-1.5">
        {m.anonymous ? (
          <Badge tone="neutral">익명</Badge>
        ) : (
          <span className="text-[14px] font-extrabold">{m.author_name}</span>
        )}
        {!m.read_at && (
          <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-label="안 읽음" />
        )}
        <span className="ml-auto text-[11px] text-ink-4">
          {prettyDateTime(m.created_at)}
        </span>
      </div>

      <p className="mt-2 text-[14px] leading-relaxed whitespace-pre-wrap">
        {m.body}
      </p>

      {m.reply && (
        <div className="mt-2.5 rounded-xl border border-brand-200 bg-brand-50/60 px-3.5 py-2.5">
          <p className="text-[11px] font-bold text-brand-700">
            내 답장
            {m.replier_name && ` · ${m.replier_name}`}
            {m.replied_at && ` · ${prettyDateTime(m.replied_at)}`}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-wrap text-ink-2">
            {m.reply}
          </p>
        </div>
      )}

      {open ? (
        <form
          action={(fd) => {
            fd.set("id", m.id);
            setError(undefined);
            startTransition(async () => {
              const res = await replyVoice(fd);
              if (res.ok) setOpen(false);
              else setError(res.error);
            });
          }}
          className="mt-3 space-y-2"
        >
          <Textarea
            name="reply"
            rows={3}
            maxLength={2000}
            defaultValue={m.reply ?? ""}
            autoFocus
            placeholder="답장을 적으면 보낸 사람만 볼 수 있습니다"
          />
          {error && <Alert>{error}</Alert>}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
            <Button type="submit" className="flex-1" disabled={pending}>
              {pending ? "저장 중…" : "답장 남기기"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-2.5 flex gap-1.5">
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg border border-ink/12 px-2.5 py-1 text-[12px] font-bold text-ink-3 transition-colors active:bg-paper-2"
          >
            {m.reply ? "답장 고치기" : "답장"}
          </button>
          {!m.read_at && (
            <button
              onClick={() =>
                startTransition(() => {
                  void markVoiceRead(m.id);
                })
              }
              className="rounded-lg px-2.5 py-1 text-[12px] font-semibold text-ink-4 transition-colors active:bg-ink/5"
            >
              읽음으로 표시
            </button>
          )}
        </div>
      )}
    </li>
  );
}
