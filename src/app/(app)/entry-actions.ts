"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { isWrittenToday } from "@/lib/format";

export type ActionResult = { ok: boolean; error?: string };

function toInt(v: FormDataEntryValue | null) {
  const n = Number(String(v ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 이 내역을 고치거나 지울 수 있는지 판단합니다.
 *
 * - 관리자: 누구 내역이든 언제든 가능 (직원이 잘못 올린 걸 바로잡아야 하므로)
 * - 직원  : 본인 것만, 그리고 **오늘 적은 것**만
 *
 * 기준을 work_date 가 아니라 적은 날(created_at)로 잡은 이유는,
 * 지난 날짜를 뒤늦게 입력하는 경우가 있어서입니다. 방금 적은 것은 바로
 * 고칠 수 있어야 하고, 어제 적어 둔 것은 잠겨야 합니다.
 *
 * DB 쪽 RLS 에도 같은 규칙이 걸려 있습니다 (여기만 믿으면 우회 가능).
 */
async function canModify(entryId: string): Promise<ActionResult> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("entries")
    .select("user_id, created_at")
    .eq("id", entryId)
    .maybeSingle();

  if (!data) return { ok: false, error: "내역을 찾을 수 없습니다." };
  if (profile.role === "admin") return { ok: true };
  if (data.user_id !== profile.id) {
    return { ok: false, error: "본인 내역만 수정할 수 있습니다." };
  }
  if (!isWrittenToday(data.created_at)) {
    return {
      ok: false,
      error: "오늘 적은 것만 수정할 수 있습니다. 지난 것은 관리자에게 말씀해 주세요.",
    };
  }
  return { ok: true };
}

/** 하루 마감 — 하루치를 몰아서 저장 (건수 + 신용합계 + 착불합계 + 추가금합계) */
export async function addBulkEntry(formData: FormData): Promise<ActionResult> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const workDate = String(formData.get("work_date") ?? "");
  if (!DATE_RE.test(workDate)) return { ok: false, error: "날짜가 올바르지 않습니다." };

  const count = toInt(formData.get("count"));
  const credit = toInt(formData.get("credit"));
  const cod = toInt(formData.get("cod"));
  const extra = toInt(formData.get("extra"));
  const memo = String(formData.get("memo") ?? "").trim() || null;

  if (count === 0 && credit === 0 && cod === 0 && extra === 0) {
    return { ok: false, error: "건수나 금액을 입력해 주세요." };
  }

  const { error } = await supabase.from("entries").insert({
    user_id: profile.id,
    work_date: workDate,
    mode: "bulk",
    count,
    credit,
    cod,
    extra,
    expense: toInt(formData.get("expense")),
    minutes: toInt(formData.get("minutes")) || null,
    memo,
  });

  if (error) return { ok: false, error: "저장에 실패했습니다. 다시 시도해 주세요." };

  revalidatePath("/home");
  revalidatePath("/history");
  return { ok: true };
}

/**
 * 기존 항목 수정.
 * 신용↔착불을 바꾸는 것까지 여기서 처리합니다 (잘못 고른 경우가 잦습니다).
 */
export async function updateEntry(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "잘못된 요청입니다." };

  const allowed = await canModify(id);
  if (!allowed.ok) return allowed;

  const supabase = await createClient();

  const count = toInt(formData.get("count"));
  const credit = toInt(formData.get("credit"));
  const cod = toInt(formData.get("cod"));
  const extra = toInt(formData.get("extra"));

  if (count === 0 && credit === 0 && cod === 0 && extra === 0) {
    return { ok: false, error: "건수나 금액을 입력해 주세요." };
  }

  const { error } = await supabase
    .from("entries")
    .update({
      count: count || 1,
      credit,
      cod,
      extra,
      expense: toInt(formData.get("expense")),
      minutes: toInt(formData.get("minutes")) || null,
      memo: String(formData.get("memo") ?? "").trim() || null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: "수정에 실패했습니다." };

  revalidatePath("/home");
  revalidatePath("/history");
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/** 항목 삭제 */
export async function deleteEntry(id: string): Promise<ActionResult> {
  const allowed = await canModify(id);
  if (!allowed.ok) return allowed;

  const supabase = await createClient();
  const { error } = await supabase.from("entries").delete().eq("id", id);
  if (error) return { ok: false, error: "삭제에 실패했습니다." };

  revalidatePath("/home");
  revalidatePath("/history");
  revalidatePath("/admin", "layout");
  return { ok: true };
}
