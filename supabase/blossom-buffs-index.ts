import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Deploy as blossom-buffs. Turn OFF "Verify JWT with legacy secret".
// This function independently authenticates every request with auth.getUser(token)
// and retrieves the user's approved profile and role from the database.
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const ORIGINS = new Set([
  "https://gktmddn07101825-coder.github.io",
  "https://blossomdm.kr",
  "https://www.blossomdm.kr",
]);
const MANAGERS = new Set(["site_owner", "guild_master", "vice_master", "staff"]);
const ICONS = new Set(["booster", "integration", "blessing"]);
const SOUNDS = new Set(["digivice", "digivice_alert", "voice"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Body = Record<string, unknown>;
type Member = { id: string; role: string; status: string; username: string };
type BuffFields = { name: string; icon_key: string; duration_minutes: number; sound_key: string; volume: number };
function reply(status: number, message: string, origin: string, extra: Body = {}) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  });
  if (ORIGINS.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return new Response(JSON.stringify({ success: status >= 200 && status < 300, message, ...extra }), { status, headers });
}
function log(stage: string, error: { code?: string; message?: string } | null) {
  if (error) console.error("[BLOSSOM BUFF]", stage, { code: error.code, message: error.message });
}
async function memberFrom(req: Request): Promise<Member | null> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!/^Bearer\s+\S+$/i.test(auth)) return null;
  const { data: result, error: authError } = await db.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (authError || !result.user) return null;
  const { data: profile, error } = await db.from("profiles")
    .select("id,username,role,status")
    .eq("auth_user_id", result.user.id).maybeSingle();
  if (error) { log("PROFILE", error); throw new Error("PROFILE_LOOKUP_FAILED"); }
  return profile?.status === "approved" ? profile as Member : null;
}
function uuid(v: unknown): v is string { return typeof v === "string" && UUID.test(v); }
function readFields(body: Body): BuffFields | null {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 60 || !ICONS.has(String(body.icon_key)) ||
      !Number.isInteger(body.duration_minutes) || (body.duration_minutes as number) < 1 ||
      (body.duration_minutes as number) > 10080 || !SOUNDS.has(String(body.sound_key)) ||
      !Number.isInteger(body.volume) || (body.volume as number) < 0 || (body.volume as number) > 100) return null;
  return {
    name, icon_key: body.icon_key as string, duration_minutes: body.duration_minutes as number,
    sound_key: body.sound_key as string, volume: body.volume as number,
  };
}
function badFields(origin: string) {
  return reply(400, "이름(1~60자), 아이콘, 시간(1~10080분), 알림음 및 볼륨(0~100)을 확인해 주세요.", origin);
}
async function list(m: Member, origin: string) {
  const manage = MANAGERS.has(m.role);
  const [templates, entries] = await Promise.all([
    db.from("guild_buff_templates")
      .select("id,name,icon_key,duration_minutes,sound_key,volume,is_active,sort_order,created_at")
      .order("sort_order", { ascending: true }).order("created_at", { ascending: true }).limit(100),
    db.from("guild_buff_user_entries")
      .select("id,template_id,name_override,icon_override,minutes_override,sound_override,volume_override,custom_name,custom_icon,custom_minutes,custom_sound,custom_volume,ends_at,created_at")
      .eq("owner_id", m.id).order("created_at", { ascending: true }).limit(200),
  ]);
  if (templates.error || entries.error) {
    log("LIST_TEMPLATES", templates.error); log("LIST_ENTRIES", entries.error);
    return reply(500, "버프 정보를 불러올 수 없습니다. SQL 및 함수 설정을 확인해 주세요.", origin);
  }
  // Non-managers do not receive hidden defaults. Personal override rows are private to the member.
  const shared = manage ? templates.data ?? [] : (templates.data ?? []).filter(x => x.is_active);
  return reply(200, "버프 목록입니다.", origin, {
    templates: shared,
    entries: (entries.data ?? []).filter(x => x.template_id === null || shared.some(t => t.id === x.template_id)),
    can_manage: manage,
    role: m.role,
    server_now: new Date().toISOString(),
  });
}
async function templateSave(b: Body, m: Member, origin: string) {
  if (!MANAGERS.has(m.role)) return reply(403, "운영진 이상만 기본 버프를 관리할 수 있습니다.", origin);
  const fields = readFields(b); if (!fields) return badFields(origin);
  if (b.template_id !== undefined && b.template_id !== null) {
    if (!uuid(b.template_id)) return reply(400, "기본 버프 ID를 확인해 주세요.", origin);
    const { data, error } = await db.from("guild_buff_templates").update(fields)
      .eq("id", b.template_id).select("id").maybeSingle();
    if (error) { log("TEMPLATE_UPDATE", error); return reply(500, "기본 버프 수정에 실패했습니다.", origin); }
    return data ? reply(200, "길드 기본 버프를 수정했습니다.", origin) : reply(404, "기본 버프를 찾지 못했습니다.", origin);
  }
  const { count, error: countError } = await db.from("guild_buff_templates").select("id", { count: "exact", head: true });
  if (countError) { log("TEMPLATE_COUNT", countError); return reply(500, "기본 버프 개수를 확인할 수 없습니다.", origin); }
  if ((count ?? 0) >= 60) return reply(400, "기본 버프는 최대 60개까지 등록할 수 있습니다.", origin);
  const { error } = await db.from("guild_buff_templates").insert({ ...fields, created_by: m.id });
  if (error) { log("TEMPLATE_INSERT", error); return reply(500, "기본 버프 등록에 실패했습니다.", origin); }
  return reply(200, "기본 버프를 추가했습니다.", origin);
}
async function templateVisible(b: Body, m: Member, origin: string) {
  if (!MANAGERS.has(m.role)) return reply(403, "관리 권한이 없습니다.", origin);
  if (!uuid(b.template_id) || typeof b.is_active !== "boolean") return reply(400, "버프 ID와 공개 설정을 확인해 주세요.", origin);
  const { data, error } = await db.from("guild_buff_templates").update({ is_active: b.is_active })
    .eq("id", b.template_id).select("id").maybeSingle();
  if (error) { log("TEMPLATE_VISIBLE", error); return reply(500, "공개 설정을 저장하지 못했습니다.", origin); }
  return data ? reply(200, b.is_active ? "버프를 다시 표시합니다." : "버프를 숨겼습니다.", origin) : reply(404, "기본 버프를 찾지 못했습니다.", origin);
}
async function templateDelete(b: Body, m: Member, origin: string) {
  if (!MANAGERS.has(m.role)) return reply(403, "관리 권한이 없습니다.", origin);
  if (!uuid(b.template_id)) return reply(400, "버프 ID를 확인해 주세요.", origin);
  const { data, error } = await db.from("guild_buff_templates").delete().eq("id", b.template_id).select("id").maybeSingle();
  if (error) { log("TEMPLATE_DELETE", error); return reply(500, "기본 버프를 삭제하지 못했습니다.", origin); }
  return data ? reply(200, "기본 버프를 삭제했습니다. 회원별 설정도 함께 제거됩니다.", origin) : reply(404, "기본 버프를 찾지 못했습니다.", origin);
}
async function overrideSave(b: Body, m: Member, origin: string) {
  if (!uuid(b.template_id)) return reply(400, "기본 버프 ID를 확인해 주세요.", origin);
  const fields = readFields(b); if (!fields) return badFields(origin);
  const { data: template, error: lookupError } = await db.from("guild_buff_templates")
    .select("id,name,icon_key,duration_minutes,sound_key,volume,is_active").eq("id", b.template_id).maybeSingle();
  if (lookupError) { log("OVERRIDE_TEMPLATE", lookupError); return reply(500, "버프를 찾을 수 없습니다.", origin); }
  if (!template || !template.is_active) return reply(404, "사용할 수 없는 기본 버프입니다.", origin);
  const update = {
    name_override: fields.name === template.name ? null : fields.name,
    icon_override: fields.icon_key === template.icon_key ? null : fields.icon_key,
    minutes_override: fields.duration_minutes === template.duration_minutes ? null : fields.duration_minutes,
    sound_override: fields.sound_key === template.sound_key ? null : fields.sound_key,
    volume_override: fields.volume === template.volume ? null : fields.volume,
  };
  const { data: existing, error: lookupEntryError } = await db.from("guild_buff_user_entries")
    .select("id").eq("owner_id", m.id).eq("template_id", b.template_id).maybeSingle();
  if (lookupEntryError) { log("OVERRIDE_LOOKUP", lookupEntryError); return reply(500, "내 버프 정보를 확인하지 못했습니다.", origin); }
  const result = existing
    ? await db.from("guild_buff_user_entries").update(update).eq("id", existing.id).eq("owner_id", m.id)
    : await db.from("guild_buff_user_entries").insert({ owner_id: m.id, template_id: b.template_id, ...update });
  if (result.error) { log("OVERRIDE_SAVE", result.error); return reply(500, "내 버프 설정을 저장하지 못했습니다.", origin); }
  return reply(200, "이 기본 버프의 나만의 설정을 저장했습니다.", origin);
}
async function overrideReset(b: Body, m: Member, origin: string) {
  if (!uuid(b.template_id)) return reply(400, "기본 버프 ID를 확인해 주세요.", origin);
  const { error } = await db.from("guild_buff_user_entries").update({
    name_override: null, icon_override: null, minutes_override: null, sound_override: null, volume_override: null,
  }).eq("owner_id", m.id).eq("template_id", b.template_id);
  if (error) { log("OVERRIDE_RESET", error); return reply(500, "기본값 복원에 실패했습니다.", origin); }
  return reply(200, "길드 기본 설정으로 되돌렸습니다. 실행 중인 타이머는 유지됩니다.", origin);
}
async function personalSave(b: Body, m: Member, origin: string) {
  const fields = readFields(b); if (!fields) return badFields(origin);
  if (b.personal_id !== undefined && b.personal_id !== null) {
    if (!uuid(b.personal_id)) return reply(400, "내 버프 ID를 확인해 주세요.", origin);
    const { data, error } = await db.from("guild_buff_user_entries")
      .update({ custom_name: fields.name, custom_icon: fields.icon_key, custom_minutes: fields.duration_minutes,
        custom_sound: fields.sound_key, custom_volume: fields.volume })
      .eq("owner_id", m.id).is("template_id", null).eq("id", b.personal_id).select("id").maybeSingle();
    if (error) { log("PERSONAL_UPDATE", error); return reply(500, "내 버프 수정에 실패했습니다.", origin); }
    return data ? reply(200, "내 버프 설정을 저장했습니다.", origin) : reply(404, "내 버프를 찾지 못했습니다.", origin);
  }
  const { count, error: countError } = await db.from("guild_buff_user_entries").select("id", { count: "exact", head: true })
    .eq("owner_id", m.id).is("template_id", null);
  if (countError) { log("PERSONAL_COUNT", countError); return reply(500, "내 버프 개수를 확인할 수 없습니다.", origin); }
  if ((count ?? 0) >= 60) return reply(400, "내 버프는 최대 60개까지 등록할 수 있습니다.", origin);
  const { error } = await db.from("guild_buff_user_entries").insert({
    owner_id: m.id,
    custom_name: fields.name, custom_icon: fields.icon_key, custom_minutes: fields.duration_minutes,
    custom_sound: fields.sound_key, custom_volume: fields.volume,
  });
  if (error) { log("PERSONAL_INSERT", error); return reply(500, "내 버프 추가에 실패했습니다.", origin); }
  return reply(200, "내 버프를 추가했습니다.", origin);
}
async function personalDelete(b: Body, m: Member, origin: string) {
  if (!uuid(b.personal_id)) return reply(400, "내 버프 ID를 확인해 주세요.", origin);
  const { data, error } = await db.from("guild_buff_user_entries").delete()
    .eq("owner_id", m.id).is("template_id", null).eq("id", b.personal_id).select("id").maybeSingle();
  if (error) { log("PERSONAL_DELETE", error); return reply(500, "내 버프 삭제에 실패했습니다.", origin); }
  return data ? reply(200, "내 버프를 삭제했습니다.", origin) : reply(404, "삭제할 내 버프가 없습니다.", origin);
}
async function timerChange(b: Body, m: Member, origin: string, start: boolean) {
  if (!uuid(b.buff_id) || (b.kind !== "template" && b.kind !== "personal"))
    return reply(400, "타이머 대상을 확인해 주세요.", origin);
  let minutes: number | null = null;
  let endsAt: string | null = null;
  if (b.kind === "template") {
    const { data: template, error: templateError } = await db.from("guild_buff_templates")
      .select("id,duration_minutes,is_active").eq("id", b.buff_id).maybeSingle();
    if (templateError) { log("TIMER_TEMPLATE", templateError); return reply(500, "기본 버프 확인 실패", origin); }
    if (!template || !template.is_active) return reply(404, "사용할 수 없는 기본 버프입니다.", origin);
    const { data: mine, error: entryError } = await db.from("guild_buff_user_entries")
      .select("minutes_override").eq("owner_id", m.id).eq("template_id", b.buff_id).maybeSingle();
    if (entryError) { log("TIMER_OVERRIDE", entryError); return reply(500, "내 버프 설정 확인 실패", origin); }
    minutes = mine?.minutes_override ?? template.duration_minutes;
    endsAt = start ? new Date(Date.now() + minutes * 60_000).toISOString() : null;
    // Only update ends_at: never overwrite an existing member's override fields.
    const { data: existing, error: findError } = await db.from("guild_buff_user_entries")
      .select("id").eq("owner_id", m.id).eq("template_id", b.buff_id).maybeSingle();
    if (findError) { log("TIMER_FIND", findError); return reply(500, "타이머 정보를 확인하지 못했습니다.", origin); }
    const result = existing
      ? await db.from("guild_buff_user_entries").update({ ends_at: endsAt }).eq("id", existing.id).eq("owner_id", m.id)
      : await db.from("guild_buff_user_entries").insert({ owner_id: m.id, template_id: b.buff_id, ends_at: endsAt });
    if (result.error) { log("TIMER_TEMPLATE_UPDATE", result.error); return reply(500, "타이머 상태를 저장하지 못했습니다.", origin); }
  } else {
    const { data: personal, error: entryError } = await db.from("guild_buff_user_entries")
      .select("id,custom_minutes").eq("owner_id", m.id).is("template_id", null)
      .eq("id", b.buff_id).maybeSingle();
    if (entryError) { log("TIMER_PERSONAL", entryError); return reply(500, "내 버프 확인 실패", origin); }
    if (!personal) return reply(404, "내 버프를 찾을 수 없습니다.", origin);
    minutes = personal.custom_minutes;
    endsAt = start ? new Date(Date.now() + minutes * 60_000).toISOString() : null;
    const { error } = await db.from("guild_buff_user_entries").update({ ends_at: endsAt })
      .eq("owner_id", m.id).is("template_id", null).eq("id", b.buff_id);
    if (error) { log("TIMER_PERSONAL_UPDATE", error); return reply(500, "타이머 상태를 저장하지 못했습니다.", origin); }
  }
  return reply(200, start ? "타이머를 시작했습니다." : "타이머를 정지했습니다.", origin,
    { ends_at: endsAt, duration_minutes: minutes });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") ?? "";
  if (req.method === "OPTIONS") {
    if (!ORIGINS.has(origin)) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Max-Age": "600",
      "Vary": "Origin",
    }});
  }
  if (req.method !== "POST") return reply(405, "POST 요청만 허용됩니다.", origin);
  if (origin && !ORIGINS.has(origin)) return reply(403, "허용되지 않은 접속 경로입니다.", origin);
  try {
    const member = await memberFrom(req);
    if (!member) return reply(403, "승인된 길드원 로그인이 필요합니다.", origin);
    const raw = await req.text();
    if (raw.length > 7000) return reply(413, "요청 내용이 너무 큽니다.", origin);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return reply(400, "JSON 요청 형식을 확인해 주세요.", origin); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return reply(400, "요청 형식이 잘못되었습니다.", origin);
    const b = body as Body;
    switch (b.action) {
      case "list": return await list(member, origin);
      case "template_save": return await templateSave(b, member, origin);
      case "template_visible": return await templateVisible(b, member, origin);
      case "template_delete": return await templateDelete(b, member, origin);
      case "override_save": return await overrideSave(b, member, origin);
      case "override_reset": return await overrideReset(b, member, origin);
      case "personal_save": return await personalSave(b, member, origin);
      case "personal_delete": return await personalDelete(b, member, origin);
      case "timer_start": return await timerChange(b, member, origin, true);
      case "timer_stop": return await timerChange(b, member, origin, false);
      default: return reply(400, "지원하지 않는 버프 기능입니다.", origin);
    }
  } catch (error) {
    console.error("[BLOSSOM BUFF] UNEXPECTED", error instanceof Error ? error.message : "unknown");
    return reply(500, "버프 기능 처리 중 오류가 발생했습니다.", origin);
  }
});
