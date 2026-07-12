"use client";

import { FormEvent, useMemo, useState } from "react";

type Mode = "role" | "talent";
type View = "home" | "matches" | "messages" | "trust" | "jury" | "admin";
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
  { score:96, title:"企业服务产品经理", city:"上海·混合", salary:"32–40K", verified:"企业已确认 HC", why:"你的 B 端产品经验、复杂需求拆解和跨部门推进能力完全命中。", risk:"团队处在调整期，直属上级决策快；需确认你对不确定性的接受度。" },
  { score:93, title:"增长策略负责人", city:"杭州", salary:"35–45K", verified:"发布者任职已验证", why:"你过去的用户增长成果与该业务当前阶段高度一致。", risk:"每季度约有 20% 出差，且岗位不带团队。" },
  { score:91, title:"商业化策略专家", city:"北京·可远程", salary:"30–38K", verified:"内推资格已验证", why:"你在广告策略与产品协作上的复合经验很稀缺。", risk:"组织职级可能与你当前头衔不完全对齐。" },
];

const juryCases = [
  { id:"J-2041", type:"虚假岗位", summary:"发布者要求候选人先支付“内推保证金” 800 元。", evidence:"3 份对话截图·企业否认 HC", votes:"126 / 150" },
  { id:"J-2038", type:"疑似简历造假", summary:"候选人声称独立负责项目，但作品与时间线存在明显矛盾。", evidence:"2 份材料·当事人已回应", votes:"88 / 150" },
];

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [phone, setPhone] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [view, setView] = useState<View>("home");
  const [mode, setMode] = useState<Mode>("role");
  const [profileOpen, setProfileOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [values, setValues] = useState<Record<string,string>>({});
  const [saved, setSaved] = useState(false);
  const [liked, setLiked] = useState<number[]>([]);
  const [selectedCase, setSelectedCase] = useState(0);
  const [voted, setVoted] = useState<"black"|"keep"|null>(null);
  const [toast, setToast] = useState("");
  const fields = mode === "role" ? roleFields : talentFields;
  const completion = useMemo(() => Math.round(fields.filter(f => values[`${mode}-${f.key}`]?.trim()).length / fields.length * 100), [fields, mode, values]);

  function login(e:FormEvent){ e.preventDefault(); if(!codeSent){setCodeSent(true);setToast("演示验证码：246810");return} setLoggedIn(true);setToast("已进入安全演示账户"); }
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
    <section className="login-copy"><span className="overline">PRIVATE TALENT NETWORK</span><h1>不用浏览。<br/><em>只见真正适合的人。</em></h1><p>你的岗位和简历都不会公开。AI 每周从私密池中筛选 10 个机会，只在匹配超过 90 分时为双方建立连接。</p><div className="login-proof"><span>身份分层验证</span><span>双向匿名沟通</span><span>社区陪审治理</span></div></section>
    <section className="login-box"><span className="step-tag">安全入口</span><h2>手机号登录</h2><p>一个手机号对应一份信任护照。联系方式只在双方同意后解锁。</p><form onSubmit={login}><label>手机号</label><div className="phone-input"><span>+86</span><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="138 0000 0000" required/></div>{codeSent&&<><label>验证码</label><input className="code-input" placeholder="输入 246810" required/></>}<button>{codeSent?"验证并进入":"获取验证码"}<span>→</span></button></form><small>当前为产品演示，不会发送真实短信。</small></section>
    {toast&&<div className="toast">{toast}</div>}
  </main>;

  return <main className="app-shell">
    <aside className="sidebar">
      <button className="side-brand" onClick={()=>nav("home")}><span className="brand-mark">R</span><b>Relay <i>接棒</i></b></button>
      <nav>
        <button className={view==="home"?"active":""} onClick={()=>nav("home")}><span>◈</span>首页</button>
        <button className={view==="matches"?"active":""} onClick={()=>nav("matches")}><span>✦</span>本周匹配<em>10</em></button>
        <button className={view==="messages"?"active":""} onClick={()=>nav("messages")}><span>○</span>匿名沟通<em>2</em></button>
        <button className={view==="trust"?"active":""} onClick={()=>nav("trust")}><span>✓</span>信任护照</button>
        <button className={view==="jury"?"active":""} onClick={()=>nav("jury")}><span>⚖</span>公民陪审</button>
      </nav>
      <div className="side-bottom"><button className={view==="admin"?"active":""} onClick={()=>nav("admin")}><span>⚙</span>管理员控制台</button><div className="user-chip"><span>任</span><div><b>Relay 用户 2716</b><small>信誉分 92 · 已实名</small></div></div></div>
    </aside>
    <div className="mobile-nav"><button onClick={()=>nav("home")}>首页</button><button onClick={()=>nav("matches")}>匹配</button><button onClick={()=>nav("messages")}>沟通</button><button onClick={()=>nav("jury")}>陪审</button></div>
    <section className="workspace">
      <header className="topbar"><div><span className="secure-dot"/>匿名模式已开启</div><div><button onClick={()=>flash("本周新增 3 个高匹配机会")}>○ 通知</button><button className="score-pill" onClick={()=>nav("trust")}>信誉 92</button></div></header>

      {view==="home"&&<div className="page home-page">
        <section className="welcome"><div><span className="overline">GOOD EVENING · RELAY 2716</span><h1>你的下一棒，<br/><em>正在私密池中寻找你。</em></h1><p>完善真实画像，会让 AI 更准确地判断“为什么合适”。</p></div><div className="cycle"><span>下次周筛选</span><b>03<small>天</small> 14<small>时</small></b><p>每周最多 10 条·仅展示 90+ 匹配</p></div></section>
        <section className="action-grid"><article className="primary-action"><span className="card-index">01 / PROFILE</span><h2>告诉 AI，你现在需要什么？</h2><div className="role-toggle"><button className={mode==="role"?"active":""} onClick={()=>setMode("role")}>找一位接棒人</button><button className={mode==="talent"?"active":""} onClick={()=>setMode("talent")}>找一个新机会</button></div><p>{mode==="role"?"岗位不会公开。AI 会将真实工作、文化、薪酬、风险和交接方式整理成私密岗位画像。":"简历不会出现姓名和联系方式。AI 会识别你的能力、意愿、底线和可迁移方向。"}</p><div className="completion"><span><b>{completion}%</b> 画像完整度</span><i><b style={{width:`${completion}%`}}/></i></div><div className="action-buttons"><button className="solid" onClick={()=>setProfileOpen(true)}>完整填写 <span>→</span></button><button className="outline" onClick={()=>setRawOpen(true)}>粘贴一段话，AI 帮我拆解</button></div></article>
        <article className="weekly-card"><span className="card-index">02 / WEEKLY MATCH</span><div className="ring"><b>3</b><small>/ 10</small></div><h3>本周有 3 个高匹配机会</h3><p>最高匹配 96 分。在下周一前选择“想了解”，才会向对方发出匿名连接。</p><button onClick={()=>nav("matches")}>查看本周筛选 <span>→</span></button></article></section>
        <section className="principles"><div><span>90+</span><p>只有超过 90 分才建立连接</p></div><div><span>10</span><p>每周最多十个，不制造无限滑动</p></div><div><span>∞</span><p>姓名和联系方式始终由你授权</p></div><div><span>⚖</span><p>虚假、骗钱和恶意行为由社区陪审</p></div></section>
      </div>}

      {view==="matches"&&<div className="page"><div className="page-heading"><div><span className="overline">WEEK 28 · PRIVATE SELECTION</span><h1>本周精选</h1><p>AI 已对岗位真实性、硬条件、能力、意愿与环境进行双向计算。</p></div><div className="week-count"><b>03</b><span>/ 10 个本周名额</span></div></div><div className="matches-list">{matches.map((m,i)=><article className="match-row" key={m.title}><div className="score-block"><b>{m.score}</b><span>匹配度</span><i>{m.score>=95?"极高":"高匹配"}</i></div><div className="match-body"><div className="match-title"><div><h2>{m.title}</h2><p>{m.city} · {m.salary}</p></div><span className="verified">✓ {m.verified}</span></div><div className="match-reasons"><div><b>为什么匹配</b><p>{m.why}</p></div><div className="risk"><b>哪里有风险</b><p>{m.risk}</p></div><div><b>见面应验证</b><p>直属上级的期望、前 90 天成功标准、薪资口径与真实工作负荷。</p></div></div><div className="match-actions"><button className={liked.includes(i)?"liked":""} onClick={()=>{setLiked(x=>x.includes(i)?x.filter(n=>n!==i):[...x,i]);flash(liked.includes(i)?"已取消兴趣":"已向对方发出匿名意向")}}>{liked.includes(i)?"已发出意向 ✓":"想了解"}</button><button onClick={()=>flash("已隐藏，该机会不会再出现")}>不合适</button></div></div></article>)}</div></div>}

      {view==="messages"&&<div className="page messages-page"><div className="page-heading"><div><span className="overline">ANONYMOUS CONNECTIONS</span><h1>匿名沟通</h1><p>初始只显示脱敏简历与验证状态，联系方式需要双方同意。</p></div></div><div className="messenger"><aside><button className="chat-person active"><span>T</span><div><b>匿名候选人 T-8821</b><p>刚刚：我想了解实际工作负荷…</p></div><i>2</i></button><button className="chat-person"><span>R</span><div><b>匿名岗位 R-1904</b><p>昨天：可以先聊一下你的期望</p></div></button></aside><section className="chat-panel"><header><div><b>匿名候选人 T-8821</b><span>94 分匹配 · 身份已验证</span></div><button onClick={()=>flash("已发出联系方式解锁申请")}>申请双向解锁</button></header><div className="privacy-banner">◈ 平台会隐藏手机、微信、邮箱和真实姓名，直到双方授权。</div><div className="conversation"><div className="bubble them"><span>T</span><p>你好，AI 提醒我这个岗位的管理风格可能偏强。想了解一下，所谓“强”是要求细致，还是会频繁改变方向？</p></div><div className="bubble me"><p>更接近决策快、对结果要求高。方向不会频繁变，但遇到客户问题时需要很快响应。</p></div><div className="bubble them"><span>T</span><p>了解，这点我可以接受。你能说一下前三个月最重要的交付吗？</p></div></div><form className="chat-compose" onSubmit={e=>{e.preventDefault();flash("演示消息已发送")}}><input placeholder="在不暴露身份的前提下回复…"/><button>发送</button></form></section></div></div>}

      {view==="trust"&&<div className="page trust-page"><div className="page-heading"><div><span className="overline">TRUST PASSPORT</span><h1>信任护照</h1><p>不是一个笼统的“已认证”，而是每一条说法的证据来源。</p></div><div className="trust-score"><b>92</b><span>良好信誉</span></div></div><div className="trust-layout"><section className="passport"><header><div className="avatar">R</div><div><h2>匿名用户 2716</h2><p>手机已验证 · 加入 38 天</p></div><span className="level">LEVEL 3</span></header>{[["真人与实名","verified","平台已验证"],["近两段任职","verified","材料已核验"],["项目成果","partial","1 项已验证·2 项自述"],["专业能力","self","待能力测试"],["内推与 HC 权限","verified","企业邮箱已验证"],["履约记录","verified","12 次沟通·0 次爽约"]].map(x=><div className="passport-row" key={x[0]}><div><b>{x[0]}</b><small>{x[2]}</small></div><span className={x[1]}>{x[1]==="verified"?"已验证":x[1]==="partial"?"部分验证":"本人自述"}</span></div>)}</section><aside className="reputation"><h3>声誉如何影响匹配</h3><p>高质量沟通、真实资料和匹配后的双向好评会提高你在候选池中的权重。</p><div className="rep-item"><span>+8</span><div><b>资料真实度</b><small>关键任职已核验</small></div></div><div className="rep-item"><span>+5</span><div><b>同行好评</b><small>4 位匹配对象评价“信息准确”</small></div></div><div className="rep-item negative"><span>-1</span><div><b>回复速度</b><small>最近平均 31 小时</small></div></div><button onClick={()=>flash("能力验证将在下一版开放")}>继续提升信任度</button></aside></div></div>}

      {view==="jury"&&<div className="page jury-page"><div className="page-heading"><div><span className="overline">COMMUNITY JURY</span><h1>公民陪审</h1><p>在不泄露个人信息的前提下，由随机高信誉用户审理争议。</p></div><div className="jury-duty"><b>你本周可审 2 案</b><span>每案 +2 公民声誉</span></div></div><div className="jury-layout"><aside>{juryCases.map((c,i)=><button className={selectedCase===i?"active":""} onClick={()=>{setSelectedCase(i);setVoted(null)}} key={c.id}><span>{c.id}</span><b>{c.type}</b><small>{c.votes} 票已提交</small></button>)}</aside><section className="case-file"><header><div><span>匿名案件 {juryCases[selectedCase].id}</span><h2>{juryCases[selectedCase].type}</h2></div><i>等待陪审</i></header><div className="case-warning">你看不到任何姓名、公司全称或联系方式。请只根据可验证行为投票。</div><h3>争议摘要</h3><p>{juryCases[selectedCase].summary}</p><h3>已核验证据</h3><div className="evidence"><span>▣</span><div><b>{juryCases[selectedCase].evidence}</b><small>证据已脱敏·平台事实核查完成</small></div><button>查看</button></div><h3>建议处置</h3><div className="verdicts"><button className={voted==="black"?"selected danger":""} onClick={()=>setVoted("black")}><b>拉黑账号</b><span>证据充分，且存在明显欺诈意图</span></button><button className={voted==="keep"?"selected":""} onClick={()=>setVoted("keep")}><b>证据不足</b><span>保留账号，交由平台继续核查</span></button></div><button className="submit-verdict" disabled={!voted} onClick={()=>flash("匿名陪审票已提交，感谢你的判断")}>提交匿名判决</button></section></div></div>}

      {view==="admin"&&<div className="page admin-page"><div className="page-heading"><div><span className="overline">ADMIN CONTROL</span><h1>风险管理</h1><p>系统先限流，管理员复核，有争议的案件再进入陪审池。</p></div><button className="export-btn" onClick={()=>flash("已生成脱敏风险报告")}>导出风险报告</button></div><div className="admin-stats">{[["24","待复核举报"],["7","高风险账号"],["3","今日已拉黑"],["98.6%","岗位正常率"]].map(x=><div key={x[1]}><b>{x[0]}</b><span>{x[1]}</span></div>)}</div><section className="risk-table"><header><h2>风险队列</h2><div><button className="active">全部</button><button>虚假广告</button><button>涉嫌骗钱</button><button>简历造假</button></div></header><div className="table-head"><span>账号 / 类型</span><span>风险信号</span><span>证据</span><span>状态</span><span>操作</span></div>{[["R-88102 · 岗位发布者","索要内推费","对话截图·3","高风险"],["T-09211 · 候选人","任职时间矛盾","材料·2","待复核"],["R-12094 · 岗位发布者","批量重复岗位","行为记录·16","已限流"]].map((x,i)=><div className="table-row" key={x[0]}><span><b>{x[0]}</b><small>手机已实名</small></span><span>{x[1]}</span><span>{x[2]}</span><span><i className={i===0?"danger":i===1?"pending":"limited"}>{x[3]}</i></span><span className="row-actions"><button onClick={()=>flash("账号已暂时冻结，等待申诉")}>{i===0?"冻结":"复核"}</button><button onClick={()=>{nav("jury");flash("案件已转入陪审池")}}>转陪审</button></span></div>)}</section></div>}
    </section>

    {profileOpen&&<div className="drawer-backdrop" onClick={()=>setProfileOpen(false)}><section className="profile-drawer" onClick={e=>e.stopPropagation()}><header><div><span className="overline">PRIVATE PROFILE</span><h2>{mode==="role"?"建立真实岗位画像":"建立你的能力与意愿画像"}</h2><p>{mode==="role"?"信息不会被浏览，只会用于 AI 双向匹配。":"初始简历不显示姓名、电话、微信或邮箱。"}</p></div><button onClick={()=>setProfileOpen(false)}>×</button></header><div className="contact-lock"><div><b>联系方式保险箱</b><span>只在双方同意后解锁</span></div><div className="contact-grid"><label>手机<input placeholder="138 **** 2716"/></label><label>微信<input placeholder="输入微信号"/></label><label>邮箱<input type="email" placeholder="name@example.com"/></label></div></div><div className="field-grid">{fields.map(f=><label key={f.key}><span>{f.label}{f.required&&<i>必填</i>}</span><textarea rows={3} placeholder={f.hint} value={values[`${mode}-${f.key}`]||""} onChange={e=>setValues(v=>({...v,[`${mode}-${f.key}`]:e.target.value}))}/></label>)}</div><footer><div><b>{completion}%</b><span>画像完整度</span></div><button className="outline" onClick={()=>{setProfileOpen(false);setRawOpen(true)}}>AI 帮我补齐</button><button className="solid" onClick={()=>{setSaved(true);setProfileOpen(false);flash("画像已加密入池，下周一进行筛选")}}>{saved?"更新私密画像":"确认并匿名入池"}</button></footer></section></div>}

    {rawOpen&&<div className="modal-backdrop" onClick={()=>setRawOpen(false)}><section className="raw-modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setRawOpen(false)}>×</button><span className="overline">AI STRUCTURED READING</span><h2>随便说，我来整理。</h2><p>可以直接粘贴一段话、旧简历或岗位介绍。AI 会将内容分类到完整画像，不确定的部分会留空让你确认。</p><textarea autoFocus rows={12} value={raw} onChange={e=>setRaw(e.target.value)} placeholder={mode==="role"?"例：我在上海一家 80 人的 SaaS 公司做客户成功…":"例：我做了 5 年广告策划，擅长理解客户和整理复杂信息…"}/><div className="parse-note"><span>✦</span><p>演示版会根据标点将内容拆入对应字段；正式版将使用真实语义 AI 解析。</p></div><button className="solid full" disabled={!raw.trim()} onClick={parseText}>AI 分类整理 <span>→</span></button></section></div>}
    {toast&&<div className="toast">{toast}</div>}
  </main>;
}
