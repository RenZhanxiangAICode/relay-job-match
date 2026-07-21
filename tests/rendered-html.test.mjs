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
  assert.match(envExample, /GOOGLE_CLIENT_ID=/);
  assert.match(envExample, /GOOGLE_CLIENT_SECRET=/);
});

test("supports Google OAuth while keeping email verification", async () => {
  const [page, worker, schema] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /使用 Google 账号登录/);
  assert.match(page, /或使用邮箱验证码/);
  assert.doesNotMatch(page, /正在确认投递结果/);
  assert.doesNotMatch(page, /通常会在几十秒内更新/);
  assert.match(page, /\/api\/auth\/google\/start/);
  assert.match(worker, /accounts\.google\.com\/o\/oauth2\/v2\/auth/);
  assert.match(worker, /oauth2\.googleapis\.com\/token/);
  assert.match(worker, /openidconnect\.googleapis\.com\/v1\/userinfo/);
  assert.match(worker, /\/api\/auth\/google\/callback/);
  assert.match(worker, /relay_google_state/);
  assert.match(schema, /oauthIdentities/);
});

test("uses indexed incremental matching and per-direction monthly limits", async () => {
  const [worker, schema, page] = await Promise.all([
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(worker, /JOIN profile_keywords other ON other\.keyword = mine\.keyword/);
  assert.match(worker, /LIMIT 100/);
  assert.match(worker, /cosine\(ownVector, candidateVector\)/);
  assert.match(worker, /rankCandidatesWithAi/);
  assert.match(worker, /gemini-rerank-v2/);
  assert.match(worker, /recentMatchingFeedback/);
  assert.match(worker, /match_feedback/);
  assert.match(worker, /\/api\/admin\/matches\/refresh/);
  assert.match(worker, /match_runs/);
  assert.match(worker, /publication_cycles/);
  assert.match(schema, /profileKeywords/);
  assert.match(schema, /publicationCycles/);
  assert.match(schema, /matchFeedback/);
  assert.match(schema, /adminMatchRefreshes/);
  assert.match(page, /暂停入池/);
  assert.match(page, /本月已删除过/);
  assert.match(page, /历史匹配/);
  assert.match(page, /确定退出当前登录账号吗/);
  assert.match(page, /\/api\/ai\/parse-profile/);
  assert.match(page, /岗位项目经验与产出/);
  assert.match(page, /我的项目经验与成果/);
  assert.match(page, /我的教育经历/);
  assert.match(page, /所需经验/);
  assert.match(page, /15 天未回复/);
  assert.match(page, /后台数据库/);
  assert.match(page, /getNextDailyCountdown/);
  assert.match(page, /距离下一次每日更新/);
  assert.match(page, /暂时隐藏/);
  assert.match(page, /收藏/);
  assert.match(page, /已发出意向/);
  assert.match(page, /已配对/);
  assert.match(page, /本次匹配信息/);
  assert.match(page, /正在进入匿名沟通/);
  assert.doesNotMatch(page, /await refreshDashboard\(\);\s*setHiddenReasonMatch/);
  assert.match(worker, /const \[matchRows, notificationRows, conversations, historyRows, cycles\] = await Promise\.all/);
  assert.match(worker, /mutual: ownDecision === "interested"/);
  assert.match(worker, /opposingPayload/);
  assert.match(worker, /user: \{ email: auth\.user\.email, reputation: auth\.user\.reputation/);
  assert.match(page, /onboardingChecked\.current/);
  assert.doesNotMatch(page, /关键词达标后再通过向量复核/);
  assert.match(worker, /\/api\/admin\/database/);
  assert.match(worker, /generativelanguage\.googleapis\.com/);
  assert.match(worker, /responseJsonSchema/);
  assert.match(worker, /ai_parse_usage/);
  assert.doesNotMatch(page, /split\(\/\[\\n，。；/);
});

test("ships the user-centered onboarding, persistent notifications, and real chat", async () => {
  const [page, worker, schema] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /你今天想解决什么/);
  assert.match(page, /AI PRIVATE INTERVIEW/);
  assert.match(page, /保存草稿/);
  assert.match(page, /NEXT BEST ACTION/);
  assert.match(page, /sendMessage/);
  assert.match(page, /未读与已读都会永久保留/);
  assert.match(worker, /INSERT OR IGNORE INTO notifications/);
  assert.match(worker, /conversationMessagesApi/);
  assert.match(worker, /转账\|保证金\|培训费/);
  assert.match(schema, /export const notifications/);
  assert.match(schema, /export const reviews/);
});
