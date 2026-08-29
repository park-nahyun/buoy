import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * service_role 키 사용. RLS를 우회한다.
 * ★ 절대 클라이언트 번들에 들어가면 안 된다 — 서버 라우트(크론 등)에서만 import할 것.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
