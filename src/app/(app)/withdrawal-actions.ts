"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export type WithdrawResult = { ok: boolean; error?: string };

function toInt(v: FormDataEntryValue | null) {
  const n = Number(String(v ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 출금 기록 추가 (보통 그 주 마지막 근무일에 적습니다) */
export async function addWithdrawal(formData: FormData): Promise<WithdrawResult> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const workDate = String(formData.get("work_date") ?? "");
  if (!DATE_RE.test(workDate)) return { ok: false, error: "날짜가 올바르지 않습니다." };

  const amount = toInt(formData.get("amount"));
  if (amount === 0) return { ok: false, error: "출금액을 입력해 주세요." };

  const { error } = await supabase.from("withdrawals").insert({
    user_id: profile.id,
    work_date: workDate,
    amount,
    memo: String(formData.get("memo") ?? "").trim() || null,
  });

  if (error) return { ok: false, error: "저장에 실패했습니다. 다시 시도해 주세요." };

  revalidatePath("/home");
  revalidatePath("/history");
  return { ok: true };
}

/** 출금 기록 삭제 */
export async function deleteWithdrawal(id: string): Promise<WithdrawResult> {
  await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("withdrawals").delete().eq("id", id);
  if (error) return { ok: false, error: "삭제에 실패했습니다." };

  revalidatePath("/home");
  revalidatePath("/history");
  return { ok: true };
}
