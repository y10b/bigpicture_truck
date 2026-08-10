import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/**
 * 로그인된 사용자의 프로필. 없으면 null.
 *
 * 한 번의 요청 안에서 레이아웃과 페이지가 각각 부르기 때문에 React cache 로
 * 감쌌습니다. 이게 없으면 화면 하나 그릴 때 세션 확인과 프로필 조회가
 * 두 번씩 나가고, 그만큼 응답이 느려집니다.
 */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (data as Profile) ?? null;
});

/** 로그인 필수. 비활성 계정이면 로그아웃 처리. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.active) redirect("/login?error=inactive");
  return profile;
}

/**
 * 로그인 + 임시 비밀번호 교체까지 끝난 사용자만 통과시킵니다.
 * 앱 화면(직원/관리자)의 레이아웃에서 씁니다.
 */
export async function requireSettledProfile(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.must_change_password) redirect("/password-setup");
  return profile;
}

/** 관리자 전용 페이지 가드. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireSettledProfile();
  if (profile.role !== "admin") redirect("/home");
  return profile;
}
