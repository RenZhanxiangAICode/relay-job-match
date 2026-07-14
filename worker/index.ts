import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  AUTH_SECRET?: string;
  ADMIN_EMAILS?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

type SessionUser = { id: string; email: string; reputation: number; status: string };

const SESSION_COOKIE = "relay_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const CODE_SECONDS = 10 * 60;
const PROFILE_FIELDS = {
  role: ["city", "role", "industry", "work", "projects", "ability", "knowledge", "culture", "system", "travel", "growth", "referral", "process", "warning", "leave"],
  talent: ["ability", "projects", "industry", "company", "reject", "city", "salary", "arrival", "plan", "personality", "credential"],
} as const;

function json(data: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isAdmin(env: Env, email: string) {
  return (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

function weekKey(date = new Date()) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function monthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function tokenize(value: unknown) {
  const text = String(value ?? "").toLowerCase().normalize("NFKC");
  const tokens = text.match(/[a-z0-9+#.]{2,}|[\u3400-\u9fff]{2,}/g) ?? [];
  const result: string[] = [];
  for (const token of tokens) {
    if (/^[\u3400-\u9fff]+$/.test(token)) {
      if (token.length <= 4) result.push(token);
      for (let index = 0; index < token.length - 1; index += 1) result.push(token.slice(index, index + 2));
    } else {
      result.push(token);
    }
  }
  return result;
}

function buildProfileIndex(payload: Record<string, unknown>) {
  const important = new Set(["city", "role", "industry", "ability", "projects", "knowledge", "credential", "salary", "system"]);
  const weighted = new Map<string, number>();
  for (const [key, value] of Object.entries(payload)) {
    for (const token of tokenize(value)) weighted.set(token, Math.max(weighted.get(token) ?? 0, important.has(key) ? 3 : 1));
  }
  const searchText = Object.values(payload).map((value) => String(value ?? "").trim()).filter(Boolean).join("\n").slice(0, 12000);
  return { searchText, keywords: [...weighted.entries()].slice(0, 300) };
}

function hashToken(token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) hash = Math.imul(hash ^ token.charCodeAt(index), 16777619);
  return hash >>> 0;
}

function vectorize(searchText: string, size = 128) {
  const vector = Array.from({ length: size }, () => 0);
  for (const token of tokenize(searchText)) {
    const hash = hashToken(token);
    vector[hash % size] += (hash & 1) === 0 ? 1 : -1;
  }
  const length = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Math.round((value / length) * 100000) / 100000);
}

function cosine(left: number[], right: number[]) {
  if (!left.length || left.length !== right.length) return 0;
  let dot = 0;
  let leftLength = 0;
  let rightLength = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftLength += left[index] ** 2;
    rightLength += right[index] ** 2;
  }
  return dot / ((Math.sqrt(leftLength) * Math.sqrt(rightLength)) || 1);
}

function describeMatch(keywordScore: number, vectorScore: number) {
  return {
    reasons: [`关键词匹配 ${keywordScore} 分`, `向量相似度 ${vectorScore} 分`],
    risks: ["岗位、任职、HC、薪酬和经历均为用户自述，需在沟通中验证"],
    verifyOnMeeting: ["公司与 HC 真实性", "实际工作负荷与成功标准", "任职时间线与项目成果"],
  };
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomDigits() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(100000 + (bytes[0] % 900000));
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function cookieValue(request: Request, name: string) {
  const cookies = request.headers.get("cookie") ?? "";
  for (const item of cookies.split(";")) {
    const [key, ...parts] = item.trim().split("=");
    if (key === name) return decodeURIComponent(parts.join("="));
  }
  return "";
}

function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function requestBody(request: Request) {
  try {
    return await request.json<Record<string, unknown>>();
  } catch {
    return null;
  }
}

async function currentUser(request: Request, env: Env): Promise<SessionUser | null> {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const now = Math.floor(Date.now() / 1000);
  const user = await env.DB.prepare(`
    SELECT u.id, u.email, u.reputation, u.status
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).bind(tokenHash, now).first<SessionUser>();
  return user ?? null;
}

async function requireUser(request: Request, env: Env) {
  const user = await currentUser(request, env);
  if (!user) return { response: json({ error: "请先登录" }, 401), user: null };
  if (user.status !== "active") return { response: json({ error: "账号当前不可用，请通过申诉渠道处理" }, 403), user: null };
  return { response: null, user };
}

async function sendVerificationEmail(env: Env, email: string, code: string) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    return { ok: false, message: "邮件服务尚未配置" };
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
      "idempotency-key": `relay-login-${email}-${Math.floor(Date.now() / 60000)}`,
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email],
      subject: `${code} 是你的 Relay 登录验证码`,
      text: `你的 Relay 登录验证码是 ${code}，10 分钟内有效。若非本人操作，请忽略此邮件。`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;color:#10261f"><p style="font-size:14px;color:#527064">Relay 接棒</p><h1 style="font-size:26px">验证你的邮箱</h1><p>请输入下面的验证码完成登录：</p><div style="font-size:36px;font-weight:700;letter-spacing:8px;background:#eaff70;padding:20px;text-align:center">${code}</div><p style="color:#527064">验证码 10 分钟内有效。若非本人操作，请忽略此邮件。</p></div>`,
      tags: [{ name: "category", value: "login_code" }],
    }),
  });
  if (response.ok) return { ok: true, message: "" };
  const detail = await response.text();
  console.error("Resend error", response.status, detail.slice(0, 500));
  return { ok: false, message: "验证码邮件发送失败，请稍后重试" };
}

async function requestCode(request: Request, env: Env) {
  if (!assertSameOrigin(request)) return json({ error: "请求来源无效" }, 403);
  const body = await requestBody(request);
  const email = normalizeEmail(body?.email);
  if (!validEmail(email)) return json({ error: "请输入有效邮箱地址" }, 400);
  if (!env.AUTH_SECRET) return json({ error: "登录服务尚未完成配置" }, 503);

  const now = Math.floor(Date.now() / 1000);
  const existing = await env.DB.prepare("SELECT sent_at AS sentAt FROM email_verification_codes WHERE email = ?")
    .bind(email).first<{ sentAt: number }>();
  if (existing && existing.sentAt > now - 60) return json({ error: "发送过于频繁，请 60 秒后再试" }, 429);

  const code = randomDigits();
  const codeHash = await sha256(`${email}:${code}:${env.AUTH_SECRET}`);
  await env.DB.prepare(`
    INSERT INTO email_verification_codes (email, code_hash, expires_at, attempts, sent_at)
    VALUES (?, ?, ?, 0, ?)
    ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, sent_at = excluded.sent_at
  `).bind(email, codeHash, now + CODE_SECONDS, now).run();

  const sent = await sendVerificationEmail(env, email, code);
  if (!sent.ok) {
    await env.DB.prepare("DELETE FROM email_verification_codes WHERE email = ?").bind(email).run();
    return json({ error: sent.message }, 503);
  }
  return json({ ok: true, message: "验证码已发送，有效期 10 分钟" });
}

async function verifyCode(request: Request, env: Env) {
  if (!assertSameOrigin(request)) return json({ error: "请求来源无效" }, 403);
  const body = await requestBody(request);
  const email = normalizeEmail(body?.email);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!validEmail(email) || !/^\d{6}$/.test(code)) return json({ error: "邮箱或验证码格式不正确" }, 400);
  if (!env.AUTH_SECRET) return json({ error: "登录服务尚未完成配置" }, 503);

  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare("SELECT code_hash AS codeHash, expires_at AS expiresAt, attempts FROM email_verification_codes WHERE email = ?")
    .bind(email).first<{ codeHash: string; expiresAt: number; attempts: number }>();
  if (!row || row.expiresAt <= now) return json({ error: "验证码已过期，请重新发送" }, 400);
  if (row.attempts >= 5) return json({ error: "尝试次数过多，请重新发送验证码" }, 429);
  const expected = await sha256(`${email}:${code}:${env.AUTH_SECRET}`);
  if (expected !== row.codeHash) {
    await env.DB.prepare("UPDATE email_verification_codes SET attempts = attempts + 1 WHERE email = ?").bind(email).run();
    return json({ error: "验证码不正确" }, 400);
  }

  const existing = await env.DB.prepare("SELECT id, status FROM users WHERE email = ?").bind(email).first<{ id: string; status: string }>();
  if (existing?.status === "banned") return json({ error: "该账号已被封禁，如有异议请提交申诉" }, 403);
  const userId = existing?.id ?? crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO users (id, email, email_verified_at, reputation, status, created_at, updated_at)
      VALUES (?, ?, ?, 80, 'active', ?, ?)
      ON CONFLICT(email) DO UPDATE SET email_verified_at = excluded.email_verified_at, updated_at = excluded.updated_at
    `).bind(userId, email, now, now, now),
    env.DB.prepare("DELETE FROM email_verification_codes WHERE email = ?").bind(email),
  ]);

  const token = randomToken();
  const tokenHash = await sha256(token);
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(tokenHash, userId, now + SESSION_SECONDS, now).run();
  const cookie = `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}`;
  return json({ ok: true, user: { email, reputation: 80 } }, 200, { "set-cookie": cookie });
}

async function logout(request: Request, env: Env) {
  if (!assertSameOrigin(request)) return json({ error: "请求来源无效" }, 403);
  const token = cookieValue(request, SESSION_COOKIE);
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  return json({ ok: true }, 200, { "set-cookie": `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0` });
}

async function syncProfileIndex(env: Env, profileId: string, type: "role" | "talent", keywords: Array<[string, number]>) {
  await env.DB.prepare("DELETE FROM profile_keywords WHERE profile_id = ?").bind(profileId).run();
  for (let start = 0; start < keywords.length; start += 75) {
    const statements = keywords.slice(start, start + 75).map(([keyword, weight]) =>
      env.DB.prepare("INSERT INTO profile_keywords (profile_id, keyword, type, weight) VALUES (?, ?, ?, ?)")
        .bind(profileId, keyword, type, weight));
    if (statements.length) await env.DB.batch(statements);
  }
}

async function finalizeHiddenExclusions(env: Env, userId: string, currentWeek: string) {
  const hidden = await env.DB.prepare(`
    SELECT DISTINCT m.role_profile_id AS roleProfileId, m.talent_profile_id AS talentProfileId
    FROM matches m
    JOIN profiles rp ON rp.id = m.role_profile_id
    JOIN profiles tp ON tp.id = m.talent_profile_id
    WHERE m.week_key <> ? AND (rp.user_id = ? OR tp.user_id = ?)
      AND (m.role_decision = 'hidden' OR m.talent_decision = 'hidden')
  `).bind(currentWeek, userId, userId).all<{ roleProfileId: string; talentProfileId: string }>();
  const now = Math.floor(Date.now() / 1000);
  for (const row of hidden.results) {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO match_exclusions (role_profile_id, talent_profile_id, reason, created_at)
      VALUES (?, ?, 'hidden', ?)
    `).bind(row.roleProfileId, row.talentProfileId, now).run();
  }
}

async function runMatchForProfile(env: Env, profileId: string, force = false) {
  const profile = await env.DB.prepare(`
    SELECT id, user_id AS userId, type, payload, embedding, content_version AS contentVersion, status
    FROM profiles WHERE id = ?
  `).bind(profileId).first<{ id: string; userId: string; type: "role" | "talent"; payload: string; embedding: string; contentVersion: number; status: string }>();
  if (!profile || profile.status !== "pooled") return { candidates: 0, matches: 0 };
  const currentWeek = weekKey();
  const previous = await env.DB.prepare("SELECT content_version AS contentVersion FROM match_runs WHERE profile_id = ? AND week_key = ?")
    .bind(profileId, currentWeek).first<{ contentVersion: number }>();
  if (previous && !force) return { candidates: 0, matches: 0 };

  const opposite = profile.type === "role" ? "talent" : "role";
  const exclusion = profile.type === "role"
    ? "e.role_profile_id = ? AND e.talent_profile_id = p.id"
    : "e.talent_profile_id = ? AND e.role_profile_id = p.id";
  const candidates = await env.DB.prepare(`
    SELECT p.id, p.user_id AS userId, p.payload, p.embedding,
      SUM(CASE WHEN mine.weight < other.weight THEN mine.weight ELSE other.weight END) AS sharedWeight
    FROM profile_keywords mine
    JOIN profile_keywords other ON other.keyword = mine.keyword
    JOIN profiles p ON p.id = other.profile_id
    WHERE mine.profile_id = ? AND other.type = ? AND p.status = 'pooled' AND p.user_id <> ?
      AND NOT EXISTS (SELECT 1 FROM match_exclusions e WHERE ${exclusion})
    GROUP BY p.id
    ORDER BY sharedWeight DESC
    LIMIT 100
  `).bind(profileId, opposite, profile.userId, profileId).all<{ id: string; userId: string; payload: string; embedding: string; sharedWeight: number }>();

  const ownIndex = buildProfileIndex(JSON.parse(profile.payload));
  const ownWeight = ownIndex.keywords.reduce((sum, [, weight]) => sum + weight, 0) || 1;
  const ownVector = JSON.parse(profile.embedding || "[]") as number[];
  let matchedCount = 0;
  const now = Math.floor(Date.now() / 1000);
  for (const candidate of candidates.results) {
    if (matchedCount >= 10) break;
    const candidateIndex = buildProfileIndex(JSON.parse(candidate.payload));
    const candidateWeight = candidateIndex.keywords.reduce((sum, [, weight]) => sum + weight, 0) || 1;
    const coverage = Math.min(1, Number(candidate.sharedWeight) / Math.min(ownWeight, candidateWeight));
    const keywordScore = Math.round(70 + coverage * 30);
    if (keywordScore < 90) continue;
    const candidateVector = JSON.parse(candidate.embedding || "[]") as number[];
    const vectorScore = Math.round(Math.max(0, Math.min(1, (cosine(ownVector, candidateVector) + 1) / 2)) * 100);
    const finalScore = Math.round(keywordScore * 0.75 + vectorScore * 0.25);
    if (finalScore < 90) continue;
    const roleId = profile.type === "role" ? profile.id : candidate.id;
    const talentId = profile.type === "talent" ? profile.id : candidate.id;
    const description = describeMatch(keywordScore, vectorScore);
    await env.DB.prepare(`
      INSERT INTO matches (id, role_profile_id, talent_profile_id, score, reasons, risks, verify_on_meeting, week_key, role_decision, talent_decision, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?)
      ON CONFLICT(role_profile_id, talent_profile_id, week_key)
      DO UPDATE SET score = excluded.score, reasons = excluded.reasons, risks = excluded.risks, verify_on_meeting = excluded.verify_on_meeting
    `).bind(crypto.randomUUID(), roleId, talentId, finalScore, JSON.stringify(description.reasons), JSON.stringify(description.risks), JSON.stringify(description.verifyOnMeeting), currentWeek, now).run();
    matchedCount += 1;
  }
  await env.DB.prepare(`
    INSERT INTO match_runs (profile_id, week_key, content_version, candidate_count, matched_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(profile_id, week_key) DO UPDATE SET content_version = excluded.content_version,
      candidate_count = excluded.candidate_count, matched_count = excluded.matched_count, created_at = excluded.created_at
  `).bind(profileId, currentWeek, profile.contentVersion, candidates.results.length, matchedCount, now).run();
  await env.DB.prepare("UPDATE profiles SET last_matched_week = ? WHERE id = ?").bind(currentWeek, profileId).run();
  return { candidates: candidates.results.length, matches: matchedCount };
}

async function ensureWeeklyMatchesForUser(env: Env, userId: string) {
  const currentWeek = weekKey();
  await finalizeHiddenExclusions(env, userId, currentWeek);
  const profiles = await env.DB.prepare(`
    SELECT id, type, payload, search_text AS searchText FROM profiles WHERE user_id = ? AND status = 'pooled'
  `).bind(userId).all<{ id: string; type: "role" | "talent"; payload: string; searchText: string }>();
  for (const profile of profiles.results) {
    if (!profile.searchText) {
      const index = buildProfileIndex(JSON.parse(profile.payload));
      await env.DB.prepare("UPDATE profiles SET search_text = ?, embedding = ? WHERE id = ?")
        .bind(index.searchText, JSON.stringify(vectorize(index.searchText)), profile.id).run();
      await syncProfileIndex(env, profile.id, profile.type, index.keywords);
    }
    await runMatchForProfile(env, profile.id);
  }
}

async function parseProfileWithAi(request: Request, env: Env) {
  const auth = await requireUser(request, env);
  if (auth.response || !auth.user) return auth.response!;
  if (!assertSameOrigin(request)) return json({ error: "请求来源无效" }, 403);
  if (!env.GEMINI_API_KEY) return json({ error: "AI 解析服务尚未配置，请联系管理员添加 Gemini API Key" }, 503);
  const body = await requestBody(request);
  const type = body?.type === "role" || body?.type === "talent" ? body.type as "role" | "talent" : null;
  const sourceText = typeof body?.text === "string" ? body.text.trim() : "";
  const existing = body?.existing && typeof body.existing === "object" && !Array.isArray(body.existing) ? body.existing as Record<string, unknown> : {};
  if (!type || !sourceText) return json({ error: "请先粘贴需要解析的内容" }, 400);
  if (sourceText.length > 30000) return json({ error: "一次最多解析 30000 个字符" }, 413);

  const dayKey = new Date().toISOString().slice(0, 10);
  const usage = await env.DB.prepare("SELECT request_count AS requestCount FROM ai_parse_usage WHERE user_id = ? AND day_key = ?")
    .bind(auth.user.id, dayKey).first<{ requestCount: number }>();
  if ((usage?.requestCount ?? 0) >= 20) return json({ error: "今天的 AI 解析次数已用完，请明天再试" }, 429);
  await env.DB.prepare(`
    INSERT INTO ai_parse_usage (user_id, day_key, request_count) VALUES (?, ?, 1)
    ON CONFLICT(user_id, day_key) DO UPDATE SET request_count = request_count + 1
  `).bind(auth.user.id, dayKey).run();

  const fields = PROFILE_FIELDS[type];
  const properties = Object.fromEntries(fields.map((field) => [field, { type: "string" }]));
  const model = env.GEMINI_MODEL || "gemini-flash-latest";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": env.GEMINI_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: `你是职业信息结构化分析器。把用户提供的${type === "role" ? "岗位/JD/招聘信息" : "求职经历/能力/偏好"}按字段语义归类。必须遵守：1. 不按句子出现顺序机械分配；2. 同一字段可整合多处信息并保留数字、币种、比例、期限和限定条件；3. 不得编造原文没有的信息；4. 无法判断的字段返回空字符串；5. 不要把职责放进职位名称，也不要把要求放进工作内容；6. 输出简体中文，专有名词可保留原文。` }],
      },
      contents: [{ role: "user", parts: [{ text: `字段说明：${fields.join(", ")}\n已有字段（仅用于补齐，不要覆盖其明确事实）：${JSON.stringify(existing)}\n待解析原文：\n${sourceText}` }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: { type: "object", properties, required: [...fields], additionalProperties: false },
        temperature: 0.1,
        maxOutputTokens: 4000,
      },
    }),
  });
  const result = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    console.error("Gemini parse error", response.status, JSON.stringify(result).slice(0, 800));
    return json({ error: "AI 暂时无法解析，请稍后重试" }, 502);
  }
  let outputText = "";
  if (Array.isArray(result.candidates)) {
    for (const candidate of result.candidates as Array<Record<string, unknown>>) {
      const content = candidate.content as Record<string, unknown> | undefined;
      if (!content || !Array.isArray(content.parts)) continue;
      for (const part of content.parts as Array<Record<string, unknown>>) {
        if (typeof part.text === "string") outputText += part.text;
      }
    }
  }
  try {
    const parsed = JSON.parse(outputText) as Record<string, unknown>;
    const profile = Object.fromEntries(fields.map((field) => [field, typeof parsed[field] === "string" ? parsed[field].trim() : ""]));
    return json({ ok: true, profile });
  } catch {
    return json({ error: "AI 返回内容无法读取，请重新解析" }, 502);
  }
}

async function profilesApi(request: Request, env: Env) {
  const auth = await requireUser(request, env);
  if (auth.response || !auth.user) return auth.response!;
  if (request.method === "GET") {
    const result = await env.DB.prepare(`
      SELECT id, type, anonymous_code AS anonymousCode, payload, completion, status, updated_at AS updatedAt
      FROM profiles WHERE user_id = ? AND status <> 'removed' ORDER BY type
    `).bind(auth.user.id).all<{ id: string; type: string; anonymousCode: string; payload: string; completion: number; status: string; updatedAt: number }>();
    return json({ profiles: result.results.map((row) => ({ ...row, payload: JSON.parse(row.payload) })) });
  }
  if (request.method !== "PUT") return json({ error: "不支持的请求" }, 405);
  if (!assertSameOrigin(request)) return json({ error: "请求来源无效" }, 403);
  const body = await requestBody(request);
  const type = body?.type === "role" || body?.type === "talent" ? body.type : null;
  const payload = body?.payload && typeof body.payload === "object" && !Array.isArray(body.payload) ? body.payload : null;
  const completion = typeof body?.completion === "number" ? Math.max(0, Math.min(100, Math.round(body.completion))) : 0;
  if (!type || !payload) return json({ error: "发布内容格式不正确" }, 400);
  const serialized = JSON.stringify(payload);
  if (serialized.length > 30000) return json({ error: "发布内容过长" }, 413);

  const now = Math.floor(Date.now() / 1000);
  const current = await env.DB.prepare("SELECT id, anonymous_code AS anonymousCode, status, content_version AS contentVersion FROM profiles WHERE user_id = ? AND type = ?")
    .bind(auth.user.id, type).first<{ id: string; anonymousCode: string; status: string; contentVersion: number }>();
  const recreating = current?.status === "removed";
  if (recreating) {
    const cycle = await env.DB.prepare("SELECT recreate_count AS recreateCount FROM publication_cycles WHERE user_id = ? AND type = ? AND month_key = ?")
      .bind(auth.user.id, type, monthKey()).first<{ recreateCount: number }>();
    if ((cycle?.recreateCount ?? 0) >= 1) return json({ error: "该方向本月的重新新建次数已用完" }, 429);
    await env.DB.prepare(`
      INSERT INTO publication_cycles (user_id, type, month_key, delete_count, recreate_count)
      VALUES (?, ?, ?, 0, 1)
      ON CONFLICT(user_id, type, month_key) DO UPDATE SET recreate_count = recreate_count + 1
    `).bind(auth.user.id, type, monthKey()).run();
  }
  const id = current?.id ?? crypto.randomUUID();
  const prefix = type === "role" ? "R" : "T";
  const anonymousCode = !current || recreating ? `${prefix}-${String(Math.floor(Math.random() * 900000) + 100000)}` : current.anonymousCode;
  const index = buildProfileIndex(payload);
  const embedding = vectorize(index.searchText);
  const contentVersion = (current?.contentVersion ?? 0) + 1;
  await env.DB.prepare(`
    INSERT INTO profiles (id, user_id, type, anonymous_code, payload, search_text, embedding, content_version, completion, status, created_at, updated_at, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pooled', ?, ?, NULL)
    ON CONFLICT(user_id, type) DO UPDATE SET anonymous_code = excluded.anonymous_code, payload = excluded.payload,
      search_text = excluded.search_text, embedding = excluded.embedding, content_version = excluded.content_version,
      completion = excluded.completion, status = 'pooled', updated_at = excluded.updated_at, deleted_at = NULL
  `).bind(id, auth.user.id, type, anonymousCode, serialized, index.searchText, JSON.stringify(embedding), contentVersion, completion, now, now).run();
  await syncProfileIndex(env, id, type, index.keywords);
  if (!current || recreating) {
    if (recreating) {
      await env.DB.prepare(`
        DELETE FROM matches WHERE week_key = ?
          AND (role_profile_id = ? OR talent_profile_id = ?)
          AND NOT EXISTS (SELECT 1 FROM conversations c WHERE c.match_id = matches.id)
      `).bind(weekKey(), id, id).run();
    }
    await runMatchForProfile(env, id, true);
  }
  return json({ ok: true, profile: { id, type, anonymousCode, payload, completion, status: "pooled", updatedAt: now } });
}

async function profileLifecycleApi(request: Request, env: Env, type: "role" | "talent") {
  const auth = await requireUser(request, env);
  if (auth.response || !auth.user) return auth.response!;
  if (!assertSameOrigin(request)) return json({ error: "请求来源无效" }, 403);
  const profile = await env.DB.prepare("SELECT id, status FROM profiles WHERE user_id = ? AND type = ?")
    .bind(auth.user.id, type).first<{ id: string; status: string }>();
  if (!profile || profile.status === "removed") return json({ error: "发布不存在" }, 404);
  const now = Math.floor(Date.now() / 1000);
  if (request.method === "DELETE") {
    const cycle = await env.DB.prepare("SELECT delete_count AS deleteCount FROM publication_cycles WHERE user_id = ? AND type = ? AND month_key = ?")
      .bind(auth.user.id, type, monthKey()).first<{ deleteCount: number }>();
    if ((cycle?.deleteCount ?? 0) >= 1) return json({ error: "该方向本月的删除次数已用完" }, 429);
    await env.DB.batch([
      env.DB.prepare("UPDATE profiles SET status = 'removed', deleted_at = ?, updated_at = ? WHERE id = ?").bind(now, now, profile.id),
      env.DB.prepare("DELETE FROM profile_keywords WHERE profile_id = ?").bind(profile.id),
      env.DB.prepare(`
        INSERT INTO publication_cycles (user_id, type, month_key, delete_count, recreate_count)
        VALUES (?, ?, ?, 1, 0)
        ON CONFLICT(user_id, type, month_key) DO UPDATE SET delete_count = delete_count + 1
      `).bind(auth.user.id, type, monthKey()),
    ]);
    return json({ ok: true, status: "removed" });
  }
  if (request.method === "PATCH") {
    const body = await requestBody(request);
    const status = body?.status === "paused" || body?.status === "pooled" ? body.status : null;
    if (!status) return json({ error: "状态无效" }, 400);
    await env.DB.prepare("UPDATE profiles SET status = ?, updated_at = ? WHERE id = ?").bind(status, now, profile.id).run();
    return json({ ok: true, status });
  }
  return json({ error: "不支持的请求" }, 405);
}

async function dashboardApi(request: Request, env: Env) {
  const auth = await requireUser(request, env);
  if (auth.response || !auth.user) return auth.response!;
  await ensureWeeklyMatchesForUser(env, auth.user.id);
  const profiles = await env.DB.prepare(`
    SELECT id, type, anonymous_code AS anonymousCode, payload, completion, status, updated_at AS updatedAt
    FROM profiles WHERE user_id = ? AND status <> 'removed' ORDER BY type
  `).bind(auth.user.id).all<{ id: string; type: string; anonymousCode: string; payload: string; completion: number; status: string; updatedAt: number }>();
  const profileRows = profiles.results.map((row) => ({ ...row, payload: JSON.parse(row.payload) }));
  const readyForMatching = profileRows.some((row) => row.status === "pooled");

  const matchRows = readyForMatching ? await env.DB.prepare(`
    SELECT m.id, m.score, m.reasons, m.risks, m.verify_on_meeting AS verifyOnMeeting,
      m.role_decision AS roleDecision, m.talent_decision AS talentDecision,
      rp.user_id AS roleUserId, rp.anonymous_code AS roleCode, rp.payload AS rolePayload,
      tp.user_id AS talentUserId, tp.anonymous_code AS talentCode, tp.payload AS talentPayload,
      c.id AS conversationId
    FROM matches m
    JOIN profiles rp ON rp.id = m.role_profile_id
    JOIN profiles tp ON tp.id = m.talent_profile_id
    LEFT JOIN conversations c ON c.match_id = m.id
    WHERE m.week_key = ? AND (rp.user_id = ? OR tp.user_id = ?)
    ORDER BY m.score DESC LIMIT 40
  `).bind(weekKey(), auth.user.id, auth.user.id).all<Record<string, string | number | null>>() : { results: [] };

  const allMatches = matchRows.results.map((row) => {
    const perspective = row.roleUserId === auth.user.id ? "role" : "talent";
    const opposingPayload = JSON.parse(String(perspective === "role" ? row.talentPayload : row.rolePayload));
    const ownDecision = String(perspective === "role" ? row.roleDecision : row.talentDecision);
    const otherDecision = String(perspective === "role" ? row.talentDecision : row.roleDecision);
    return {
      id: row.id, score: row.score, perspective, ownDecision, otherDecision,
      anonymousCode: perspective === "role" ? row.talentCode : row.roleCode,
      payload: opposingPayload,
      reasons: JSON.parse(String(row.reasons)), risks: JSON.parse(String(row.risks)),
      verifyOnMeeting: JSON.parse(String(row.verifyOnMeeting)), conversationId: row.conversationId,
    };
  });
  const matches = [
    ...allMatches.filter((match) => match.perspective === "role").slice(0, 10),
    ...allMatches.filter((match) => match.perspective === "talent").slice(0, 10),
  ].sort((a, b) => Number(b.score) - Number(a.score));
  const notifications = matches
    .filter((match) => match.ownDecision === "interested" && match.otherDecision === "interested" && !match.conversationId)
    .map((match) => ({ id: `mutual-${match.id}`, matchId: match.id, type: "mutual_match", anonymousCode: match.anonymousCode, score: match.score }));

  const conversations = await env.DB.prepare(`
    SELECT c.id, c.match_id AS matchId,
      CASE WHEN rp.user_id = ? THEN tp.anonymous_code ELSE rp.anonymous_code END AS anonymousCode,
      m.score,
      (SELECT body FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS lastMessage,
      (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) AS messageCount
    FROM conversations c
    JOIN matches m ON m.id = c.match_id
    JOIN profiles rp ON rp.id = m.role_profile_id
    JOIN profiles tp ON tp.id = m.talent_profile_id
    WHERE rp.user_id = ? OR tp.user_id = ?
    ORDER BY c.created_at DESC
  `).bind(auth.user.id, auth.user.id, auth.user.id).all<Record<string, string | number | null>>();

  const historyRows = await env.DB.prepare(`
    SELECT m.id, m.week_key AS weekKey, m.score, m.role_decision AS roleDecision, m.talent_decision AS talentDecision,
      rp.user_id AS roleUserId, rp.anonymous_code AS roleCode,
      tp.user_id AS talentUserId, tp.anonymous_code AS talentCode,
      c.id AS conversationId
    FROM matches m
    JOIN profiles rp ON rp.id = m.role_profile_id
    JOIN profiles tp ON tp.id = m.talent_profile_id
    LEFT JOIN conversations c ON c.match_id = m.id
    WHERE m.week_key <> ? AND (rp.user_id = ? OR tp.user_id = ?)
    ORDER BY m.week_key DESC, m.score DESC LIMIT 100
  `).bind(weekKey(), auth.user.id, auth.user.id).all<Record<string, string | number | null>>();
  const history = historyRows.results.map((row) => {
    const isRole = row.roleUserId === auth.user.id;
    const ownDecision = String(isRole ? row.roleDecision : row.talentDecision);
    const otherDecision = String(isRole ? row.talentDecision : row.roleDecision);
    const outcome = row.conversationId ? "success" : ownDecision === "hidden" || otherDecision === "hidden" ? "failed" : ownDecision === "interested" && otherDecision === "interested" ? "success" : "ended";
    return {
      id: row.id, weekKey: row.weekKey, score: row.score, outcome,
      anonymousCode: isRole ? row.talentCode : row.roleCode,
      perspective: isRole ? "role" : "talent", reviewAvailable: Boolean(row.conversationId),
    };
  });

  const cycles = await env.DB.prepare(`
    SELECT type, delete_count AS deleteCount, recreate_count AS recreateCount
    FROM publication_cycles WHERE user_id = ? AND month_key = ?
  `).bind(auth.user.id, monthKey()).all<{ type: "role" | "talent"; deleteCount: number; recreateCount: number }>();
  const publicationLimits = {
    role: { canDelete: true, canRecreate: true },
    talent: { canDelete: true, canRecreate: true },
  };
  for (const cycle of cycles.results) {
    publicationLimits[cycle.type] = { canDelete: cycle.deleteCount < 1, canRecreate: cycle.recreateCount < 1 };
  }

  return json({
    user: { email: auth.user.email, reputation: auth.user.reputation, isAdmin: isAdmin(env, auth.user.email) },
    profiles: profileRows, publicationLimits, readyForMatching, matches, history, notifications, conversations: conversations.results,
  });
}

async function matchDecisionApi(request: Request, env: Env, matchId: string) {
  const auth = await requireUser(request, env);
  if (auth.response || !auth.user) return auth.response!;
  if (!assertSameOrigin(request)) return json({ error: "请求来源无效" }, 403);
  const body = await requestBody(request);
  const decision = body?.decision === "pending" || body?.decision === "interested" || body?.decision === "hidden" ? body.decision : null;
  if (!decision) return json({ error: "选择无效" }, 400);
  const match = await env.DB.prepare(`
    SELECT rp.user_id AS roleUserId, tp.user_id AS talentUserId
    FROM matches m JOIN profiles rp ON rp.id = m.role_profile_id JOIN profiles tp ON tp.id = m.talent_profile_id
    WHERE m.id = ?
  `).bind(matchId).first<{ roleUserId: string; talentUserId: string }>();
  if (!match || (match.roleUserId !== auth.user.id && match.talentUserId !== auth.user.id)) return json({ error: "匹配不存在" }, 404);
  const column = match.roleUserId === auth.user.id ? "role_decision" : "talent_decision";
  await env.DB.prepare(`UPDATE matches SET ${column} = ? WHERE id = ?`).bind(decision, matchId).run();
  return json({ ok: true });
}

async function startConversationApi(request: Request, env: Env) {
  const auth = await requireUser(request, env);
  if (auth.response || !auth.user) return auth.response!;
  if (!assertSameOrigin(request)) return json({ error: "请求来源无效" }, 403);
  const body = await requestBody(request);
  const matchId = typeof body?.matchId === "string" ? body.matchId : "";
  const match = await env.DB.prepare(`
    SELECT m.id, m.role_decision AS roleDecision, m.talent_decision AS talentDecision,
      rp.user_id AS roleUserId, tp.user_id AS talentUserId
    FROM matches m JOIN profiles rp ON rp.id = m.role_profile_id JOIN profiles tp ON tp.id = m.talent_profile_id
    WHERE m.id = ?
  `).bind(matchId).first<{ id: string; roleDecision: string; talentDecision: string; roleUserId: string; talentUserId: string }>();
  if (!match || (match.roleUserId !== auth.user.id && match.talentUserId !== auth.user.id)) return json({ error: "匹配不存在" }, 404);
  if (match.roleDecision !== "interested" || match.talentDecision !== "interested") return json({ error: "只有双方匹配成功后才能开始沟通" }, 409);
  const existing = await env.DB.prepare("SELECT id FROM conversations WHERE match_id = ?").bind(matchId).first<{ id: string }>();
  const id = existing?.id ?? crypto.randomUUID();
  if (!existing) await env.DB.prepare("INSERT INTO conversations (id, match_id, created_at) VALUES (?, ?, ?)")
    .bind(id, matchId, Math.floor(Date.now() / 1000)).run();
  return json({ ok: true, conversationId: id });
}

async function adminSummaryApi(request: Request, env: Env) {
  const auth = await requireUser(request, env);
  if (auth.response || !auth.user) return auth.response!;
  if (!isAdmin(env, auth.user.email)) return json({ error: "无管理员权限" }, 403);
  const [users, reports, appeals] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS count FROM users").first<{ count: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM reports WHERE status = 'jury'").first<{ count: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM appeals WHERE status = 'pending'").first<{ count: number }>(),
  ]);
  return json({ users: users?.count ?? 0, activeReports: reports?.count ?? 0, pendingAppeals: appeals?.count ?? 0 });
}

async function adminDatabaseApi(request: Request, env: Env) {
  const auth = await requireUser(request, env);
  if (auth.response || !auth.user) return auth.response!;
  if (!isAdmin(env, auth.user.email)) return json({ error: "无管理员权限" }, 403);
  const tableNames = [
    "users", "profiles", "profile_keywords", "matches", "match_runs", "match_exclusions",
    "conversations", "messages", "reputation_events", "reports", "jury_assignments", "jury_votes",
    "appeals", "publication_cycles", "ai_parse_usage",
  ] as const;
  const countValues = await Promise.all(tableNames.map((table) =>
    env.DB.prepare(`SELECT COUNT(*) AS count FROM ${table}`).first<{ count: number }>()));
  const counts = Object.fromEntries(tableNames.map((table, index) => [table, countValues[index]?.count ?? 0]));
  const [users, profiles, matches] = await Promise.all([
    env.DB.prepare(`
      SELECT email, reputation, status, created_at AS createdAt
      FROM users ORDER BY created_at DESC LIMIT 30
    `).all<{ email: string; reputation: number; status: string; createdAt: number }>(),
    env.DB.prepare(`
      SELECT p.anonymous_code AS anonymousCode, p.type, p.status, p.completion,
        u.email, p.updated_at AS updatedAt
      FROM profiles p JOIN users u ON u.id = p.user_id
      ORDER BY p.updated_at DESC LIMIT 30
    `).all<{ anonymousCode: string; type: string; status: string; completion: number; email: string; updatedAt: number }>(),
    env.DB.prepare(`
      SELECT m.score, m.week_key AS weekKey, m.role_decision AS roleDecision,
        m.talent_decision AS talentDecision, rp.anonymous_code AS roleCode,
        tp.anonymous_code AS talentCode, m.created_at AS createdAt
      FROM matches m
      JOIN profiles rp ON rp.id = m.role_profile_id
      JOIN profiles tp ON tp.id = m.talent_profile_id
      ORDER BY m.created_at DESC LIMIT 30
    `).all<Record<string, string | number>>(),
  ]);
  return json({ counts, users: users.results, profiles: profiles.results, matches: matches.results });
}

async function api(request: Request, env: Env) {
  const { pathname } = new URL(request.url);
  if (pathname === "/api/auth/request-code" && request.method === "POST") return requestCode(request, env);
  if (pathname === "/api/auth/verify-code" && request.method === "POST") return verifyCode(request, env);
  if (pathname === "/api/auth/logout" && request.method === "POST") return logout(request, env);
  if (pathname === "/api/auth/me" && request.method === "GET") {
    const user = await currentUser(request, env);
    return user ? json({ user: { email: user.email, reputation: user.reputation, isAdmin: isAdmin(env, user.email) } }) : json({ user: null }, 401);
  }
  if (pathname === "/api/profiles") return profilesApi(request, env);
  if (pathname === "/api/ai/parse-profile" && request.method === "POST") return parseProfileWithAi(request, env);
  const profileLifecycleMatch = pathname.match(/^\/api\/profiles\/(role|talent)$/);
  if (profileLifecycleMatch && (request.method === "PATCH" || request.method === "DELETE")) {
    return profileLifecycleApi(request, env, profileLifecycleMatch[1] as "role" | "talent");
  }
  if (pathname === "/api/dashboard" && request.method === "GET") return dashboardApi(request, env);
  const decisionMatch = pathname.match(/^\/api\/matches\/([^/]+)\/decision$/);
  if (decisionMatch && request.method === "PUT") return matchDecisionApi(request, env, decisionMatch[1]);
  if (pathname === "/api/conversations" && request.method === "POST") return startConversationApi(request, env);
  if (pathname === "/api/admin/summary" && request.method === "GET") return adminSummaryApi(request, env);
  if (pathname === "/api/admin/database" && request.method === "GET") return adminDatabaseApi(request, env);
  return json({ error: "接口不存在" }, 404);
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return api(request, env);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
