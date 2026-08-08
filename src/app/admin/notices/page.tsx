import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Notice } from "@/lib/types";
import { Button, Card, Empty } from "@/components/ui";
import NoticeAdminRow from "./NoticeAdminRow";

export const metadata = { title: "공지 관리 · BIG PICTURE" };

export default async function AdminNoticesPage() {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase
    .from("notices")
    .select("*")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });

  const notices = (data ?? []) as Notice[];

  return (
    <div className="space-y-4 rise">
      <div className="flex items-baseline justify-between">
        <h1 className="text-[20px] font-extrabold tracking-tight">공지 관리</h1>
        <span className="text-[13px] font-semibold text-ink-4">
          총 <span className="tnum">{notices.length}</span>건
        </span>
      </div>

      <Link href="/admin/notices/new">
        <Button variant="dark" size="lg" className="w-full">
          + 새 공지 작성
        </Button>
      </Link>

      {notices.length === 0 ? (
        <Card>
          <Empty
            icon="📢"
            title="아직 올린 공지가 없습니다"
            desc="직원들이 공지사항 탭에서 바로 확인합니다."
          />
        </Card>
      ) : (
        <ul className="space-y-2.5">
          {notices.map((n) => (
            <li key={n.id}>
              <NoticeAdminRow notice={n} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
