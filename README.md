# Relay 接棒

一个不能公开浏览的私密 AI 职业匹配网络。用户可以同时发布一条“待接棒岗位”和一条“找工作画像”，系统每天分别提供最多 10 条值得判断的真实匹配。

## 功能

- Google OAuth 登录，同时保留 Resend 真实邮箱验证码登录；相同邮箱自动关联同一账号
- Gemini 结构化输出解析岗位 JD 与求职资料
- 待接棒岗位与求职画像，每类每账号最多一条
- 两个方向每天分别最多 10 条匿名匹配
- 硬条件过滤、数据库关键词召回、Gemini 768 维语义 Embedding、规则校准与 Gemini 解释
- 首次发布即时匹配，之后每日增量刷新；画像未变化时不会重复生成向量
- 两个方向都可以随时删除和重新发布，暂停/恢复不限次数
- 匹配理由、风险和面谈验证项
- 匿名站内沟通
- 双盲评价、结果里程碑、幂等信誉流水、举报、陪审和申诉
- 验证码与消息限流、严格来源校验、安全响应头和举报图片安全重编码
- 数据导出、7天注销反悔期和分级数据保存期限
- 只向 100 分信誉用户随机发放陪审案件

## 一键安装

需要 Node.js 22.13 或更高版本。克隆仓库后只需运行：

```bash
npm run setup
```

该命令会安装依赖、生成 D1/SQLite 数据库迁移，并执行生产构建验证。完成后启动：

```bash
npm run dev
```

## 数据库

项目使用 Drizzle ORM + Cloudflare D1（SQLite）。数据模型包含：

- `users`：邮箱账号、信誉分与封禁状态
- `oauth_identities`：Google 身份与 Relay 用户的安全关联，不存储 Google 密码
- `profiles`：接棒/求职画像，数据库约束每人每类仅一条
- `profile_keywords`：关键词倒排索引，用于数据库候选召回
- `match_runs`：每个画像每日的增量匹配执行记录
- `product_events`：不包含聊天正文的关键结果与漏斗事件
- `ai_parse_usage`：限制每个账号每日 AI 解析次数，防止接口滥用
- `match_exclusions`：跨周永久排除已隐藏组合
- `matches`：每周匹配分、理由、风险和双方决定
- `conversations` / `messages`：匿名会话
- `reputation_events`：可审计的信誉加减分流水
- `reports`：虚假岗位、虚假简历、骗钱等举报
- `jury_assignments` / `jury_votes`：随机陪审任务与投票
- `appeals`：扣分申诉和人工复核结果
- `data_requests`：数据导出与注销请求
- `company_complaints`：公司对未授权岗位、关闭HC和机密信息的投诉

修改 [db/schema.ts](db/schema.ts) 后运行：

```bash
npm run db:generate
```

## 部署

当前结构使用 vinext，适合部署到 Cloudflare Workers / OpenAI Sites 的免费层。`.openai/hosting.json` 已声明 `DB` D1 绑定，真实数据库由部署平台创建和注入。

### Google 登录配置

在 Google Cloud 创建“Web 应用”OAuth 客户端，并设置：

- 已获授权的 JavaScript 来源：`https://relayjob.dpdns.org`
- 已获授权的重定向 URI：`https://relayjob.dpdns.org/api/auth/google/callback`

将客户端凭据保存为部署环境变量 `GOOGLE_CLIENT_ID` 和 `GOOGLE_CLIENT_SECRET`，再设置 `APP_ORIGIN=https://relayjob.dpdns.org`。客户端密钥不得提交到 GitHub。Google 返回经过验证的邮箱后，Relay 会创建账号；如果该邮箱已使用验证码登录，会自动关联现有账号。

## 开发命令

```bash
npm run dev          # 本地开发
npm run build        # 生产构建
npm run db:generate  # 生成数据库迁移
npm run lint         # 代码检查
```

## 当前边界

邮箱、账号、发布、匹配、会话、双盲评价、举报与数据请求均接入真实数据库。AI 解析和解释使用服务端 `GEMINI_API_KEY`，语义匹配使用 `gemini-embedding-2` 的 768 维向量；Gemini 不可改变候选集合、硬条件、最终分数或信誉状态。API 不可用时降级为本地确定性向量与规则排序。
