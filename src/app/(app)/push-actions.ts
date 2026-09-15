"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

/**
 * 이 기기로 알림을 받을 수 있게 토큰을 등록합니다.
 * 앱을 다시 깔거나 데이터를 지우면 토큰이 바뀌므로, 켤 때마다 덮어씁니다.
 */
export async function registerPushToken(
  token: string,
  platform = "android",
): Promise<{ ok: boolean }> {
  const profile = await requireProfile();
  if (!token || token.length > 4096) return { ok: false };

  const supabase = await createClient();
  const { error } = await supabase.from("push_tokens").upsert(
    {
      token,
      user_id: profile.id,
      platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "token" },
  );

  return { ok: !error };
}
