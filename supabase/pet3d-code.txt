// 永远的花园 · 宠物照片 → Meshy 3D
// 把本文件全部粘贴到 Supabase Dashboard → Edge Functions → Deploy a new function → Via Editor
// 函数名必须是：pet3d
// 密钥：在 Edge Functions → Secrets 里添加 MESHY_API_KEY。
// 可选：再添加 ADMIN_CODE（请自己设一个口令，不要写进代码或发给别人）。
// SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY（或新版 SUPABASE_SECRET_KEYS）由平台自动注入，不用手动填。
//
// 请求：POST /functions/v1/pet3d    JSON { action, ... }
//   action=create  提交一张 ≤1MB 的 jpeg/png/webp（data URI），开始生成
//   action=status  查询进度；若已完成则下载 GLB 存到 Storage
//   action=place   确认安放到花园（此后所有访客都能看到）
//   action=list    已安放的小像列表（与 RPC pet3d_list 相同）
// 不会自动重试付费的 Meshy 创建请求。

const RESERVED_CREDITS = 15;
const MESHY_CREATE = "https://api.meshy.ai/openapi/v1/image-to-3d";
const MAX_IMAGE_BYTES = 1024 * 1024;
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const FRIENDLY: Record<string, string> = {
  daily_limit: "今天这台设备已经生成过 3 次了，明天再来吧。每台设备每天限 3 次。",
  ip_limit: "今天这个网络的生成次数已经用完了，请明天再试。",
  slow_down: "尝试次数有点多，请稍后再试。",
  month_limit: "这个月的生成额度已经用完了（每月最多大约 20 只小像），下个月再来吧。",
  spot_taken: "这个纪念位已经有小像了，换一个空位吧。",
  bad_image: "请上传 1 MB 以内的 jpg、png 或 webp 照片。",
  bad_spot: "请选择一个空着的纪念位。",
  bad_name: "请给它起一个 1 到 24 个字的名字。",
  bad_device: "这台设备暂时不能生成。请刷新页面再试。",
  has_link: "名字或故事里不能放链接、网址或一长串数字。",
  too_long: "故事最多 2000 字。",
  bad_request: "这次提交不太完整，请检查后重试。",
  no_key: "管理员还没有配置生成密钥，请稍后再试。",
  meshy_error: "生成没有成功。如果扣了额度，Meshy 会退回。今天的次数已用掉的话，请明天再试。",
  not_found: "没有找到这次生成。",
  not_yours: "只能查看或确认自己提交的小像。",
  not_ready: "小像还在生成中，请再等一会儿。",
  expired: "上次提交没有发出去，请重新上传。",
  busy: "花园有点忙，请稍后再试。",
};

type Job = Record<string, unknown>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}
function fail(code: string, status = 400, extra: Record<string, unknown> = {}): Response {
  return json({ ok: false, error: code, message: FRIENDLY[code] || code, ...extra }, status);
}

function supabaseUrl(): string {
  return (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
}
function serviceKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_KEY") || "";
  if (legacy) return legacy;
  try {
    const raw = Deno.env.get("SUPABASE_SECRET_KEYS") || "{}";
    const keys = JSON.parse(raw) as Record<string, string>;
    return keys.default || keys.service_role || Object.values(keys).find((v) => typeof v === "string") || "";
  } catch {
    return "";
  }
}
function meshyKey(): string {
  return Deno.env.get("MESHY_API_KEY") || "";
}

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const ah = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode("pmg-admin\0" + a)));
  const bh = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode("pmg-admin\0" + b)));
  let diff = 0;
  for (let i = 0; i < ah.length; i++) diff |= ah[i] ^ bh[i];
  return diff === 0;
}

// Returns true when the caller may skip the per-device daily cap. Never logs the code.
// Wrong codes are counted per IP; 5 failures in 10 minutes → "slow_down".
// If the SQL patch is not applied yet, a missing RPC is ignored and daily caps still apply.
async function maybeSkipDaily(iph: string, offered: unknown): Promise<true | false | "slow_down"> {
  const secret = (Deno.env.get("ADMIN_CODE") || "").trim();
  const code = typeof offered === "string" ? offered : "";
  if (!secret || !code || code.length > 128) return false;
  if (await timingSafeEqual(secret, code)) return true;
  try {
    await rpc("pet3d_admin_attempt", { p_ip_hash: iph, p_ok: false });
  } catch (e) {
    const body = (e as any) && (e as any).body;
    const pg = String((body && (body.code || body.message)) || (e as Error).message || "");
    if (pg === "slow_down" || /slow_down/.test(pg)) return "slow_down";
  }
  return false;
}

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf && cf.trim()) return cf.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0].trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real && real.trim()) return real.trim();
  return "unknown";
}

function publicObjectUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${supabaseUrl()}/storage/v1/object/public/pet3d/${path}`;
}

function publicJob(row: Job, mine = false): Record<string, unknown> {
  const status = String(row.status || "");
  const modelPath = (row.model_path as string) || null;
  const thumbPath = (row.thumb_path as string) || null;
  const out: Record<string, unknown> = {
    id: row.id,
    spot: row.spot,
    status,
    progress: row.progress || 0,
    name: row.name,
    born: row.born || null,
    departed: row.departed || null,
    story: row.story || null,
    rotation: row.rotation || 0,
    model_url: modelPath ? publicObjectUrl(modelPath) : null,
    thumb_url: thumbPath ? publicObjectUrl(thumbPath) : null,
    error: row.error_code ? (FRIENDLY[String(row.error_code)] || row.error_code) : null,
  };
  if (mine) out.credits = row.credits_used || row.credits_reserved || 0;
  return out;
}

async function rest(path: string, init: RequestInit = {}): Promise<{ status: number; body: any }> {
  const key = serviceKey();
  const headers = new Headers(init.headers || {});
  headers.set("apikey", key);
  headers.set("Authorization", `Bearer ${key}`);
  if (!headers.has("Content-Type") && init.body && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  const r = await fetch(supabaseUrl() + path, { ...init, headers });
  const text = await r.text();
  let body: any = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  return { status: r.status, body };
}

async function rpc(name: string, args: Record<string, unknown>): Promise<any> {
  const r = await rest(`/rest/v1/rpc/${name}`, { method: "POST", body: JSON.stringify(args) });
  if (r.status >= 400) {
    const msg = (r.body && (r.body.message || r.body.error)) || `HTTP ${r.status}`;
    const err = new Error(String(msg));
    (err as any).status = r.status;
    (err as any).body = r.body;
    throw err;
  }
  return r.body;
}

async function getJob(id: string): Promise<Job | null> {
  const r = await rest(`/rest/v1/pet3d_jobs?id=eq.${encodeURIComponent(id)}&select=*`);
  if (r.status >= 400 || !Array.isArray(r.body) || !r.body[0]) return null;
  return r.body[0] as Job;
}

async function patchJob(id: string, fields: Record<string, unknown>): Promise<Job | null> {
  const r = await rest(`/rest/v1/pet3d_jobs?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
  });
  if (Array.isArray(r.body) && r.body[0]) return r.body[0] as Job;
  return getJob(id);
}

async function uploadObject(objectPath: string, bytes: Uint8Array, contentType: string): Promise<void> {
  const key = serviceKey();
  const url = `${supabaseUrl()}/storage/v1/object/pet3d/${objectPath}`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: bytes,
  });
  if (!r.ok) {
    // Retry as PUT in case POST rejects an existing object.
    const r2 = await fetch(url, {
      method: "PUT",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: bytes,
    });
    if (!r2.ok) {
      const t = await r2.text();
      console.error("storage upload failed", r.status, r2.status, t.slice(0, 200));
      throw new Error("busy");
    }
  }
}

function parseImage(dataUri: string): { mime: string; bytes: Uint8Array; dataUri: string } {
  const m = /^data:(image\/(jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec((dataUri || "").trim());
  if (!m) throw Object.assign(new Error("bad_image"), { code: "bad_image" });
  let mime = m[1].toLowerCase();
  if (mime === "image/jpg") mime = "image/jpeg";
  const b64 = m[3].replace(/\s+/g, "");
  let raw: Uint8Array;
  try {
    const bin = atob(b64);
    raw = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);
  } catch {
    throw Object.assign(new Error("bad_image"), { code: "bad_image" });
  }
  if (raw.length < 32 || raw.length > MAX_IMAGE_BYTES) {
    throw Object.assign(new Error("bad_image"), { code: "bad_image" });
  }
  const isJpeg = raw[0] === 0xff && raw[1] === 0xd8 && raw[2] === 0xff;
  const isPng = raw[0] === 0x89 && raw[1] === 0x50 && raw[2] === 0x4e && raw[3] === 0x47;
  const isWebp = raw[0] === 0x52 && raw[1] === 0x49 && raw[2] === 0x46 && raw[3] === 0x46;
  if (mime === "image/jpeg" && !isJpeg) throw Object.assign(new Error("bad_image"), { code: "bad_image" });
  if (mime === "image/png" && !isPng) throw Object.assign(new Error("bad_image"), { code: "bad_image" });
  if (mime === "image/webp" && !isWebp) throw Object.assign(new Error("bad_image"), { code: "bad_image" });
  if (!isJpeg && !isPng && !isWebp) throw Object.assign(new Error("bad_image"), { code: "bad_image" });
  return { mime, bytes: raw, dataUri: `data:${mime};base64,${b64}` };
}

async function meshyCreate(dataUri: string): Promise<string> {
  const key = meshyKey();
  const r = await fetch(MESHY_CREATE, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: dataUri,
      ai_model: "meshy-6-lite",
      should_texture: true,
      texture_resolution: "2k",
      should_remesh: true,
      topology: "triangle",
      target_polycount: 8000,
      target_formats: ["glb"],
      enable_pbr: false,
      moderation: true,
    }),
  });
  const body = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = String((body && (body.message || body.error)) || `HTTP ${r.status}`);
    console.error("meshy create failed", r.status, msg.slice(0, 240));
    if (r.status === 402) throw Object.assign(new Error("month_limit"), { code: "month_limit" });
    if (r.status === 400 && /moderat|harmful|nsfw|content/i.test(msg)) {
      throw Object.assign(new Error("bad_image"), { code: "bad_image" });
    }
    throw Object.assign(new Error("meshy_error"), { code: "meshy_error", unpaid: r.status === 400 });
  }
  const id = body && (body.result || body.id);
  if (!id || typeof id !== "string") throw Object.assign(new Error("meshy_error"), { code: "meshy_error" });
  return id;
}

async function meshyGet(taskId: string): Promise<any> {
  const key = meshyKey();
  const r = await fetch(`${MESHY_CREATE}/${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const body = await r.json().catch(() => null);
  if (!r.ok) {
    console.error("meshy get failed", r.status, JSON.stringify(body).slice(0, 200));
    throw Object.assign(new Error("busy"), { code: "busy" });
  }
  return body;
}

async function downloadBytes(url: string, maxBytes = 15 * 1024 * 1024): Promise<Uint8Array> {
  const r = await fetch(url);
  if (!r.ok) throw Object.assign(new Error("busy"), { code: "busy" });
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.length < 16 || buf.length > maxBytes) throw Object.assign(new Error("meshy_error"), { code: "meshy_error" });
  return buf;
}

function pgCode(err: any): string {
  const msg = String((err && err.message) || "");
  const body = err && err.body;
  // PostgREST raises `message` as the exception text for P0001
  const fromBody = body && (body.message || body.code);
  const text = String(fromBody || msg);
  const known = [
    "daily_limit","ip_limit","month_limit","spot_taken","bad_image","bad_spot",
    "bad_name","bad_device","has_link","too_long","bad_request","no_key",
    "meshy_error","not_found","not_yours","not_ready","expired","busy","slow_down",
  ];
  if (known.includes(text)) return text;
  if (known.includes(msg)) return msg;
  console.error("unexpected error", text.slice(0, 300));
  return "busy";
}

async function handleCreate(req: Request, body: any): Promise<Response> {
  if (!meshyKey()) return fail("no_key", 503);
  if (!serviceKey() || !supabaseUrl()) return fail("busy", 503);
  const image = parseImage(String(body.image || body.image_url || ""));
  const iph = await sha256hex("pmg-pet3d:" + clientIp(req));
  const skip = await maybeSkipDaily(iph, body && body.admin);
  if (skip === "slow_down") return fail("slow_down", 429);
  let reserved: any;
  const reserveArgs: Record<string, unknown> = {
    p_id: body.client_id || body.id,
    p_device: body.device,
    p_ip_hash: iph,
    p_spot: body.spot,
    p_name: body.name,
    p_born: body.born || null,
    p_departed: body.departed || null,
    p_story: body.story || null,
  };
  // Only send p_skip_daily when true, so an older 8-argument function still works
  // until the SQL patch is applied (no bypass until then).
  if (skip === true) reserveArgs.p_skip_daily = true;
  try {
    reserved = await rpc("pet3d_reserve", reserveArgs);
  } catch (e) {
    const code = pgCode(e);
    const bodyCode = String(((e as any).body && ((e as any).body.code || (e as any).body.message)) || "");
    // SQL not patched yet: retry without the new parameter so generation still works.
    if (skip === true && /PGRST202|PGRST205|could not find the function|schema cache/i.test(bodyCode + code + String((e as Error).message || ""))) {
      delete reserveArgs.p_skip_daily;
      try { reserved = await rpc("pet3d_reserve", reserveArgs); }
      catch (e2) { return fail(pgCode(e2), 400); }
    } else {
      return fail(code, 400);
    }
  }
  const row: Job = (reserved && reserved.job) || reserved;
  const id = String(row.id);
  if (reserved && reserved.duplicate) {
    return json({ ok: true, duplicate: true, job: publicJob(row, true) });
  }
  // Store the photo privately (best-effort; generation still proceeds if this fails).
  try {
    const photoPath = `photos/${id}.jpg`;
    await uploadObject(photoPath, image.bytes, image.mime);
    await patchJob(id, { photo_path: photoPath });
  } catch (e) {
    console.error("photo upload skipped", String((e as Error).message || e).slice(0, 160));
  }
  // Paid call: at most once per reserved job. Never auto-retry.
  try {
    const taskId = await meshyCreate(image.dataUri);
    const updated = await patchJob(id, { status: "pending", meshy_task_id: taskId, progress: 0 });
    return json({ ok: true, job: publicJob(updated || row, true) });
  } catch (e) {
    const code = pgCode(e);
    const unpaid = !!(e as any).unpaid || code === "bad_image";
    await patchJob(id, {
      status: "failed",
      error_code: code,
      credits_reserved: 0,
      credits_used: 0,
      // If Meshy never created a task, clear the way for a same-day retry
      // by leaving meshy_task_id null (daily_limit only counts started/active jobs).
    });
    return fail(code, 400, { job: publicJob({ ...row, status: "failed", error_code: code }, true) });
  }
}

async function finishSuccess(row: Job, task: any): Promise<Job> {
  const id = String(row.id);
  const glbUrl = task.model_urls && task.model_urls.glb;
  if (!glbUrl) throw Object.assign(new Error("meshy_error"), { code: "meshy_error" });
  const glb = await downloadBytes(glbUrl);
  const modelPath = `models/${id}.glb`;
  await uploadObject(modelPath, glb, "model/gltf-binary");
  let thumbPath: string | null = null;
  const thumbUrl = task.thumbnail_url;
  if (thumbUrl) {
    try {
      const thumb = await downloadBytes(thumbUrl, 3 * 1024 * 1024);
      thumbPath = `thumbs/${id}.png`;
      await uploadObject(thumbPath, thumb, "image/png");
    } catch (e) {
      console.error("thumb upload skipped", String((e as Error).message || e).slice(0, 160));
      thumbPath = null;
    }
  }
  const credits = Number(task.consumed_credits);
  const used = Number.isFinite(credits) && credits >= 0 ? credits : RESERVED_CREDITS;
  const updated = await patchJob(id, {
    status: "succeeded",
    progress: 100,
    model_path: modelPath,
    thumb_path: thumbPath,
    credits_used: used,
    credits_reserved: 0,
    error_code: null,
  });
  return updated || row;
}

async function handleStatus(body: any): Promise<Response> {
  const id = String(body.client_id || body.id || "");
  const device = String(body.device || "");
  if (!id || !device) return fail("bad_request");
  const row = await getJob(id);
  if (!row) return fail("not_found", 404);
  if (String(row.device) !== device) return fail("not_yours", 403);
  const status = String(row.status);
  if (status === "succeeded" || status === "placed" || status === "failed") {
    return json({ ok: true, job: publicJob(row, true) });
  }
  if (!row.meshy_task_id) {
    return json({ ok: true, job: publicJob(row, true) });
  }
  if (!meshyKey()) return fail("no_key", 503);
  const task = await meshyGet(String(row.meshy_task_id));
  const st = String(task.status || "");
  const progress = Math.max(0, Math.min(100, Number(task.progress) || 0));
  if (st === "PENDING" || st === "IN_PROGRESS") {
    const mapped = st === "IN_PROGRESS" ? "in_progress" : "pending";
    const updated = await patchJob(id, { status: mapped, progress });
    return json({ ok: true, job: publicJob(updated || { ...row, status: mapped, progress }, true) });
  }
  if (st === "SUCCEEDED") {
    try {
      const updated = await finishSuccess(row, task);
      return json({ ok: true, job: publicJob(updated, true) });
    } catch (e) {
      return fail(pgCode(e), 500, { job: publicJob(row, true) });
    }
  }
  // FAILED or CANCELED: Meshy refunds credits for FAILED.
  const updated = await patchJob(id, {
    status: "failed",
    progress,
    credits_reserved: 0,
    credits_used: 0,
    error_code: "meshy_error",
  });
  return json({ ok: false, error: "meshy_error", message: FRIENDLY.meshy_error, job: publicJob(updated || row, true) });
}

async function handlePlace(body: any): Promise<Response> {
  const id = String(body.client_id || body.id || "");
  const device = String(body.device || "");
  const rotation = Math.round(Number(body.rotation) || 0) % 360;
  const rot = rotation < 0 ? rotation + 360 : rotation;
  if (!id || !device) return fail("bad_request");
  const row = await getJob(id);
  if (!row) return fail("not_found", 404);
  if (String(row.device) !== device) return fail("not_yours", 403);
  if (String(row.status) === "placed") {
    const updated = rot !== Number(row.rotation || 0) ? await patchJob(id, { rotation: rot }) : row;
    return json({ ok: true, job: publicJob(updated || row, true) });
  }
  if (String(row.status) !== "succeeded" || !row.model_path) return fail("not_ready");
  const updated = await patchJob(id, { status: "placed", rotation: rot, progress: 100 });
  return json({ ok: true, job: publicJob(updated || row, true) });
}

async function handleList(): Promise<Response> {
  try {
    const list = await rpc("pet3d_list", {});
    const jobs = (Array.isArray(list) ? list : []).map((j: Job) => publicJob(j, false));
    return json({ ok: true, jobs });
  } catch (e) {
    return fail(pgCode(e), 500);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("bad_request", 405);
  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("bad_request");
  }
  const action = String((body && body.action) || "");
  try {
    if (action === "create") return await handleCreate(req, body);
    if (action === "status") return await handleStatus(body);
    if (action === "place") return await handlePlace(body);
    if (action === "list") return await handleList();
    return fail("bad_request");
  } catch (e) {
    return fail(pgCode(e), 500);
  }
});
