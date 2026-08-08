"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

export async function updateLevySettings(formData: FormData) {
  await requireAdmin();

  const raw = String(formData.get("levy_amount") ?? "").replace(/[^\d]/g, "");
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, error: "금액을 정확히 입력해 주세요." };
  }

  const days = Number(String(formData.get("levy_days_per_week") ?? "5"));
  if (!Number.isInteger(days) || days < 0 || days > 7) {
    return { ok: false, error: "주당 일수는 0~7 사이로 정해 주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .update({ levy_amount: Math.floor(value), levy_days_per_week: days })
    .eq("id", 1);

  if (error) return { ok: false, error: "저장에 실패했습니다." };

  // 사납금은 모든 정산 화면의 숫자를 바꾸므로 전체를 다시 그립니다.
  revalidatePath("/", "layout");
  return { ok: true };
}
