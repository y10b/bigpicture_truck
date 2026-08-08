"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export type ActionResult = { ok: boolean; error?: string };

function toInt(v: FormDataEntryValue | null) {
  const n = Number(String(v ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 건별 1건 추가 (신용 또는 착불 + 추가금) */
export async function addSingleEntry(formData: FormData): Promise<ActionResult> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const workDate = String(formData.get("work_date") ?? "");
  if (!DATE_RE.test(workDate)) return { ok: false, error: "날짜가 올바르지 않습니다." };

  const kind = String(formData.get("kind") ?? "credit");
  const amount = toInt(formData.get("amount"));
  const extra = toInt(formData.get("extra"));
  const memo = String(formData.get("memo") ?? "").trim() || null;

  if (amount === 0 && extra === 0) {
    return { ok: false, error: "금액을 입력해 주세요." };
  }

  const { error } = await supabase.from("entries").insert({
    user_id: profile.id,
    work_date: workDate,
    mode: "single",
    count: 1,
    credit: kind === "credit" ? amount : 0,
    cod: kind === "cod" ? amount : 0,
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

/** 하루치 몰아서 저장 (건수 + 신용합계 + 착불합계 + 추가금합계) */
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

/** 기존 항목 수정 */
export async function updateEntry(formData: FormData): Promise<ActionResult> {
  await requireProfile();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "잘못된 요청입니다." };

  const { error } = await supabase
    .from("entries")
    .update({
      count: toInt(formData.get("count")) || 1,
      credit: toInt(formData.get("credit")),
      cod: toInt(formData.get("cod")),
      extra: toInt(formData.get("extra")),
      memo: String(formData.get("memo") ?? "").trim() || null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: "수정에 실패했습니다." };

  revalidatePath("/home");
  revalidatePath("/history");
  return { ok: true };
}

/** 항목 삭제 */
export async function deleteEntry(id: string): Promise<ActionResult> {
  await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("entries").delete().eq("id", id);
  if (error) return { ok: false, error: "삭제에 실패했습니다." };

  revalidatePath("/home");
  revalidatePath("/history");
  return { ok: true };
}
