"use client";

import { FormEvent, useMemo, useState } from "react";

type Mode = "role" | "talent";
type Chat = { from: "ai" | "user"; text: string };

const starters: Record<Mode, Chat[]> = {
  role: [
    {
      from: "ai",
      text: "先用你自己的话说说：你现在做什么、为什么准备离开，以及你希望什么样的人接住这份工作？",
    },
  ],
  talent: [
    {
      from: "ai",
      text: "不用写标准简历。告诉我你真正擅长什么、下一步想改变什么，以及哪些工作条件不能妥协？",
    },
  ],
};

const replies: Record<Mode, string[]> = {
  role: [
    "明白了。这份岗位真正难的似乎不是职位名称，而是把客户续费和内部协作同时接住。公司是否已经知道你的离职计划？你有内推或推荐候选人的权限吗？",
    "很好。我会把岗位标记为“潜在接棒”，在公司确认前不透露公司名称。最后一个问题：候选人上手后的前三个月，最重要的成功标准是什么？",
    "岗位画像已经生成并加密进入接棒池。只有硬条件、能力和工作环境都合适的人，才会收到匿名机会。",
  ],
  talent: [
    "我听到的核心不是“换一份同类工作”，而是希望把你的沟通与复杂信息整理能力迁移到更稳定的环境。你对薪资、城市和到岗时间有什么硬性要求？",
    "收到。为了避免只按职位名称匹配，我会同时寻找客户成功、用户研究、内容策略和项目运营等相邻方向。你愿意完成一个不超过 45 分钟的工作样本吗？",
    "个人画像已经匿名进入人才池。身份不会被浏览，只有双方条件达到阈值时，我才会分别征求你们的同意。",
  ],
};

export default function Home() {
  const [mode, setMode] = useState<Mode>("role");
  const [chats, setChats] = useState<Record<Mode, Chat[]>>(starters);
  const [input, setInput] = useState("");
  const [step, setStep] = useState<Record<Mode, number>>({ role: 0, talent: 0 });
  const [submitted, setSubmitted] = useState<Record<Mode, boolean>>({ role: false, talent: false });
  const [notice, setNotice] = useState(false);

  const current = chats[mode];
  const progress = useMemo(() => Math.min(34 + step[mode] * 23, 100), [mode, step]);

  function switchMode(next: Mode) {
    setMode(next);
    setInput("");
  }

  function send(e: FormEvent) {
    e.preventDefault();
    const value = input.trim();
    if (!value) return;
    const nextStep = Math.min(step[mode] + 1, 3);
    setChats((all) => ({
      ...all,
      [mode]: [...all[mode], { from: "user", text: value }, { from: "ai", text: replies[mode][Math.min(step[mode], 2)] }],
    }));
    setStep((all) => ({ ...all, [mode]: nextStep }));
    if (nextStep === 3) setSubmitted((all) => ({ ...all, [mode]: true }));
    setInput("");
  }

  return (
    <main>
      <header className="nav shell">
        <a className="brand" href="#top" aria-label="Relay 首页">
          <span className="brand-mark">R</span>
          <span>Relay <i>接棒</i></span>
        </a>
        <div className="privacy-pill"><span /> 默认匿名 · 双向解锁</div>
        <button className="text-btn" onClick={() => setNotice(true)}>我的信任护照</button>
      </header>

      <section className="hero shell" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span>私密职业匹配网络</span><b>PRIVATE BY DESIGN</b></div>
          <h1>不用找工作。<br /><em>让合适的机会找到你。</em></h1>
          <p className="lead">这里没有职位广场，也没有公开简历。把你的真实需求交给 AI，只有当岗位与人彼此合适时，双方才会被看见。</p>
          <div className="promise-row">
            <div><b>01</b><span>不可浏览</span><small>信息不会被搜索</small></div>
            <div><b>02</b><span>证据分层</span><small>自述与已验证分开</small></div>
            <div><b>03</b><span>双向同意</span><small>双方点头才解锁</small></div>
          </div>
        </div>

        <section className="agent-card" aria-label="AI 职业代理">
          <div className="agent-head">
            <div><span className="ai-orb">✦</span><div><b>你的 AI 职业代理</b><small>只对你负责 · 数据加密</small></div></div>
            <div className="status">● 在线</div>
          </div>

          <div className="mode-tabs" role="tablist">
            <button className={mode === "role" ? "active" : ""} onClick={() => switchMode("role")}>我想找接班人</button>
            <button className={mode === "talent" ? "active" : ""} onClick={() => switchMode("talent")}>我想找新机会</button>
          </div>

          <div className="progress"><span style={{ width: `${progress}%` }} /></div>
          <div className="chat-window" aria-live="polite">
            {current.map((chat, index) => (
              <div className={`message ${chat.from}`} key={`${mode}-${index}`}>
                {chat.from === "ai" && <span className="mini-orb">✦</span>}
                <p>{chat.text}</p>
              </div>
            ))}
            {submitted[mode] && (
              <div className="pool-ticket">
                <div><span>已入池</span><b>{mode === "role" ? "待接棒岗位 #R-0482" : "匿名人才 #T-2716"}</b></div>
                <small>当前可见性：仅 AI 可见</small>
              </div>
            )}
          </div>

          <form className="composer" onSubmit={send}>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder={submitted[mode] ? "继续补充，AI 会更新你的画像…" : "就像和一个值得信任的人聊天…"} aria-label="输入你的回答" rows={2} />
            <button type="submit" aria-label="发送">↑</button>
          </form>
          <p className="fine-print">你的身份不会因进入池子而公开。AI 不会在未获授权时向任何人分享你的资料。</p>
        </section>
      </section>

      <section className="how shell">
        <div className="section-title"><span>它如何工作</span><h2>信任不是一枚徽章，<br />而是一条可验证的链路。</h2></div>
        <div className="trust-grid">
          <article><span>1</span><b>自然对话建模</b><p>AI 追问真实工作、能力边界与不可妥协条件，不靠标准简历。</p></article>
          <article><span>2</span><b>重要说法有凭证</b><p>身份、任职、岗位权限和能力样本分开验证，清楚标注“自述”或“已核验”。</p></article>
          <article><span>3</span><b>匿名双向匹配</b><p>先显示匹配理由和风险，双方都愿意后再逐层解锁身份。</p></article>
          <article><span>4</span><b>用结果累积声誉</b><p>到岗、上手时间与留存结果持续校准匹配，不用空洞的五星好评。</p></article>
        </div>
      </section>

      <section className="match-demo shell">
        <div><span className="kicker">一次匹配会长什么样</span><h2>不只告诉你“合适”，<br />还要告诉你为什么。</h2><p>匹配分数不是结论。Relay 会把已验证事实、可迁移能力与待确认风险同时呈现。</p></div>
        <div className="match-card">
          <div className="match-top"><div><span>82</span><small>双向适配</small></div><b>一个只对你可见的机会</b></div>
          <h3>B2B 客户成功 · 上海/可混合</h3>
          <div className="signal good"><b>匹配信号</b><p>你的客户沟通与复杂信息整理能力，能迁移到该岗位的续费管理工作。</p></div>
          <div className="signal warn"><b>待确认风险</b><p>你暂无 SaaS 经验；岗位上级管理风格较强，需要在匿名面谈中确认。</p></div>
          <button onClick={() => setNotice(true)}>我愿意了解更多 <span>→</span></button>
        </div>
      </section>

      <footer><div className="shell"><div className="brand"><span className="brand-mark">R</span><span>Relay <i>接棒</i></span></div><p>让每一次离开，都成为下一次开始。</p><small>概念验证版 · 不会真实发送任何个人资料</small></div></footer>

      {notice && <div className="modal-backdrop" onClick={() => setNotice(false)}><div className="modal" onClick={(e) => e.stopPropagation()}><button className="close" onClick={() => setNotice(false)}>×</button><span className="ai-orb">✓</span><h2>这是一个可交互概念版</h2><p>你刚才的输入只保存在当前页面里，不会上传。正式版将加入身份核验、企业确认、加密数据库与真实 AI 匹配。</p><button className="modal-cta" onClick={() => setNotice(false)}>继续体验</button></div></div>}
    </main>
  );
}
