"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * 앱을 켤 때 출근을 남깁니다.
 *
 * 그날 처음이면 true 가 옵니다 — 화면에서 "출근했습니다" 를 한 번만 띄우려고요.
 * 여러 번 불려도 마지막 시각만 갱신되므로 그냥 켤 때마다 부르면 됩니다.
 */
export async function checkIn(): Promise<{ first: boolean }> {
  const supabase = await createClient();

  // 로그인 안 된 상태면 함수 안에서 false 를 돌려줍니다.
  const { data, error } = await supabase.rpc("check_in");
  if (error) return { first: false };

  // 처음 켠 날에만 관리자 화면을 새로 그리게 합니다.
  if (data === true) revalidatePath("/admin");

  return { first: data === true };
}
