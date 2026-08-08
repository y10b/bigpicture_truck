"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveNotice, type NoticeState } from "../notice-actions";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";
import type { Notice } from "@/lib/types";

function Submit({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="flex-1" disabled={pending}>
      {pending ? "저장 중…" : isEdit ? "수정하기" : "공지 올리기"}
    </Button>
  );
}

export default function NoticeEditor({ notice }: { notice?: Notice }) {
  const [state, action] = useActionState<NoticeState, FormData>(saveNotice, {});

  return (
    <Card className="p-4">
      <form action={action} className="space-y-4">
        {notice && <input type="hidden" name="id" value={notice.id} />}

        <Field label="제목">
          <Input
            name="title"
            defaultValue={notice?.title}
            placeholder="예: 이번 주 토요일 근무 안내"
            maxLength={120}
            autoFocus={!notice}
          />
        </Field>

        <Field label="내용" hint="줄바꿈 그대로 보입니다">
          <Textarea
            name="body"
            defaultValue={notice?.body}
            rows={10}
            placeholder="직원들에게 전달할 내용을 적어 주세요."
            className="text-[15px] leading-relaxed"
          />
        </Field>

        <label className="flex items-center gap-2.5 rounded-xl border border-ink/10 bg-paper-2/50 px-3.5 py-3">
          <input
            type="checkbox"
            name="pinned"
            defaultChecked={notice?.pinned}
            className="h-5 w-5 accent-[var(--color-brand-500)]"
          />
          <span className="text-[14px] font-semibold">
            📌 중요 공지로 맨 위에 고정
          </span>
        </label>

        {state.error && <Alert>{state.error}</Alert>}

        <div className="flex gap-2">
          <Link href="/admin/notices" className="flex-1">
            <Button type="button" variant="outline" size="lg" className="w-full">
              취소
            </Button>
          </Link>
          <Submit isEdit={Boolean(notice)} />
        </div>
      </form>
    </Card>
  );
}
