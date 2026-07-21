"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Mode = "role" | "talent";
type View = "home" | "posts" | "matches" | "history" | "messages" | "notifications" | "trust" | "jury" | "admin";
type Field = { key: string; label: string; hint: string; required?: boolean };
type ProfileMeta = { anonymousCode:string; status:string; completion:number; payload:Record<string,string> };
type PublicationLimit = { canDelete:boolean; canRecreate:boolean };
type MatchItem = { id:string; score:number; perspective:Mode; ownDecision:"pending"|"interested"|"hidden"; otherDecision:"pending"|"interested"|"hidden"; favorite:boolean; algorithmVersion?:string; anonymousCode:string; payload:Record<string,string>; reasons:string[]; risks:string[]; verifyOnMeeting:string[]; conversationId?:string|null };
type NotificationItem = { id:string; type:string; title:string; body:string; targetId?:string|null; readAt?:number|null; createdAt:number };
type ConversationItem = { id:string; matchId:string; anonymousCode:string; score:number; status:"active"|"cancelled"|"success_pending"|"successful"; perspective:Mode; payload:Record<string,string>; reasons:string[]; risks:string[]; verifyOnMeeting:string[]; lastMessage?:string|null; messageCount:number };
type ChatMessage = { id:string; body:string; mine:boolean; createdAt:number };
type HistoryItem = { id:string; weekKey:string; score:number; outcome:"success"|"failed"|"ended"; anonymousCode:string; perspective:Mode; reviewAvailable:boolean };
type AdminDatabase = {counts:Record<string,number>;users:Array<{email:string;reputation:number;status:string;createdAt:number}>;profiles:Array<{anonymousCode:string;type:Mode;status:string;completion:number;email:string;updatedAt:number}>;matches:Array<{score:number;weekKey:string;roleDecision:string;talentDecision:string;roleCode:string;talentCode:string;createdAt:number}>};
type AdminRefresh = {id:string;status:"running"|"completed"|"failed";processedProfiles:number;matchedCount:number;error?:string|null;createdAt:number;completedAt?:number|null};

const roleFields: Field[] = [
  { key:"city", label:"公司城市", hint:"例：上海·浦东 / 可混合", required:true },
  { key:"role", label:"当前岗位", hint:"职位名称、级别、所属部门", required:true },
  { key:"industry", label:"行业与业务", hint:"公司做什么，岗位服务谁" },
  { key:"work", label:"真实工作内容", hint:"一周怎么过，关键 KPI 是什么", required:true },
  { key:"experience", label:"所需经验", hint:"需要哪些工作经历、年限或相似岗位背景", required:true },
  { key:"education", label:"学历与专业要求", hint:"学历、专业要求，以及哪些条件可以放宽", required:true },
  { key:"projects", label:"岗位项目经验与产出", hint:"这个岗位过去做过哪些项目？目标、职责、规模、结果和可量化产出是什么？", required:true },
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
  { key:"experience", label:"我的工作经验", hint:"公司、岗位、工作年限、主要职责和真实成果", required:true },
  { key:"education", label:"我的教育经历", hint:"学校、专业、学历和与目标方向相关的学习经历", required:true },
  { key:"ability", label:"我的能力", hint:"你真正擅长什么，有哪些成果", required:true },
  { key:"projects", label:"我的项目经验与成果", hint:"项目背景、你的角色、采取的行动、可量化结果，以及可以如何验证", required:true },
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

const interviewQuestions: Record<Mode,string[]> = {
  role:["你所在的城市和行业是什么？","这个岗位的名称、部门和级别是什么？","一周真实的工作内容和关键目标是什么？","这个岗位做过哪些重要项目，你负责什么？","项目最终带来了什么可量化结果？","接任者必须具备哪些经验、教育背景和能力？","薪酬、奖金、作息和福利如何？","团队、管理者和决策方式是什么风格？","有哪些招聘广告不会写的真实风险？","为什么准备离开？是否确认存在 HC 或拥有内推资格？"],
  talent:["你现在或最近的岗位是什么？","你的教育背景是什么？","你最擅长解决什么问题？","你做过哪些重要项目，在里面承担什么角色？","有哪些可量化、可以验证的项目结果？","你想进入什么行业，为什么？","你明确不接受哪些工作条件？","目标城市、工作方式和期望薪资是什么？","最早什么时候到岗？","未来 2—3 年希望获得什么样的成长？"],
};

const reputationRules = [
  ["+3","合作履约", "双方确认合作成功并完成评价"],
  ["+1","高质量评价", "对方评价高于 90 分；评价只影响信誉加减分"],
  ["+1","有效沟通", "同一会话累计 20 次有效回复，最多奖励 1 分；每天最多计 3 次"],
  ["-1","低质量评价", "对方评价低于 60 分，可申诉"],
  ["-1","15 天未回复", "从收到待回复消息开始计时，同一会话最多扣 1 分；取消或关闭会话可撤销"],
  ["-20","虚假岗位或简历", "包括伪造任职、学历、项目经历与项目产出"],
  ["-100","索要费用或诈骗", "信誉最低降至 0，不封号，但匹配排序与展示机会最低"],
  ["-10","恶意举报或陪审", "管理员申诉复核确认后扣减；恶意陪审永久失去陪审资格"],
  ["恢复","申诉翻案", "撤销相应误扣分并重新计算陪审准确率"],
] as const;

const databaseCountLabels: Record<string,string> = {
  users:"用户", oauth_identities:"第三方登录", profiles:"画像", profile_keywords:"画像关键词", matches:"匹配结果",
  match_runs:"匹配任务", match_exclusions:"永久排除", conversations:"匿名会话", messages:"消息",
  reputation_events:"信誉变动", reports:"举报", jury_assignments:"陪审分配", jury_votes:"陪审投票",
  appeals:"申诉", publication_cycles:"发布周期", ai_parse_usage:"AI 解析用量",
  match_feedback:"匹配反馈", admin_match_refreshes:"全池更新任务",
};

const formatDatabaseTime = (timestamp:number) => timestamp ? new Date(timestamp*1000).toLocaleString("zh-CN", {hour12:false}) : "—";

function getNextDailyCountdown(now = new Date()) {
  const nextUpdate = new Date(now);
  nextUpdate.setDate(now.getDate() + 1);
  nextUpdate.setHours(0, 0, 0, 0);
  const remaining = Math.max(0, nextUpdate.getTime() - now.getTime());
  return {
    hours: String(Math.floor(remaining / 3_600_000)).padStart(2, "0"),
    minutes: String(Math.floor((remaining % 3_600_000) / 60_000)).padStart(2, "0"),
  };
}

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<View>("home");
  const [mode, setMode] = useState<Mode>("role");
  const [profileOpen, setProfileOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const [rawDrafts, setRawDrafts] = useState<Record<Mode,string>>({role:"",talent:""});
  const [values, setValues] = useState<Record<string,string>>({});
  const [profileMeta, setProfileMeta] = useState<Record<Mode,ProfileMeta|undefined>>({ role:undefined, talent:undefined });
  const [publicationLimits, setPublicationLimits] = useState<Record<Mode,PublicationLimit>>({role:{canDelete:true,canRecreate:true},talent:{canDelete:true,canRecreate:true}});
  const [isAdmin, setIsAdmin] = useState(false);
  const [reputation, setReputation] = useState(80);
  const [readyForMatching, setReadyForMatching] = useState(false);
  const [matchItems, setMatchItems] = useState<MatchItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [adminSummary, setAdminSummary] = useState<{users:number;activeReports:number;pendingAppeals:number}|null>(null);
  const [adminDatabase, setAdminDatabase] = useState<AdminDatabase|null>(null);
  const [adminRefresh, setAdminRefresh] = useState<AdminRefresh|null>(null);
  const [hiddenReasonMatch, setHiddenReasonMatch] = useState<string|null>(null);
  const [nextDailyCountdown, setNextDailyCountdown] = useState({hours:"--",minutes:"--"});
  const [dataLoading, setDataLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const onboardingChecked = useRef(false);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [interviewStep, setInterviewStep] = useState(0);
  const [interviewAnswers, setInterviewAnswers] = useState<string[]>([]);
  const [activeConversation, setActiveConversation] = useState<string|null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [matchingStats, setMatchingStats] = useState({role:0,talent:0,highScore:0,mutual:0});
  const fields = mode === "role" ? roleFields : talentFields;
  const completion = useMemo(() => Math.round(fields.filter(f => values[`${mode}-${f.key}`]?.trim()).length / fields.length * 100), [fields, mode, values]);
  const unreadCount = notifications.filter(item=>!item.readAt).length;
  const activeConversationItem = conversations.find(item=>item.id===activeConversation);
  const draftProfile = (["role","talent"] as Mode[]).find(type=>profileMeta[type]?.status==="draft"||((profileMeta[type]?.completion??100)<100));
  const hasUnreadMessage = notifications.some(item=>!item.readAt&&item.type==="new_message");

  useEffect(()=>{
    fetch("/api/auth/providers").then(async response=>{if(response.ok){const data=await response.json() as {google?:boolean};setGoogleAvailable(Boolean(data.google))}}).catch(()=>undefined);
    const authError=new URLSearchParams(window.location.search).get("auth_error");
    if(authError){const messages:Record<string,string>={google_cancelled:"你已取消 Google 登录",google_state:"Google 登录状态已失效，请重新尝试",google_token:"Google 授权交换失败，请稍后重试",google_identity:"Google 账号邮箱未通过验证",google_not_configured:"Google 登录尚未完成配置",account_unavailable:"该账号当前不可用"};window.setTimeout(()=>flash(messages[authError]||"Google 登录失败"),0);window.history.replaceState({},"",window.location.pathname)}
    fetch("/api/auth/me").then(async response=>{
      if(!response.ok) return;
      const data = await response.json() as {user?:{email:string;reputation?:number;isAdmin?:boolean}};
      if(data.user){setEmail(data.user.email);setReputation(data.user.reputation??80);setIsAdmin(Boolean(data.user.isAdmin));setLoggedIn(true)}
    }).finally(()=>setAuthChecking(false));
  },[]);

  useEffect(()=>{
    const updateCountdown=()=>setNextDailyCountdown(getNextDailyCountdown(new Date()));
    updateCountdown();
    const timer=window.setInterval(updateCountdown,30_000);
    return()=>window.clearInterval(timer);
  },[]);

  const refreshDashboard=useCallback(async()=>{
    setDataLoading(true);
    try{
      const response=await fetch("/api/dashboard");
      if(!response.ok) throw new Error("资料读取失败");
      const data = await response.json() as {user:{email:string;reputation:number;isAdmin:boolean};profiles:Array<{type:Mode;anonymousCode:string;status:string;completion:number;payload:Record<string,string>}>;publicationLimits:Record<Mode,PublicationLimit>;readyForMatching:boolean;matches:MatchItem[];history:HistoryItem[];notifications:NotificationItem[];conversations:ConversationItem[];matchingStats:{role:number;talent:number;highScore:number;mutual:number}};
      const nextValues:Record<string,string> = {};
      const nextMeta:Record<Mode,ProfileMeta|undefined> = {role:undefined,talent:undefined};
      data.profiles.forEach(profile=>{
        nextMeta[profile.type]={anonymousCode:profile.anonymousCode,status:profile.status,completion:profile.completion,payload:profile.payload};
        Object.entries(profile.payload).forEach(([key,value])=>nextValues[`${profile.type}-${key}`]=String(value??""));
      });
      setEmail(data.user.email);setReputation(data.user.reputation);setIsAdmin(data.user.isAdmin);setValues(nextValues);setProfileMeta(nextMeta);
      setPublicationLimits(data.publicationLimits);
      setReadyForMatching(data.readyForMatching);setMatchItems(data.matches);setHistoryItems(data.history);setNotifications(data.notifications);setConversations(data.conversations);
      setMatchingStats(data.matchingStats);
      if(!onboardingChecked.current){onboardingChecked.current=true;if(data.profiles.length===0)setOnboardingOpen(true)}
    }catch{setToast("资料读取失败，请刷新后重试");setTimeout(()=>setToast(""),2600)}finally{setDataLoading(false)}
  },[]);

  useEffect(()=>{
    if(!loggedIn) return;
    const timer=window.setTimeout(()=>void refreshDashboard(),0);
    return()=>window.clearTimeout(timer);
  },[loggedIn,refreshDashboard]);

  useEffect(()=>{
    if(view!=="admin"||!isAdmin) return;
    Promise.all([fetch("/api/admin/summary"),fetch("/api/admin/database"),fetch("/api/admin/matches/refresh")]).then(async([summaryResponse,databaseResponse,refreshResponse])=>{
      if(!summaryResponse.ok||!databaseResponse.ok||!refreshResponse.ok) throw new Error();
      setAdminSummary(await summaryResponse.json());setAdminDatabase(await databaseResponse.json());
      const refreshData=await refreshResponse.json() as {latest:AdminRefresh|null};setAdminRefresh(refreshData.latest);
    }).catch(()=>flash("管理数据读取失败"));
  },[view,isAdmin]);

  useEffect(()=>{
    if(view!=="admin"||!isAdmin||adminRefresh?.status!=="running")return;
    const timer=window.setInterval(()=>{fetch("/api/admin/matches/refresh").then(async response=>{
      if(!response.ok)return;const data=await response.json() as {latest:AdminRefresh|null};setAdminRefresh(data.latest);
    }).catch(()=>undefined)},3000);
    return()=>window.clearInterval(timer);
  },[view,isAdmin,adminRefresh?.status]);

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

  async function saveProfile(publish=true){
    const requiredMissing=publish&&fields.some(field=>field.required&&!values[`${mode}-${field.key}`]?.trim());
    if(requiredMissing){flash("请先填写所有必填项");return}
    setBusy(true);
    try{
      const payload=Object.fromEntries(fields.map(field=>[field.key,values[`${mode}-${field.key}`]||""]));
      const response=await fetch("/api/profiles",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({type:mode,payload,completion,publish})});
      const data=await response.json() as {error?:string;profile?:{anonymousCode:string;status:string}};
      if(!response.ok||!data.profile) throw new Error(data.error||"保存失败");
      setProfileOpen(false);await refreshDashboard();flash(publish?(mode==="role"?"接棒信息已确认并进入匹配池":"求职信息已确认并进入匹配池"):"草稿已保存，暂时不会参与匹配");
    }catch(error){flash(error instanceof Error?error.message:"保存失败，请稍后再试")}finally{setBusy(false)}
  }

  async function logout(){if(!window.confirm("确定退出当前登录账号吗？"))return;await fetch("/api/auth/logout",{method:"POST"});setLoggedIn(false);setIsAdmin(false);setReputation(80);setCodeSent(false);setCode("");setValues({});setRawDrafts({role:"",talent:""});setProfileMeta({role:undefined,talent:undefined});setMatchItems([]);setHistoryItems([]);setNotifications([]);setConversations([]);flash("已安全退出")}
  async function changeProfileStatus(type:Mode,status:"paused"|"pooled"){
    const response=await fetch(`/api/profiles/${type}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({status})});
    const data=await response.json() as {error?:string};
    if(!response.ok){flash(data.error||"状态修改失败");return}
    await refreshDashboard();flash(status==="paused"?"已暂停入池，可随时恢复":"已恢复入池，将在下一次每日更新中重新匹配");
  }
  async function deleteProfile(type:Mode){
    if(!window.confirm(`确定删除这条${type==="role"?"接棒":"求职"}发布吗？该方向每月只能删除一次。`)) return;
    const response=await fetch(`/api/profiles/${type}`,{method:"DELETE"});
    const data=await response.json() as {error?:string};
    if(!response.ok){flash(data.error||"删除失败");return}
    await refreshDashboard();flash("发布已删除；该方向本月还可新建一次");
  }
  async function decideMatch(matchId:string,decision:"pending"|"interested"|"hidden",reason=""){
    const previous=matchItems.find(item=>item.id===matchId);if(!previous)return;
    setMatchItems(items=>items.map(item=>item.id===matchId?{...item,ownDecision:decision}:item));
    setHiddenReasonMatch(null);
    try{
      const response=await fetch(`/api/matches/${matchId}/decision`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({decision,reason})});
      const data=await response.json() as {error?:string;ownDecision?:MatchItem["ownDecision"];otherDecision?:MatchItem["otherDecision"];conversationId?:string|null;mutual?:boolean};
      if(!response.ok)throw new Error(data.error||"操作失败");
      setMatchItems(items=>items.map(item=>item.id===matchId?{...item,ownDecision:data.ownDecision||decision,otherDecision:data.otherDecision||item.otherDecision,conversationId:data.conversationId||item.conversationId}:item));
      setMatchingStats(stats=>({...stats,mutual:Math.max(0,stats.mutual+(data.mutual&&!(previous.ownDecision==="interested"&&previous.otherDecision==="interested")?1:0))}));
      if(data.mutual&&data.conversationId){
        const conversation:ConversationItem={id:data.conversationId,matchId,anonymousCode:previous.anonymousCode,score:previous.score,status:"active",perspective:previous.perspective,payload:previous.payload,reasons:previous.reasons,risks:previous.risks,verifyOnMeeting:previous.verifyOnMeeting,messageCount:0};
        setConversations(items=>items.some(item=>item.id===conversation.id)?items.map(item=>item.id===conversation.id?{...item,...conversation}:item):[conversation,...items]);
        flash("双方已配对，正在进入匿名沟通");await openConversation(data.conversationId);
      }else flash(decision==="interested"?"已发出匿名意向":decision==="hidden"?"已隐藏；原因会用于优化后续匹配":"已恢复该匹配");
    }catch(error){setMatchItems(items=>items.map(item=>item.id===matchId?previous:item));flash(error instanceof Error?error.message:"操作失败")}
  }
  async function toggleFavorite(matchId:string,favorite:boolean){
    const previous=matchItems.find(item=>item.id===matchId);if(!previous)return;
    setMatchItems(items=>items.map(item=>item.id===matchId?{...item,favorite}:item));
    try{const response=await fetch(`/api/matches/${matchId}/favorite`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({favorite})});
      const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||"收藏失败");flash(favorite?"已收藏，系统会学习你的偏好":"已取消收藏");
    }catch(error){setMatchItems(items=>items.map(item=>item.id===matchId?previous:item));flash(error instanceof Error?error.message:"收藏失败")}
  }
  async function startAdminRefresh(){
    if(!window.confirm("确定立即启动一次全池 AI 增量匹配吗？系统会在后台处理所有有效画像。"))return;
    const response=await fetch("/api/admin/matches/refresh",{method:"POST"});const data=await response.json() as {error?:string;jobId?:string};
    if(!response.ok){flash(data.error||"无法启动更新");return}setAdminRefresh({id:data.jobId||"",status:"running",processedProfiles:0,matchedCount:0,createdAt:Math.floor(Date.now()/1000)});flash("全池 AI 匹配已在后台启动");
  }
  function startInterview(type:Mode){setMode(type);setOnboardingOpen(false);setInterviewStep(0);setInterviewAnswers([]);setInterviewOpen(true)}
  async function finishInterview(){
    const text=interviewQuestions[mode].map((question,index)=>`${index+1}. ${question}\n${interviewAnswers[index]||""}`).join("\n\n");
    setBusy(true);
    try{
      const response=await fetch("/api/ai/parse-profile",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({type:mode,text,existing:{}})});
      const data=await response.json() as {error?:string;profile?:Record<string,string>};if(!response.ok||!data.profile)throw new Error(data.error||"AI 整理失败");
      setValues(current=>{const next={...current};Object.entries(data.profile!).forEach(([key,value])=>{if(value.trim())next[`${mode}-${key}`]=value.trim()});return next});
      setInterviewOpen(false);setProfileOpen(true);flash("AI 已生成画像，请逐项确认推测和缺失信息");
    }catch(error){flash(error instanceof Error?error.message:"AI 整理失败")}finally{setBusy(false)}
  }
  async function openConversation(id:string){
    const response=await fetch(`/api/conversations/${id}/messages`);const data=await response.json() as {error?:string;messages?:ChatMessage[];conversation?:ConversationItem};
    if(!response.ok){flash(data.error||"无法读取会话");return}if(data.conversation)setConversations(items=>items.some(item=>item.id===id)?items.map(item=>item.id===id?{...item,...data.conversation!}:item):[data.conversation!,...items]);setActiveConversation(id);setChatMessages(data.messages||[]);setView("messages");
  }
  async function sendMessage(e:FormEvent){
    e.preventDefault();if(!activeConversation||!chatDraft.trim())return;const body=chatDraft.trim();setChatDraft("");
    const response=await fetch(`/api/conversations/${activeConversation}/messages`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({body})});
    const data=await response.json() as {error?:string;warning?:string|null;message?:ChatMessage};if(!response.ok||!data.message){flash(data.error||"发送失败");setChatDraft(body);return}
    setChatMessages(items=>[...items,data.message!]);if(data.warning)flash(data.warning);await refreshDashboard();
  }
  async function conversationAction(action:"cancel"|"success"){
    if(!activeConversation)return;if(action==="cancel"&&!window.confirm("取消后双方会话都会关闭，确定继续吗？"))return;
    const response=await fetch(`/api/conversations/${activeConversation}/action`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action})});
    const data=await response.json() as {error?:string;status?:string};if(!response.ok){flash(data.error||"操作失败");return}await refreshDashboard();flash(data.status==="successful"?"双方已确认合作成功，可以进行评价":action==="success"?"已请对方确认合作结果":"匹配已取消");
  }
  async function openNotification(item:NotificationItem){
    if(!item.readAt)await fetch(`/api/notifications/${item.id}/read`,{method:"PUT"});
    if(item.targetId&&(item.type==="mutual_match"||item.type==="new_message"||item.type.startsWith("success")))await openConversation(item.targetId);else await refreshDashboard();
  }
  function flash(text:string){setToast(text);setTimeout(()=>setToast(""),2600)}
  function openAiParser(type:Mode){setMode(type);setRawDrafts(drafts=>({...drafts,[type]:""}));setProfileOpen(false);setRawOpen(true)}
  async function parseText(){
    const text=rawDrafts[mode].trim();if(!text){flash("请先粘贴需要解析的内容");return}
    setBusy(true);
    try{
      const existing=Object.fromEntries(fields.map(field=>[field.key,values[`${mode}-${field.key}`]||""]));
      const response=await fetch("/api/ai/parse-profile",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({type:mode,text,existing})});
      const data=await response.json() as {error?:string;profile?:Record<string,string>};
      if(!response.ok||!data.profile) throw new Error(data.error||"AI 解析失败");
      setValues(current=>{const next={...current};for(const [key,value] of Object.entries(data.profile!)){if(value.trim())next[`${mode}-${key}`]=value.trim()}return next});
      setRawDrafts(drafts=>({...drafts,[mode]:""}));setRawOpen(false);setProfileOpen(true);flash("AI 已按语义完成分类，请确认后保存");
    }catch(error){flash(error instanceof Error?error.message:"AI 解析失败，请稍后再试")}finally{setBusy(false)}
  }
  function nav(next:View){setView(next);window.scrollTo({top:0,behavior:"smooth"})}

  if(authChecking) return <main className="login-page"><div className="login-brand"><span className="brand-mark">R</span><b>Relay 接棒</b></div><section className="login-copy"><h1>正在确认<br/><em>安全登录状态…</em></h1></section></main>;

  if(!loggedIn) return <main className="login-page">
    <div className="login-brand"><span className="brand-mark">R</span><b>Relay 接棒</b></div>
    <section className="login-copy"><span className="overline">PRIVATE TALENT NETWORK</span><h1>不用海投。<br/><em>让真正做过的人帮你接棒。</em></h1><p>岗位和求职画像不会公开浏览。AI 每日理解能力、项目成果和跨行业可迁移性，只推送少量值得认真了解的匿名机会。</p><div className="login-proof"><span>Google 或邮箱登录</span><span>全程匿名沟通</span><span>反馈持续优化</span></div></section>
    <section className="login-box"><span className="step-tag">安全入口</span><h2>登录 Relay</h2><p>使用 Google 可直接进入；也可以继续使用邮箱验证码。两种方式使用相同邮箱时会自动关联为同一个账号。</p><button type="button" className="google-login" disabled={!googleAvailable||busy} onClick={()=>{window.location.href="/api/auth/google/start"}}><span className="google-mark">G</span><b>{googleAvailable?"使用 Google 账号登录":"Google 登录等待管理员配置"}</b><span>→</span></button><div className="login-divider"><span>或使用邮箱验证码</span></div><form onSubmit={login}><label>邮箱地址</label><div className="phone-input"><span>@</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" required disabled={codeSent||busy}/></div>{codeSent&&<><label>邮箱验证码</label><input className="code-input" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" autoComplete="one-time-code" placeholder="输入邮件中的 6 位验证码" required/></>}<button disabled={busy}>{busy?"正在处理…":codeSent?"验证邮箱并进入":"发送邮箱验证码"}<span>→</span></button></form>{codeSent&&<button className="text-button" onClick={()=>{setCodeSent(false);setCode("")}}>更换邮箱或重新发送</button>}<small>邮箱验证码会真实发送，10 分钟内有效。</small></section>
    {toast&&<div className="toast">{toast}</div>}
  </main>;

  return <main className="app-shell">
    {view==="admin"&&isAdmin&&<section className="admin-refresh-panel"><div><b>全池 AI 匹配</b><span>{adminRefresh?`${adminRefresh.status==="completed"?"上次完成":"当前状态"}：已处理 ${adminRefresh.processedProfiles} 份画像，生成 ${adminRefresh.matchedCount} 条匹配`:"管理员可以随时触发增量重排"}</span></div><button className="solid" disabled={adminRefresh?.status==="running"} onClick={startAdminRefresh}>{adminRefresh?.status==="running"?"AI 正在更新…":"立即更新"}</button></section>}
    {hiddenReasonMatch&&<div className="modal-backdrop" onClick={()=>setHiddenReasonMatch(null)}><section className="hide-reason-modal" onClick={event=>event.stopPropagation()}><button className="close" onClick={()=>setHiddenReasonMatch(null)}>×</button><span className="overline">HELP AI LEARN</span><h2>这次为什么不合适？</h2><p>原因只用于优化你的后续匹配，对方不会知道。</p><div>{["行业不符合","城市不符合","薪资不符合","不接受出差","工作内容不符合","公司阶段不符合","能力差距较大","信息不够真实","只是这一次不感兴趣"].map(reason=><button key={reason} onClick={()=>decideMatch(hiddenReasonMatch,"hidden",reason)}>{reason}</button>)}</div></section></div>}
    {onboardingOpen&&<div className="modal-backdrop"><section className="onboarding-card"><span className="overline">WELCOME TO RELAY</span><h2>你今天想解决什么？</h2><p>你的资料不会公开展示，只有进入私密匹配结果的匿名用户才可能看到。</p><div><button onClick={()=>startInterview("role")}><b>我想为当前岗位找接棒人</b><span>把真实工作与经验交给下一位合适的人</span></button><button onClick={()=>startInterview("talent")}><b>我想找一个新机会</b><span>包括跨行业，把可迁移能力说清楚</span></button></div><button className="text-button" onClick={()=>{setOnboardingOpen(false);setMode("role");setProfileOpen(true)}}>跳过访谈，直接完整填写</button><button className="text-button" onClick={()=>setOnboardingOpen(false)}>暂时不发布，只看看</button></section></div>}
    {interviewOpen&&<div className="modal-backdrop"><section className="interview-card"><header><span className="overline">AI PRIVATE INTERVIEW · {interviewStep+1}/{interviewQuestions[mode].length}</span><button onClick={()=>setInterviewOpen(false)}>×</button></header><div className="interview-progress"><i style={{width:`${(interviewStep+1)/interviewQuestions[mode].length*100}%`}}/></div><h2>{interviewQuestions[mode][interviewStep]}</h2><textarea autoFocus rows={8} value={interviewAnswers[interviewStep]||""} onChange={event=>setInterviewAnswers(items=>{const next=[...items];next[interviewStep]=event.target.value;return next})} placeholder="用你自己的话回答，真实比写得漂亮更重要…"/><footer><button className="outline" disabled={interviewStep===0||busy} onClick={()=>setInterviewStep(step=>step-1)}>上一题</button>{interviewStep<interviewQuestions[mode].length-1?<button className="solid" disabled={!interviewAnswers[interviewStep]?.trim()} onClick={()=>setInterviewStep(step=>step+1)}>下一题</button>:<button className="solid" disabled={!interviewAnswers[interviewStep]?.trim()||busy} onClick={finishInterview}>{busy?"AI 正在生成画像…":"生成画像并逐项确认"}</button>}</footer></section></div>}
    <aside className="sidebar">
      <button className="side-brand" onClick={()=>nav("home")}><span className="brand-mark">R</span><b>Relay <i>接棒</i></b></button>
      <nav>
        <button className={view==="home"?"active":""} onClick={()=>nav("home")}><span>◈</span>首页</button>
        <button className={view==="posts"?"active":""} onClick={()=>nav("posts")}><span>▤</span>我的发布{Object.values(profileMeta).filter(Boolean).length>0&&<em>{Object.values(profileMeta).filter(Boolean).length}</em>}</button>
        <button className={view==="matches"?"active":""} onClick={()=>nav("matches")}><span>✦</span>今日匹配{matchItems.length>0&&<em>{matchItems.length}</em>}</button>
        <button className={view==="history"?"active":""} onClick={()=>nav("history")}><span>◷</span>历史匹配{historyItems.length>0&&<em>{historyItems.length}</em>}</button>
        <button className={view==="notifications"?"active":""} onClick={()=>nav("notifications")}><span>◇</span>通知{notifications.filter(item=>!item.readAt).length>0&&<em>{notifications.filter(item=>!item.readAt).length}</em>}</button>
        <button className={view==="messages"?"active":""} onClick={()=>nav("messages")}><span>○</span>匿名沟通{conversations.length>0&&<em>{conversations.length}</em>}</button>
        <button className={view==="trust"?"active":""} onClick={()=>nav("trust")}><span>✓</span>信任护照</button>
        {(reputation===100||isAdmin)&&<button className={view==="jury"?"active":""} onClick={()=>nav("jury")}><span>⚖</span>公民陪审</button>}
      </nav>
      <div className="side-bottom">{isAdmin&&<button className={view==="admin"?"active":""} onClick={()=>nav("admin")}><span>⚙</span>管理员控制台</button>}<div className="user-chip"><span>R</span><div><b>{profileMeta.talent?.anonymousCode||profileMeta.role?.anonymousCode||"新匿名用户"}</b><small>{email} · 邮箱已验证</small></div><button className="logout-button" onClick={logout} aria-label="退出当前账号">退出登录</button></div></div>
    </aside>
    <div className="mobile-nav"><button onClick={()=>nav("home")}>首页</button><button onClick={()=>nav("matches")}>匹配</button><button onClick={()=>nav("notifications")}>通知</button><button onClick={()=>nav("messages")}>沟通</button></div>
    <section className="workspace">
      <header className="topbar"><div><span className="secure-dot"/>匿名模式已开启</div><div><button className="score-pill" onClick={()=>nav("trust")}>信誉 {reputation}</button></div></header>

      {view==="home"&&<div className="page home-page">
        <section className="welcome"><div><span className="overline">YOUR PRIVATE CAREER STATUS</span><h1>{hasUnreadMessage?"有人在等你的回复。":matchItems.length?`今天有 ${matchItems.length} 个机会，值得认真判断。`:draftProfile?"把真实经历说完整，下一棒才会更准。":"你的下一棒，正在私密池中寻找你。"}</h1><p>{hasUnreadMessage?"回复从真实交流开始；连续短句不会被当成有效沟通。":matchItems.length?"系统已经整理好匹配原因、风险和需要验证的事项。":readyForMatching?"画像已进入私密池，目前只等待真实用户出现。":"先选择一个目标，AI 会用访谈帮你建立画像。"}</p></div><div className="cycle"><span>距离下一次每日更新</span><b>{nextDailyCountdown.hours}<small>时</small> {nextDailyCountdown.minutes}<small>分</small></b><p>每天 00:00 更新 · 每个方向最多 10 条</p></div></section>
        <section className="home-focus"><span className="card-index">NEXT BEST ACTION</span><h2>{hasUnreadMessage?"回复匿名消息":matchItems.length?"查看今日匹配":draftProfile?"继续确认画像":"开始建立第一份画像"}</h2><p>{hasUnreadMessage?`你有 ${unreadCount} 条未读通知。`:matchItems.length?`其中 ${matchingStats.highScore} 条达到 90 分以上，${matchingStats.mutual} 条已经双方互选。`:draftProfile?`当前画像完成度 ${profileMeta[draftProfile]?.completion??0}%，补齐项目成果与可验证信息后再入池。`:"可以选择 AI 访谈，也可以跳过访谈直接填写完整表单。"}</p><button className="solid home-main-cta" onClick={()=>{if(hasUnreadMessage)nav("notifications");else if(matchItems.length)nav("matches");else if(draftProfile){setMode(draftProfile);setProfileOpen(true)}else setOnboardingOpen(true)}}>{hasUnreadMessage?"去回复":matchItems.length?"查看匹配":"开始"} <span>→</span></button></section>
        <section className="home-results"><div><span>找接棒人方向</span><b>{matchingStats.role}</b></div><div><span>找工作方向</span><b>{matchingStats.talent}</b></div><div><span>90 分以上</span><b>{matchingStats.highScore}</b></div><div><span>双方互选</span><b>{matchingStats.mutual}</b></div></section>
        <section className="home-secondary"><button onClick={()=>startInterview("role")}>+ 发布或更新接棒岗位</button><button onClick={()=>startInterview("talent")}>+ 发布或更新找工作画像</button><button onClick={()=>nav("posts")}>管理我的发布</button></section>
      </div>}

      {view==="posts"&&<div className="page posts-page"><div className="page-heading"><div><span className="overline">MY PRIVATE POSTS</span><h1>我的发布</h1><p>两个方向分别管理：每月各可删除一次，删除后各可重新新建一次；暂停和恢复不限次数。</p></div><div className="post-limit"><b>{Object.values(profileMeta).filter(Boolean).length} / 2</b><span>当前有效发布</span></div></div><div className="post-cards">{(["role","talent"] as Mode[]).map(item=>{const profile=profileMeta[item];const limit=publicationLimits[item];return profile?<article key={item}><header><span>{profile.anonymousCode}</span><i>{profile.status==="paused"?"已暂停":"匹配中"}</i></header><h2>{item==="role"?"我的待接棒岗位":"我的找工作画像"}</h2><p>{item==="role"?[profile.payload.city,profile.payload.role,profile.payload.industry].filter(Boolean).join(" · "):[profile.payload.industry,profile.payload.city,profile.payload.salary].filter(Boolean).join(" · ")}</p><div className="post-meta"><span>画像完整度 <b>{profile.completion}%</b></span><span>今日匹配 <b>{matchItems.filter(match=>match.perspective===item).length}</b></span></div><div><button className="solid" onClick={()=>{setMode(item);setProfileOpen(true)}}>{item==="role"?"修改接棒信息":"修改求职信息"}</button><button className="outline" onClick={()=>changeProfileStatus(item,profile.status==="paused"?"pooled":"paused")}>{profile.status==="paused"?"恢复入池":"暂停入池"}</button><button className="danger" disabled={!limit.canDelete} onClick={()=>deleteProfile(item)}>{limit.canDelete?"删除发布":"本月已删除过"}</button></div></article>:<article className="empty-post" key={item}><span className="card-index">{item==="role"?"ROLE POST":"TALENT POST"}</span><h2>{item==="role"?"还没有待接棒岗位":"还没有求职画像"}</h2><p>{limit.canRecreate?(item==="role"?"提交真实岗位信息后，立即进行首次AI匹配。":"提交能力与求职偏好后，立即进行首次AI匹配。"):`该方向本月的新建次数已用完，下月可再次发布。`}</p><button className="solid" disabled={!limit.canRecreate} onClick={()=>{setMode(item);setProfileOpen(true)}}>{limit.canRecreate?"立即发布":"本月不可再新建"}</button></article>})}</div><div className="one-post-rule"><b>匹配什么时候更新？</b><p>首次发布立即匹配；之后每天更新一次。修改、收藏、想了解和隐藏原因都会进入下一轮AI排序。</p></div></div>}

      {view==="matches"&&<div className="page"><div className="page-heading"><div><span className="overline">PRIVATE DAILY AI SELECTION</span><h1>今日匹配</h1><p>AI结合能力、项目成果、硬性条件、跨行业可迁移性和你的历史选择进行排序。</p></div><div className="week-count"><b>{String(matchItems.length).padStart(2,"0")}</b><span>/ 10 个今日机会</span></div></div>{dataLoading?<div className="empty-state"><h2>AI正在读取今日匹配…</h2></div>:!readyForMatching?<div className="empty-state"><span>✦</span><h2>匹配尚未开启</h2><p>请先发布“找工作”或“找接任者”任意一条信息。</p><button className="solid" onClick={()=>nav("posts")}>去完成我的发布</button></div>:matchItems.length===0?<div className="empty-state"><span>○</span><h2>今天还没有合适结果</h2><p>你的画像已进入私密池。系统不会为了凑满十条而展示明显不合适的机会。</p></div>:<div className="matches-list">{matchItems.map(m=>{const paired=m.ownDecision==="interested"&&m.otherDecision==="interested";return <article className={`match-row ${m.ownDecision==="hidden"?"is-hidden":""}`} key={m.id}><div className="score-block"><b>{m.score}</b><span>匹配度</span><i>{m.score>=90?"高度匹配":m.score>=75?"值得了解":"探索机会"}</i></div><div className="match-body"><div className="match-title"><div><h2>{m.perspective==="talent"?`匿名岗位 ${m.anonymousCode}`:`匿名候选人 ${m.anonymousCode}`}</h2><p>{[m.payload.city,m.payload.role||m.payload.industry,m.payload.system||m.payload.salary].filter(Boolean).join(" · ")}</p></div><span className="verified">✓ 对方邮箱已验证</span></div><div className="match-reasons"><div><b>为什么值得聊</b><p>{m.reasons.join("；")}</p></div><div className="risk"><b>最大分歧与风险</b><p>{m.risks.join("；")}</p></div><div><b>沟通时应验证</b><p>{m.verifyOnMeeting.join("；")}</p></div></div><div className="match-actions"><button className={paired?"paired":m.ownDecision==="interested"?"liked":""} disabled={m.ownDecision==="hidden"} onClick={()=>paired&&m.conversationId?openConversation(m.conversationId):decideMatch(m.id,m.ownDecision==="interested"?"pending":"interested")}>{paired?"已配对 ✓":m.ownDecision==="interested"?"已发出意向 ✓":"想了解"}</button><button className={m.favorite?"favorite active":"favorite"} disabled={m.ownDecision==="hidden"} onClick={()=>toggleFavorite(m.id,!m.favorite)}>{m.favorite?"已收藏 ★":"收藏 ☆"}</button><button className={m.ownDecision==="hidden"?"hidden-btn":""} onClick={()=>m.ownDecision==="hidden"?decideMatch(m.id,"pending"):setHiddenReasonMatch(m.id)}>{m.ownDecision==="hidden"?"已隐藏·点击撤回":"暂时隐藏"}</button></div></div></article>})}</div>}</div>}

      {view==="history"&&<div className="page history-page"><div className="page-heading"><div><span className="overline">MATCH HISTORY</span><h1>历史匹配</h1><p>这里保留以前日期的真实匹配结果；已隐藏对象不会再次进入你的候选池。</p></div></div>{historyItems.length===0?<div className="empty-state"><span>◷</span><h2>还没有历史匹配</h2><p>新账号不会显示测试数据。每日更新后，以前的真实匹配会出现在这里。</p></div>:<div className="history-list">{historyItems.map(item=><article key={item.id}><div><span>{item.weekKey}</span><h2>{item.perspective==="talent"?"匿名岗位":"匿名候选人"} {item.anonymousCode}</h2><p>{item.outcome==="success"?"匹配成功":item.outcome==="failed"?"匹配失败或已隐藏":"本轮已结束"} · 匹配度 {item.score} 分</p></div><i className={item.outcome}>{item.outcome==="success"?"成功":item.outcome==="failed"?"失败":"已结束"}</i>{item.reviewAvailable&&<button className="outline" onClick={()=>flash("评价与追评将在评价功能上线后开放")}>评价 / 追评</button>}</article>)}</div>}</div>}

      {view==="messages"&&<div className="page messages-page"><div className="page-heading"><div><span className="overline">ANONYMOUS CONNECTIONS</span><h1>匿名沟通</h1><p>双方互选后自动开启。第一版只支持文字，不支持图片、文件或撤回。</p></div></div>{conversations.length===0?<div className="empty-state"><span>○</span><h2>还没有匿名沟通</h2><p>当双方都表达意向后，会话会自动出现在这里。</p></div>:<div className="messenger"><aside>{conversations.map(item=><button className={activeConversation===item.id?"active":""} key={item.id} onClick={()=>openConversation(item.id)}><b>{item.perspective==="talent"?"匿名岗位":"匿名候选人"} {item.anonymousCode}</b><span>{item.payload.role||item.payload.industry||item.lastMessage||"发送第一条消息"}</span><i>{item.status==="successful"?"合作成功":item.status==="cancelled"?"已结束":`${item.score} 分`}</i></button>)}</aside><section className="chat-panel">{!activeConversation||!activeConversationItem?<div className="chat-placeholder"><span>○</span><h2>选择一段匿名会话</h2><p>在交换身份或转账前，请先验证岗位、项目与对方权限。</p></div>:<><header><div><b>{activeConversationItem.perspective==="talent"?"匿名岗位":"匿名候选人"} {activeConversationItem.anonymousCode}</b><span>{activeConversationItem.score} 分匹配 · {activeConversationItem.status==="active"?"沟通中":"状态已变化"}</span></div><div><button className="report-link" onClick={()=>flash("举报入口会要求选择原因并上传证据截图")}>举报</button><button className="outline" onClick={()=>conversationAction("cancel")}>取消匹配</button><button className="solid" onClick={()=>conversationAction("success")}>合作成功</button></div></header><details className="chat-match-context" open><summary><span>本次匹配信息</span><b>{[activeConversationItem.payload.role,activeConversationItem.payload.city,activeConversationItem.payload.industry,activeConversationItem.payload.system||activeConversationItem.payload.salary].filter(Boolean).join(" · ")||"查看对方画像摘要"}</b></summary><div className="chat-context-grid"><div><b>为什么匹配</b><p>{activeConversationItem.reasons.join("；")||"暂无说明"}</p></div><div className="risk"><b>风险与分歧</b><p>{activeConversationItem.risks.join("；")||"暂无明显风险"}</p></div><div><b>建议核实</b><p>{activeConversationItem.verifyOnMeeting.join("；")||"请核实身份、岗位和项目成果"}</p></div></div></details><div className="chat-messages">{chatMessages.length===0?<p className="first-message">你们已经互选。可以从上方“建议核实”的事项开始沟通。</p>:chatMessages.map(message=><div className={message.mine?"bubble mine":"bubble"} key={message.id}><p>{message.body}</p><time>{new Date(message.createdAt*1000).toLocaleString("zh-CN",{hour12:false})}</time></div>)}</div><form className="chat-compose" onSubmit={sendMessage}><textarea rows={2} value={chatDraft} onChange={event=>setChatDraft(event.target.value)} placeholder="发送文字消息；可以自愿输入邮箱、电话或微信…"/><button className="solid" disabled={!chatDraft.trim()}>发送</button><small>涉及转账、保证金、培训费等内容时，系统会提示诈骗风险。</small></form></>}</section></div>}</div>}

      {view==="notifications"&&<div className="page notifications-page"><div className="page-heading"><div><span className="overline">ACCOUNT ACTIVITY</span><h1>通知</h1><p>未读与已读都会永久保留，不再使用右上角通知图标。</p></div><div className="post-limit"><b>{unreadCount}</b><span>未读通知</span></div></div>{notifications.length===0?<div className="empty-state"><span>✓</span><h2>暂无通知</h2><p>新账号不会出现测试通知。匹配、消息、举报、陪审和信誉变化会出现在这里。</p></div>:<div className="notification-list">{notifications.map(item=><article className={item.readAt?"read":"unread"} key={item.id}><span>{item.readAt?"✓":"✦"}</span><div><small>{item.readAt?"已读":"未读"} · {new Date(item.createdAt*1000).toLocaleString("zh-CN",{hour12:false})}</small><h2>{item.title}</h2><p>{item.body}</p></div><button className="solid" onClick={()=>openNotification(item)}>{item.targetId?"查看":"标为已读"}</button></article>)}</div>}</div>}

      {view==="trust"&&<div className="page trust-page"><div className="page-heading"><div><span className="overline">TRUST PASSPORT</span><h1>信誉记录</h1><p>第一版只验证邮箱归属，其他岗位与简历信息都是本人自述。</p></div><div className="trust-score"><b>{reputation}</b><span>当前信誉分</span></div></div><div className="trust-layout"><section className="passport"><header><div className="avatar">R</div><div><h2>{profileMeta.talent?.anonymousCode||profileMeta.role?.anonymousCode||"新匿名用户"}</h2><p>邮箱已验证</p></div><span className="level">邮箱验证</span></header>{[["邮箱归属","verified","邮箱验证码已通过"],["任职与学历","self","平台暂不认证"],["项目成果","self","平台暂不认证"],["专业能力","self","平台暂不认证"],["内推与 HC 权限","self","平台暂不认证"],["社区履约记录","record","暂无记录"]].map(x=><div className="passport-row" key={x[0]}><div><b>{x[0]}</b><small>{x[2]}</small></div><span className={x[1]}>{x[1]==="verified"?"已验证":x[1]==="record"?"平台记录":"本人自述"}</span></div>)}</section><aside className="reputation"><h3>信誉奖惩规则</h3><p>初始 80 分，最高 100 分。只有 100 分用户才会被随机抽中陪审。</p>{reputationRules.map(rule=><div className={`rep-item ${rule[0].startsWith("-")?"negative":rule[0]==="恢复"?"neutral":""}`} key={`${rule[0]}-${rule[1]}`}><span>{rule[0]}</span><div><b>{rule[1]}</b><small>{rule[2]}</small></div></div>)}<div className="reputation-note"><b>0 分账号不会封号</b><p>仍可使用和申诉，但匹配排序最低、每日展示机会更少、卡片显示“低信誉”，且不能参加陪审。普通信誉下降恢复至 100 分后可重新获得陪审资格；确认恶意陪审者永久失去资格。</p></div></aside></div></div>}

      {view==="jury"&&<div className="page jury-page"><div className="page-heading"><div><span className="overline">COMMUNITY JURY</span><h1>公民陪审</h1><p>案件只会随机发给当时信誉度为 100 分的陪审员。</p></div><div className="jury-duty"><b>你的信誉：{reputation}</b><span>{reputation===100?"你已具备被随机抽中的资格":"达到 100 分后才可能被随机抽中"}</span></div></div><div className="empty-state"><span>⚖</span><h2>当前没有分配给你的陪审案件</h2><p>新账号不会看到演示案件或虚假排行数据。真实案件会按规则随机发放。</p></div></div>}

      {view==="admin"&&isAdmin&&<div className="page admin-page"><div className="page-heading"><div><span className="overline">ADMIN ONLY</span><h1>管理员控制台</h1><p>该页面只对唯一管理员账号显示，同时由服务端校验权限。</p></div></div><div className="admin-stats">{[[String(adminSummary?.users??0),"注册用户"],[String(adminDatabase?.counts.profiles??0),"真实画像"],[String(adminSummary?.activeReports??0),"陪审中举报"],[String(adminSummary?.pendingAppeals??0),"待处理申诉"]].map(x=><div key={x[1]}><b>{x[0]}</b><span>{x[1]}</span></div>)}</div><section className="database-panel"><header><div><span className="overline">LIVE DATABASE</span><h2>后台数据库</h2></div><p>以下数据直接读取线上数据库，仅供管理员查看；不会展示验证码、登录会话、密钥或完整画像正文。</p></header>{!adminDatabase?<div className="database-loading">正在读取数据库…</div>:<><div className="database-counts">{Object.entries(adminDatabase.counts).map(([key,value])=><div key={key}><b>{value}</b><span>{databaseCountLabels[key]||key}</span></div>)}</div><div className="database-section"><h3>最近用户</h3>{adminDatabase.users.length===0?<p className="database-empty">暂无用户</p>:<div className="database-table users"><div className="database-head"><span>邮箱</span><span>信誉</span><span>状态</span><span>注册时间</span></div>{adminDatabase.users.map(user=><div className="database-row" key={`${user.email}-${user.createdAt}`}><span>{user.email}</span><b>{user.reputation}</b><span>{user.status}</span><time>{formatDatabaseTime(user.createdAt)}</time></div>)}</div>}</div><div className="database-section"><h3>最近画像</h3>{adminDatabase.profiles.length===0?<p className="database-empty">暂无画像</p>:<div className="database-table profiles"><div className="database-head"><span>匿名编号</span><span>方向</span><span>状态 / 完整度</span><span>用户</span><span>更新时间</span></div>{adminDatabase.profiles.map(profile=><div className="database-row" key={`${profile.anonymousCode}-${profile.type}`}><b>{profile.anonymousCode}</b><span>{profile.type==="role"?"找接任者":"找工作"}</span><span>{profile.status} · {profile.completion}%</span><span>{profile.email}</span><time>{formatDatabaseTime(profile.updatedAt)}</time></div>)}</div>}</div><div className="database-section"><h3>最近匹配</h3>{adminDatabase.matches.length===0?<p className="database-empty">暂无匹配结果</p>:<div className="database-table matches"><div className="database-head"><span>双方匿名编号</span><span>匹配分</span><span>周次</span><span>双方状态</span><span>生成时间</span></div>{adminDatabase.matches.map((match,index)=><div className="database-row" key={`${match.roleCode}-${match.talentCode}-${match.createdAt}-${index}`}><b>{match.roleCode} ↔ {match.talentCode}</b><span>{match.score}</span><span>{match.weekKey}</span><span>{match.roleDecision} / {match.talentDecision}</span><time>{formatDatabaseTime(match.createdAt)}</time></div>)}</div>}</div></>}</section></div>}
    </section>

    {profileOpen&&<div className="drawer-backdrop" onClick={()=>setProfileOpen(false)}><section className="profile-drawer" onClick={e=>e.stopPropagation()}><header><div><span className="overline">PRIVATE PROFILE · 1 / 1</span><h2>{mode==="role"?"确认待接棒岗位":"确认找工作画像"}</h2><p>AI 生成和推测的信息需要你逐项确认；草稿不会进入匹配池。</p></div><button onClick={()=>setProfileOpen(false)}>×</button></header><div className="contact-lock"><div><b>已验证登录邮箱</b><span>只用于登录和账号通知，不对匹配对象展示</span></div><div className="contact-grid one"><label>邮箱<input type="email" value={email} readOnly/></label></div></div><div className="profile-review-note"><b>请重点确认</b><span>项目产出是否可验证 · 推测信息是否准确 · 缺失项是否影响对方判断 · 前后是否矛盾</span></div><div className="field-grid">{fields.map(f=><label key={f.key}><span>{f.label}{f.required&&<i>入池必填</i>}</span><textarea rows={3} placeholder={f.hint} value={values[`${mode}-${f.key}`]||""} onChange={e=>setValues(v=>({...v,[`${mode}-${f.key}`]:e.target.value}))}/></label>)}</div><footer><div><b>{completion}%</b><span>画像完整度</span></div><button className="outline" onClick={()=>saveProfile(false)}>保存草稿</button><button className="outline" onClick={()=>openAiParser(mode)}>AI 帮我补齐</button><button className="solid" disabled={busy} onClick={()=>saveProfile(true)}>{busy?"正在保存…":profileMeta[mode]?.status==="pooled"?"确认更新":"确认并匿名入池"}</button></footer></section></div>}

    {rawOpen&&<div className="modal-backdrop" onClick={()=>setRawOpen(false)}><section className="raw-modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setRawOpen(false)}>×</button><span className="overline">AI STRUCTURED READING · {mode==="role"?"岗位":"求职"}</span><h2>粘贴原文，AI 按语义整理。</h2><p>可以粘贴表格行、完整 JD、旧简历或自然语言。岗位与求职草稿完全独立，每次打开都会从空白文本开始。</p><textarea autoFocus rows={12} value={rawDrafts[mode]} onChange={e=>setRawDrafts(drafts=>({...drafts,[mode]:e.target.value}))} placeholder={mode==="role"?"粘贴岗位名称、地点、职责、要求、薪酬、流程等完整原文…":"粘贴工作经历、能力、求职方向、城市、薪资和不接受事项…"}/><div className="parse-note"><span>✦</span><p>AI 会理解字段含义、合并分散信息并保留薪资数字；原文没有的信息不会编造。</p></div><button className="solid full" disabled={!rawDrafts[mode].trim()||busy} onClick={parseText}>{busy?"AI 正在分析…":"AI 分类整理"} <span>→</span></button></section></div>}
    {toast&&<div className="toast">{toast}</div>}
  </main>;
}
