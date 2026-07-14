"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Mode = "role" | "talent";
type View = "home" | "posts" | "matches" | "messages" | "notifications" | "trust" | "jury" | "admin";
type Field = { key: string; label: string; hint: string; required?: boolean };
type ProfileMeta = { anonymousCode:string; status:string; completion:number; payload:Record<string,string> };
type PublicationLimit = { canDelete:boolean; canRecreate:boolean };
type MatchItem = { id:string; score:number; perspective:Mode; ownDecision:"pending"|"interested"|"hidden"; otherDecision:"pending"|"interested"|"hidden"; anonymousCode:string; payload:Record<string,string>; reasons:string[]; risks:string[]; verifyOnMeeting:string[]; conversationId?:string|null };
type NotificationItem = { id:string; matchId:string; type:"mutual_match"; anonymousCode:string; score:number };
type ConversationItem = { id:string; matchId:string; anonymousCode:string; score:number; lastMessage?:string|null; messageCount:number };

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

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<View>("home");
  const [mode, setMode] = useState<Mode>("role");
  const [profileOpen, setProfileOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [values, setValues] = useState<Record<string,string>>({});
  const [profileMeta, setProfileMeta] = useState<Record<Mode,ProfileMeta|undefined>>({ role:undefined, talent:undefined });
  const [publicationLimits, setPublicationLimits] = useState<Record<Mode,PublicationLimit>>({role:{canDelete:true,canRecreate:true},talent:{canDelete:true,canRecreate:true}});
  const [isAdmin, setIsAdmin] = useState(false);
  const [readyForMatching, setReadyForMatching] = useState(false);
  const [matchItems, setMatchItems] = useState<MatchItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [adminSummary, setAdminSummary] = useState<{users:number;activeReports:number;pendingAppeals:number}|null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [toast, setToast] = useState("");
  const fields = mode === "role" ? roleFields : talentFields;
  const completion = useMemo(() => Math.round(fields.filter(f => values[`${mode}-${f.key}`]?.trim()).length / fields.length * 100), [fields, mode, values]);

  useEffect(()=>{
    fetch("/api/auth/me").then(async response=>{
      if(!response.ok) return;
      const data = await response.json() as {user?:{email:string;isAdmin?:boolean}};
      if(data.user){setEmail(data.user.email);setIsAdmin(Boolean(data.user.isAdmin));setLoggedIn(true)}
    }).finally(()=>setAuthChecking(false));
  },[]);

  const refreshDashboard=useCallback(async()=>{
    setDataLoading(true);
    try{
      const response=await fetch("/api/dashboard");
      if(!response.ok) throw new Error("资料读取失败");
      const data = await response.json() as {user:{email:string;isAdmin:boolean};profiles:Array<{type:Mode;anonymousCode:string;status:string;completion:number;payload:Record<string,string>}>;publicationLimits:Record<Mode,PublicationLimit>;readyForMatching:boolean;matches:MatchItem[];notifications:NotificationItem[];conversations:ConversationItem[]};
      const nextValues:Record<string,string> = {};
      const nextMeta:Record<Mode,ProfileMeta|undefined> = {role:undefined,talent:undefined};
      data.profiles.forEach(profile=>{
        nextMeta[profile.type]={anonymousCode:profile.anonymousCode,status:profile.status,completion:profile.completion,payload:profile.payload};
        Object.entries(profile.payload).forEach(([key,value])=>nextValues[`${profile.type}-${key}`]=String(value??""));
      });
      setEmail(data.user.email);setIsAdmin(data.user.isAdmin);setValues(nextValues);setProfileMeta(nextMeta);
      setPublicationLimits(data.publicationLimits);
      setReadyForMatching(data.readyForMatching);setMatchItems(data.matches);setNotifications(data.notifications);setConversations(data.conversations);
    }catch{setToast("资料读取失败，请刷新后重试");setTimeout(()=>setToast(""),2600)}finally{setDataLoading(false)}
  },[]);

  useEffect(()=>{
    if(!loggedIn) return;
    const timer=window.setTimeout(()=>void refreshDashboard(),0);
    return()=>window.clearTimeout(timer);
  },[loggedIn,refreshDashboard]);

  useEffect(()=>{
    if(view!=="admin"||!isAdmin) return;
    fetch("/api/admin/summary").then(async response=>{
      if(!response.ok) throw new Error();
      setAdminSummary(await response.json());
    }).catch(()=>flash("管理数据读取失败"));
  },[view,isAdmin]);

  async function login(e:FormEvent){
    e.preventDefault();setBusy(true);
    try{
      const response=await fetch(codeSent?"/api/auth/verify-code":"/api/auth/request-code",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(codeSent?{email,code}:{email})});
      const data=await response.json() as {error?:string;message?:string};
      if(!response.ok) throw new Error(data.error||"请求失败，请稍后再试");
      if(!codeSent){setCodeSent(true);flash(data.message||"验证码已发送，请检查邮箱");return}
      setLoggedIn(true);flash("邮箱已验证，已进入安全账户");
    }catch(error){flash(error instanceof Error?error.message:"请求失败，请稍后再试")}finally{setBusy(false)}
  }

  async function saveProfile(){
    const requiredMissing=fields.some(field=>field.required&&!values[`${mode}-${field.key}`]?.trim());
    if(requiredMissing){flash("请先填写所有必填项");return}
    setBusy(true);
    try{
      const payload=Object.fromEntries(fields.map(field=>[field.key,values[`${mode}-${field.key}`]||""]));
      const response=await fetch("/api/profiles",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({type:mode,payload,completion})});
      const data=await response.json() as {error?:string;profile?:{anonymousCode:string;status:string}};
      if(!response.ok||!data.profile) throw new Error(data.error||"保存失败");
      setProfileOpen(false);await refreshDashboard();flash(mode==="role"?"接棒信息已真实保存并进入匹配池":"求职信息已真实保存并进入匹配池");
    }catch(error){flash(error instanceof Error?error.message:"保存失败，请稍后再试")}finally{setBusy(false)}
  }

  async function logout(){await fetch("/api/auth/logout",{method:"POST"});setLoggedIn(false);setIsAdmin(false);setCodeSent(false);setCode("");setValues({});setProfileMeta({role:undefined,talent:undefined});setMatchItems([]);setNotifications([]);setConversations([]);flash("已安全退出")}
  async function changeProfileStatus(type:Mode,status:"paused"|"pooled"){
    const response=await fetch(`/api/profiles/${type}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({status})});
    const data=await response.json() as {error?:string};
    if(!response.ok){flash(data.error||"状态修改失败");return}
    await refreshDashboard();flash(status==="paused"?"已暂停入池，可随时恢复":"已恢复入池，将在下周一重新匹配");
  }
  async function deleteProfile(type:Mode){
    if(!window.confirm(`确定删除这条${type==="role"?"接棒":"求职"}发布吗？该方向每月只能删除一次。`)) return;
    const response=await fetch(`/api/profiles/${type}`,{method:"DELETE"});
    const data=await response.json() as {error?:string};
    if(!response.ok){flash(data.error||"删除失败");return}
    await refreshDashboard();flash("发布已删除；该方向本月还可新建一次");
  }
  async function decideMatch(matchId:string,decision:"pending"|"interested"|"hidden"){
    const response=await fetch(`/api/matches/${matchId}/decision`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({decision})});
    const data=await response.json() as {error?:string};
    if(!response.ok){flash(data.error||"操作失败");return}
    await refreshDashboard();
    flash(decision==="interested"?"已发出匿名意向":decision==="hidden"?"已隐藏该匹配":"已恢复该匹配");
  }
  async function startConversation(matchId:string){
    const response=await fetch("/api/conversations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({matchId})});
    const data=await response.json() as {error?:string};
    if(!response.ok){flash(data.error||"无法开始沟通");return}
    await refreshDashboard();setView("messages");flash("匿名沟通已开启");
  }
  function flash(text:string){setToast(text);setTimeout(()=>setToast(""),2600)}
  function parseText(){
    const chunks = raw.split(/[\n，。；;]+/).filter(Boolean);
    const next = {...values};
    fields.forEach((f,i)=>{ if(chunks[i]) next[`${mode}-${f.key}`]=chunks[i].trim(); });
    setValues(next);setRawOpen(false);setProfileOpen(true);flash(`AI 已识别 ${Math.min(chunks.length,fields.length)} 项信息，请确认`);
  }
  function nav(next:View){setView(next);window.scrollTo({top:0,behavior:"smooth"})}

  if(authChecking) return <main className="login-page"><div className="login-brand"><span className="brand-mark">R</span><b>Relay 接棒</b></div><section className="login-copy"><h1>正在确认<br/><em>安全登录状态…</em></h1></section></main>;

  if(!loggedIn) return <main className="login-page">
    <div className="login-brand"><span className="brand-mark">R</span><b>Relay 接棒</b></div>
    <section className="login-copy"><span className="overline">PRIVATE TALENT NETWORK</span><h1>不用浏览。<br/><em>只见真正适合的人。</em></h1><p>你的岗位和简历都不会公开。AI 每周从私密池中筛选 10 个机会，只在匹配超过 90 分时为双方建立连接。</p><div className="login-proof"><span>仅邮箱验证</span><span>全程匿名沟通</span><span>社区过半自动处置</span></div></section>
    <section className="login-box"><span className="step-tag">安全入口</span><h2>邮箱登录</h2><p>一个邮箱对应一个匿名账号。第一版不收集、不认证手机号。</p><form onSubmit={login}><label>邮箱地址</label><div className="phone-input"><span>@</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" required disabled={codeSent||busy}/></div>{codeSent&&<><label>邮箱验证码</label><input className="code-input" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" autoComplete="one-time-code" placeholder="输入邮件中的 6 位验证码" required/></>}<button disabled={busy}>{busy?"正在处理…":codeSent?"验证邮箱并进入":"发送邮箱验证码"}<span>→</span></button></form>{codeSent&&<button className="text-button" onClick={()=>{setCodeSent(false);setCode("")}}>更换邮箱或重新发送</button>}<small>验证码会真实发送到你的邮箱，10 分钟内有效。</small></section>
    {toast&&<div className="toast">{toast}</div>}
  </main>;

  return <main className="app-shell">
    <aside className="sidebar">
      <button className="side-brand" onClick={()=>nav("home")}><span className="brand-mark">R</span><b>Relay <i>接棒</i></b></button>
      <nav>
        <button className={view==="home"?"active":""} onClick={()=>nav("home")}><span>◈</span>首页</button>
        <button className={view==="posts"?"active":""} onClick={()=>nav("posts")}><span>▤</span>我的发布{Object.values(profileMeta).filter(Boolean).length>0&&<em>{Object.values(profileMeta).filter(Boolean).length}</em>}</button>
        <button className={view==="matches"?"active":""} onClick={()=>nav("matches")}><span>✦</span>本周匹配{matchItems.length>0&&<em>{matchItems.length}</em>}</button>
        <button className={view==="notifications"?"active":""} onClick={()=>nav("notifications")}><span>◇</span>通知{notifications.length>0&&<em>{notifications.length}</em>}</button>
        <button className={view==="messages"?"active":""} onClick={()=>nav("messages")}><span>○</span>匿名沟通{conversations.length>0&&<em>{conversations.length}</em>}</button>
        <button className={view==="trust"?"active":""} onClick={()=>nav("trust")}><span>✓</span>信任护照</button>
        <button className={view==="jury"?"active":""} onClick={()=>nav("jury")}><span>⚖</span>公民陪审</button>
      </nav>
      <div className="side-bottom">{isAdmin&&<button className={view==="admin"?"active":""} onClick={()=>nav("admin")}><span>⚙</span>管理员控制台</button>}<div className="user-chip"><span>R</span><div><b>{profileMeta.talent?.anonymousCode||profileMeta.role?.anonymousCode||"新匿名用户"}</b><small>{email} · 邮箱已验证</small></div><button onClick={logout} aria-label="退出登录">退出</button></div></div>
    </aside>
    <div className="mobile-nav"><button onClick={()=>nav("home")}>首页</button><button onClick={()=>nav("matches")}>匹配</button><button onClick={()=>nav("messages")}>沟通</button><button onClick={()=>nav("jury")}>陪审</button></div>
    <section className="workspace">
      <header className="topbar"><div><span className="secure-dot"/>匿名模式已开启</div><div><button className="score-pill" onClick={()=>nav("trust")}>信誉 80</button></div></header>

      {view==="home"&&<div className="page home-page">
        <section className="welcome"><div><span className="overline">GOOD EVENING · RELAY 2716</span><h1>你的下一棒，<br/><em>正在私密池中寻找你。</em></h1><p>完善真实画像，会让 AI 更准确地判断“为什么合适”。</p></div><div className="cycle"><span>下次周筛选</span><b>03<small>天</small> 14<small>时</small></b><p>每周最多 10 条·仅展示 90+ 匹配</p></div></section>
        <section className="action-grid"><article className="primary-action"><span className="card-index">01 / PROFILE</span><h2>告诉 AI，你现在需要什么？</h2><div className="role-toggle"><button className={mode==="role"?"active":""} onClick={()=>setMode("role")}>找一位接棒人</button><button className={mode==="talent"?"active":""} onClick={()=>setMode("talent")}>找一个新机会</button></div><p>{mode==="role"?"岗位不会公开。AI 会将真实工作、文化、薪酬、风险和交接方式整理成私密岗位画像。":"简历不会出现姓名和联系方式。AI 会识别你的能力、意愿、底线和可迁移方向。"}</p><div className="completion"><span><b>{completion}%</b> 画像完整度</span><i><b style={{width:`${completion}%`}}/></i></div><div className="action-buttons"><button className="solid" onClick={()=>setProfileOpen(true)}>完整填写 <span>→</span></button><button className="outline" onClick={()=>setRawOpen(true)}>粘贴一段话，AI 帮我拆解</button></div></article>
        <article className="weekly-card"><span className="card-index">02 / WEEKLY MATCH</span><div className="ring"><b>{matchItems.length}</b><small>/ 10</small></div><h3>{!readyForMatching?"发布任意一份画像后开始匹配":matchItems.length?`本周有 ${matchItems.length} 个高匹配机会`:"已入池，暂无 90+ 匹配"}</h3><p>{!readyForMatching?"发布“找工作”或“找接任者”任意一条，系统就会启动对应方向的匹配。":matchItems.length?"只展示来自其他真实用户、且达到 90 分的匿名匹配。":"你的画像已进入私密池，有合适的真实用户时会在这里出现。"}</p><button onClick={()=>nav("matches")}>查看本周筛选 <span>→</span></button></article></section>
        <section className="principles"><div><span>90+</span><p>关键词达标后再通过向量复核</p></div><div><span>1+1</span><p>每个账号最多一条接棒与一条求职信息</p></div><div><span>@</span><p>第一版仅验证邮箱，其他信息都是自述</p></div><div><span>50%</span><p>陪审成立票过半后按类型自动扣分</p></div></section>
      </div>}

      {view==="posts"&&<div className="page posts-page"><div className="page-heading"><div><span className="overline">MY PRIVATE POSTS</span><h1>我的发布</h1><p>两个方向分别管理：每月各可删除一次，删除后各可重新新建一次；暂停和恢复不限次数。</p></div><div className="post-limit"><b>{Object.values(profileMeta).filter(Boolean).length} / 2</b><span>当前有效发布</span></div></div><div className="post-cards">{(["role","talent"] as Mode[]).map(item=>{const profile=profileMeta[item];const limit=publicationLimits[item];return profile?<article key={item}><header><span>{profile.anonymousCode}</span><i>{profile.status==="paused"?"已暂停":"匹配中"}</i></header><h2>{item==="role"?"我的待接棒岗位":"我的找工作画像"}</h2><p>{item==="role"?[profile.payload.city,profile.payload.role,profile.payload.industry].filter(Boolean).join(" · "):[profile.payload.industry,profile.payload.city,profile.payload.salary].filter(Boolean).join(" · ")}</p><div className="post-meta"><span>画像完整度 <b>{profile.completion}%</b></span><span>本周匹配 <b>{matchItems.filter(match=>match.perspective===item).length}</b></span></div><div><button className="solid" onClick={()=>{setMode(item);setProfileOpen(true)}}>{item==="role"?"修改接棒信息":"修改求职信息"}</button><button className="outline" onClick={()=>changeProfileStatus(item,profile.status==="paused"?"pooled":"paused")}>{profile.status==="paused"?"恢复入池":"暂停入池"}</button><button className="danger" disabled={!limit.canDelete} onClick={()=>deleteProfile(item)}>{limit.canDelete?"删除发布":"本月已删除过"}</button></div></article>:<article className="empty-post" key={item}><span className="card-index">{item==="role"?"ROLE POST":"TALENT POST"}</span><h2>{item==="role"?"还没有待接棒岗位":"还没有求职画像"}</h2><p>{limit.canRecreate?(item==="role"?"提交真实岗位信息后，立即进行首次增量匹配。":"提交能力与求职偏好后，立即进行首次增量匹配。"):`该方向本月的新建次数已用完，下月可再次发布。`}</p><button className="solid" disabled={!limit.canRecreate} onClick={()=>{setMode(item);setProfileOpen(true)}}>{limit.canRecreate?"立即发布":"本月不可再新建"}</button></article>})}</div><div className="one-post-rule"><b>匹配什么时候更新？</b><p>首次发布立即匹配；修改、暂停和恢复不会触发即时重算，系统会在下周一按最新内容进行增量匹配。</p></div></div>}

      {view==="matches"&&<div className="page"><div className="page-heading"><div><span className="overline">PRIVATE WEEKLY SELECTION</span><h1>本周精选</h1><p>只会展示其他真实用户提交、且双向匹配达到 90 分的匿名信息。</p></div><div className="week-count"><b>{String(matchItems.length).padStart(2,"0")}</b><span>/ 10 个本周名额</span></div></div>{dataLoading?<div className="empty-state"><h2>正在读取本周匹配…</h2></div>:!readyForMatching?<div className="empty-state"><span>✦</span><h2>本周匹配尚未开启</h2><p>请先发布“找工作”或“找接任者”任意一条信息。入池后就会开始对应方向的筛选。</p><button className="solid" onClick={()=>nav("posts")}>去完成我的发布</button></div>:matchItems.length===0?<div className="empty-state"><span>○</span><h2>暂无高匹配结果</h2><p>你已发布的画像正在池中匹配。当其他真实用户的信息达到 90 分时，才会出现在这里。</p></div>:<div className="matches-list">{matchItems.map(m=><article className={`match-row ${m.ownDecision==="hidden"?"is-hidden":""}`} key={m.id}><div className="score-block"><b>{m.score}</b><span>匹配度</span><i>{m.score>=95?"极高":"高匹配"}</i></div><div className="match-body"><div className="match-title"><div><h2>{m.perspective==="talent"?`匿名岗位 ${m.anonymousCode}`:`匿名候选人 ${m.anonymousCode}`}</h2><p>{[m.payload.city,m.payload.role||m.payload.industry,m.payload.system||m.payload.salary].filter(Boolean).join(" · ")}</p></div><span className="verified">✓ 对方邮箱已验证</span></div><div className="match-reasons"><div><b>为什么匹配</b><p>{m.reasons.join("；")}</p></div><div className="risk"><b>哪里有风险</b><p>{m.risks.join("；")}</p></div><div><b>见面应验证</b><p>{m.verifyOnMeeting.join("；")}</p></div></div><div className="match-actions"><button className={m.ownDecision==="interested"?"liked":""} disabled={m.ownDecision==="hidden"} onClick={()=>decideMatch(m.id,m.ownDecision==="interested"?"pending":"interested")}>{m.ownDecision==="interested"?"已发出意向 ✓":"想了解"}</button><button className={m.ownDecision==="hidden"?"hidden-btn":""} onClick={()=>decideMatch(m.id,m.ownDecision==="hidden"?"pending":"hidden")}>{m.ownDecision==="hidden"?"已隐藏·点击撤回":"不合适"}</button></div></div></article>)}</div>}</div>}

      {view==="messages"&&<div className="page messages-page"><div className="page-heading"><div><span className="overline">ANONYMOUS CONNECTIONS</span><h1>匿名沟通</h1><p>只有双方都选择“想了解”，并在通知页确认开始后，这里才会出现对话。</p></div></div>{conversations.length===0?<div className="empty-state"><span>○</span><h2>还没有匿名沟通</h2><p>当你与对方双向匹配成功时，通知页会询问是否开始匿名沟通。</p></div>:<div className="conversation-list">{conversations.map(item=><article key={item.id}><span className="avatar">{String(item.anonymousCode).charAt(0)}</span><div><h2>匿名用户 {item.anonymousCode}</h2><p>{item.lastMessage||"沟通已开启，暂无消息"}</p></div><i>{item.score} 分匹配</i></article>)}</div>}</div>}

      {view==="notifications"&&<div className="page notifications-page"><div className="page-heading"><div><span className="overline">MATCH NOTIFICATIONS</span><h1>通知</h1><p>匹配、沟通和账号安全的真实通知会出现在这里。</p></div></div>{notifications.length===0?<div className="empty-state"><span>✓</span><h2>暂无新通知</h2><p>双方匹配成功后，你会在这里收到开始匿名沟通的邀请。</p></div>:<div className="notification-list">{notifications.map(item=><article key={item.id}><span>✦</span><div><h2>你已经成功匹配</h2><p>你和匿名用户 {item.anonymousCode} 都选择了“想了解”，匹配度 {item.score} 分。是否开始匿名沟通？</p></div><button className="solid" onClick={()=>startConversation(item.matchId)}>开始匿名沟通</button></article>)}</div>}</div>}

      {view==="trust"&&<div className="page trust-page"><div className="page-heading"><div><span className="overline">TRUST PASSPORT</span><h1>信誉记录</h1><p>第一版只验证邮箱归属，其他岗位与简历信息都是本人自述。</p></div><div className="trust-score"><b>80</b><span>新账号初始信誉</span></div></div><div className="trust-layout"><section className="passport"><header><div className="avatar">R</div><div><h2>{profileMeta.talent?.anonymousCode||profileMeta.role?.anonymousCode||"新匿名用户"}</h2><p>邮箱已验证</p></div><span className="level">邮箱验证</span></header>{[["邮箱归属","verified","邮箱验证码已通过"],["任职与学历","self","平台暂不认证"],["项目成果","self","平台暂不认证"],["专业能力","self","平台暂不认证"],["内推与 HC 权限","self","平台暂不认证"],["社区履约记录","record","暂无记录"]].map(x=><div className="passport-row" key={x[0]}><div><b>{x[0]}</b><small>{x[2]}</small></div><span className={x[1]}>{x[1]==="verified"?"已验证":x[1]==="record"?"平台记录":"本人自述"}</span></div>)}</section><aside className="reputation"><h3>信誉奖惩规则</h3><p>初始 80 分，最高 100 分。只有 100 分用户才会被随机抽中陪审。</p><div className="rep-item"><span>+3</span><div><b>有效履约</b><small>匹配后诚信沟通并完成双向评价</small></div></div><div className="rep-item negative"><span>-20</span><div><b>证实虚假岗位或简历</b><small>伪造任职、学历或项目成果</small></div></div><div className="rep-item negative"><span>-100</span><div><b>索要费用或欺诈</b><small>信誉降至 0，匹配权重与展示机会最低</small></div></div><div className="rep-item negative"><span>-10</span><div><b>恶意举报或陪审</b><small>申诉复核确认后扣减</small></div></div></aside></div></div>}

      {view==="jury"&&<div className="page jury-page"><div className="page-heading"><div><span className="overline">COMMUNITY JURY</span><h1>公民陪审</h1><p>案件只会随机发给当时信誉度为 100 分的陪审员。</p></div><div className="jury-duty"><b>你的信誉：80</b><span>达到 100 分后才可能被随机抽中</span></div></div><div className="empty-state"><span>⚖</span><h2>当前没有分配给你的陪审案件</h2><p>新账号不会看到演示案件或虚假排行数据。真实案件会按规则随机发放。</p></div></div>}

      {view==="admin"&&isAdmin&&<div className="page admin-page"><div className="page-heading"><div><span className="overline">ADMIN ONLY</span><h1>管理员控制台</h1><p>该页面只对唯一管理员账号显示，同时由服务端校验权限。</p></div></div><div className="admin-stats">{[[String(adminSummary?.users??0),"注册用户"],[String(adminSummary?.activeReports??0),"陪审中举报"],[String(adminSummary?.pendingAppeals??0),"待处理申诉"]].map(x=><div key={x[1]}><b>{x[0]}</b><span>{x[1]}</span></div>)}</div><div className="empty-state"><span>✓</span><h2>当前没有待处理的真实队列</h2><p>管理员页面不再展示演示申诉、虚假封号数或测试陪审员。</p></div></div>}
    </section>

    {profileOpen&&<div className="drawer-backdrop" onClick={()=>setProfileOpen(false)}><section className="profile-drawer" onClick={e=>e.stopPropagation()}><header><div><span className="overline">PRIVATE PROFILE · 1 / 1</span><h2>{mode==="role"?"修改待接棒岗位":"修改找工作画像"}</h2><p>{mode==="role"?"每个账号只有一条待接棒岗位，保存后会更新原记录。":"每个账号只有一条求职画像，保存后会更新原记录。"}</p></div><button onClick={()=>setProfileOpen(false)}>×</button></header><div className="contact-lock"><div><b>已验证登录邮箱</b><span>只用于登录和账号通知，不对匹配对象展示</span></div><div className="contact-grid one"><label>邮箱<input type="email" value={email} readOnly/></label></div></div><div className="field-grid">{fields.map(f=><label key={f.key}><span>{f.label}{f.required&&<i>必填</i>}</span><textarea rows={3} placeholder={f.hint} value={values[`${mode}-${f.key}`]||""} onChange={e=>setValues(v=>({...v,[`${mode}-${f.key}`]:e.target.value}))}/></label>)}</div><footer><div><b>{completion}%</b><span>画像完整度</span></div><button className="outline" onClick={()=>{setProfileOpen(false);setRawOpen(true)}}>AI 帮我补齐</button><button className="solid" disabled={busy} onClick={saveProfile}>{busy?"正在保存…":profileMeta[mode]?"保存真实修改":"确认并匿名入池"}</button></footer></section></div>}

    {rawOpen&&<div className="modal-backdrop" onClick={()=>setRawOpen(false)}><section className="raw-modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setRawOpen(false)}>×</button><span className="overline">AI STRUCTURED READING</span><h2>随便说，我来整理。</h2><p>可以直接粘贴一段话、旧简历或岗位介绍。AI 会将内容分类到完整画像，不确定的部分会留空让你确认。</p><textarea autoFocus rows={12} value={raw} onChange={e=>setRaw(e.target.value)} placeholder={mode==="role"?"例：我在上海一家 80 人的 SaaS 公司做客户成功…":"例：我做了 5 年广告策划，擅长理解客户和整理复杂信息…"}/><div className="parse-note"><span>✦</span><p>演示版会根据标点将内容拆入对应字段；正式版将使用真实语义 AI 解析。</p></div><button className="solid full" disabled={!raw.trim()} onClick={parseText}>AI 分类整理 <span>→</span></button></section></div>}
    {toast&&<div className="toast">{toast}</div>}
  </main>;
}
