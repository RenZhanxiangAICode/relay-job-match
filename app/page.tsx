"use client";

import { FormEvent, useMemo, useState } from "react";

type Mode = "role" | "talent";
type View = "home" | "posts" | "matches" | "messages" | "trust" | "jury" | "admin";
type Field = { key: string; label: string; hint: string; required?: boolean };

const roleFields: Field[] = [
  { key:"city", label:"公司城市", hint:"例：上海·浦东 / 可混合", required:true },
  { key:"role", label:"当前岗位", hint:"职位名称、级别、所属部门", required:true },
  { key:"industry", label:"行业与业务", hint:"公司做什么，岗位服务谁" },
  { key:"work", label:"真实工作内容", hint:"一周怎么过，关键 KPI 是什么", required:true },
  { key:"ability", label:"必要能力", hint:"硬技能、软技能与上手时间", required:true },
  { key:"knowledge", label:"知识与证书", hint:"专业知识、工具、证书或资历要求" },
  { key:"culture", label:"文化氛围", hint:"管理风格、团队关系、决策方式" },
  { key:"system", label:"制度与薪酬", hint:"薪资范围、奖金、作息、福利和加班" },
  { key:"travel", label:"出差与到岗", hint:"出差频率、预计空缺时间、交接周期" },
  { key:"growth", label:"晋升空间", hint:"向上发展、转岗机会、能学到什么" },
  { key:"referral", label:"内推资格", hint:"你是否可内推？公司是否已确认 HC？", required:true },
  { key:"process", label:"招聘流程", hint:"面试轮次、决策人、大约时间" },
  { key:"warning", label:"避雷点", hint:"什么样的人不适合？最容易后悔什么？", required:true },
  { key:"leave", label:"为什么离开", hint:"只对高匹配候选人展示", required:true },
];

const talentFields: Field[] = [
  { key:"ability", label:"我的能力", hint:"你真正擅长什么，有哪些成果", required:true },
  { key:"industry", label:"想进入的行业", hint:"可以写多个，也可说为什么" },
  { key:"company", label:"想去的公司", hint:"规模、阶段、团队、管理风格" },
  { key:"reject", label:"明确不接受", hint:"行业、工作内容、加班、出差、管理方式", required:true },
  { key:"city", label:"目标城市", hint:"可接受的城市、通勤或远程要求", required:true },
  { key:"salary", label:"期望薪资", hint:"底线、期望和总包接受方式", required:true },
  { key:"arrival", label:"到岗时间", hint:"最早到岗、当前在职状态" },
  { key:"plan", label:"职业规划", hint:"未来 2—3 年想成为谁，什么比职称更重要" },
  { key:"personality", label:"性格与工作方式", hint:"可粘贴 MBTI / DISC，也可直接描述" },
  { key:"credential", label:"资历与作品", hint:"证书、作品集、项目、可验证人" },
];

const matches = [
  { score:96, title:"匿名岗位 R-1904", city:"上海·混合", salary:"32–40K", verified:"发布者邮箱已验证", why:"你的 B 端产品经验、复杂需求拆解和跨部门推进能力完全命中。", risk:"公司、任职、HC 和业绩均为发布者自述；需在匿名沟通中逐项验证。" },
  { score:93, title:"匿名岗位 R-2088", city:"杭州", salary:"35–45K", verified:"发布者邮箱已验证", why:"你过去的用户增长经验与对方描述的业务阶段高度一致。", risk:"岗位真实性、团队规模和 20% 出差频率均尚未由第三方认证。" },
  { score:91, title:"匿名岗位 R-2261", city:"北京·可远程", salary:"30–38K", verified:"发布者邮箱已验证", why:"你在广告策略与产品协作上的复合经验与对方需求类似。", risk:"内推权限、薪资口径与远程政策都属于自述信息。" },
];

const juryCases = [
  { id:"J-2041", type:"虚假岗位", summary:"发布者要求候选人先支付“内推保证金” 800 元。", evidence:"3 份对话截图·企业否认 HC", votes:"126 / 150" },
  { id:"J-2038", type:"疑似简历造假", summary:"候选人声称独立负责项目，但作品与时间线存在明显矛盾。", evidence:"2 份材料·当事人已回应", votes:"88 / 150" },
];

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [view, setView] = useState<View>("home");
  const [mode, setMode] = useState<Mode>("role");
  const [profileOpen, setProfileOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [values, setValues] = useState<Record<string,string>>({});
  const [saved, setSaved] = useState(false);
  const [liked, setLiked] = useState<number[]>([]);
  const [hidden, setHidden] = useState<number[]>([]);
  const [selectedCase, setSelectedCase] = useState(0);
  const [voted, setVoted] = useState<"black"|"keep"|null>(null);
  const [toast, setToast] = useState("");
  const fields = mode === "role" ? roleFields : talentFields;
  const completion = useMemo(() => Math.round(fields.filter(f => values[`${mode}-${f.key}`]?.trim()).length / fields.length * 100), [fields, mode, values]);

  function login(e:FormEvent){ e.preventDefault(); if(!codeSent){setCodeSent(true);setToast("演示邮箱验证码：246810");return} setLoggedIn(true);setToast("邮箱已验证，已进入安全账户"); }
  function flash(text:string){setToast(text);setTimeout(()=>setToast(""),2600)}
  function parseText(){
    const chunks = raw.split(/[\n，。；;]+/).filter(Boolean);
    const next = {...values};
    fields.forEach((f,i)=>{ if(chunks[i]) next[`${mode}-${f.key}`]=chunks[i].trim(); });
    setValues(next);setRawOpen(false);setProfileOpen(true);flash(`AI 已识别 ${Math.min(chunks.length,fields.length)} 项信息，请确认`);
  }
  function nav(next:View){setView(next);window.scrollTo({top:0,behavior:"smooth"})}

  if(!loggedIn) return <main className="login-page">
    <div className="login-brand"><span className="brand-mark">R</span><b>Relay 接棒</b></div>
    <section className="login-copy"><span className="overline">PRIVATE TALENT NETWORK</span><h1>不用浏览。<br/><em>只见真正适合的人。</em></h1><p>你的岗位和简历都不会公开。AI 每周从私密池中筛选 10 个机会，只在匹配超过 90 分时为双方建立连接。</p><div className="login-proof"><span>仅邮箱验证</span><span>全程匿名沟通</span><span>社区过半自动处置</span></div></section>
    <section className="login-box"><span className="step-tag">安全入口</span><h2>邮箱登录</h2><p>一个邮箱对应一个匿名账号。第一版不收集、不认证手机号。</p><form onSubmit={login}><label>邮箱地址</label><div className="phone-input"><span>@</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" required/></div>{codeSent&&<><label>邮箱验证码</label><input className="code-input" placeholder="输入 246810" required/></>}<button>{codeSent?"验证邮箱并进入":"发送邮箱验证码"}<span>→</span></button></form><small>当前为产品演示，不会发送真实邮件。</small></section>
    {toast&&<div className="toast">{toast}</div>}
  </main>;

  return <main className="app-shell">
    <aside className="sidebar">
      <button className="side-brand" onClick={()=>nav("home")}><span className="brand-mark">R</span><b>Relay <i>接棒</i></b></button>
      <nav>
        <button className={view==="home"?"active":""} onClick={()=>nav("home")}><span>◈</span>首页</button>
        <button className={view==="posts"?"active":""} onClick={()=>nav("posts")}><span>▤</span>我的发布<em>2</em></button>
        <button className={view==="matches"?"active":""} onClick={()=>nav("matches")}><span>✦</span>本周匹配<em>10</em></button>
        <button className={view==="messages"?"active":""} onClick={()=>nav("messages")}><span>○</span>匿名沟通<em>2</em></button>
        <button className={view==="trust"?"active":""} onClick={()=>nav("trust")}><span>✓</span>信任护照</button>
        <button className={view==="jury"?"active":""} onClick={()=>nav("jury")}><span>⚖</span>公民陪审</button>
      </nav>
      <div className="side-bottom"><button className={view==="admin"?"active":""} onClick={()=>nav("admin")}><span>⚙</span>管理员控制台</button><div className="user-chip"><span>R</span><div><b>匿名用户 2716</b><small>信誉分 100 · 邮箱已验证</small></div></div></div>
    </aside>
    <div className="mobile-nav"><button onClick={()=>nav("home")}>首页</button><button onClick={()=>nav("matches")}>匹配</button><button onClick={()=>nav("messages")}>沟通</button><button onClick={()=>nav("jury")}>陪审</button></div>
    <section className="workspace">
      <header className="topbar"><div><span className="secure-dot"/>匿名模式已开启</div><div><button onClick={()=>flash("本周新增 3 个高匹配机会")}>○ 通知</button><button className="score-pill" onClick={()=>nav("trust")}>信誉 100</button></div></header>

      {view==="home"&&<div className="page home-page">
        <section className="welcome"><div><span className="overline">GOOD EVENING · RELAY 2716</span><h1>你的下一棒，<br/><em>正在私密池中寻找你。</em></h1><p>完善真实画像，会让 AI 更准确地判断“为什么合适”。</p></div><div className="cycle"><span>下次周筛选</span><b>03<small>天</small> 14<small>时</small></b><p>每周最多 10 条·仅展示 90+ 匹配</p></div></section>
        <section className="action-grid"><article className="primary-action"><span className="card-index">01 / PROFILE</span><h2>告诉 AI，你现在需要什么？</h2><div className="role-toggle"><button className={mode==="role"?"active":""} onClick={()=>setMode("role")}>找一位接棒人</button><button className={mode==="talent"?"active":""} onClick={()=>setMode("talent")}>找一个新机会</button></div><p>{mode==="role"?"岗位不会公开。AI 会将真实工作、文化、薪酬、风险和交接方式整理成私密岗位画像。":"简历不会出现姓名和联系方式。AI 会识别你的能力、意愿、底线和可迁移方向。"}</p><div className="completion"><span><b>{completion}%</b> 画像完整度</span><i><b style={{width:`${completion}%`}}/></i></div><div className="action-buttons"><button className="solid" onClick={()=>setProfileOpen(true)}>完整填写 <span>→</span></button><button className="outline" onClick={()=>setRawOpen(true)}>粘贴一段话，AI 帮我拆解</button></div></article>
        <article className="weekly-card"><span className="card-index">02 / WEEKLY MATCH</span><div className="ring"><b>3</b><small>/ 10</small></div><h3>本周有 3 个高匹配机会</h3><p>最高匹配 96 分。在下周一前选择“想了解”，才会向对方发出匿名连接。</p><button onClick={()=>nav("matches")}>查看本周筛选 <span>→</span></button></article></section>
        <section className="principles"><div><span>90+</span><p>只有超过 90 分才建立连接</p></div><div><span>1+1</span><p>每个账号最多一条接棒与一条求职信息</p></div><div><span>@</span><p>第一版仅验证邮箱，其他信息都是自述</p></div><div><span>50%</span><p>陪审拉黑票过半后，系统立即自动封号</p></div></section>
      </div>}

      {view==="posts"&&<div className="page posts-page"><div className="page-heading"><div><span className="overline">MY PRIVATE POSTS</span><h1>我的发布</h1><p>每个账号只能同时向池子提交一条接棒信息和一条找工作信息，可随时修改或暂停匹配。</p></div><div className="post-limit"><b>2 / 2</b><span>已使用发布名额</span></div></div><div className="post-cards"><article><header><span>R-0482</span><i>匹配中</i></header><h2>我的待接棒岗位</h2><p>上海 · B2B SaaS 客户成功 · 预计 30 天后交接</p><div className="post-meta"><span>画像完整度 <b>{Math.max(completion,72)}%</b></span><span>本周候选人 <b>6</b></span></div><div><button className="solid" onClick={()=>{setMode("role");setProfileOpen(true)}}>修改接棒信息</button><button className="outline" onClick={()=>flash("该接棒信息已暂停匹配")}>暂停入池</button></div></article><article><header><span>T-2716</span><i>匹配中</i></header><h2>我的找工作画像</h2><p>产品 / 增长策略 · 上海或杭州 · 期望 30–40K</p><div className="post-meta"><span>画像完整度 <b>{Math.max(completion,84)}%</b></span><span>本周匹配岗位 <b>3</b></span></div><div><button className="solid" onClick={()=>{setMode("talent");setProfileOpen(true)}}>修改求职信息</button><button className="outline" onClick={()=>flash("该求职信息已暂停匹配")}>暂停入池</button></div></article></div><div className="one-post-rule"><b>为什么限制为 1+1？</b><p>减少重复岗位、批量投放和虚假广告。如果方向发生变化，请直接修改原信息，而不是新建多条记录。</p></div></div>}

      {view==="matches"&&<div className="page"><div className="page-heading"><div><span className="overline">WEEK 28 · PRIVATE SELECTION</span><h1>本周精选</h1><p>AI 已对岗位真实性、硬条件、能力、意愿与环境进行双向计算。</p></div><div className="week-count"><b>03</b><span>/ 10 个本周名额</span></div></div><div className="matches-list">{matches.map((m,i)=><article className={`match-row ${hidden.includes(i)?"is-hidden":""}`} key={m.title}><div className="score-block"><b>{m.score}</b><span>匹配度</span><i>{m.score>=95?"极高":"高匹配"}</i></div><div className="match-body"><div className="match-title"><div><h2>{m.title}</h2><p>{m.city} · {m.salary}</p></div><span className="verified">✓ {m.verified}</span></div><div className="match-reasons"><div><b>为什么匹配</b><p>{m.why}</p></div><div className="risk"><b>哪里有风险</b><p>{m.risk}</p></div><div><b>见面应验证</b><p>直属上级的期望、前 90 天成功标准、薪资口径与真实工作负荷。</p></div></div><div className="match-actions"><button className={liked.includes(i)?"liked":""} disabled={hidden.includes(i)} onClick={()=>{setLiked(x=>x.includes(i)?x.filter(n=>n!==i):[...x,i]);flash(liked.includes(i)?"已取消兴趣":"已向对方发出匿名意向")}}>{liked.includes(i)?"已发出意向 ✓":"想了解"}</button><button className={hidden.includes(i)?"hidden-btn":""} onClick={()=>{setHidden(x=>x.includes(i)?x:[...x,i]);flash("已隐藏该职位")}}>{hidden.includes(i)?"已隐藏该职位 ✓":"不合适"}</button></div></div></article>)}</div></div>}

      {view==="messages"&&<div className="page messages-page"><div className="page-heading"><div><span className="overline">ANONYMOUS CONNECTIONS</span><h1>匿名沟通</h1><p>双方全匿名，第一版仅显示“邮箱已验证”，任职、学历、HC 与业绩均不做平台认证。</p></div></div><div className="messenger"><aside><button className="chat-person active"><span>T</span><div><b>匿名候选人 T-8821</b><p>刚刚：我想了解实际工作负荷…</p></div><i>2</i></button><button className="chat-person"><span>R</span><div><b>匿名岗位 R-1904</b><p>昨天：可以先聊一下你的期望</p></div></button></aside><section className="chat-panel"><header><div><b>匿名候选人 T-8821</b><span>94 分匹配 · 邮箱已验证</span></div><i className="anonymous-badge">不解锁真实身份</i></header><div className="privacy-banner">◈ 邮箱、微信和真实姓名不会对匹配对象展示。</div><div className="conversation"><div className="bubble them"><span>T</span><p>你好，AI 提醒我这个岗位的管理风格可能偏强。想了解一下，所谓“强”是要求细致，还是会频繁改变方向？</p></div><div className="bubble me"><p>更接近决策快、对结果要求高。方向不会频繁变，但遇到客户问题时需要很快响应。</p></div><div className="bubble them"><span>T</span><p>了解，这点我可以接受。你能说一下前三个月最重要的交付吗？</p></div></div><form className="chat-compose" onSubmit={e=>{e.preventDefault();flash("演示消息已发送")}}><input placeholder="在不暴露身份的前提下回复…"/><button>发送</button></form></section></div></div>}

      {view==="trust"&&<div className="page trust-page"><div className="page-heading"><div><span className="overline">TRUST PASSPORT</span><h1>信誉记录</h1><p>第一版只验证邮箱归属，其他岗位与简历信息都是本人自述。</p></div><div className="trust-score"><b>100</b><span>陪审资格已开启</span></div></div><div className="trust-layout"><section className="passport"><header><div className="avatar">R</div><div><h2>匿名用户 2716</h2><p>邮箱已验证 · 加入 38 天</p></div><span className="level">邮箱验证</span></header>{[["邮箱归属","verified","邮箱验证码已通过"],["任职与学历","self","平台暂不认证"],["项目成果","self","平台暂不认证"],["专业能力","self","平台暂不认证"],["内推与 HC 权限","self","平台暂不认证"],["社区履约记录","record","12 次沟通·0 次有效投诉"]].map(x=><div className="passport-row" key={x[0]}><div><b>{x[0]}</b><small>{x[2]}</small></div><span className={x[1]}>{x[1]==="verified"?"已验证":x[1]==="record"?"平台记录":"本人自述"}</span></div>)}</section><aside className="reputation"><h3>信誉奖惩规则</h3><p>初始 80 分，最高 100 分。只有 100 分用户才会被随机抽中陪审；封号申诉恢复后，责任陪审者的准确率会重新计算。</p><div className="rep-item"><span>+3</span><div><b>有效履约</b><small>匹配后诚信沟通并完成双向评价</small></div></div><div className="rep-item negative"><span>-20</span><div><b>证实虚假岗位或简历</b><small>修改时间线、伪造任职、学历或项目成果</small></div></div><div className="rep-item negative"><span>-100</span><div><b>索要费用或欺诈</b><small>永久封号；关联邮箱和设备禁止重新注册</small></div></div><div className="rep-item negative"><span>-10</span><div><b>恶意举报或陪审</b><small>申诉复核确认多次恶意行为时逐次扣减</small></div></div><button onClick={()=>flash("所有扣分都有证据记录并允许申诉")}>查看完整信誉规则</button></aside></div></div>}

      {view==="jury"&&<div className="page jury-page"><div className="page-heading"><div><span className="overline">COMMUNITY JURY</span><h1>公民陪审</h1><p>案件只会随机发给当时信誉度正好为 100 分的陪审员；拉黑票超过 50% 时系统立即封号。</p></div><div className="jury-duty"><b>你的信誉：100 · 已获得陪审资格</b><span>案件由系统随机发放，不能主动挑选</span></div></div><div className="jury-layout"><aside>{juryCases.map((c,i)=><button className={selectedCase===i?"active":""} onClick={()=>{setSelectedCase(i);setVoted(null)}} key={c.id}><span>{c.id}</span><b>{c.type}</b><small>系统随机发放·{c.votes} 票</small></button>)}</aside><section className="case-file"><header><div><span>匿名案件 {juryCases[selectedCase].id}</span><h2>{juryCases[selectedCase].type}</h2></div><i>50%+ 自动封号</i></header><div className="case-warning">评估算法会在申诉结果、事后证据和陪审一致性之间计算准确率与公正度；正式算法上线前，排行榜数据仅为演示。</div><div className="vote-meter"><div><b>当前拉黑票 46%</b><span>距离自动封号还差 5%</span></div><i><b/></i></div><h3>争议摘要</h3><p>{juryCases[selectedCase].summary}</p><h3>脱敏证据</h3><div className="evidence"><span>▣</span><div><b>{juryCases[selectedCase].evidence}</b><small>证据已脱敏·陪审者自行判断</small></div><button>查看</button></div><h3>你的投票</h3><div className="verdicts"><button className={voted==="black"?"selected danger":""} onClick={()=>setVoted("black")}><b>拉黑账号</b><span>这一票可能触发系统立即封号</span></button><button className={voted==="keep"?"selected":""} onClick={()=>setVoted("keep")}><b>不应拉黑</b><span>证据不足或行为未达到封号程度</span></button></div><button className="submit-verdict" disabled={!voted} onClick={()=>flash(voted==="black"?"投票后拉黑票已过半，系统自动封号":"匿名陪审票已提交")}>提交匿名投票</button><p className="appeal-note">封号后可在 7 天内申诉。如果信誉分降低到 100 以下，将立即失去陪审资格。</p></section></div><section className="jury-board"><header><div><span className="overline">TOP 10 JURORS</span><h2>100 分陪审员榜</h2></div><p>公正度是算法综合申诉翻案率、少数意见质量、投票时长异常与群体偏差得出的演示指标。</p></header><div className="leader-head"><span># / 陪审员</span><span>审核量</span><span>准确率</span><span>公正度</span></div>{[["01","J-1008","328","97.8%","优秀"],["02","J-0421","301","97.1%","优秀"],["03","J-2716","286","96.8%","优秀"],["04","J-1190","265","96.2%","稳定"],["05","J-0837","251","95.9%","稳定"],["06","J-3302","244","95.4%","稳定"],["07","J-0158","229","94.9%","稳定"],["08","J-4420","218","94.5%","稳定"],["09","J-3071","205","94.1%","观察"],["10","J-2246","197","93.8%","观察"]].map(r=><div className="leader-row" key={r[1]}><span><b>{r[0]}</b> {r[1]}</span><span>{r[2]}</span><span>{r[3]}</span><span><i>{r[4]}</i></span></div>)}</section></div>}

      {view==="admin"&&<div className="page admin-page"><div className="page-heading"><div><span className="overline">APPEAL & JURY QUALITY</span><h1>申诉与陪审质量</h1><p>首次处置完全由陪审票决定；人工只复核被封账号的申诉，并调查是否存在多次恶意投票。</p></div><button className="export-btn" onClick={()=>flash("已生成脱敏陪审质量报告")}>导出陪审报告</button></div><div className="admin-stats">{[["8","待处理申诉"],["3","疑似恶意陪审者"],["12","今日过半自动封号"],["4.1%","封号申诉率"]].map(x=><div key={x[1]}><b>{x[0]}</b><span>{x[1]}</span></div>)}</div><section className="risk-table"><header><h2>申诉复核队列</h2><div><button className="active">全部</button><button>虚假广告</button><button>涉嫌骗钱</button><button>简历造假</button></div></header><div className="table-head"><span>匿名账号 / 申诉</span><span>原封号原因</span><span>陪审结果</span><span>状态</span><span>操作</span></div>{[["R-88102 · 已提交申诉","索要内推费","57% 拉黑票","待申诉复核"],["T-09211 · 已提交申诉","任职时间矛盾","64% 拉黑票","调查陪审者"],["R-12094 · 申诉已完成","批量重复岗位","52% 拉黑票","维持封号"]].map((x,i)=><div className="table-row" key={x[0]}><span><b>{x[0]}</b><small>仅邮箱已验证</small></span><span>{x[1]}</span><span>{x[2]}</span><span><i className={i===0?"pending":i===1?"danger":"limited"}>{x[3]}</i></span><span className="row-actions"><button onClick={()=>flash(i===1?"已对涉嫌多次恶意投票者扣减信誉分":"申诉复核结果已记录")}>{i===1?"扣陪审信誉":"处理申诉"}</button></span></div>)}</section></div>}
    </section>

    {profileOpen&&<div className="drawer-backdrop" onClick={()=>setProfileOpen(false)}><section className="profile-drawer" onClick={e=>e.stopPropagation()}><header><div><span className="overline">PRIVATE PROFILE · 1 / 1</span><h2>{mode==="role"?"修改待接棒岗位":"修改找工作画像"}</h2><p>{mode==="role"?"每个账号只有一条待接棒岗位，保存后会更新原记录。":"每个账号只有一条求职画像，保存后会更新原记录。"}</p></div><button onClick={()=>setProfileOpen(false)}>×</button></header><div className="contact-lock"><div><b>已验证登录邮箱</b><span>只用于登录和账号通知，不对匹配对象展示</span></div><div className="contact-grid one"><label>邮箱<input type="email" value={email||"demo@relay.cn"} readOnly/></label></div></div><div className="field-grid">{fields.map(f=><label key={f.key}><span>{f.label}{f.required&&<i>必填</i>}</span><textarea rows={3} placeholder={f.hint} value={values[`${mode}-${f.key}`]||""} onChange={e=>setValues(v=>({...v,[`${mode}-${f.key}`]:e.target.value}))}/></label>)}</div><footer><div><b>{completion}%</b><span>画像完整度</span></div><button className="outline" onClick={()=>{setProfileOpen(false);setRawOpen(true)}}>AI 帮我补齐</button><button className="solid" onClick={()=>{setSaved(true);setProfileOpen(false);flash(mode==="role"?"接棒信息已更新，仍占用唯一名额":"求职信息已更新，仍占用唯一名额")}}>{saved?"保存修改":"确认并匿名入池"}</button></footer></section></div>}

    {rawOpen&&<div className="modal-backdrop" onClick={()=>setRawOpen(false)}><section className="raw-modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setRawOpen(false)}>×</button><span className="overline">AI STRUCTURED READING</span><h2>随便说，我来整理。</h2><p>可以直接粘贴一段话、旧简历或岗位介绍。AI 会将内容分类到完整画像，不确定的部分会留空让你确认。</p><textarea autoFocus rows={12} value={raw} onChange={e=>setRaw(e.target.value)} placeholder={mode==="role"?"例：我在上海一家 80 人的 SaaS 公司做客户成功…":"例：我做了 5 年广告策划，擅长理解客户和整理复杂信息…"}/><div className="parse-note"><span>✦</span><p>演示版会根据标点将内容拆入对应字段；正式版将使用真实语义 AI 解析。</p></div><button className="solid full" disabled={!raw.trim()} onClick={parseText}>AI 分类整理 <span>→</span></button></section></div>}
    {toast&&<div className="toast">{toast}</div>}
  </main>;
}
