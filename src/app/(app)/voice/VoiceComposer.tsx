"use client";

import { useState, useTransition } from "react";
import { sendVoice } from "../voice-actions";
import { Alert, Button, Card, Textarea, cn } from "@/components/ui";

/**
 * 사장님께 보내는 글쓰기 칸.
 * 기본은 익명입니다 — 이름을 밝히는 쪽을 굳이 눌러야 실명으로 갑니다.
 */
export default function VoiceComposer({ canRead }: { canRead: boolean }) {
  const [body, setBody] = useState("");
  const [named, setNamed] = useState(false);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  // 읽는 쪽은 답장으로 소통하므로, 새로 쓰는 칸은 접어 둡니다.
  const [open, setOpen] = useState(!canRead);

  if (sent) {
    return (
      <Card className="border-brand-200 bg-brand-50/60 p-5 text-center">
        <p className="text-[15px] font-extrabold text-brand-700">
          잘 전달됐습니다
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-3">
          답장이 오면 아래 &lsquo;내가 보낸 이야기&rsquo;에서 볼 수 있습니다.
        </p>
        <Button
          variant="outline"
          className="mt-3.5 w-full"
          onClick={() => setSent(false)}
        >
          하나 더 쓰기
        </Button>
      </Card>
    );
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="lg"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        나도 이야기 보내기
      </Button>
    );
  }

  return (
    <Card className="p-4">
      <form
        action={(fd) => {
          setError(undefined);
          startTransition(async () => {
            const res = await sendVoice(fd);
            if (!res.ok) {
              setError(res.error);
              return;
            }
            setBody("");
            setNamed(false);
            setSent(true);
          });
        }}
        className="space-y-3"
      >
        <Textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder={"예) 배차가 몰리는 날은 점심 먹을 시간이 없습니다.\n예) 이런 게 있으면 일하기 편할 것 같습니다."}
        />

        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            name="named"
            checked={named}
            onChange={(e) => setNamed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand-500)]"
          />
          <span className="text-[13px] leading-snug">
            <span className="font-bold">내 이름을 밝히고 보내기</span>
            <span className="mt-0.5 block text-[12px] text-ink-4">
              {named
                ? "사장님께 이름이 함께 보입니다."
                : "지금은 익명입니다. 누가 썼는지 아무도 알 수 없습니다."}
            </span>
          </span>
        </label>

        {error && <Alert>{error}</Alert>}

        <Button
          type="submit"
          size="lg"
          className={cn("w-full")}
          disabled={body.trim().length === 0 || pending}
        >
          {pending ? "보내는 중…" : "보내기"}
        </Button>
      </form>
    </Card>
  );
}
