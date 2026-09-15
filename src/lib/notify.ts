import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush, type PushMessage } from "@/lib/fcm";

/**
 * "누구에게" 를 정해 알림을 보냅니다.
 *
 * 토큰은 서비스 롤로만 읽습니다 — 남의 토큰이 브라우저까지 내려가면
 * 아무한테나 알림을 보낼 수 있게 되기 때문입니다.
 * 죽은 토큰은 보내 본 뒤 정리합니다(재설치하면 토큰이 바뀝니다).
 */
async function pushTo(userIds: string[], message: PushMessage) {
  if (userIds.length === 0) return;

  const admin = createAdminClient();
  const { data } = await admin
    .from("push_tokens")
    .select("token")
    .in("user_id", userIds);

  const tokens = (data ?? []).map((r) => r.token as string);
  if (tokens.length === 0) return;

  const result = await sendPush(tokens, message);

  if (result.deadTokens.length > 0) {
    await admin.from("push_tokens").delete().in("token", result.deadTokens);
  }
}

/** 관리자 전원 (본인은 빼고 — 본인 행동으로 본인에게 울릴 이유가 없습니다) */
export async function pushToAdmins(message: PushMessage, exceptUserId?: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("active", true);

  const ids = (data ?? [])
    .map((p) => p.id as string)
    .filter((id) => id !== exceptUserId);

  await pushTo(ids, message);
}

/** 지정한 사람들에게만 */
export async function pushToUsers(userIds: string[], message: PushMessage) {
  await pushTo(userIds, message);
}
