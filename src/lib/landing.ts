import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/**
 * 앱을 열었을 때 어디로 보낼지 정합니다.
 *
 * 안 읽은 공지가 있으면 공지부터 보여 줍니다 — 하단 탭에 빨간 점만 띄워서는
 * 그냥 지나치는 분이 많았습니다.
 *
 * 공지 목록을 여는 순간 '읽음' 으로 처리되므로, 한 번 보고 나면
 * 다음부터는 평소 화면으로 바로 갑니다. 계속 붙잡아 두지 않습니다.
 */
export async function landingPath(
  profile: Pick<Profile, "role" | "notices_seen_at">,
) {
  const home = profile.role === "admin" ? "/admin" : "/home";

  const supabase = await createClient();
  const { count } = await supabase
    .from("notices")
    .select("id", { count: "exact", head: true })
    .gt("created_at", profile.notices_seen_at ?? "1970-01-01T00:00:00Z");

  return (count ?? 0) > 0 ? "/notices" : home;
}
