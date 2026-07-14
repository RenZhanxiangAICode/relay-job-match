import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Relay email-login shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Relay 接棒 — 私密 AI 职业匹配<\/title>/i);
  assert.match(html, /正在确认/);
  assert.match(html, /安全登录状态/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps real email auth and persistent profiles wired", async () => {
  const [page, worker, hosting, envExample] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);

  assert.match(page, /\/api\/auth\/request-code/);
  assert.match(page, /\/api\/auth\/verify-code/);
  assert.match(page, /\/api\/profiles/);
  assert.match(worker, /https:\/\/api\.resend\.com\/emails/);
  assert.match(worker, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(worker, /INSERT INTO email_verification_codes/);
  assert.match(worker, /ON CONFLICT\(user_id, type\)/);
  assert.equal(JSON.parse(hosting).d1, "DB");
  assert.match(envExample, /RESEND_API_KEY=/);
  assert.match(envExample, /AUTH_SECRET=/);
});
