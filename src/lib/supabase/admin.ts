import { createClient } from "@supabase/supabase-js";

/**
 * service_role 키를 쓰는 관리자 전용 클라이언트.
 * ⚠️ 반드시 서버(라우트 핸들러/서버 액션)에서만 호출하세요.
 *    RLS를 전부 우회하므로 클라이언트 번들에 들어가면 안 됩니다.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.");

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
