"use client";

import { useTransition } from "react";
import { deleteVoice } from "../voice-actions";
import { Badge, Card, CardHeader, Empty, cn } from "@/components/ui";
import { prettyDateTime } from "@/lib/format";

export type MyVoice = {
  id: string;
  body: string;
  anonymous: boolean;
  reply: string | null;
  replied_at: string | null;
  read_at: string | null;
  created_at: string;
};

/**
 * 내가 보낸 이야기.
 * 익명으로 보냈어도 본인 화면에서는 보입니다 — 답장을 받아 봐야 하니까요.
 */
export default function MyVoiceList({ items }: { items: MyVoice[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <Card className="overflow-hidden">
      <CardHeader title="내가 보낸 이야기" desc="답장이 오면 여기에 붙습니다" />

      {items.length === 0 ? (
        <Empty icon="🕊️" title="아직 보낸 이야기가 없습니다" />
      ) : (
        <ul className="divide-y divide-ink/6">
          {items.map((m) => (
            <li
              key={m.id}
              className={cn("px-4 py-3.5", pending && "opacity-40")}
            >
              <div className="flex items-center gap-1.5">
                <Badge tone={m.anonymous ? "neutral" : "brand"}>
                  {m.anonymous ? "익명으로 보냄" : "이름 밝힘"}
                </Badge>
                <span className="text-[11px] font-semibold text-ink-4">
                  {m.read_at ? "읽음" : "아직 안 읽음"}
                </span>
                <span className="ml-auto text-[11px] text-ink-4">
                  {prettyDateTime(m.created_at)}
                </span>
              </div>

              <p className="mt-2 text-[14px] leading-relaxed whitespace-pre-wrap">
                {m.body}
              </p>

              {m.reply ? (
                <div className="mt-2.5 rounded-xl border border-brand-200 bg-brand-50/60 px-3.5 py-2.5">
                  <p className="text-[11px] font-bold text-brand-700">
                    사장님 답장
                    {m.replied_at && ` · ${prettyDateTime(m.replied_at)}`}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-wrap text-ink-2">
                    {m.reply}
                  </p>
                </div>
              ) : (
                !m.read_at && (
                  // 아직 안 읽혔을 때만 거둬들일 수 있습니다 (DB 에서도 막혀 있습니다)
                  <button
                    onClick={() =>
                      startTransition(() => {
                        void deleteVoice(m.id);
                      })
                    }
                    className="mt-2.5 rounded-lg px-2.5 py-1 text-[12px] font-semibold text-ink-4 transition-colors active:bg-ink/5"
                  >
                    보낸 것 취소
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
