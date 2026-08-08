"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeBlocks } from "@/lib/notice-blocks";

export type NoticeState = { error?: string };

export async function saveNotice(
  _prev: NoticeState,
  formData: FormData,
): Promise<NoticeState> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const pinned = formData.get("pinned") === "on";

  if (!title) return { error: "제목을 입력해 주세요." };

  // AI 서식은 저장할 때 한 번만 넣어두고, 이후에는 읽기만 합니다.
  const rawBlocks = formData.get("blocks");
  let blocks = null;
  if (typeof rawBlocks === "string" && rawBlocks) {
    try {
      blocks = normalizeBlocks(JSON.parse(rawBlocks));
    } catch {
      blocks = null;
    }
  }

  const { error } = id
    ? await supabase
        .from("notices")
        .update({ title, body, pinned, blocks })
        .eq("id", id)
    : await supabase
        .from("notices")
        .insert({ title, body, pinned, blocks, author_id: admin.id });

  if (error) return { error: "저장에 실패했습니다. 다시 시도해 주세요." };

  revalidatePath("/admin/notices");
  revalidatePath("/notices");
  redirect("/admin/notices");
}

export async function deleteNotice(id: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("notices").delete().eq("id", id);
  if (error) return { ok: false, error: "삭제에 실패했습니다." };

  revalidatePath("/admin/notices");
  revalidatePath("/notices");
  return { ok: true };
}

export async function toggleNoticePin(id: string, pinned: boolean) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("notices").update({ pinned }).eq("id", id);
  if (error) return { ok: false, error: "변경에 실패했습니다." };

  revalidatePath("/admin/notices");
  revalidatePath("/notices");
  return { ok: true };
}
