"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { saveNotice } from "../notice-actions";
import { polishNotice, type PolishResult } from "../ai-actions";
import { Alert, Badge, Button, Card, Field, Input, Textarea, cn } from "@/components/ui";
import NoticeBody from "@/components/NoticeBody";
import { blocksToText, normalizeBlocks, type NoticeBlock } from "@/lib/notice-blocks";
import type { Notice } from "@/lib/types";

export default function NoticeEditor({ notice }: { notice?: Notice }) {
  const [title, setTitle] = useState(notice?.title ?? "");
  const [body, setBody] = useState(notice?.body ?? "");
  const [pinned, setPinned] = useState(notice?.pinned ?? false);

  // 이미 서식이 매겨진 공지를 수정하는 경우 그대로 들고 갑니다.
  const [blocks, setBlocks] = useState<NoticeBlock[] | null>(
    normalizeBlocks(notice?.blocks),
  );

  const [polish, setPolish] = useState<PolishResult | null>(null);
  const [error, setError] = useState<string>();
  const [polishing, startPolish] = useTransition();
  const [saving, startSave] = useTransition();

  const canSave = title.trim().length > 0;

  const runPolish = () =>
    startPolish(async () => {
      setError(undefined);
      setPolish(null);
      const res = await polishNotice(title, body);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPolish(res);
    });

  const applyPolish = () => {
    if (!polish?.blocks) return;
    setTitle(polish.title ?? title);
    setBody(blocksToText(polish.blocks));
    setBlocks(polish.blocks);
    setPolish(null);
  };

  const save = () =>
    startSave(async () => {
      setError(undefined);
      const fd = new FormData();
      if (notice) fd.set("id", notice.id);
      fd.set("title", title);
      fd.set("body", body);
      if (pinned) fd.set("pinned", "on");
      if (blocks) fd.set("blocks", JSON.stringify(blocks));

      const res = await saveNotice({}, fd);
      if (res?.error) setError(res.error);
    });

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="space-y-4">
          <Field label="제목" required>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setBlocks(null); // 글이 바뀌면 예전 서식은 버립니다
              }}
              placeholder="예: 이번 주 토요일 근무 안내"
              maxLength={120}
              autoFocus={!notice}
            />
          </Field>

          <Field label="내용" optional hint="줄바꿈 그대로 보입니다">
            <Textarea
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setBlocks(null);
              }}
              rows={10}
              placeholder="직원들에게 전달할 내용을 적어 주세요."
              className="text-[15px] leading-relaxed"
            />
          </Field>

          <label className="flex items-center gap-2.5 rounded-xl border border-ink/10 bg-paper-2/50 px-3.5 py-3">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="h-5 w-5 accent-[var(--color-brand-500)]"
            />
            <span className="text-[14px] font-semibold">
              📌 중요 공지로 맨 위에 고정
            </span>
          </label>

          {/* AI 다듬기 */}
          <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-brand-700">
                  ✨ AI로 다듬기
                </p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-brand-700/75">
                  맞춤법을 고치고, 중요한 부분을 크게·굵게·빨갛게 표시해 줍니다.
                  고친 내용을 먼저 보여드리니 확인하고 정하시면 됩니다.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full"
              disabled={!canSave || polishing}
              onClick={runPolish}
            >
              {polishing ? "다듬는 중…" : "다듬어 보기"}
            </Button>
          </div>

          {blocks && !polish && (
            <Alert tone="brand">
              서식이 적용된 상태입니다. 저장하면 이 모양으로 올라갑니다.
            </Alert>
          )}

          {error && <Alert>{error}</Alert>}
        </div>
      </Card>

      {/* 다듬기 결과 미리보기 */}
      {polish?.ok && polish.blocks && (
        <Card className="overflow-hidden border-brand-300 rise">
          <div className="border-b border-ink/8 bg-brand-50 px-4 py-3">
            <p className="text-[14px] font-extrabold text-brand-700">
              이렇게 바꿔봤습니다
            </p>
            <p className="mt-0.5 text-[12px] text-brand-700/75">
              마음에 들면 적용하고, 아니면 원래 글 그대로 두시면 됩니다.
            </p>
          </div>

          {polish.changes && polish.changes.length > 0 && (
            <div className="border-b border-ink/8 px-4 py-3">
              <p className="mb-2 text-[12px] font-bold text-ink-2">
                고친 곳 {polish.changes.length}군데
              </p>
              <ul className="space-y-1.5">
                {polish.changes.map((c, i) => (
                  <li key={i} className="text-[12px] leading-relaxed">
                    <span className="text-ink-4 line-through">{c.before}</span>
                    <span className="mx-1.5 text-ink-4">→</span>
                    <span className="font-bold text-ink">{c.after}</span>
                    <span className="ml-1.5 text-ink-4">({c.why})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {polish.changes?.length === 0 && (
            <div className="border-b border-ink/8 px-4 py-3">
              <p className="text-[12px] text-ink-4">
                맞춤법은 고칠 곳이 없었습니다. 강조 표시만 넣었습니다.
              </p>
            </div>
          )}

          <div className="px-4 py-4">
            <p className="mb-2 text-[12px] font-bold text-ink-4">미리보기</p>
            <div className="rounded-xl border border-ink/8 bg-paper p-4">
              <h2 className="mb-3 text-[17px] leading-snug font-extrabold">
                {polish.title}
              </h2>
              <NoticeBody blocks={polish.blocks} body="" />
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {(["title", "warn", "strong"] as const).map((s) => {
                const n = polish.blocks!.filter((b) => b.style === s).length;
                if (!n) return null;
                return (
                  <Badge
                    key={s}
                    tone={s === "warn" ? "danger" : s === "strong" ? "brand" : "neutral"}
                  >
                    {s === "title" ? "소제목" : s === "warn" ? "꼭 지킬 것" : "강조"} {n}
                  </Badge>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 border-t border-ink/8 p-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setPolish(null)}
            >
              내 글 그대로
            </Button>
            <Button type="button" className="flex-1" onClick={applyPolish}>
              이대로 적용
            </Button>
          </div>
        </Card>
      )}

      <div className="flex gap-2">
        <Link href="/admin/notices" className="flex-1">
          <Button type="button" variant="outline" size="lg" className="w-full">
            취소
          </Button>
        </Link>
        <Button
          type="button"
          size="lg"
          className={cn("flex-1")}
          disabled={!canSave || saving}
          onClick={save}
        >
          {saving ? "저장 중…" : notice ? "수정하기" : "공지 올리기"}
        </Button>
      </div>
    </div>
  );
}
