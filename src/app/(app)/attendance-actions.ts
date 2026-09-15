"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushToAdmins } from "@/lib/notify";

/**
 * 앱을 켤 때 출근을 남깁니다.
 *
 * 그날 처음이면 true 가 옵니다 — 그때만 관리자에게 알림을 보냅니다.
 * 앱을 열 때마다 울리면 아무도 안 보게 됩니다.
 */
export async function checkIn(): Promise<{ first: boolean }> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("check_in");
  if (error || data !== true) return { first: false };

  // 누가 나왔는지 이름을 붙여 보냅니다.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const admin = createAdminClient();
    const { data: me } = await admin
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle();

    const now = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());

    // 알림이 실패해도 출근 기록은 이미 남았으니 그대로 넘어갑니다.
    await pushToAdmins(
      {
        title: "출근",
        body: `${me?.name ?? "직원"} · ${now}`,
        link: "/admin/attendance",
      },
      user.id,
    ).catch(() => {});
  }

  revalidatePath("/admin");
  revalidatePath("/admin/attendance");
  return { first: true };
}
