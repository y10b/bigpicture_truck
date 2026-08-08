import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { prettyDateTime } from "@/lib/format";
import type { Notice } from "@/lib/types";
import { Badge, Card } from "@/components/ui";
import NoticeBody from "@/components/NoticeBody";
import { normalizeBlocks } from "@/lib/notice-blocks";

export default async function NoticeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireProfile();
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase
    .from("notices")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const notice = data as Notice;

  return (
    <div className="space-y-4 rise">
      <Link
        href="/notices"
        className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-3"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
        공지사항
      </Link>

      <Card className="p-5">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {notice.pinned && <Badge tone="accent">📌 중요</Badge>}
          <span className="text-[12px] text-ink-4">
            {prettyDateTime(notice.created_at)}
          </span>
        </div>

        <h1 className="text-[19px] leading-snug font-extrabold tracking-tight">
          {notice.title}
        </h1>

        <div className="mt-4 border-t border-ink/8 pt-4">
          <NoticeBody blocks={normalizeBlocks(notice.blocks)} body={notice.body} />
        </div>
      </Card>
    </div>
  );
}
