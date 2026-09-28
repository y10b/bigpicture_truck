"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export type PwState = { ok?: boolean; error?: string };

export async function changePasswordAction(
  _prev: PwState,
  formData: FormData,
): Promise<PwState> {
  const profile = await requireProfile();

  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 6) return { error: "비밀번호는 6자 이상으로 정해 주세요." };
  if (next !== confirm) return { error: "두 비밀번호가 서로 다릅니다." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { error: "변경에 실패했습니다. 잠시 후 다시 시도해 주세요." };

  // 본인이 직접 정했으므로 임시 비밀번호 상태를 해제합니다.
  await supabase
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", profile.id);

  revalidatePath("/", "layout");
  return { ok: true };
}

export type InfoState = { ok?: boolean; error?: string };

/**
 * 차량번호 · 차종 · 계좌를 본인이 고칩니다.
 *
 * 권한이나 번호 같은 칸은 여기서 안 받습니다 — DB 트리거가 한 번 더 막지만,
 * 애초에 보내지 않는 게 맞습니다.
 */
export async function updateMyInfoAction(
  _prev: InfoState,
  formData: FormData,
): Promise<InfoState> {
  const profile = await requireProfile();
  const text = (k: string, max: number) => {
    const v = String(formData.get(k) ?? "").trim();
    return v.slice(0, max) || null;
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      vehicle_no: text("vehicle_no", 20),
      vehicle_type: text("vehicle_type", 30),
      bank_account: text("bank_account", 60),
    })
    .eq("id", profile.id);

  if (error) return { error: "저장에 실패했습니다. 다시 시도해 주세요." };

  revalidatePath("/me");
  return { ok: true };
}
