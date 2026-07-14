# Relay 接棒

一个不能浏览的私密 AI 职业匹配网络。用户可以同时发布一条“待接棒岗位”和一条“找工作画像”，只有当 AI 双向匹配超过 90 分时才建立匿名连接。

## 功能

- Resend 真实邮箱验证码登录
- 待接棒岗位与求职画像，每类每账号最多一条
- 两个方向分别每周最多 10 条匿名匹配
- 数据库关键词索引召回，达到 90 分后再做向量复核
- 首次发布即时匹配；修改、暂停和恢复在下周一增量刷新
- 两个方向分别每月可删除一次、删除后新建一次，暂停/恢复不限次数
- 匹配理由、风险和面谈验证项
- 匿名站内沟通
- 信誉流水、举报、陪审、过半封号和申诉
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
- `profiles`：接棒/求职画像，数据库约束每人每类仅一条
- `profile_keywords`：关键词倒排索引，用于数据库候选召回
- `match_runs`：每个画像每周的增量匹配执行记录
- `publication_cycles`：按方向记录月度删除和重建额度
- `match_exclusions`：跨周永久排除已隐藏组合
- `matches`：每周匹配分、理由、风险和双方决定
- `conversations` / `messages`：匿名会话
- `reputation_events`：可审计的信誉加减分流水
- `reports`：虚假岗位、虚假简历、骗钱等举报
- `jury_assignments` / `jury_votes`：随机陪审任务与投票
- `appeals`：封号申诉和人工复核结果

修改 [db/schema.ts](db/schema.ts) 后运行：

```bash
npm run db:generate
```

## 部署

当前结构使用 vinext，适合部署到 Cloudflare Workers / OpenAI Sites 的免费层。`.openai/hosting.json` 已声明 `DB` D1 绑定，真实数据库由部署平台创建和注入。

## 开发命令

```bash
npm run dev          # 本地开发
npm run build        # 生产构建
npm run db:generate  # 生成数据库迁移
npm run lint         # 代码检查
```

## 当前边界

邮箱、账号、发布、月度额度和匹配结果均接入真实服务与数据库。当前向量层使用本地确定性 128 维文本向量，不依赖付费 API；后续可替换为语义 embedding，并沿用相同的数据库候选召回和匹配记录结构。
