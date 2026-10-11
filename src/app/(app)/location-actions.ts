"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { isMandatoryNow, shouldTrackNow } from "@/lib/tracking";

/**
 * 기사 현재 위치를 저장합니다. 사람당 한 줄이라 계속 덮어씁니다.
 *
 * 근무시간(08~22시) 밖이거나 본인이 위치 공유를 꺼두었으면 조용히 버립니다.
 * 앱에서도 한 번 거르지만, 서버에서 막아야 확실합니다.
 */
export async function saveLocation(input: {
  lat: number;
  lng: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  recordedAt?: string;
}): Promise<{ ok: boolean; skipped?: string }> {
  const profile = await requireProfile();

  // 오후 5시까지는 꺼 두셨어도 받습니다. 그 뒤로는 켜 두신 경우만.
  if (!shouldTrackNow(profile.share_location)) {
    return { ok: true, skipped: "지금은 위치를 받지 않습니다" };
  }

  const { lat, lng } = input;
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return { ok: false };
  }

  const supabase = await createClient();
  const recordedAt = input.recordedAt ?? new Date().toISOString();

  // 거리부터 더합니다. driver_locations 를 덮어쓰기 전에 해야
  // 직전 점과의 거리를 잴 수 있습니다.
  await supabase.rpc("add_distance", {
    p_lat: lat,
    p_lng: lng,
    p_accuracy: input.accuracy ?? null,
    p_recorded_at: recordedAt,
  });

  const { error } = await supabase.from("driver_locations").upsert(
    {
      user_id: profile.id,
      lat,
      lng,
      accuracy: input.accuracy ?? null,
      speed: input.speed ?? null,
      heading: input.heading ?? null,
      recorded_at: recordedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) return { ok: false };
  return { ok: true };
}

/** 기사 본인이 위치 공유를 켜고 끕니다. */
export async function setShareLocation(on: boolean) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ share_location: on })
    .eq("id", profile.id);

  if (error) return { ok: false, error: "변경에 실패했습니다." };

  // 껐으면 마지막으로 남아 있던 위치도 지웁니다.
  // 다만 필수 구간(오후 5시 이전)에는 어차피 곧 다시 들어오므로 그대로 둡니다 —
  // 지웠다가 몇 초 뒤 다시 뜨면 관리자 화면이 깜빡이는 것처럼 보입니다.
  if (!on && !isMandatoryNow()) {
    await supabase.from("driver_locations").delete().eq("user_id", profile.id);
  }

  revalidatePath("/me");
  return { ok: true };
}
