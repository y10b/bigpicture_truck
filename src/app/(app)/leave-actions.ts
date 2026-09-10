"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export type LeaveResult = { ok: boolean; error?: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 한 달에 하루입니다. DB 트리거가 최종적으로 막지만, 메시지는 여기서 다듬습니다. */
function friendlyError(message: string) {
  if (message.includes("한 달에 월차는"))
    return "이 달에는 이미 월차를 잡아 두셨습니다.";
  if (message.includes("leaves_user_id_leave_date_key"))
    return "그날은 이미 월차로 잡혀 있습니다.";
  return "저장하지 못했습니다. 다시 시도해 주세요.";
}

/** 월차 등록. 관리자는 다른 사람 것도 넣을 수 있습니다. */
export async function addLeave(formData: FormData): Promise<LeaveResult> {
  const me = await requireProfile();
  const supabase = await createClient();

  const date = String(formData.get("leave_date") ?? "");
  if (!DATE_RE.test(date)) return { ok: false, error: "날짜를 골라 주세요." };

  const requested = String(formData.get("user_id") ?? "") || me.id;
  // 남의 월차를 넣는 건 관리자만 됩니다 (DB 정책도 같이 막습니다).
  if (requested !== me.id && me.role !== "admin")
    return { ok: false, error: "본인 월차만 등록할 수 있습니다." };

  const { error } = await supabase.from("leaves").insert({
    user_id: requested,
    leave_date: date,
    memo: String(formData.get("memo") ?? "").trim() || null,
    created_by: me.id,
  });

  if (error) return { ok: false, error: friendlyError(error.message) };

  revalidatePath("/leave");
  revalidatePath("/admin/attendance");
  return { ok: true };
}

/** 월차 취소. 본인 것이거나, 관리자면 누구 것이든 지울 수 있습니다. */
export async function removeLeave(id: string): Promise<LeaveResult> {
  await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("leaves").delete().eq("id", id);
  if (error) return { ok: false, error: "취소하지 못했습니다." };

  revalidatePath("/leave");
  revalidatePath("/admin/attendance");
  return { ok: true };
}

/** 월차 날짜 변경 — 관리자가 잘못 잡힌 날을 고칠 때 씁니다. */
export async function moveLeave(formData: FormData): Promise<LeaveResult> {
  await requireProfile();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  const date = String(formData.get("leave_date") ?? "");
  if (!id || !DATE_RE.test(date))
    return { ok: false, error: "날짜를 골라 주세요." };

  const { error } = await supabase
    .from("leaves")
    .update({ leave_date: date })
    .eq("id", id);

  if (error) return { ok: false, error: friendlyError(error.message) };

  revalidatePath("/leave");
  revalidatePath("/admin/attendance");
  return { ok: true };
}
