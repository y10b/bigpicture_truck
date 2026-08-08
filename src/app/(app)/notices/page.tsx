import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { prettyDateTime } from "@/lib/format";
import type { Notice } from "@/lib/types";
import { Badge, Card, Empty } from "@/components/ui";
import MarkSeen from "./MarkSeen";

export const metadata = { title: "공지사항 · BIG PICTURE" };

export default async function NoticesPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("notices")
    .select("*")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  const notices = (data ?? []) as Notice[];
  const seenAt = profile.notices_seen_at
    ? new Date(profile.notices_seen_at)
    : null;

  return (
    <div className="space-y-4 rise">
      <MarkSeen />

      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-extrabold tracking-tight">공지사항</h1>
        {profile.role === "admin" && (
          <Link
            href="/admin/notices"
            className="rounded-lg border border-ink/12 bg-card px-3 py-1.5 text-[12px] font-bold text-ink-2"
          >
            공지 관리
          </Link>
        )}
      </div>

      {notices.length === 0 ? (
        <Card>
          <Empty icon="📢" title="등록된 공지가 없습니다" />
        </Card>
      ) : (
        <ul className="space-y-2">
          {notices.map((n) => {
            const isNew = !seenAt || new Date(n.created_at) > seenAt;
            return (
              <li key={n.id}>
                <Link href={`/notices/${n.id}`}>
                  <Card className="p-4 transition-colors active:bg-paper-2">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      {n.pinned && <Badge tone="accent">📌 중요</Badge>}
                      {isNew && <Badge tone="brand">NEW</Badge>}
                      <span className="text-[12px] text-ink-4">
                        {prettyDateTime(n.created_at)}
                      </span>
                    </div>
                    <p className="text-[15px] leading-snug font-bold">{n.title}</p>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-3">
                      {n.body}
                    </p>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
