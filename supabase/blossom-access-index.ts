// Supabase Edge Functions > blossom-access > index.ts
// 이 함수는 공개 HTML/JS를 비공개로 만들지는 않습니다.
// 인증된 회원에게만 데이터 API 접근을 허용하기 위한 서버 측 검증입니다.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const allowedOrigins = new Set([
  "https://gktmddn07101825-coder.github.io", // blossom-test
  "https://blossomdm.kr",
  "https://www.blossomdm.kr",
]);
const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function headersFor(origin: string): Headers {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  });
  if (allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
}
function json(status: number, origin: string, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: headersFor(origin) });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") ?? "";
  if (req.method === "OPTIONS") {
    if (!allowedOrigins.has(origin)) return new Response(null, { status: 403 });
    const headers = headersFor(origin);
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "authorization, apikey, content-type, x-client-info");
    headers.set("Access-Control-Max-Age", "600");
    return new Response(null, { status: 204, headers });
  }
  if (req.method !== "GET") {
    return json(405, origin, { success: false, message: "GET 요청만 허용됩니다." });
  }
  if (origin && !allowedOrigins.has(origin)) {
    return json(403, origin, { success: false, message: "허용되지 않은 사이트입니다." });
  }
  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return json(401, origin, { success: false, message: "로그인이 필요합니다." });
  }
  const accessToken = authorization.slice("Bearer ".length).trim();
  if (!accessToken) {
    return json(401, origin, { success: false, message: "로그인이 필요합니다." });
  }
  try {
    // 절대 브라우저가 보낸 role/status 값을 신뢰하지 않습니다.
    const { data: authData, error: authError } = await client.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return json(401, origin, { success: false, message: "로그인이 만료되었습니다. 다시 로그인해 주세요." });
    }
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("username, digimon_nickname, role, status")
      .eq("auth_user_id", authData.user.id)
      .maybeSingle();
    if (profileError) {
      console.error("[BLOSSOM ACCESS] PROFILE_LOOKUP", profileError.code);
      return json(500, origin, { success: false, message: "회원 권한 확인 중 오류가 발생했습니다." });
    }
    if (!profile || profile.status !== "approved") {
      return json(403, origin, { success: false, message: "승인된 회원만 이용할 수 있습니다." });
    }
    return json(200, origin, {
      success: true,
      user: {
        username: profile.username,
        digimon_nickname: profile.digimon_nickname,
        role: profile.role,
      },
    });
  } catch (error) {
    console.error("[BLOSSOM ACCESS] UNEXPECTED", error instanceof Error ? error.message : "unknown");
    return json(500, origin, { success: false, message: "인증 서버 오류가 발생했습니다." });
  }
});
