"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

/** 공지 목록을 열면 "읽음" 시각을 갱신해 하단 탭의 알림 점을 없앱니다. */
export async function markNoticesSeen() {
  const profile = await requireProfile();
  const supabase = await createClient();

  await supabase
    .from("profiles")
    .update({ notices_seen_at: new Date().toISOString() })
    .eq("id", profile.id);

  revalidatePath("/", "layout");
}
