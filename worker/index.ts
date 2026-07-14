import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  AUTH_SECRET?: string;
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

async function profilesApi(request: Request, env: Env) {
  const auth = await requireUser(request, env);
  if (auth.response || !auth.user) return auth.response!;
  if (request.method === "GET") {
    const result = await env.DB.prepare(`
      SELECT id, type, anonymous_code AS anonymousCode, payload, completion, status, updated_at AS updatedAt
      FROM profiles WHERE user_id = ? ORDER BY type
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
  const current = await env.DB.prepare("SELECT id, anonymous_code AS anonymousCode FROM profiles WHERE user_id = ? AND type = ?")
    .bind(auth.user.id, type).first<{ id: string; anonymousCode: string }>();
  const id = current?.id ?? crypto.randomUUID();
  const prefix = type === "role" ? "R" : "T";
  const anonymousCode = current?.anonymousCode ?? `${prefix}-${String(Math.floor(Math.random() * 900000) + 100000)}`;
  await env.DB.prepare(`
    INSERT INTO profiles (id, user_id, type, anonymous_code, payload, completion, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pooled', ?, ?)
    ON CONFLICT(user_id, type) DO UPDATE SET payload = excluded.payload, completion = excluded.completion, status = 'pooled', updated_at = excluded.updated_at
  `).bind(id, auth.user.id, type, anonymousCode, serialized, completion, now, now).run();
  return json({ ok: true, profile: { id, type, anonymousCode, payload, completion, status: "pooled", updatedAt: now } });
}

async function api(request: Request, env: Env) {
  const { pathname } = new URL(request.url);
  if (pathname === "/api/auth/request-code" && request.method === "POST") return requestCode(request, env);
  if (pathname === "/api/auth/verify-code" && request.method === "POST") return verifyCode(request, env);
  if (pathname === "/api/auth/logout" && request.method === "POST") return logout(request, env);
  if (pathname === "/api/auth/me" && request.method === "GET") {
    const user = await currentUser(request, env);
    return user ? json({ user: { email: user.email, reputation: user.reputation } }) : json({ user: null }, 401);
  }
  if (pathname === "/api/profiles") return profilesApi(request, env);
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
