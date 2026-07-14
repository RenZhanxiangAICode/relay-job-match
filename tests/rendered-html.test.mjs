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
  assert.match(page, /readyForMatching/);
  assert.match(page, /view==="admin"&&isAdmin/);
  assert.doesNotMatch(page, /R-1904|T-8821|J-2041|R-88102/);
  assert.match(worker, /https:\/\/api\.resend\.com\/emails/);
  assert.match(worker, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(worker, /INSERT INTO email_verification_codes/);
  assert.match(worker, /ON CONFLICT\(user_id, type\)/);
  assert.match(worker, /ADMIN_EMAILS/);
  assert.match(worker, /\u65e0\u7ba1\u7406\u5458\u6743\u9650/);
  assert.equal(JSON.parse(hosting).d1, "DB");
  assert.match(envExample, /RESEND_API_KEY=/);
  assert.match(envExample, /AUTH_SECRET=/);
});

test("uses indexed incremental matching and per-direction monthly limits", async () => {
  const [worker, schema, page] = await Promise.all([
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(worker, /JOIN profile_keywords other ON other\.keyword = mine\.keyword/);
  assert.match(worker, /LIMIT 100/);
  assert.match(worker, /if \(keywordScore < 90\) continue/);
  assert.match(worker, /cosine\(ownVector, candidateVector\)/);
  assert.match(worker, /match_runs/);
  assert.match(worker, /publication_cycles/);
  assert.match(schema, /profileKeywords/);
  assert.match(schema, /publicationCycles/);
  assert.match(page, /暂停入池/);
  assert.match(page, /本月已删除过/);
  assert.match(page, /历史匹配/);
  assert.match(page, /确定退出当前登录账号吗/);
  assert.match(page, /\/api\/ai\/parse-profile/);
  assert.match(page, /岗位项目经验与产出/);
  assert.match(page, /我的项目经验与成果/);
  assert.match(page, /15 天未回复/);
  assert.match(page, /后台数据库/);
  assert.match(worker, /\/api\/admin\/database/);
  assert.match(worker, /generativelanguage\.googleapis\.com/);
  assert.match(worker, /responseJsonSchema/);
  assert.match(worker, /ai_parse_usage/);
  assert.doesNotMatch(page, /split\(\/\[\\n，。；/);
});
