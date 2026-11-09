import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Supabase Edge Functions: blossom-events (Verify JWT with legacy secret: OFF)
// 브라우저에서 받은 역할/회원 ID는 신뢰하지 않습니다.
const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORIGINS = new Set([
  "https://gktmddn07101825-coder.github.io",
  "https://blossomdm.kr",
  "https://www.blossomdm.kr",
]);
const client = createClient(URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const WRITERS = new Set(["staff", "vice_master", "guild_master", "site_owner"]);
const LEADERS = new Set(["guild_master", "site_owner"]);
type Profile = { id: string; username: string; digimon_nickname: string | null; role: string; status: string };
type Body = Record<string, unknown>;

function reply(status: number, message: string, origin: string, extra: Body = {}) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  });
  if (ORIGINS.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return new Response(JSON.stringify({ success: status >= 200 && status < 300, message, ...extra }), {
    status, headers,
  });
}
function validUUID(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
function errorLog(stage: string, error: { code?: string; message?: string } | null) {
  if (error) console.error("[BLOSSOM EVENTS]", stage, error.code ?? "unknown", error.message ?? "");
}
async function getMember(req: Request): Promise<Profile | null> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  const { data: authData, error: authError } = await client.auth.getUser(token);
  if (authError || !authData.user) return null;
  const { data: profile, error } = await client.from("profiles")
    .select("id, username, digimon_nickname, role, status")
    .eq("auth_user_id", authData.user.id).maybeSingle();
  if (error) { errorLog("PROFILE_LOOKUP", error); throw new Error("PROFILE_LOOKUP_FAILED"); }
  return profile && profile.status === "approved" ? profile as Profile : null;
}
function parsePost(body: Body) {
  const kind = body.kind;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const eventAt = typeof body.event_at === "string" ? body.event_at.trim() : "";
  if (kind !== "notice" && kind !== "event") return { error: "게시물 종류를 선택해 주세요." };
  if (title.length < 2 || title.length > 100) return { error: "제목은 2~100자여야 합니다." };
  if (content.length < 1 || content.length > 4000) return { error: "내용은 1~4000자여야 합니다." };
  if (eventAt && (eventAt.length > 40 || !Number.isFinite(Date.parse(eventAt)))) {
    return { error: "이벤트 날짜 형식이 올바르지 않습니다." };
  }
  return { data: {
    kind, title, content,
    event_at: kind === "event" && eventAt ? new Date(eventAt).toISOString() : null,
  } };
}
async function list(profile: Profile, origin: string) {
  const { data, error } = await client.from("guild_posts")
    .select("id,kind,title,content,event_at,author_id,author_name,created_at,updated_at")
    .order("created_at", { ascending: false }).limit(100);
  if (error) { errorLog("LIST", error); return reply(500, "게시물을 불러오지 못했습니다. SQL 설정을 확인해 주세요.", origin); }
  return reply(200, "길드 게시물 목록입니다.", origin, {
    posts: data ?? [], viewer_id: profile.id, role: profile.role,
    can_post: WRITERS.has(profile.role),
    can_manage_any: LEADERS.has(profile.role),
  });
}
async function createPost(body: Body, profile: Profile, origin: string) {
  if (!WRITERS.has(profile.role)) return reply(403, "운영진 이상만 글을 작성할 수 있습니다.", origin);
  const parsed = parsePost(body);
  if (!parsed.data) return reply(400, parsed.error ?? "입력 오류", origin);
  const authorName = (profile.digimon_nickname || profile.username).slice(0, 100);
  const { data, error } = await client.from("guild_posts")
    .insert({ ...parsed.data, author_id: profile.id, author_name: authorName })
    .select("id").single();
  if (error) { errorLog("CREATE", error); return reply(500, "게시물 등록에 실패했습니다.", origin); }
  console.info("[BLOSSOM EVENTS] CREATED", { actor_id: profile.id, post_id: data.id });
  return reply(200, "게시물이 등록되었습니다.", origin, { id: data.id });
}
async function changePost(body: Body, profile: Profile, origin: string, action: "update" | "delete") {
  if (!WRITERS.has(profile.role)) return reply(403, "게시물을 관리할 권한이 없습니다.", origin);
  if (!validUUID(body.post_id)) return reply(400, "게시물 ID가 올바르지 않습니다.", origin);
  const postId = body.post_id;
  const { data: target, error: lookupError } = await client.from("guild_posts")
    .select("id,author_id").eq("id", postId).maybeSingle();
  if (lookupError) { errorLog("LOOKUP", lookupError); return reply(500, "게시물 조회에 실패했습니다.", origin); }
  if (!target) return reply(404, "이미 삭제되었거나 없는 게시물입니다.", origin);
  if (!LEADERS.has(profile.role) && target.author_id !== profile.id) {
    return reply(403, "본인이 작성한 게시물만 수정하거나 삭제할 수 있습니다.", origin);
  }
  if (action === "delete") {
    let q = client.from("guild_posts").delete().eq("id", postId);
    if (!LEADERS.has(profile.role)) q = q.eq("author_id", profile.id);
    const { data: removed, error } = await q.select("id").maybeSingle();
    if (error) { errorLog("DELETE", error); return reply(500, "게시물 삭제에 실패했습니다.", origin); }
    if (!removed) return reply(409, "게시물 상태가 변경되었습니다. 목록을 새로고침해 주세요.", origin);
    console.info("[BLOSSOM EVENTS] DELETED", { actor_id: profile.id, post_id: postId });
    return reply(200, "게시물을 삭제했습니다.", origin);
  }
  const parsed = parsePost(body);
  if (!parsed.data) return reply(400, parsed.error ?? "입력 오류", origin);
  let q = client.from("guild_posts").update({ ...parsed.data, updated_at: new Date().toISOString() }).eq("id", postId);
  if (!LEADERS.has(profile.role)) q = q.eq("author_id", profile.id);
  const { data: updated, error } = await q.select("id").maybeSingle();
  if (error) { errorLog("UPDATE", error); return reply(500, "게시물 수정에 실패했습니다.", origin); }
  if (!updated) return reply(409, "게시물 상태가 변경되었습니다. 목록을 새로고침해 주세요.", origin);
  console.info("[BLOSSOM EVENTS] UPDATED", { actor_id: profile.id, post_id: postId });
  return reply(200, "게시물을 수정했습니다.", origin);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") ?? "";
  if (req.method === "OPTIONS") {
    if (!ORIGINS.has(origin)) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Max-Age": "600",
      "Vary": "Origin",
    } });
  }
  if (!origin || !ORIGINS.has(origin)) {
    // 브라우저 요청은 허용된 BLOSSOM 도메인에서만 처리합니다.
    // Origin 헤더가 없는 서버 요청은 별도의 인증 검사를 통과해야 합니다.
    if (origin) return reply(403, "허용되지 않은 사이트입니다.", origin);
  }
  if (req.method !== "GET" && req.method !== "POST") return reply(405, "허용되지 않은 메서드입니다.", origin);
  try {
    const member = await getMember(req);
    if (!member) return reply(401, "로그인이 만료되었거나 승인된 회원이 아닙니다.", origin);
    if (req.method === "GET") return await list(member, origin);
    const raw = await req.text();
    if (raw.length > 12000) return reply(413, "요청 내용이 너무 깁니다.", origin);
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return reply(400, "잘못된 요청 형식입니다.", origin); }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reply(400, "잘못된 요청입니다.", origin);
    const body = parsed as Body;
    if (body.action === "create") return await createPost(body, member, origin);
    if (body.action === "update") return await changePost(body, member, origin, "update");
    if (body.action === "delete") return await changePost(body, member, origin, "delete");
    return reply(400, "지원하지 않는 기능입니다.", origin);
  } catch (error) {
    console.error("[BLOSSOM EVENTS] ERROR", error instanceof Error ? error.message : "unknown");
    return reply(500, "이벤트 서버 처리 중 오류가 발생했습니다.", origin);
  }
});
