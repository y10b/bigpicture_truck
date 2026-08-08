import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Notice } from "@/lib/types";
import NoticeEditor from "../NoticeEditor";

export const metadata = { title: "공지 수정 · BIG PICTURE" };

export default async function EditNoticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase
    .from("notices")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  return (
    <div className="space-y-4 rise">
      <h1 className="text-[20px] font-extrabold tracking-tight">공지 수정</h1>
      <NoticeEditor notice={data as Notice} />
    </div>
  );
}
