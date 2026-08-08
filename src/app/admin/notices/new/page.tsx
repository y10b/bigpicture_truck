import { requireAdmin } from "@/lib/auth";
import NoticeEditor from "../NoticeEditor";

export const metadata = { title: "새 공지 · BIG PICTURE" };

export default async function NewNoticePage() {
  await requireAdmin();

  return (
    <div className="space-y-4 rise">
      <h1 className="text-[20px] font-extrabold tracking-tight">새 공지 작성</h1>
      <NoticeEditor />
    </div>
  );
}
