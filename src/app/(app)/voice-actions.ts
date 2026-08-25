"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export type VoiceResult = { ok: boolean; error?: string };

const MAX_LEN = 2000;

/**
 * 사장님께 이야기를 보냅니다.
 * 익명으로 보내면 읽는 쪽에 이름이 아예 가지 않습니다.
 */
export async function sendVoice(formData: FormData): Promise<VoiceResult> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { ok: false, error: "내용을 입력해 주세요." };
  if (body.length > MAX_LEN)
    return { ok: false, error: `${MAX_LEN}자 안으로 적어 주세요.` };

  const { error } = await supabase.from("voice_messages").insert({
    author_id: profile.id,
    // 체크를 풀었을 때만 실명입니다. 기본은 익명 쪽이 안전합니다.
    anonymous: formData.get("named") !== "on",
    body,
  });

  if (error) return { ok: false, error: "보내지 못했습니다. 다시 시도해 주세요." };

  revalidatePath("/voice");
  return { ok: true };
}

/** 아직 읽히기 전이라면 거둬들일 수 있습니다 (RLS 가 read_at 으로 막습니다). */
export async function deleteVoice(id: string): Promise<VoiceResult> {
  await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("voice_messages").delete().eq("id", id);
  if (error) return { ok: false, error: "삭제하지 못했습니다." };

  revalidatePath("/voice");
  return { ok: true };
}

/** 읽음 표시 — 읽을 권한이 있는 사람만 통과합니다(함수 안에서 검사). */
export async function markVoiceRead(id: string): Promise<VoiceResult> {
  await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("voice_mark_read", { target: id });
  if (error) return { ok: false, error: "처리하지 못했습니다." };

  revalidatePath("/voice");
  return { ok: true };
}

/** 답장 — 보낸 사람은 익명이어도 자기 글에 달린 답장을 봅니다. */
export async function replyVoice(formData: FormData): Promise<VoiceResult> {
  await requireProfile();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  const text = String(formData.get("reply") ?? "").trim();
  if (!id) return { ok: false, error: "대상을 찾지 못했습니다." };
  if (text.length > MAX_LEN)
    return { ok: false, error: `${MAX_LEN}자 안으로 적어 주세요.` };

  const { error } = await supabase.rpc("voice_reply", {
    target: id,
    reply_text: text,
  });
  if (error) return { ok: false, error: "답장을 남기지 못했습니다." };

  revalidatePath("/voice");
  return { ok: true };
}
