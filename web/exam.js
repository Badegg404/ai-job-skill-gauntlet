/* ===== 知识考核中心 — 主逻辑 =====
 * 功能：四大考核模式 / 六种题型 / 能力评估（雷达·增长点·缺失点）/
 *       岗位匹配 / 游戏化（积分·连击·等级·徽章）/ 历史追踪
 */
"use strict";

/* ---------------- 常量 ---------------- */
// 能力维度（对齐「大模型应用开发工程师」官方能力模型）
const ABILITIES = [
  "提示词工程",
  "RAG 与知识库",
  "工具调用",
  "向量与 Embedding",
  "Agent 核心机制",
  "模型微调",
  "开发框架",
  "部署与推理",
  "算法与神经网络",
  "面试表达力",
];

// 岗位能力要求权重（0-5）
// 岗位能力要求权重（0-5）——与 job_knowledge.json 的 8 个面试岗位对齐
const JOBS = [
  {
    name: "Agent 工程师",
    desc: "构建与编排 AI Agent（规划/工具/记忆/MCP）",
    weight: { "提示词工程": 3, "RAG 与知识库": 2, "工具调用": 5, "向量与 Embedding": 1, "Agent 核心机制": 5, "模型微调": 1, "开发框架": 4, "部署与推理": 2, "算法与神经网络": 1, "面试表达力": 3 },
  },
  {
    name: "LLM 应用开发工程师",
    desc: "基于大模型开发应用（提示词/工具调用/框架集成）",
    weight: { "提示词工程": 5, "RAG 与知识库": 3, "工具调用": 4, "向量与 Embedding": 2, "Agent 核心机制": 3, "模型微调": 1, "开发框架": 4, "部署与推理": 2, "算法与神经网络": 1, "面试表达力": 3 },
  },
  {
    name: "RAG / 检索增强工程师",
    desc: "检索增强生成与私有知识库建设（向量库/混合检索）",
    weight: { "提示词工程": 3, "RAG 与知识库": 5, "工具调用": 2, "向量与 Embedding": 5, "Agent 核心机制": 2, "模型微调": 1, "开发框架": 3, "部署与推理": 2, "算法与神经网络": 1, "面试表达力": 3 },
  },
  {
    name: "算法 / 机器学习工程师",
    desc: "模型微调/训练/蒸馏（LoRA/SFT/RLHF）",
    weight: { "提示词工程": 2, "RAG 与知识库": 1, "工具调用": 1, "向量与 Embedding": 2, "Agent 核心机制": 1, "模型微调": 5, "开发框架": 3, "部署与推理": 2, "算法与神经网络": 5, "面试表达力": 2 },
  },
  {
    name: "AI 平台 / 推理优化工程师",
    desc: "推理服务部署与性能优化（vLLM/SGLang/KV Cache）",
    weight: { "提示词工程": 1, "RAG 与知识库": 1, "工具调用": 1, "向量与 Embedding": 1, "Agent 核心机制": 2, "模型微调": 2, "开发框架": 2, "部署与推理": 5, "算法与神经网络": 3, "面试表达力": 2 },
  },
  {
    name: "多模态 / 视觉算法工程师",
    desc: "多模态大模型与视觉任务（VLM/文生图/检测分割）",
    weight: { "提示词工程": 2, "RAG 与知识库": 1, "工具调用": 1, "向量与 Embedding": 3, "Agent 核心机制": 2, "模型微调": 3, "开发框架": 2, "部署与推理": 2, "算法与神经网络": 5, "面试表达力": 2 },
  },
  {
    name: "AI 评测 / 质量工程师",
    desc: "大模型与 AI 系统评测（评测集/指标/质量闭环）",
    weight: { "提示词工程": 3, "RAG 与知识库": 3, "工具调用": 2, "向量与 Embedding": 2, "Agent 核心机制": 3, "模型微调": 2, "开发框架": 2, "部署与推理": 2, "算法与神经网络": 2, "面试表达力": 3 },
  },
  {
    name: "Prompt / 提示词工程师",
    desc: "提示词工程与输出控制（结构化输出/评测）",
    weight: { "提示词工程": 5, "RAG 与知识库": 2, "工具调用": 3, "向量与 Embedding": 1, "Agent 核心机制": 3, "模型微调": 1, "开发框架": 2, "部署与推理": 1, "算法与神经网络": 1, "面试表达力": 3 },
  },
];

// 等级称号（基础段：由综合能力画像平均分线性递进）
const LEVEL_TITLES = [
  { score: 0,  title: "AI 认知者", icon: "🌱" },
  { score: 40, title: "AI 工具使用者", icon: "🛠️" },
  { score: 50, title: "提示词工程师", icon: "💬" },
  { score: 60, title: "RAG/应用工程师", icon: "📚" },
  { score: 68, title: "Agent 工程师", icon: "⚙️" },
];

// 专家方向（三个平级分支，按对应能力维度分数解锁，无先后）
const EXPERT_TRACKS = [
  { ability: "开发框架",   title: "框架架构师",   icon: "🏗️", threshold: 75 },
  { ability: "模型微调",   title: "微调专家",     icon: "🔬", threshold: 75 },
  { ability: "部署与推理", title: "部署/推理专家", icon: "⚙️", threshold: 75 },
];
// 汇聚与顶点（三个方向都精通 → 全栈；画像 ≥98% → 大师）
const FULL_STACK_TITLE = { title: "全栈 AI 工程师", icon: "🏆", score: 94 };
const GRAND_MASTER_TITLE = { title: "AI 大师", icon: "👑", score: 98 };
// 综合能力画像平均分（无数据时 0）
async function loadIdentity() {
  // 本地配置（昵称、LLM key 等隐私项仍存 localStorage，仅本浏览器可见）
  try {
    NICKNAME = localStorage.getItem("examCenter.nickname") || "";
    LLM_KEY = localStorage.getItem("examCenter.llmKey") || "";
    LLM_BASE = localStorage.getItem("examCenter.llmBase") || "";
    LLM_MODEL = localStorage.getItem("examCenter.llmModel") || "";
  } catch (e) { /* ignore */ }
  // 设备绑定：从服务器获取固定 uid，所有浏览器共享同一用户数据
  try {
    const res = await fetch("./api/whoami", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data.uid) UID = data.uid;
    }
  } catch (e) { /* ignore */ }
  // 兜底：服务器不可用时回退到 localStorage 缓存
  if (!UID) {
    try { UID = localStorage.getItem("examCenter.uid") || ""; } catch (e) { /* ignore */ }
    if (!UID) {
      UID = "u_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }
  }
  // 同步到 localStorage 作缓存
  try { localStorage.setItem("examCenter.uid", UID); } catch (e) { /* ignore */ }
}
function saveIdentity() {
  try {
    localStorage.setItem("examCenter.uid", UID);
    localStorage.setItem("examCenter.nickname", NICKNAME);
    localStorage.setItem("examCenter.llmKey", LLM_KEY);
    localStorage.setItem("examCenter.llmBase", LLM_BASE);
    localStorage.setItem("examCenter.llmModel", LLM_MODEL);
  } catch (e) { /* ignore */ }
}
function setLLMConfig(key, base, model) {
  LLM_KEY = (key || "").trim();
  LLM_BASE = (base || "").trim();
  LLM_MODEL = (model || "").trim();
  saveIdentity();
}
/* 展示名：优先昵称，否则回退到简短 UID 或"同学" */
function displayName() {
  return (NICKNAME || "").trim() || "同学";
}

/* ---------------- 状态 ---------------- */
let COURSE = null;          // 当前课程
let state = {               // 游戏化状态
  nickname: "",             // 用户昵称（同步到服务器 profile，跨浏览器一致）
  xp: 0, level: 1, exams: 0, bestCombo: 0,
  lastScore: 0, bestInterview: 0, crossExam: false, practicalDone: false,
  modesDone: [],            // 已完成模式列表
  streak: 0, bestStreak: 0, lastStudyDay: "",  // 连续学习
  abilityBest: {},          // 能力维度历史最佳 {ability: pct}
  abilityProfile: {},       // 能力画像累积 {ability: {sum, count}} — 综合评估基础
  imports: 0,               // 导入资料次数
  history: [],              // [{date, mode, score, pct, abilities:{}}]
  wrongBook: [],            // 错题 [{q, answer, my, explanation, ability}]
  interviewLogs: [],        // 面试记录 [{job, date, score, dimensions, overall, history}]
  jobExtraQuestions: {},    // 从资料提炼的岗位通用面试题 {岗位名: [题, ...]} — 面试时并入参考弹药
  askedLog: {},             // 考过的题 {questionText: {q, wrong, lastAt}} — 用于回顾题
};
let quiz = [];              // 当前试卷
let quizIdx = 0;
let combo = 0;
let correctCount = 0;
let abilityScore = {};      // 本次能力得分 {ability: {got, total}}
let examMode = "chapter";
let answers = [];
let examSeq = 0;            // 考核序号（竞态守卫）
let isCrossExam = false;    // 是否综合考核（跨目录），用于跨课程徽章
let examDirId = null;       // 当前考核所属目录（章节考核记录用，判断「已考核」标识）
let wrongAttempts = 0;      // 当前题已答错次数（用于答错重试机制）
let beforeRankIdx = 0;      // 本次考核前的境界序号（用于检测境界提升）

/* ---------------- 工具 ---------------- */
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return [...document.querySelectorAll(sel)]; }
function esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

/* S-1 加固：JS 字符串字面量安全转义（用于 onclick 内联传参）。
 * esc 只做 HTML 转义；onclick 属性内的 HTML 实体会被浏览器解码还原，
 * 故这里必须补转义：反斜杠、单引号、换行、</script> 与实体还原。 */
function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* SVG 图标渲染（数据统一方案 UI 篇：控件 emoji → 线框 SVG 图标）
 * icon('home') 返回 <svg> 字符串；CSS .svg-icon 控制尺寸，currentColor 继承文字颜色 */
function icon(name, cls = "") {
  const svg = (typeof Icons !== "undefined" && Icons.ICONS && Icons.ICONS[name]) || "";
  if (!svg) return "";
  const m = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  const body = m ? m[1] : svg;
  return '<svg class="svg-icon ' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
}

/* 赛博霓虹图标：渐变描边（Lucide 图形 + linearGradient），用于大图标场景（如三大考核卡） */
function neonIcon(name, gid, from, to, cls = "") {
  const svg = (typeof Icons !== "undefined" && Icons.ICONS && Icons.ICONS[name]) || "";
  if (!svg) return "";
  const m = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  const body = m ? m[1] : svg;
  return '<svg class="svg-icon neon ' + cls + '" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="' + from + '"/><stop offset="100%" stop-color="' + to + '"/>' +
    '</linearGradient></defs>' +
    '<g stroke="url(#' + gid + ')" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + body + '</g></svg>';
}

/* ===== 常驻左侧导航（UI 优化：图标 + 文字，当前项霓虹高亮） ===== */
const SIDE_NAV = [
  { key: "home", icon: "home", label: "首页", fn: "goHome()" },
  { key: "quickstart", icon: "rocket", label: "快速开始", fn: "showQuickStart()" },
  { key: "sep" },
  // 章节考核分组：导入资料（建目录）→ 资料目录（按章节考核）
  {
    key: "chapter", icon: "book-open", label: "章节考核", children: [
      { key: "import", icon: "upload", label: "导入资料", fn: "showImportPanel()" },
      { key: "library", icon: "folder", label: "资料目录", fn: "showLibrary()" },
    ],
  },
  // 综合考核分组：子项点击先进「考核介绍页」，开启按钮后进考核（含加载动画）
  {
    key: "exam", icon: "target", label: "综合考核", children: [
      { key: "theory", icon: "brain", label: "理论考核", fn: "showExamIntro('theory')" },
      { key: "practical", icon: "code", label: "实战考核", fn: "showExamIntro('practical')" },
    ],
  },
  // 面试考核：一级入口（介绍页更精致丰富）
  { key: "interview", icon: "messages-square", label: "面试考核", fn: "showExamIntro('interview')" },
  { key: "sep" },
  { key: "radar", icon: "radar", label: "能力画像", fn: "showAssessment()" },
  { key: "history", icon: "history", label: "学习历史", fn: "showHistory()" },
  { key: "wrongbook", icon: "bookmark", label: "错题本", fn: "showWrongBook()" },
  { key: "diag", icon: "terminal", label: "诊断日志", fn: "showDiagnostics()" },
  { key: "sep" },
  { key: "settings", icon: "settings", label: "设置", fn: "showSettings()" },
];

function renderSidebar() {
  const el = $("#app-sidebar");
  if (!el) return;
  const items = SIDE_NAV.map((it) => it.key === "sep"
    ? '<div class="side-nav-sep"></div>'
    : it.children
      ? '<div class="side-group" data-group="' + it.key + '">' +
        '<div class="side-group-title" onclick="toggleSideGroup(\'' + it.key + '\')">' + icon(it.icon) + '<span>' + it.label + '</span><span class="sg-arrow">▾</span></div>' +
        it.children.map((c) => `<div class="side-nav-item" data-key="${c.key}" onclick="${c.fn}">${icon(c.icon)}<span>${c.label}</span></div>`).join("") +
        '</div>'
      : `<div class="side-nav-item" data-key="${it.key}" onclick="${it.fn}">${icon(it.icon)}<span>${it.label}</span></div>`
  ).join("");
  el.innerHTML = '<div class="side-brand">AI 技能考核中心</div>' + items + '<div class="side-nav-spacer"></div>';
  // 恢复折叠记忆
  SIDE_NAV.forEach((it) => {
    if (!it.children) return;
    const g = el.querySelector('[data-group="' + it.key + '"]');
    if (g && localStorage.getItem("dsh.navCollapsed." + it.key) === "1") g.classList.add("collapsed");
  });
}

/* 分组点击折叠/展开（章节考核、综合考核） */
function toggleSideGroup(key) {
  const g = document.querySelector('[data-group="' + key + '"]');
  if (!g) return;
  const nowCollapsed = g.classList.toggle("collapsed");
  try { localStorage.setItem("dsh.navCollapsed." + key, nowCollapsed ? "1" : "0"); } catch (e) { /* ignore */ }
}

function setNavActive(key) {
  const items = document.querySelectorAll("#app-sidebar .side-nav-item");
  for (const el of items) {
    const active = el.dataset.key === key;
    el.classList.toggle("active", active);
    if (active) {
      // 激活子项时自动展开其所属分组
      const g = el.closest(".side-group");
      if (g) {
        g.classList.remove("collapsed");
        try { localStorage.setItem("dsh.navCollapsed." + g.dataset.group, "0"); } catch (e) { /* ignore */ }
      }
    }
  }
  // 分组父项联动高亮（子项激活时）
  document.querySelectorAll("#app-sidebar .side-group").forEach((g) => {
    const any = [...g.querySelectorAll(".side-nav-item")].some((el) => el.classList.contains("active"));
    g.classList.toggle("has-active", any);
  });
}

function jsStr(s) {
  return String(s == null ? "" : s)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/"/g, "\\u0022");
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) state = { ...state, ...JSON.parse(raw) };
  } catch (e) { /* ignore */ }
}
function saveState() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  // 同步到服务器（跨浏览器持久化）；clientTs = 保存发起时刻，用于重置竞态防护
  // （重置前挂起的旧请求 clientTs 早于 reset-ts 会被服务端丢弃，防止旧数据复活）
  try {
    return fetch(`./api/profile-save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: UID, profile: state, clientTs: Date.now() }),
    }).catch(() => {});
  } catch (e) { return Promise.resolve(); }
}

/* 记录考过的题（用于回顾题抽题） */
function recordAsked(q, wrong) {
  if (!q || !q.question) return;
  if (!state.askedLog) state.askedLog = {};
  const key = q.question;
  const prev = state.askedLog[key];
  state.askedLog[key] = {
    q,
    wrong: (prev ? prev.wrong : 0) + (wrong ? 1 : 0),
    lastAt: Date.now(),
  };
}

function updateGamestat() {
  // BUG-4 修复：同步 state.level（供等级徽章 lv3/lv5/lv7/lv8 判断），与顶栏显示一致
  state.level = currentLevelIndex() + 1;
  $("#gs-level").textContent = state.level;
  $("#gs-xp").textContent = state.xp;
  const unlocked = BADGES.filter((b) => b.check(state)).length;
  $("#gs-badges").textContent = unlocked;
  $("#gs-exams").textContent = state.exams;
  // 等级称号 + 成就点
  const t = currentTitle();
  const ap = calcAP(state);
  const titleEl = $("#gs-title");
  if (titleEl) titleEl.textContent = `${t.icon} ${t.title}`;
  const apEl = $("#gs-ap");
  if (apEl) apEl.textContent = ap;
  const streakEl = $("#gs-streak");
  if (streakEl) streakEl.textContent = state.streak;
}

/* ---------------- 数据加载 ---------------- */
async function loadData() {
  await loadIdentity();
  // 用户课程（无则返回空课程）
  const res = await fetch("./api/profile?uid=" + encodeURIComponent(UID), { cache: "no-store" });
  let profile = null;
  if (res.ok) {
    const pdata = await res.json();
    profile = pdata.profile;
    if (profile) {
      state = { ...state, ...profile };
      // 昵称同步到服务器 profile，跨浏览器一致
      if (profile.nickname !== undefined) NICKNAME = profile.nickname;
    }
  }
  // 加载用户当前课程
  try {
    const cr = await fetch(`./api/user-course?uid=${encodeURIComponent(UID)}`, { cache: "no-store" });
    if (cr.ok) {
      const c = await cr.json();
      COURSE = c.course || null;
    }
  } catch (e) { /* ignore */ }
  if (!COURSE) {
    COURSE = { title: "未导入课程", quiz: [], chapters: [], concepts: [], learningObjectives: [], difficulties: [] };
  }
}

/* ---------------- 粒子动画 ---------------- */
function burstParticles(x, y, color, count = 26) {
  const layer = $("#particle-layer");
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    const ang = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 90;
    p.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:7px;height:7px;border-radius:50%;
      background:${color};pointer-events:none;transition:all ${0.5 + Math.random() * 0.4}s cubic-bezier(0.1,0.8,0.3,1);
      opacity:1;z-index:99`;
    layer.appendChild(p);
    requestAnimationFrame(() => {
      p.style.transform = `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist}px) scale(0.2)`;
      p.style.opacity = "0";
    });
    setTimeout(() => p.remove(), 950);
  }
}
function showCombo(n) {
  const b = $("#combo-banner");
  if (n >= 2) {
    b.textContent = `🔥 连击 ×${n}`;
    b.classList.add("show");
    setTimeout(() => b.classList.remove("show"), 700);
  }
}

/* ---------------- 试卷生成 ---------------- */
/* 被反馈过的题干（供出题 prompt 避开雷同坏题）：题干有误/答案有误，最多 10 条 */
function flaggedQuestionTxt() {
  return (state.questionFlags || [])
    .filter((f) => f.flag === "题干有误/表述不清" || f.flag === "答案有误")
    .slice(0, 10)
    .map((f) => `- ${f.q}`)
    .join("\n") || "";
}

/* LLM 动态挑选组卷：把候选题摘要（类型/维度/难度）发给 LLM，按「维度多样 + 难度适配 + 不雷同」挑 count 道。
 * 失败/返回不合法时返回 null，调用方回退 adaptivePick 程序抽题。 */
/* 保留供未来扩展（组卷已纯程序化，不再调用）：LLM 从题库挑选组卷 */
async function llmPickQuestions(pool, mode, count, scope) {
  // scope: "chapter"（章节考核，从本章题库挑、聚焦本章）| "cross"（综合考核，从全题库挑、跨章节覆盖）
  if (!LLM_KEY || !pool || pool.length < count) return null;
  const NL = String.fromCharCode(10);
  // 数据统一方案 L1：候选题面统一 sanitizeMaterial（quizBrief 60 字上限，行首编号格式保留）
  const brief = pool.slice(0, 100).map((q, i) =>
    i + "｜[" + q.type + "] " + DataIO.sanitizeMaterial([{ key: "quizBrief", text: q.question || "" }], { prefix: "" }) + "（维度:" + (q.ability || "?") + " 难度:" + (q.difficulty || 2) + "）"
  ).join(NL);
  const modeLabel = mode === "theory" ? "理论" : "实战";
  const goal = scope === "chapter"
    ? "这是一场【章节考核】：从本章节题库中挑选 " + count + " 道" + modeLabel + "题组卷。要求：聚焦本章节核心知识点、题目与本章资料强相关、难度适中为主、题型适度多样、题目之间不要雷同。"
    : "这是一场【综合考核】：从整个题库（跨章节/跨目录）中挑选 " + count + " 道" + modeLabel + "题组卷。要求：跨章节覆盖、维度尽量多样不扎堆、难度有阶梯（基础到进阶）、题目之间不要雷同、优先选质量高有区分度、贴合真实业务的题。";
  const prompt = "你是出题组长。" + goal + NL +
    "只输出 JSON：{'picks': [编号数组]}，编号取自上面列表行首数字。" + NL + "候选题：" + NL + brief;
  // 数据统一方案 P1：迁移到 llmJSON 统一调用器（格式约束块/反馈重出/日志/空响应软处理全覆盖）
  try {
    const parsed = await llmJSON({
      system: "你只输出 JSON，不输出任何其他文字。",
      prompt,
      formatHint: PICK_JSON_HINT,
      expect: "object",
      part: "pick",
      maxTokens: 300,
      temperature: 0.6,
      maxRetries: 2,
      validateObj: (o) => DataSchema.validateBySchema(o, DataSchema.OBJECT_SCHEMAS.pick),
    });
    const picks = Array.isArray(parsed && parsed.picks)
      ? parsed.picks
          .filter((i) => (typeof i === "number" || (typeof i === "string" && String(i).trim() !== "")))
          .map((i) => Number(i))
          .filter((i) => Number.isInteger(i) && i >= 0 && i < pool.length)
      : [];
    const uniq = Array.from(new Set(picks)).slice(0, count);
    if (!uniq.length) return null;
    // 不足 count 时从池中补齐：随机打乱剩余题再补，避免每次都取题库头部固定题
    const pickedSet = new Set(uniq);
    const rest = [];
    for (let i = 0; i < pool.length; i++) if (!pickedSet.has(i)) rest.push(i);
    for (const i of shuffle(rest)) {
      if (uniq.length >= count) break;
      uniq.push(i);
    }
    return uniq.map((i) => pool[i]);
  } catch (e) { return null; }
}

/* 自适应抽题：薄弱维度加权 + 按历史水平调整难度 */
function adaptivePick(pool, limit) {
  if (!pool.length) return [];
  // 反馈过滤：用户反馈「题干有误/答案有误」的坏题直接剔除；「考点/难度不合适」的题在池充足时剔除（降权）
  const flags = state.questionFlags || [];
  const badTexts = new Set(flags.filter((f) => f.flag === "题干有误/表述不清" || f.flag === "答案有误").map((f) => f.q));
  const softTexts = new Set(flags.filter((f) => f.flag === "考点/难度不合适").map((f) => f.q));
  if (badTexts.size) {
    // 强制剔除坏题（宁缺毋滥：即使剔除后不足 target 也绝不考错题）
    pool = pool.filter((q) => !badTexts.has(q.question));
  }
  if (softTexts.size) {
    const rest = pool.filter((q) => !softTexts.has(q.question));
    if (rest.length) pool = rest;
  }
  if (!pool.length) return [];
  const profilePct = abilityProfilePct();
  const recent = (state.history || []).slice(-3);
  const avgPct = recent.length ? recent.reduce((s, h) => s + (h.pct || 0), 0) / recent.length : null;

  // 1. 难度浮动（加权）：水平高 → 难题占约 70%；水平低 → 基础题占约 70%
  let chosen = null;
  if (avgPct !== null && pool.length >= limit) {
    if (avgPct >= 80) {
      const hard = pool.filter((q) => (q.difficulty || 2) >= 3);
      const easy = pool.filter((q) => (q.difficulty || 2) < 3);
      if (hard.length >= Math.ceil(limit * 0.4)) {
        const hardCount = Math.min(hard.length, Math.ceil(limit * 0.7));
        chosen = shuffle(hard).slice(0, hardCount).concat(shuffle(easy).slice(0, limit - hardCount));
      }
    } else if (avgPct < 55) {
      const easy = pool.filter((q) => (q.difficulty || 2) <= 2);
      const hard = pool.filter((q) => (q.difficulty || 2) > 2);
      if (easy.length >= Math.ceil(limit * 0.4)) {
        const easyCount = Math.min(easy.length, Math.ceil(limit * 0.7));
        chosen = shuffle(easy).slice(0, easyCount).concat(shuffle(hard).slice(0, limit - easyCount));
      }
    }
  }

  // 2. 薄弱维度加权：得分 < 60 的维度多出题（约占 60%）
  if (!chosen) {
    const weakAbilities = Object.keys(profilePct).filter((a) => (profilePct[a] || 100) < 60);
    if (weakAbilities.length) {
      const weakQs = pool.filter((q) => weakAbilities.includes(q.ability));
      const otherQs = pool.filter((q) => !weakAbilities.includes(q.ability));
      if (weakQs.length) {
        const weakCount = Math.min(weakQs.length, Math.ceil(limit * 0.6));
        chosen = shuffle(weakQs).slice(0, weakCount).concat(shuffle(otherQs).slice(0, limit - weakCount));
      }
    }
  }
  if (!chosen) chosen = shuffle(pool).slice(0, limit);
  // 整体打乱顺序：保持「自适应抽题配比」（难题/薄弱维度占比不变），但题目排列顺序完全随机，
  // 避免「难题永远在前 / 薄弱维度永远在前」的固定顺序
  return shuffle(chosen);
}

function injectReviewQuestions(filtered, mode, target, chapter) {
  const log = state.askedLog || {};
  const entries = Object.values(log);
  if (!entries.length) return filtered;
  // BUG-FIX：回顾题也必须过滤反馈坏题 + 已知错题（否则旧错题会作为第一题反复注入）
  const flags = state.questionFlags || [];
  const badTexts = new Set(flags.filter((f) => f.flag === "题干有误/表述不清" || f.flag === "答案有误").map((f) => f.q));
  const clean = entries.filter((e) => e.q && e.q.question && !badTexts.has(e.q.question)
    && !KNOWN_BAD_QUESTIONS.some((b) => String(e.q.question).includes(b))
    && (!chapter || normChapter(e.q.chapterRef || e.q.chapter) === chapter));   // 章节隔离：按章考核只注入本章回顾题
  if (!clean.length) return filtered;
  // 题型过滤：回顾题必须与当前考核模式匹配（理论考核绝不注入实战题，反之亦然）
  const typeOk = (q) => {
    if (mode === "practical") return q && q.type === "practical";
    if (mode === "theory") return q && ["choice", "multi_choice", "true_false", "fill_blank"].includes(q.type);
    return true;   // 其他模式（面试等）不过滤
  };
  // 优先错题，且按「距离上次答错的时间」从远到近排序（间隔重复：越久越该复习）
  const wrongs = clean.filter((e) => typeOk(e.q) && e.wrong > 0)
    .sort((a, b) => (a.lastAt || 0) - (b.lastAt || 0));
  const others = clean.filter((e) => typeOk(e.q) && !e.wrong)
    .sort((a, b) => (a.lastAt || 0) - (b.lastAt || 0));
  const candidates = wrongs.concat(others);
  // 最多抽 3 道，且不能与本次试卷重复
  const chosen = [];
  const seen = new Set(filtered.map((q) => q.question));
  for (const e of candidates) {
    if (chosen.length >= 3) break;
    if (!e.q || !e.q.question || seen.has(e.q.question)) continue;
    chosen.push({ ...e.q, review: true });
    seen.add(e.q.question);
  }
  // 总题量固定：回顾题算在 target 内（基础题截断到 target - 回顾数），不追加超量
  const baseCap = Math.max(0, (target || filtered.length) - chosen.length);
  return chosen.concat(filtered.slice(0, baseCap));
}

/* 组卷后选项洗牌：LLM 出题时正确答案常偏向前几个选项（A/B 占 8 成），每次考核现场打乱选项顺序，
 * 让正确答案位置随机化、不可预测（题库数据不变，correctIndex 同步重映射） */
function shuffleChoiceOptions(qs) {
  for (const q of qs) {
    if (q.type !== "choice" && q.type !== "multi_choice") continue;
    const opts = q.options || [];
    if (opts.length < 2) continue;
    const order = opts.map((_, i) => i);
    shuffle(order);   // 随机打乱下标
    const newOpts = order.map((i) => opts[i]);
    const ci = Array.isArray(q.correctIndex) ? q.correctIndex : [q.correctIndex];
    q.correctIndex = ci.map((i) => order.indexOf(Number(i))).filter((i) => i >= 0);
    q.options = newOpts;
  }
  return qs;
}

function render(view, html) {
  $("#exam-view").innerHTML = html;
  if (typeof view === "function") view();
}

/* ===== 首页产品展示示例（静态演示，不依赖用户数据/LLM） ===== */
const HOME_EXAMPLE_PCT = {
  "提示词工程": 82, "RAG 与知识库": 74, "工具调用": 68, "向量与 Embedding": 61,
  "Agent 核心机制": 58, "模型微调": 42, "开发框架": 66, "部署与推理": 55,
  "算法与神经网络": 48, "面试表达力": 71,
};
/* 雷达顶点 10 色（Hero 演示：顶点颜色 ↔ 右侧图例一一对应） */
const HOME_LEGEND_COLORS = ["#00e5ff", "#38bdf8", "#ff3df0", "#b026ff", "#2fd6b5", "#ffb84d", "#ff6b6b", "#fb923c", "#f472b6", "#a78bfa"];
const HOME_EXAMPLES = {
  theory: { q: "Transformer 中自注意力机制的核心作用是？", opts: ["捕捉序列内任意位置间的依赖关系", "降低模型参数量", "将文本编码为固定长度向量", "加速训练收敛"] },
  code: { file: "agent.py", code: "def average(nums):\n    return sum(nums) / len(nums)\n\nprint(average([1, 2, 3]))", q: "这段代码的输出是？" },
  chat: [
    { role: "iv", text: "介绍一下你负责过的 RAG 项目，检索环节是怎么设计的？" },
    { role: "me", text: "我们用了混合检索：BM25 关键词 + 向量召回，再按分数融合重排…" },
    { role: "iv", text: "如果召回结果相关性不高，你会怎么调优？" },
  ],
  bars: [
    { ab: "提示词工程", v: 82 }, { ab: "RAG 与知识库", v: 74 }, { ab: "工具调用", v: 68 },
    { ab: "Agent 核心机制", v: 61 }, { ab: "开发框架", v: 57 }, { ab: "面试表达力", v: 71 },
  ],
};

async function goHome() {
  setNavActive("home");
  await refreshDirs();   // 保持目录缓存刷新（首页聚焦展示，题库状态由侧栏/介绍页承载）
  const profilePct = abilityProfilePct();
  const profileKeys = Object.keys(profilePct);
  const avg = profileAvgScore();
  const curTitle = currentTitle();
  const curIdx = currentLevelIndex();
  const unlocked = BADGES.filter((b) => b.check(state)).length;
  const ap = calcAP(state);

  // 成长进度：下一基础称号
  const nextT = LEVEL_TITLES.find((t) => t.score > avg);
  let nextTxt, progPct;
  if (nextT) {
    const prev = [...LEVEL_TITLES].reverse().find((t) => t.score <= avg) || LEVEL_TITLES[0];
    const span = Math.max(1, nextT.score - prev.score);
    progPct = Math.max(4, Math.min(96, Math.round(((avg - prev.score) / span) * 100)));
    nextTxt = "距离「" + nextT.title + "」还需 " + Math.max(1, nextT.score - avg) + "%";
  } else {
    progPct = 100;
    nextTxt = "基础称号已满 · 冲击专家方向";
  }

  // 最近动态（考核 + 面试合并，按时间取最近 3）
  const modeLabel = (m) => (typeof MODE_LABEL !== "undefined" && MODE_LABEL[m]) ? MODE_LABEL[m] : (m || "");
  const recentItems = [
    ...(state.history || []).map((h) => ({ date: h.date, label: modeLabel(h.mode), val: h.pct != null ? h.pct + " 分" : "", fn: "showHistory()" })),
    ...(state.interviewLogs || []).slice(0, 8).map((l) => ({ date: l.date, label: "面试 · " + (l.job || ""), val: l.score != null ? l.score + " 分" : "评分失败", fn: "showInterviewHistory()" })),
  ].filter((x) => x.date).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3);
  const recentHtml = recentItems.length
    ? recentItems.map((r) => `
      <div class="home-recent-item" onclick="${r.fn}">
        <span style="color:var(--text-1)">${esc(r.label)}</span>
        <span style="display:flex;align-items:center;gap:8px">
          <span style="font-family:var(--mono);color:${String(r.val).includes("失败") ? "var(--danger)" : "var(--accent)"}">${esc(r.val)}</span>
          <span style="font-size:10.5px;color:var(--text-2)">${String(r.date).slice(5, 16).replace("T", " ")}</span>
        </span>
      </div>`).join("")
    : `<div style="font-size:12px;color:var(--text-2);text-align:center;padding:16px 0">暂无考核 / 面试记录 · 完成第一次考核后显示在这里</div>`;

  // 下一步推荐（复用快速开始引导逻辑）
  const nextId = guideNextStepId();
  const nextStep = nextId
    ? ((GUIDE_STEPS.find((s) => s.id === nextId) || {}).title || "继续提升")
    : "全部完成，继续保持！";

  // 产品功能 Showcase 四卡（静态示例）
  const showcase = buildShowcaseHTML();

  // Hero 演示雷达的 HTML 图例：10 条，色点颜色与雷达顶点一一对应
  const demoLegend = ABILITIES.map((ab, i) => {
    const v = HOME_EXAMPLE_PCT[ab] ?? 0;
    const c = HOME_LEGEND_COLORS[i % HOME_LEGEND_COLORS.length];
    return `
      <div class="dl-row">
        <span class="dl-dot" style="background:${c};box-shadow:0 0 6px ${c}cc"></span>
        <span class="dl-name">${esc(ab)}</span>
        <span class="dl-val" style="color:${c}">${v}%</span>
      </div>`;
  }).join("");

  render(() => {
    const demo = document.getElementById("home-demo-canvas");
    if (demo) drawRadarProfile(HOME_EXAMPLE_PCT, "#home-demo-canvas", { noLabels: true, vertexColors: HOME_LEGEND_COLORS });
    const pc = document.getElementById("home-profile-canvas");
    if (pc && profileKeys.length) drawRadarProfile(profilePct, "#home-profile-canvas");
  }, `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--border)">
      <div style="font-size:12px;color:var(--accent-2);font-family:var(--mono);letter-spacing:1px;display:flex;align-items:center;gap:7px"><span style="color:#ff3df0">&gt;_</span> SYSTEM // AI 技能考核中心 · AI Job Skill Gauntlet</div>
      <div style="font-size:11.5px;color:var(--text-2);font-family:var(--mono);display:flex;align-items:center;gap:9px">👤 ${esc(displayName())}<span style="color:var(--border)">|</span>${LLM_KEY ? icon("robot") + " " + esc(LLM_MODEL || "deepseek-v4-flash") : "⚠️ 未配置 LLM"}</div>
    </div>

    <!-- ① Hero：价值主张 + 双 CTA + 演示雷达 -->
    <div class="home-hero">
      <div class="home-hero-left">
        <!-- 信息层级：LLM 驱动主张(最大) → 全流程说明 → 特性标签 → 行动按钮 -->
        <!-- 把 LLM 变成考官：考官规则由产品设计定义，LLM 在规则内执行 -->
        <div class="home-tagline">把 <span class="gt-em">大模型</span> 变成考官，为你的技能把关</div>
        <div class="home-sub">由 LLM 驱动的动态 AI 考核系统。</div>
        <div class="home-value">
          <span class="hv-item">动态出题</span>
          <span class="hv-item">面试追问</span>
          <span class="hv-item">代码实战</span>
          <span class="hv-item">能力评估</span>
        </div>
        <div class="home-cta">
          <button class="exam-btn primary" style="padding:12px 26px;font-size:15px" onclick="showQuickStart()">${icon("rocket")} 快速开始</button>
          <button class="exam-btn" style="padding:12px 22px;font-size:14px" onclick="showImportPanel()">${icon("upload")} 导入我的资料</button>
        </div>
      </div>
      <div class="home-hero-right">
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
          <div style="text-align:center">
            <canvas id="home-demo-canvas" width="340" height="340"></canvas>
            <div class="radar-tag">十维能力雷达 · 示例</div>
          </div>
          <div class="demo-legend">${demoLegend}</div>
        </div>
      </div>
    </div>

    ${!LLM_KEY ? `
    <div class="card" style="margin-bottom:18px;padding:13px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;border-color:rgba(255,61,240,0.35);background:linear-gradient(90deg,rgba(255,61,240,0.07),rgba(176,38,255,0.05))">
      <div style="font-size:13px;color:var(--text-1)">${icon("lightbulb", "lg")} <strong style="color:var(--accent-2)">提示</strong>：出题、判分、面试由 LLM 驱动，请先在「设置」配置 API Key 后即可开始考核。</div>
      <button class="exam-btn" style="padding:7px 16px;font-size:13px" onclick="showSettings()">${icon("settings")} 去设置</button>
    </div>` : ""}

    <!-- ② 产品功能 Showcase（静态示例演示，不依赖 LLM/数据） -->
    <h3 class="section-title" style="margin:0 0 12px">${icon("sparkles", "lg")} 产品功能展示</h3>
    <div class="showcase-grid">
      ${showcase}
    </div>

    <!-- ③ 我的数据 -->
    <div class="card" style="margin-bottom:18px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <h3 class="section-title" style="margin:0">${icon("radar", "lg")} 我的能力画像</h3>
        <button class="exam-btn ghost" style="padding:5px 12px;font-size:12px" onclick="showAssessment()">查看详情 ${icon("arrow-right")}</button>
      </div>
      ${profileKeys.length ? `
      <div class="home-data">
        <div class="radar-wrap" style="margin:0"><canvas id="home-profile-canvas" width="420" height="340"></canvas></div>
        <div>
          <div style="font-size:12px;color:var(--text-1);margin-bottom:8px;font-family:var(--mono);letter-spacing:1px">RECENT // 最近动态</div>
          <div class="home-recent">${recentHtml}</div>
          <div style="margin-top:12px;font-size:11px;color:var(--text-2)">基于 ${state.exams} 次考核 · ${state.imports} 份导入资料</div>
        </div>
      </div>` : `
      <div style="text-align:center;padding:24px 16px">
        <div style="font-size:34px;margin-bottom:8px;opacity:0.85">🧬</div>
        <div style="font-size:14px;font-weight:700;color:var(--text-1);margin-bottom:6px">暂无能力画像</div>
        <div style="font-size:12.5px;color:var(--text-2);line-height:1.8;margin-bottom:14px">完成任意一次考核后，这里将生成你的十维能力雷达图与最近动态。</div>
        <button class="exam-btn primary" onclick="showQuickStart()">${icon("rocket")} 快速开始第一步</button>
      </div>`}
    </div>

    <!-- ④ 成长激励条 -->
    <div class="card home-motivate">
      <div style="font-size:26px;line-height:1">${curTitle.icon}</div>
      <div class="mot-prog">
        <div class="mot-top">
          <span>Lv.${curIdx + 1} ${curTitle.title} · 画像 ${avg}%</span>
          <span style="color:var(--accent-2)">${nextTxt}</span>
        </div>
        <div class="mot-track"><div class="mot-fill" style="width:${progPct}%"></div></div>
      </div>
      <div class="mot-stats">
        <span>🔥 连击 <b>${state.streak || 0} 天</b></span>
        <span>🏅 徽章 <b>${unlocked}/${BADGES.length}</b></span>
        <span>💎 AP <b>${ap}</b></span>
        <span>🎯 下一步：<b>${nextStep}</b></span>
      </div>
    </div>
  `);
  updateGamestat();   // C1：回到首页时刷新顶栏状态
}

/* 首页 Showcase 四卡（静态示例演示，Show don't tell） */
function buildShowcaseHTML() {
  const theory = `
    <div class="sc-card" onclick="showExamIntro('theory')">
      <div class="sc-head">${icon("brain", "lg")}<div><div class="sc-title">理论考核</div><div class="sc-sub">概念 / 原理 / 判断等客观知识题</div></div></div>
      <div class="sc-preview">
        <div class="sc-question">${esc(HOME_EXAMPLES.theory.q)}</div>
        ${HOME_EXAMPLES.theory.opts.map((o, i) => `<div class="sc-opt${i === 0 ? " hot" : ""}">${i === 0 ? "✓ " : ""}${esc(o)}</div>`).join("")}
      </div>
      <div class="sc-foot">进入理论考核 ${icon("arrow-right")}</div>
    </div>`;
  const practical = `
    <div class="sc-card" onclick="showExamIntro('practical')">
      <div class="sc-head">${icon("code", "lg")}<div><div class="sc-title">实战考核</div><div class="sc-sub">代码实战客观题（作用 / 输出 / Bug）</div></div></div>
      <div class="sc-preview">
        <div class="sc-code"><span class="hl"># ${esc(HOME_EXAMPLES.code.file)}</span>
${esc(HOME_EXAMPLES.code.code)}</div>
        <div class="sc-question" style="margin-bottom:0">${esc(HOME_EXAMPLES.code.q)}</div>
      </div>
      <div class="sc-foot">进入实战考核 ${icon("arrow-right")}</div>
    </div>`;
  const interview = `
    <div class="sc-card" onclick="showExamIntro('interview')">
      <div class="sc-head">${icon("messages-square", "lg")}<div><div class="sc-title">面试考核</div><div class="sc-sub">AI 面试官仿真对话 · 严格追问</div></div></div>
      <div class="sc-preview">
        <div class="sc-chat">
          ${HOME_EXAMPLES.chat.map((c) => `<div class="sc-bubble ${c.role === "me" ? "me" : "iv"}">${esc(c.text)}</div>`).join("")}
        </div>
      </div>
      <div class="sc-foot">进入面试考核 ${icon("arrow-right")}</div>
    </div>`;
  const profile = `
    <div class="sc-card" onclick="showAssessment()">
      <div class="sc-head">${icon("radar", "lg")}<div><div class="sc-title">能力画像</div><div class="sc-sub">十维雷达 · 岗位匹配 · 等级称号</div></div></div>
      <div class="sc-preview">
        <div class="sc-bars">
          ${HOME_EXAMPLES.bars.map((b) => `<div class="sc-bar"><span class="nm">${esc(b.ab)}</span><div class="track"><div class="fill" style="width:${b.v}%"></div></div><span style="width:30px;text-align:right">${b.v}%</span></div>`).join("")}
        </div>
      </div>
      <div class="sc-foot">查看能力画像 ${icon("arrow-right")}</div>
    </div>`;
  return theory + practical + interview + profile;
}

function saveLLMSettings() {
  const k = $("#llm-key-input"), b = $("#llm-base-input"), m = $("#llm-model-input");
  if (!k || !b || !m) return;
  setLLMConfig(k.value, b.value, m.value);
  Logger.info("settings.save", "LLM 设置已保存", { hasKey: !!k.value, base: b.value || "(默认)", model: m.value || "deepseek-v4-flash" });
  // 保存后重渲染设置页，顶部摘要显示已保存的模型名 + 地址
  showSettings();
  showToast(LLM_KEY ? `已保存：${LLM_MODEL || "deepseek-v4-flash"}` : "⚠️ 已清除 LLM 配置（需配置后才能考核）");
}

/* ===== 设置 ===== */
function showSettings() {
  setNavActive("settings");
  render(null, `
    <button class="exam-btn ghost" onclick="goHome()" style="margin-bottom:18px">← 返回</button>
    <h2 class="section-title">${icon("settings", "lg")} 设置</h2>

    <div class="card" style="margin-bottom:14px">
      <div style="font-size:14px;font-weight:700;margin-bottom:10px;color:var(--accent)">${icon("robot", "lg")} LLM 出题引擎（必需）</div>
      <div style="font-size:12.5px;margin-bottom:12px;padding:9px 12px;border-radius:8px;${LLM_KEY ? "background:rgba(47,214,181,0.08);border:1px solid rgba(47,214,181,0.3);color:#2fd6b5" : "background:rgba(255,255,255,0.03);border:1px solid var(--border);color:var(--text-2)"}">
        ${LLM_KEY
          ? `✅ 当前生效：<strong>${esc(LLM_MODEL || "deepseek-v4-flash")}</strong> @ ${esc(LLM_BASE || "https://api.deepseek.com")}`
          : "⚠️ 未配置 LLM（无法考核）"}
      </div>
      <div style="font-size:11.5px;color:var(--text-1);line-height:1.8;margin-bottom:10px">
        本系统的出题、题目能力打标签、语义判分、岗位匹配均由 LLM 驱动，理论 / 实战 / 面试三种考核都需要先配置 API Key。<br>
        <span style="color:var(--accent-3)">🔒 隐私保护：API Key 只保存在你自己的浏览器，由浏览器直连 API 服务（支持 DeepSeek 官方或中转站）。</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:9px">
        <input type="text" id="llm-base-input" value="${esc(LLM_BASE)}" placeholder="API 地址（留空=官方 DeepSeek）https://api.deepseek.com" style="width:100%;padding:10px 14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:9px;color:var(--text-0);font-size:13px;outline:none">
        <div style="display:flex;gap:9px">
          <input type="password" id="llm-key-input" value="${esc(LLM_KEY)}" placeholder="API Key (sk-...)" style="flex:1;padding:10px 14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:9px;color:var(--text-0);font-size:13px;outline:none">
          <input type="text" id="llm-model-input" value="${esc(LLM_MODEL)}" placeholder="模型名 (deepseek-v4-flash)" style="flex:1;padding:10px 14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:9px;color:var(--text-0);font-size:13px;outline:none">
        </div>
        <div style="display:flex;gap:9px">
          <button class="exam-btn primary" onclick="saveLLMSettings()">${icon("save")} 保存设置</button>
          <button class="exam-btn ghost" onclick="testLLMConnection()">${icon("zap")} 测试连接</button>
        </div>
        <div style="display:flex;gap:9px;align-items:center;margin-top:2px">
          <button class="exam-btn ghost" onclick="readLocalLLMEnv()">${icon("search")} 从本机环境读取 Key</button>
          <span style="font-size:10.5px;color:var(--text-2)">可选：读取本机环境变量（如 DASHSCOPE_API_KEY / DEEPSEEK_API_KEY）自动填入，需手动点「保存」生效。</span>
        </div>
      </div>
      <div style="font-size:10.5px;color:var(--text-2);margin-top:8px;font-family:var(--mono)">Key 仅存于本机 localStorage，LLM 请求由浏览器直发。</div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div style="font-size:14px;font-weight:700;margin-bottom:10px;color:var(--accent)">${icon("user", "lg")} 用户信息</div>
      <div style="font-size:12.5px;color:var(--text-1);line-height:2">
        <div>用户名（昵称）</div>
        <div style="display:flex;gap:9px;margin:4px 0 10px">
          <input type="text" id="nickname-input" value="${esc(NICKNAME)}" placeholder="例如：小明 / 阿强" maxlength="20" style="flex:1;padding:10px 14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:9px;color:var(--text-0);font-size:13px;outline:none">
          <button class="exam-btn primary" onclick="saveNickname()">${icon("save")} 保存</button>
        </div>
        <div>用户 ID：<span style="font-family:var(--mono);color:var(--accent-2)">${esc(UID)}</span></div>
        <div style="font-size:11.5px;color:var(--text-2)">昵称仅用于界面显示与对话称呼，不影响用户 ID（数据仍按 ID 隔离存储）。</div>
      </div>
    </div>

    <div class="card">
      <div style="font-size:14px;font-weight:700;margin-bottom:10px;color:var(--accent)">${icon("trash-2", "lg")} 数据管理</div>
      <div style="display:flex;gap:9px;flex-wrap:wrap">
        <button class="exam-btn" onclick="clearWrongBook()">清空错题本</button>
        <button class="exam-btn" onclick="resetAllData()" style="color:#ff6b6b;border-color:#ff6b6b">${icon("alert-triangle")} 重置全部数据</button>
      </div>
      <div style="font-size:11px;color:var(--text-2);margin-top:8px">重置会清空考核记录、徽章、错题本、资料目录、课程库、昵称，以及 LLM 配置，恢复到初始状态。</div>
    </div>`);
}

/* 从本机环境变量读取 LLM API Key（可选功能）：由本地服务器读 os.environ，Key 不离开本机 */
async function readLocalLLMEnv() {
  try {
    const res = await fetch("/api/llm-env");
    const data = await res.json().catch(() => ({}));
    const found = (data && data.found) || [];
    if (!found.length) {
      showToast("⚠️ 未在本机环境变量中检测到 LLM API Key（如 DASHSCOPE_API_KEY / DEEPSEEK_API_KEY）");
      return;
    }
    if (found.length === 1) {
      applyLocalLLMEnv(found[0]);
      return;
    }
    // 多个：让用户选一个
    showModal({
      icon: "🔑",
      title: "检测到多个本机 LLM Key",
      text: "请选择要填入的一个（不会自动保存，选定后请点「保存设置」）：",
      actions: found.map((f) => ({
        label: `${f.label}（${f.env}）`,
        primary: f.env === "DASHSCOPE_API_KEY" || f.env === "DEEPSEEK_API_KEY",
        onClick: () => applyLocalLLMEnv(f),
      })),
    });
  } catch (e) {
    showToast("⚠️ 读取本机环境失败：" + (e && e.message ? e.message : e));
  }
}

function applyLocalLLMEnv(f) {
  // S-2 加固：服务器默认只返回掩码 Key；用户确认后才带 full=1 读取完整 Key（仅本机浏览器使用）
  showModal({
    icon: "🔑",
    title: "读取本机 LLM Key？",
    text: `将从本机环境读取「${f.env}」的完整 API Key 并填入浏览器。Key 仅保存在本机浏览器 localStorage，不会上传服务器。`,
    actions: [
      { label: "取消", onClick: () => {} },
      { label: "读取并填入", primary: true, onClick: async () => {
        try {
          const res = await fetch("/api/llm-env?full=1");
          const data = await res.json().catch(() => ({}));
          const full = ((data && data.found) || []).find((x) => x.env === f.env);
          const base = $("#llm-base-input"), key = $("#llm-key-input"), model = $("#llm-model-input");
          if (full && full.key && key) {
            if (base && full.base) base.value = full.base;
            key.value = full.key;
            if (model && full.model) model.value = full.model;
            showToast(`🔑 已从 ${f.env} 读取，请点「保存设置」确认生效`);
          } else {
            showToast("⚠️ 读取失败，请检查环境变量");
          }
        } catch (e) {
          showToast("⚠️ 读取失败：" + (e && e.message ? e.message : e));
        }
      } },
    ],
  });
}

function saveNickname() {
  const inp = $("#nickname-input");
  if (!inp) return;
  NICKNAME = inp.value.trim().slice(0, 20);
  saveIdentity();
  // 同步昵称到服务器 profile，换浏览器也一致
  state.nickname = NICKNAME;
  saveState();
  showToast(NICKNAME ? `✅ 用户名已设为「${NICKNAME}」` : "✅ 已清除用户名（显示为「同学」）");
  // 更新设置页里顶部 UID 行的显示无需刷新，直接重渲染设置页
  showSettings();
}

function testLLMConnection() {
  const key = ($("#llm-key-input") || {}).value || LLM_KEY;
  const base = ($("#llm-base-input") || {}).value || LLM_BASE;
  const model = ($("#llm-model-input") || {}).value || LLM_MODEL;
  if (!key) { showToast("⚠️ 请先填写 API Key"); return; }
  const url = (base || "https://api.deepseek.com").replace(/\/+$/, "") + "/chat/completions";
  Logger.info("settings.test-llm", "测试 LLM 连接", { base: base || "(默认)", model: model || "deepseek-v4-flash" });
  showToast("🔌 正在测试连接…");
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
    body: JSON.stringify({ model: model || "deepseek-v4-flash", messages: [{ role: "user", content: "hi" }], max_tokens: 5 }),
  }).then(async (r) => {
    const txt = await r.text().catch(() => "");
    let ok = false;
    let errMsg = "";
    if (r.ok) {
      // 即使 HTTP 200，也要验证 body 是成功的聊天响应（含 choices），避免误判
      try {
        const data = JSON.parse(txt);
        if (data.error) errMsg = data.error.message || data.error.code || "API 返回错误";
        else if (data.choices && data.choices.length) ok = true;
        else errMsg = "响应缺少 choices（可能地址填错或非 OpenAI 兼容接口）";
      } catch (e) {
        errMsg = "响应不是 JSON（可能地址填错，返回了网页）";
      }
    } else {
      // HTTP 错误：从 body 提取错误信息
      try {
        const data = JSON.parse(txt);
        errMsg = (data.error && (data.error.message || data.error.code)) || txt || (r.status + " " + r.statusText);
      } catch (e) {
        errMsg = txt || (r.status + " " + r.statusText);
      }
    }
    if (ok) { Logger.info("settings.test-llm-ok", "LLM 连接成功"); showToast("✅ 连接成功，API 可用"); return; }
    Logger.error("settings.test-llm-fail", "LLM 连接失败: " + errMsg.slice(0, 150), { status: r.status });
    showToast("❌ 连接失败：" + errMsg.slice(0, 150));
  }).catch((e) => { Logger.error("settings.test-llm-fail", "LLM 连接网络错误: " + e.message); showToast("❌ 网络错误：" + e.message); });
}

async function resetAllData() {
  if (!confirm("确定要彻底重置所有数据吗？将清空：考核记录、徽章、错题本、资料目录、课程库、昵称，以及 LLM 配置。此操作不可撤销。\n\n⚠️ 请先关闭本应用的其他窗口/标签页，重置期间在其他窗口操作可能被重置覆盖。")) return;
  Logger.warn("profile.reset", "用户请求重置全部数据");
  // 1. 先重置内存状态（含昵称、课程、LLM）——之后的任何 saveState 都只会保存空 state
  state = { nickname: "", xp: 0, level: 1, exams: 0, bestCombo: 0, lastScore: 0, bestInterview: 0, crossExam: false, practicalDone: false, modesDone: [], streak: 0, bestStreak: 0, lastStudyDay: "", abilityBest: {}, abilityProfile: {}, imports: 0, history: [], wrongBook: [], interviewLogs: [], jobExtraQuestions: {}, askedLog: {} };
  NICKNAME = "";
  LLM_KEY = ""; LLM_BASE = ""; LLM_MODEL = "";
  COURSE = null;
  // 2. 清空浏览器 localStorage（昵称、LLM 配置、state、uid 缓存；保留 llmGuided，欢迎弹窗严格只出现一次）
  try {
    ["examCenter.uid", "examCenter.nickname", "examCenter.llmKey", "examCenter.llmBase", "examCenter.llmModel", "examCenter.v1"].forEach((k) => localStorage.removeItem(k));
  } catch (e) { /* ignore */ }
  // 3. 清空服务器端数据（当前课程、课程库、资料目录、档案、导入存档）+ 写 reset-ts 墓碑
  try {
    await fetch("./api/reset-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: UID }),
    });
  } catch (e) { /* ignore */ }
  // 4. 同步空 state 落盘（clientTs 晚于 reset-ts，正常写入空 profile.json）——
  //    同时挡住「重置前挂起的旧 saveState 请求晚到写回旧数据」（服务端按 clientTs < reset-ts 丢弃）
  try { await saveState(); } catch (e) { /* ignore */ }
  showToast("✅ 已彻底重置，恢复到初始状态");
  // 重新加载，回到全新用户状态（重新获取 uid、加载空数据）
  setTimeout(() => location.reload(), 900);
}

/* ===== 资料导入 ===== */
function showImportPanel() {
  setNavActive("import");
  // LLM 是出题主力，未配置则阻止导入（与「LLM 驱动」一致）
  if (!LLM_KEY) {
    showModal({
      iconHtml: icon("robot"),
      title: "导入资料需要 LLM",
      text: "导入时由 LLM 生成考核题（理论客观题 + 代码实战客观题），去重后存入本章题库，并为对应岗位提炼面试参考题。未配置 LLM 无法生成考核题。请先配置 API Key（支持 DeepSeek、阿里百炼等 OpenAI 兼容接口）。",
      actions: [
        { label: "⚙️ 去设置", primary: true, onClick: () => showSettings() },
        { label: "先不了", onClick: () => {} },
      ],
    });
    return;
  }
  render(null, `
    <button class="exam-btn ghost" onclick="goHome()" style="margin-bottom:18px">← 返回</button>
    <h2 class="section-title">${icon("upload", "lg")} 导入资料</h2>
    <div class="card">
      <div class="drop-zone" id="import-drop">
        <div class="dz-icon">📁</div>
        <div class="dz-title">拖拽文件或文件夹到这里</div>
        <div class="dz-sub">系统自动识别笔记、代码、数据等文件并出题</div>
        <div style="display:flex;gap:12px;justify-content:center;margin-top:16px;flex-wrap:wrap">
          <button class="exam-btn primary" onclick="document.getElementById('import-folder').click()">${icon("folder-open")} 导入文件夹</button>
          <button class="exam-btn" onclick="document.getElementById('import-file').click()">${icon("file-text")} 导入文件</button>
        </div>
        <input type="file" id="import-file" multiple style="display:none" onchange="handleImportFile(this.files)">
        <input type="file" id="import-folder" webkitdirectory directory style="display:none" onchange="handleImportFolder(this.files)">
      </div>
      <div class="parse-status" id="import-status"></div>
    </div>`);
  // 拖拽支持（文件夹 + 文件）
  const dz = $("#import-drop");
  if (dz) {
    dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("drag"); });
    dz.addEventListener("dragleave", () => dz.classList.remove("drag"));
    dz.addEventListener("drop", (e) => {
      e.preventDefault();
      dz.classList.remove("drag");
      const items = e.dataTransfer.items;
      // 收集所有顶层条目（文件 + 文件夹）
      const entries = [];
      if (items && items.length) {
        for (const it of items) {
          const getEntry = it.webkitGetAsEntry ? it.webkitGetAsEntry.bind(it) : (it.getAsEntry ? it.getAsEntry.bind(it) : null);
          if (getEntry) {
            const entry = getEntry();
            if (entry) entries.push(entry);
          }
        }
      }
      if (entries.length) {
        // 递归读取所有条目（文件夹递归展开，文件直接收集）
        const allFiles = [];
        let pending = entries.length;
        const doneOne = () => { if (--pending === 0) handleImportFileList(allFiles); };
        entries.forEach((entry) => {
          readDirEntries(entry, (file) => allFiles.push(file), doneOne);
        });
        return;
      }
      // 兜底：某些浏览器不支持 items → 用 files（但文件夹内容可能不完整）
      const files = e.dataTransfer.files;
      if (files && files.length) handleImportFile(files);
    });
  }
}

/* 递归读取文件夹中的所有文件（File System API，兼容 webkit 前缀），保留相对路径 */
function readDirEntries(entry, onFile, onDone, relPath) {
  relPath = relPath || "";
  if (!entry) { onDone(); return; }
  if (entry.isFile) {
    entry.file((f) => { f._relPath = relPath + f.name; onFile(f); onDone(); }, onDone);
    return;
  }
  if (!entry.isDirectory) { onDone(); return; }
  const reader = entry.createReader();
  const allEntries = [];
  // readEntries 每次最多返回 100 条，需循环读取直到空
  const readBatch = () => {
    reader.readEntries((entries) => {
      if (!entries.length) {
        // 本目录所有条目已读完，逐个处理（文件→onFile；子目录→递归）
        let pending = allEntries.length;
        if (!pending) { onDone(); return; }
        const doneOne = () => { if (--pending === 0) onDone(); };
        allEntries.forEach((ent) => {
          if (ent.isFile) {
            ent.file((f) => { f._relPath = relPath + f.name; onFile(f); doneOne(); }, doneOne);
          } else if (ent.isDirectory) {
            readDirEntries(ent, onFile, doneOne, relPath + ent.name + "/");
          } else {
            doneOne();
          }
        });
        return;
      }
      allEntries.push(...entries);
      readBatch();
    }, onDone);
  };
  readBatch();
}

/* 文件类型识别 */
const TEXT_EXTS = /\.(md|markdown|txt|py|js|ts|jsx|tsx|java|c|cpp|h|go|rs|rb|php|sh|bash|json|yaml|yml|toml|ini|cfg|conf|xml|html|htm|css|scss|less|csv|tsv|log|sql|ipynb)$/i;
// 附带产物目录：这些目录下的文件是课程练习的产物/缓存，不作为学习内容出题
const ARTIFACT_DIRS = /(^|\/)(outputs?|cache|dist|build|node_modules|__pycache__|\.git|\.venv|venv|target|tmp|temp)(\/|$)/i;
function fileKind(name) {
  // 产物/缓存目录 → 不出题（仅挂进文件清单）
  if (ARTIFACT_DIRS.test(name)) return "artifact";
  if (/\.(md|markdown)$/i.test(name)) return "note";        // 学习笔记 → 主出题
  if (/\.(py|js|ts|jsx|tsx|java|c|cpp|h|go|rs|rb|php|sh|bash)$/i.test(name)) return "code"; // 代码 → 实战题
  if (/\.(json|yaml|yml|toml|ini|cfg|conf|xml|csv|tsv|sql)$/i.test(name)) return "data";    // 数据/配置 → 辅助资料
  return "text";                                            // 其他文本
}
function isTextFile(name) {
  return TEXT_EXTS.test(name);
}

/* 处理：单个文件 / 多文件（自动过滤可处理文件） */
async function handleImportFile(files) {
  const list = files && files.length ? [...files] : [files];
  const mdList = list.filter((f) => isTextFile(f.name));
  if (!mdList.length) {
    showToast("⚠️ 没有找到可处理的文件（.md/.txt/.py/.json 等）");
    return;
  }
  await handleImportFileList(mdList);
}

/* 处理：文件夹（自动递归扫描所有文本类文件） */
async function handleImportFolder(files) {
  const list = files && files.length ? [...files] : [];
  const textList = list.filter((f) => isTextFile(f.name));
  if (!textList.length) {
    showToast("⚠️ 文件夹里没有可处理的文本文件");
    return;
  }
  const notes = textList.filter((f) => fileKind(f.name) === "note").length;
  const others = textList.length - notes;
  showToast(`📁 发现 ${textList.length} 个文件（${notes} 笔记 + ${others} 代码/数据），开始导入…`);
  await handleImportFileList(textList);
}

async function reportDebug(tag, payload) {
  // 统一日志上报：批量走 Logger → /api/log → 用户 activity.log（旧 tag 与调用点全部兼容）
  // 级别映射（评审 C）：失败事件必须能按 level 过滤，不能被 info 淹没
  let level = "info";
  if (/fail|error/.test(tag)) level = "error";
  else if (/retry|empty|partial/.test(tag)) level = "warn";
  Logger[level](tag, "", payload);
}


/* ===== LLM 约束化输出（Agently 式）：统一 JSON 格式约束 + 校验失败反馈重出 ===== */
// 所有 LLM 出题交互统一走 llmJSON：prompt 尾部附加标准格式约束；解析出题数不足时把校验错误反馈给 LLM 重新输出（最多 maxRetries 次）
const JSON_FORMAT_HINT = `【输出格式要求（程序会严格校验，不满足会要求你重新输出）】
1. 只输出一个 JSON 对象：顶层必须有 questions 数组
2. 不要 markdown 代码块（不要用三个反引号包裹 JSON），不要任何解释、前后缀、多余文字
3. 每道题严格按上面给出的 JSON 模板逐字段填写，字段名一个都不能改
4. 字符串用英文双引号，数组用方括号，数量必须达到要求，不要少出
5. 实在无法生成时输出 {"questions": []}`;

const INTERVIEW_JSON_HINT = `【输出格式要求（程序会严格校验，不满足会要求你重新输出）】
1. 只输出一个 JSON 对象，不要 markdown 代码块（不要用三个反引号包裹），不要任何解释、前后缀文字
2. 字段名严格按上面要求输出，一个都不能改
3. 字符串用英文双引号`;

/* 判分 / 组卷 / job 出题场景的输出格式约束（数据统一方案 P1：6 处直接 fetch 迁移 llmJSON 后统一生效） */
const GRADE_JSON_HINT = `【输出格式要求（程序会严格校验，不满足会要求你重新输出）】
1. 只输出一个 JSON 对象：{"score": 0-100 的整数, "feedback": "一两句反馈（亮点+不足+改进建议）"}
2. 不要 markdown 代码块，不要任何解释、前后缀文字
3. 字符串用英文双引号`;
const FILL_JSON_HINT = `【输出格式要求（程序会严格校验，不满足会要求你重新输出）】
1. 只输出一个 JSON 对象：{"correct": true 或 false, "reason": "一句话判定理由"}
2. 不要 markdown 代码块，不要任何解释、前后缀文字
3. 字符串用英文双引号`;
const PICK_JSON_HINT = `【输出格式要求（程序会严格校验，不满足会要求你重新输出）】
1. 只输出一个 JSON 对象：{"picks": [编号数组]}，编号取自候选题列表行首数字
2. 不要 markdown 代码块，不要任何解释、前后缀文字
3. 字符串用英文双引号`;
const JOB_JSON_HINT = `【输出格式要求（程序会严格校验，不满足会要求你重新输出）】
1. 只输出一个 JSON 对象：{"jobName": "岗位名", "questions": [题目数组]}
2. 不要 markdown 代码块，不要任何解释、前后缀文字
3. 字符串用英文双引号`;

async function llmJSON(opts) {
  // opts: { system, prompt, formatHint, minCount, maxRetries, part, maxTokens, expect }
  // expect: "questions"（默认）返回题目数组（归一化+校验）；"object" 返回任意解析成功的 JSON 对象（面试出题/追问/评分）
  // 两者都带校验失败反馈重出（Agently custom() 机制）
  if (!LLM_KEY) return [];
  const base = String(LLM_BASE || "https://api.deepseek.com").replace(/\/+$/, "");
  const model = LLM_MODEL || "deepseek-v4-flash";
  const maxTokens = opts.maxTokens || (opts.part === "theory" ? 4500 : opts.part === "practical" ? 7000 : 10000);
  const system = opts.system || SYSTEM.examiner;
  const prompt = opts.prompt || "";
  const formatHint = opts.formatHint || JSON_FORMAT_HINT;
  const minCount = opts.minCount || 0;
  // 注：minCount 已是最低可用量（8/5），数量不足由「反馈重出 + lastNonEmpty 有多少收多少」兜底
  const maxRetries = opts.maxRetries || 3;
  const part = opts.part || "all";
  const expect = opts.expect || "questions";
  const validateObj = opts.validateObj || null;   // expect=object 时的校验函数（返回错误信息或 null）
  const temperature = opts.temperature || 0.8;    // 评分等场景可降低温度
  let curPrompt = prompt + "\n\n" + formatHint;
  let lastErr = null;
  let lastNonEmpty = null;   // 最后一次非空结果：数量不足且重试耗尽时「有多少收多少」
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    reportDebug("llm-start", { part, attempt, model, base, promptLen: curPrompt.length });
    const doFetch = (withFormat) => fetch(base + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + LLM_KEY },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: curPrompt },
        ],
        temperature: temperature,
        max_tokens: maxTokens,
        ...(withFormat ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    // 429/5xx/网络错误自动重试（最多 3 次，间隔递增）
    let res = null;
    for (let a = 1; a <= 3; a++) {
      try {
        res = await doFetch(true);
        if (res.ok) break;
        if (res.status === 429 || res.status >= 500) {
          reportDebug("llm-retry", { part, attempt, status: res.status });
          await new Promise((r) => setTimeout(r, 1200 * a));
          continue;
        }
        break;
      } catch (e) {
        if (a === 3) { lastErr = e; break; }
        reportDebug("llm-net-retry", { part, attempt, err: String(e) });
        await new Promise((r) => setTimeout(r, 1200 * a));
      }
    }
    if (!res || !res.ok) {
      // 400：中转站可能不支持 response_format，去掉该字段重试一次
      if (res && res.status === 400) {
        try {
          const res2 = await doFetch(false);
          if (res2.ok) {
            const data2 = await res2.json();
            const qs2 = extractLLMQuestions(data2);
            reportDebug("llm-ok", { part, attempt, count: qs2.length });
            if (qs2.length) lastNonEmpty = qs2;
            if (qs2.length >= minCount) return qs2;

            lastErr = new Error("解析出 " + qs2.length + " 题（要求 " + minCount + "）");
            curPrompt = prompt + "\n\n" + formatHint + "\n\n【修正要求】上一次输出未通过程序校验：" + lastErr.message + "。常见问题：markdown 代码块包裹 JSON、字段名不符、少出题。请严格按【输出格式要求】重新输出完整 JSON（不要代码块，不要多余文字），数量必须达标。";
            continue;
          }
        } catch (e2) {}
      }
      const errTxt = res ? (await res.text().catch(() => "")) : "";
      lastErr = new Error("API 返回 " + (res ? res.status : "无响应") + (errTxt ? "：" + errTxt.slice(0, 120) : ""));
      reportDebug("llm-fail", { part, attempt, msg: lastErr.message });
      throw lastErr;
    }
    const data = await res.json();
    const rawContent = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
    if (expect === "object") {
      // 空响应 = 服务限流/异常：最多重试 2 次，不空转
      if (!rawContent.length) {
        reportDebug("llm-empty", { part, attempt });
        if (attempt >= 3) {
          lastErr = new Error("LLM 返回空内容（服务可能限流），已重试 " + attempt + " 次");
          reportDebug("llm-fail", { part, msg: lastErr.message });
          throw lastErr;
        }
        await new Promise((r) => setTimeout(r, 2500 * attempt));   // 退避：2.5s / 5s，给限流恢复时间
        continue;
      }
      // 通用对象模式：解析成功且通过校验即返回（面试出题/追问/评分）
      const parsedObj = parseLLMJSON(rawContent);
      const validErr = (parsedObj && validateObj) ? validateObj(parsedObj) : null;
      if (parsedObj && !validErr) {
        reportDebug("llm-ok", { part, attempt, count: 1, rawLen: rawContent.length });
        return parsedObj;
      }
      lastErr = new Error(validErr || "JSON 解析失败");
      reportDebug("llm-fail", { part, attempt, msg: lastErr.message, contentHead: rawContent.slice(0, 800) });
      curPrompt = prompt + "\n\n" + formatHint + "\n\n【修正要求】你上一次的输出未能通过程序校验：" + lastErr.message + "。请严格按【输出格式要求】重新输出完整 JSON（不要 markdown 代码块，不要多余文字）。";
      continue;
    }
    // 空响应（rawLen 0）= 服务限流/异常，重出大概率也空：最多重试 2 次（间隔 1.5s），不空转 3 次
    if (!rawContent.length) {
      reportDebug("llm-empty", { part, attempt });
      if (attempt >= 3) {
        // 服务限流：不再 throw（否则理论题会被实战空响应连坐全丢）——返回已有（宁缺毋滥），主流程软处理
        reportDebug("llm-empty-final", { part });
        return lastNonEmpty || [];
      }
      await new Promise((r) => setTimeout(r, 2500 * attempt));   // 退避：2.5s / 5s，给限流恢复时间
      continue;
    }
    const qs = extractLLMQuestions(data);
    if (qs.length) lastNonEmpty = qs;
    reportDebug("llm-ok", {
      part, attempt, count: qs.length, rawLen: rawContent.length,
      // 解析出 0 题时把 LLM 原始内容前 1500 字落盘，精确定位格式/结构问题
      ...(qs.length === 0 ? { contentHead: rawContent.slice(0, 1500) } : {}),
    });
    if (qs.length >= minCount) return qs;

    lastErr = new Error("解析出 " + qs.length + " 题（要求 " + minCount + "）");
    // Agently 式修正：把校验错误反馈给 LLM，要求重新输出
    curPrompt = prompt + "\n\n" + formatHint + "\n\n【修正要求】你上一次的输出未能通过程序校验：" + lastErr.message + "。请严格按【输出格式要求】重新输出完整 JSON（不要 markdown 代码块，不要多余文字），数量必须达标。";
  }
  // 宁缺毋滥：数量不足但出过题 → 有多少收多少（主流程累积补足兜底）；从未出题（空响应/格式全坏）→ 真不可用，throw
  if (lastNonEmpty) {
    reportDebug("llm-partial-final", { part, count: lastNonEmpty.length, want: minCount });
    return lastNonEmpty;
  }
  reportDebug("llm-fail", { part, msg: String((lastErr && lastErr.message) || lastErr) });
  throw lastErr;
}


/* ===== 浏览器端 LLM 出题（Key 不出浏览器，不经服务器） ===== */
async function browserLLMGenerate(course, part, count) {
  // part: "theory" 只生成理论 | "practical" 只生成实战 | 缺省全量（26 道，兼容旧调用）
  // count: 本次期望生成题数（首轮 16/10，补足轮传缺失量）；缺省按 part 回退 14/8/26
  if (!LLM_KEY) return [];
  const base = (LLM_BASE || "https://api.deepseek.com").replace(/\/+$/, "");
  const model = LLM_MODEL || "deepseek-v4-flash";

  // 课程素材摘要（用于生成题目）
  // 数据统一方案 L1：素材统一走 sanitizeMaterial（长度配置集中在 DataIO.INPUT_LIMITS）
  const concepts = DataIO.sanitizeMaterial((course.concepts || []).map((c) => ({ key: "concept", title: c.name, text: c.summary })), { emptyText: "（无概念表）" });
  const chapters = DataIO.sanitizeMaterial((course.chapters || []).map((ch) => ({ key: "chapter", title: "第" + ch.index + "章 " + ch.title, text: ch.summary })), { emptyText: "（无章节）" });
  const difficulties = DataIO.sanitizeMaterial((course.difficulties || []).map((d) => ({ key: "difficulty", title: d.title })), { emptyText: "（无难点）" });
  // 代码文件内容（出题素材：按文件名排序，利于 LLM 识别递进/对比关系，基于真实代码出实战题）
  const codeFiles = DataIO.sanitizeMaterial(
    (course.materials || [])
      .filter((m) => m.type === "code" || (m.file && /\.(py|ipynb|js|ts|java)$/i.test(m.file)))
      .sort((a, b) => (a.file || a.path || "").localeCompare(b.file || b.path || ""))
      .map((m) => ({ key: "codeFile", title: "[" + m.file + "（" + (m.lines || "?") + " 行）]", text: m.preview })),
    { emptyText: "" }
  );

  // 有代码文件才要求实战题：纯笔记目录（无代码素材）跳过实战硬校验，避免「无代码却要代码题」结构性必败
  const hasCode = codeFiles.trim().length > 0;

  // 期望题数：首轮 16/10，补足轮按缺失量；缺省回退 14/8/26
  const wantCount = count || (part === "theory" ? 16 : part === "practical" ? 10 : 26);
  // max_tokens 随首轮大 batch 放宽（消除 16/10 道单批截断，而非截断后靠补足兜底）
  const maxTokens = part === "theory" ? 6000 : part === "practical" ? 9000 : 10000;
  const system = SYSTEM.examiner;
  const prompt = part === "theory"
    ? buildImportTheoryPrompt((course.title || "").slice(0, 50), concepts, chapters, difficulties, flaggedQuestionTxt(), wantCount)
    : part === "practical"
    ? buildImportPracticalPrompt((course.title || "").slice(0, 50), concepts, chapters, difficulties, codeFiles, flaggedQuestionTxt(), wantCount)
    : buildImportPrompt((course.title || "").slice(0, 50), concepts, chapters, difficulties, codeFiles, flaggedQuestionTxt());

  // 实战硬校验仅在有代码文件时生效（纯笔记目录实战轮可返回空，不阻塞导入）
  // 最低可用量软门槛（宁缺毋滥）：低于此才触发「修正重出」；首轮即使截断到 12 道也直接收，交给补足轮精确补
  const minCount = part === "theory" ? 4 : part === "practical" ? (hasCode ? 3 : 0) : (hasCode ? 7 : 4);
  const qs = await llmJSON({
    system,
    prompt,
    formatHint: JSON_FORMAT_HINT,
    minCount,
    part,
    maxTokens,
  });
  return qs;
}

/* 从导入资料提炼「岗位通用面试题」：LLM 判断资料最贴近的岗位 + 生成 3 道场景面试题（扩充面试参考弹药） */
async function generateJobQuestions(course) {
  if (!LLM_KEY) return null;
  try {
    const jobNames = (JOB_KNOWLEDGE || []).map((j) => j.name);
    if (!jobNames.length) return null;
    const prompt = buildJobQuestionPrompt(course, jobNames);
    // 数据统一方案 P1：迁移到 llmJSON 统一调用器
    const parsed = await llmJSON({
      system: SYSTEM.examiner,
      prompt,
      formatHint: JOB_JSON_HINT,
      expect: "object",
      part: "job",
      maxTokens: 800,
      temperature: 0.7,
      maxRetries: 2,
      validateObj: (o) => DataSchema.validateBySchema(o, DataSchema.OBJECT_SCHEMAS.job),
    });
    return { jobName: parsed.jobName, questions: parsed.questions };
  } catch (e) {
    return null;
  }
}

/* 导入进度条 UI（阶段化：图标 + 阶段文字 + 流动进度条 + 百分比） */
function setImportProgress(pct, icon, text, detail) {
  const status = $("#import-status");
  if (!status) return;
  status.className = "parse-status loading";
  status.innerHTML = `
    <div class="imp-hero">
      <div class="imp-stage-icon">${icon}</div>
      <div style="flex:1;min-width:0">
        <div class="imp-stage-text">${esc(text)}</div>
        ${detail ? `<div class="imp-stage-detail">${esc(detail)}</div>` : ""}
      </div>
      <div class="imp-pct">${Math.round(pct)}%</div>
    </div>
    <div class="imp-track"><div class="imp-fill" style="width:${Math.round(pct)}%"></div></div>
    <div class="imp-parts"></div>
    <div class="imp-tips-box"><div class="imp-tip"></div></div>`;
}

/* 保留供未来扩展（组卷已纯程序化，不再调用）：LLM 动态出题补足 */
async function llmExamQuestions(courses, mode, count = 4) {
  if (!LLM_KEY) return [];

  // 汇总所有目录的素材
  const concepts = [];
  const chapters = [];
  const codeFiles = [];
  for (const c of courses) {
    for (const cc of (c.concepts || [])) concepts.push(`${c.title}·${cc.name}: ${(cc.summary || "").slice(0, 60)}`);
    for (const ch of (c.chapters || [])) chapters.push(`${c.title}·第${ch.index}章 ${ch.title}: ${(ch.summary || "").slice(0, 40)}`);
    for (const m of (c.materials || [])) {
      if (m.type === "code" || (m.file && /\.(py|ipynb|js|ts|java)$/i.test(m.file))) {
        codeFiles.push({ key: "codePreview", title: "[" + (m.file || m.path) + "]", text: m.preview });
      }
    }
  }
  // 数据统一方案 L1：素材统一走 sanitizeMaterial（长度配置集中在 DataIO.INPUT_LIMITS）
  const conceptTxt = DataIO.sanitizeMaterial(concepts.map((s) => ({ key: "conceptBrief", text: s })), { emptyText: "（无概念表）" });
  const chapterTxt = DataIO.sanitizeMaterial(chapters.map((s) => ({ key: "chapterBrief", text: s })), { emptyText: "（无章节）" });
  const codeTxt = DataIO.sanitizeMaterial(codeFiles, { emptyText: "" });

  const prompt = buildExamPrompt(conceptTxt, chapterTxt, mode, count, ABILITIES.join("、"), codeTxt, flaggedQuestionTxt());

  // 数据统一方案 P1：迁移到 llmJSON 统一调用器（考核动态出题，minCount 0=宁缺毋滥，失败返回空走主流程兜底）
  const qs = await llmJSON({
    system: SYSTEM.examiner,
    prompt,
    part: "exam-dynamic",
    maxTokens: 3000,
    temperature: 0.8,
    minCount: 0,
  });
  // 补全字段（含 correctIndex 归一化 + ability 白名单），维度强制为考核模式
  for (const q of qs) {
    normalizeLLMQuestion(q);
    q.dimension = mode;
    q.dynamic = true;
    q.source = "LLM 动态";
  }
  return qs;
}

/* 核心：批量导入多份 .md */
let importBusy = false;   // 导入防重入锁：导入中再次触发导入直接提示，避免并发竞态

async function handleImportFileList(mdFiles) {
  if (!mdFiles.length) return;
  // 兜底：未配置 LLM 不导入（showImportPanel 已拦截，这里防拖拽等入口绕过）
  if (!LLM_KEY) {
    showModal({
      iconHtml: icon("robot"),
      title: "导入资料需要 LLM",
      text: "导入时由 LLM 出题，请先配置 API Key（支持 DeepSeek、阿里百炼等 OpenAI 兼容接口）。",
      actions: [
        { label: "⚙️ 去设置", primary: true, onClick: () => showSettings() },
        { label: "先不了", onClick: () => {} },
      ],
    });
    return;
  }
  // 防重入：导入进行中再次触发（如连点导入按钮）→ 提示并忽略，避免两个导入流程并发覆盖状态/挂库/写盘
  if (importBusy) {
    showToast("⏳ 正在导入中，请等待当前导入完成");
    return;
  }
  importBusy = true;
  Logger.begin("imp");   // 本次导入流程的 sessionId（整条链可聚合）
  Logger.info("import.start", "开始导入资料", { files: mdFiles.length });
  const status = $("#import-status");
  status.className = "parse-status loading";
  setImportProgress(3, "🚀", "准备导入", `${mdFiles.length} 份资料`);

  try {
    // 灰色态提示（theoryWarn/pracWarn）：声明提升到外层 try 块，供 success 流程 status.innerHTML 使用
    // （原声明在内层 try 块，success 流程访问会触发 ReferenceError「Can't find variable」）
    let theoryWarn = "";
    let pracWarn = "";
    // 逐份读取文本（带进度提示）
    const payload = [];
    for (let i = 0; i < mdFiles.length; i++) {
      const f = mdFiles[i];
      setImportProgress(5 + ((i + 1) / mdFiles.length) * 5, "📄", `读取文件 ${i + 1}/${mdFiles.length}`, f.name);
      const md = await f.text();
      const relPath = f._relPath || f.webkitRelativePath || f.name;
      payload.push({ filename: relPath, md, kind: fileKind(relPath) });
    }

    // 批量提交（统一走 import-batch：一次导入 = 一个章节目录）
    const reqBody = { uid: UID };
    setImportProgress(10, "🧠", "解析资料中", "章节 / 概念 / 难点提取");
    const res = await fetch("/api/import-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...reqBody, files: payload }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "导入失败");

    // 若用户配置了 LLM，浏览器直连 API 生成考核题（主力出题，key 不出浏览器）
    if (LLM_KEY && data.course) {
      setImportProgress(10, icon("robot"), "LLM 正在生成题目", "理论 + 实战并行 · 浏览器直连 · Key 不出浏览器");
      // 伪进度：按 10% 一档跳（10→20→…→90），每 6 tick（约 3.6 秒）跳一档，匹配生成时长
      let impPct = 10;
      let stepTicks = 0;
      const tips = [
        "🧩 理论题：概念辨析 · 判断 · 填空",
        "💻 实战题：代码作用 · 输出预测 · Bug 修复",
        "⚡ 理论 + 实战并行生成，导入更快",
        "📚 理论题基于概念，实战题必须引用真实代码",
        "📚 生成的全部题目会去重后存入本章题库",
        "💡 提示：考核连续答对有连击加成，XP 更多",
        "💡 提示：答错的题自动进错题本，之后会间隔重考",
        "💡 提示：完成 6 步引导即可解锁完整能力画像",
        "💡 提示：章节考核聚焦单章，综合考核聚合全部章节",
        "💡 提示：综合考核题量是章节的 2 倍",
        "💡 提示：支持 AI 面试官仿真面试，会严格追问",
        "💡 提示：能力雷达图按 10 个维度评估，快速定位短板",
        "💡 提示：每次导入都会按岗位提炼面试参考题",
      ];
      let tipIdx = 0;
      let tipTicks = 0;
      const pTimer = setInterval(() => {
        stepTicks++;
        if (stepTicks % 6 === 0 && impPct < 90) impPct += 10;
        const fill = $("#import-status .imp-fill");
        const pctEl = $("#import-status .imp-pct");
        if (fill) fill.style.width = impPct + "%";
        if (pctEl) pctEl.textContent = impPct + "%";
        // 动态轮换提示文案：每 6 个 tick（约 3.6 秒）换一条，保证用户能看清
        tipTicks++;
        if (tipTicks % 6 === 0) {
          const tipEl = $("#import-status .imp-tip");
          if (tipEl) {
            tipIdx = (tipIdx + 1) % tips.length;
            tipEl.textContent = tips[tipIdx];
          }
        }
      }, 600);
      try {
        // 并行两次请求：理论 16 道 + 实战 8 道（同步开始、全部结束后进入下一环节；重复由 seenTxt 去重兜底）
        // 注：综合考核单目录理论 16 道会被抽满，需导入 ≥2 个目录聚合才够 2 次量（章节考核 8 道可考 2 次不重复）
        // ⑥ 修复：LLM 题 id 用时间戳派生的全局近似唯一起点（LLM 题本无 id，existingIds 去重是死逻辑，已删除）
        // 纯笔记目录（无代码素材）：实战题无代码可引用，跳过实战硬校验（理论题仍必须生成）
        const hasCode = (data.course.materials || []).some((m) => m.type === "code" || (m.file && /\.(py|ipynb|js|ts|java)$/i.test(m.file)));
        // 纯笔记目录不发实战请求（无代码素材，发了也白发还浪费请求；宁缺毋滥）
        const genParts = [
          { key: "theory", label: "生成理论题 ing..", icon: "📘", count: 16 },
          ...(hasCode ? [{ key: "practical", label: "生成实战题 ing..", icon: "🛠️", count: 10 }] : []),
        ];
        const partsBox = $("#import-status .imp-parts");
        if (partsBox) {
          partsBox.innerHTML = genParts.map((gp) => `
            <div class="imp-part" data-part="${gp.key}">
              <span class="imp-part-icon">${gp.icon}</span>
              <span class="imp-part-label">${gp.label}</span>
              <span class="imp-part-state">⏳ 生成中…</span>
            </div>`).join("");
        }
        const results = await Promise.allSettled(
          genParts.map((gp) => browserLLMGenerate(data.course, gp.key, gp.count))
        );
        // 只有理论轮请求被拒绝（LLM 真不可用）才整体失败；实战轮 rejected/空响应 → 视为空，由补足+软提示兜底（宁缺毋滥：理论保住，实战不足提示补）
        const hardFail = results.findIndex((r, i) => r.status === "rejected" && genParts[i].key === "theory");
        if (hardFail >= 0) {
          const bad = results[hardFail];
          throw new Error("LLM 生成失败（" + genParts[hardFail].label + "）：" + ((bad.reason || {}).message || "请求失败"));
        }
        let nid = Date.now();   // 13 位毫秒全局唯一，同目录内 nid++ 不重；天然避开引擎题/辅助题 id 段
        const seenTxt = new Set((data.course.quiz || []).map((q) => (q.question || "") + "|" + q.type));
        // 挂库公共函数：去重 + 补全 + 入库（理论/实战补足共用）
        const hangQ = (qs) => {
          let added = 0;
          for (const q of qs || []) {
            if (seenTxt.has((q.question || "") + "|" + q.type)) continue;
            q.id = nid++;
            q.source = "llm";
            if (!q.dimension) q.dimension = inferDimension(q);
            q.interview = !!q.interview;
            if (q.type === "essay" && !q.followUps) q.followUps = [];
            normalizeLLMQuestion(q);
            data.course.quiz.push(q);
            seenTxt.add((q.question || "") + "|" + q.type);
            added++;
          }
          return added;
        };
        genParts.forEach((gp, i) => {
          const stEl = partsBox ? partsBox.querySelector(`.imp-part[data-part="${gp.key}"] .imp-part-state`) : null;
          const lblEl = partsBox ? partsBox.querySelector(`.imp-part[data-part="${gp.key}"] .imp-part-label`) : null;
          const added = hangQ(results[i].value || []);
          if (lblEl) lblEl.textContent = "完成 " + added + " 道";
          if (stEl) stEl.textContent = "✅";
        });
        // 数量统计：理论/实战累积补足到理想量（16/10），最低可用量（8/5）才允许通过
        const countTheory = () => (data.course.quiz || []).filter((q) => (q.dimension || inferDimension(q)) === "theory").length;
        const countPrac = () => (data.course.quiz || []).filter((q) => q.type === "practical").length;
        // 补足循环（首轮 16/10 已由主批次发出）：每轮按「缺失量」精确补（下限理论 4 / 实战 3，避免「生成 1 道」过小请求），
        // 直到理想量达标或该方向卡死（空响应/全重复 → 停）；最多补 2 轮（合计 3 轮）防失控
        let topRound = 0;
        let thStuck = false, pracStuck = false;
        while (topRound < 2 && ((countTheory() < 16 && !thStuck) || (hasCode && countPrac() < 10 && !pracStuck))) {
          topRound++;
          // 缺失量精确补（下限理论 4 / 实战 3）：题型公式已自洽（选择 = N−2×⌊N/4⌋，判断 = 填空 = ⌊N/4⌋），任意 N 都能正确分配，无需再对齐 4 的倍数
          const thNeed = Math.max(16 - countTheory(), 4);
          const pracNeed = Math.max(10 - countPrac(), 3);
          const thJob = countTheory() < 16 && !thStuck ? browserLLMGenerate(data.course, "theory", thNeed).catch(() => null) : Promise.resolve(null);
          const pracJob = hasCode && countPrac() < 10 && !pracStuck ? browserLLMGenerate(data.course, "practical", pracNeed).catch(() => null) : Promise.resolve(null);
          const stElT2 = partsBox ? partsBox.querySelector(`.imp-part[data-part="theory"] .imp-part-state`) : null;
          const stElP2 = partsBox ? partsBox.querySelector(`.imp-part[data-part="practical"] .imp-part-state`) : null;
          if (stElT2 && thJob) stElT2.textContent = "⏳ 补足理论（" + topRound + "/2）…";
          if (stElP2 && pracJob) stElP2.textContent = "⏳ 补足实战（" + topRound + "/2）…";
          const [thRes, pracRes] = await Promise.all([thJob, pracJob]);
          if (thRes !== null) { if (!thRes || !thRes.length) thStuck = true; else if (!hangQ(thRes)) thStuck = true; }
          if (pracRes !== null) { if (!pracRes || !pracRes.length) pracStuck = true; else if (!hangQ(pracRes)) pracStuck = true; }
        }
        // 数量校验（宁缺毋滥）：收纳实际生成的全部题目；理论 <8 / 实战 <5 时按钮置灰 + 提示补出题或重新导入
        theoryWarn = countTheory() < 8 ? "理论题仅 " + countTheory() + " 道（不足 8，理论考核按钮已置灰），可点「补出题」或重新导入" : "";
        pracWarn = hasCode && countPrac() < 5 ? "实战题仅 " + countPrac() + " 道（不足 5），可点「补出题」补足" : "";
        const stElP2 = partsBox ? partsBox.querySelector(`.imp-part[data-part="practical"] .imp-part-state`) : null;
        const lblP = partsBox ? partsBox.querySelector(`.imp-part[data-part="practical"] .imp-part-label`) : null;
        if (lblP) lblP.textContent = "完成 " + countPrac() + " 道";
        if (stElP2) stElP2.textContent = "✅";
        const lblT = partsBox ? partsBox.querySelector(`.imp-part[data-part="theory"] .imp-part-label`) : null;
        if (lblT) lblT.textContent = "完成 " + countTheory() + " 道";
        await fetch("/api/course-save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: UID, course: data.course, dirId: data.dir ? data.dir.id : null }),
        }).catch(() => {});
        // 额外：从这份资料提炼「岗位通用面试题」，并入该岗位的面试参考弹药
        const jobQ = await generateJobQuestions(data.course);
        if (jobQ && jobQ.questions.length) {
          if (!state.jobExtraQuestions) state.jobExtraQuestions = {};
          const bucket = state.jobExtraQuestions[jobQ.jobName] || [];
          const seen = new Set(bucket);
          let addedJobQ = 0;
          for (const q of jobQ.questions) {
            if (q && !seen.has(q)) { bucket.push(q); seen.add(q); addedJobQ++; }
          }
          state.jobExtraQuestions[jobQ.jobName] = bucket;
          if (addedJobQ) saveState();
        }
        clearInterval(pTimer);
      } catch (e) {
        clearInterval(pTimer);
        Logger.error("import.fail", "导入失败: " + String((e && e.message) || e), { msg: String((e && e.message) || e) });
        // 失败不再自动删除目录：保留后端已解析的资料与文件清单，用户可重试、补出题或手动删除
        const msg = String((e && e.message) || e);
        const reason = /failed to fetch|fetch failed|network|net::/i.test(msg)
          ? "无法连接 API 服务（网络错误）"
          : msg;
        status.className = "parse-status err";
        status.innerHTML = `⚠️ 导入失败，原因是：${esc(reason)}。目录已保留（未删除），可重新导入或点「补出题」修复。`;
        return;   // 阻止后续成功流程（COURSE 赋值 / 发 XP / status=ok 覆盖失败文案）
      }
    }

    // 更新当前课程 + 目录列表
    if (data.course) COURSE = data.course;

    // 奖励：XP + 记录（按实际导入的文件数）
    const fileCount = data.fileCount || 0;
    const gain = 30 * Math.max(1, fileCount);
    state.imports = (state.imports || 0) + fileCount;
    state.xp += gain;
    saveState();
    updateGamestat();

    // 展示结果：目录标题 + 重复提示
    const dupCount = (data.duplicates || []).length;
    const errCount = (data.errors || []).length;
    let dupRows = "";
    if (dupCount) {
      dupRows = `<div style="margin:8px 0;max-height:140px;overflow-y:auto">${data.duplicates.map((d) => `
        <div style="display:flex;justify-content:space-between;padding:6px 10px;border-bottom:1px solid var(--border);font-size:11.5px">
          <span style="color:var(--warn)">⚠️ ${esc(d.filename)}（${esc(d.reason || "资料重复")}）</span>
          <span style="color:var(--text-2)">已跳过</span>
        </div>`).join("")}</div>`;
    }
    status.className = "parse-status ok";
    if (data.dir) {
      // 用前端挂库后的实际题库统计（data.course.quiz 已含 LLM 题；data.dir.course 是后端挂库前数据，会显示 0 题）
      const q = data.course?.quiz || [];
      const theoryN = q.filter((x) => (x.dimension || inferDimension(x)) === "theory").length;
      const pracN = q.filter((x) => (x.dimension || inferDimension(x)) === "practical").length;
      status.innerHTML = `
        ✅ 已创建章节目录「<strong style="color:var(--accent)">${esc(data.dir.title)}</strong>」<br>
        📚 生成 <strong style="color:var(--accent)">${theoryN + pracN}</strong> 题（理论 ${theoryN} · 实战 ${pracN}）· ${fileCount} 个文件<br>
        ${dupCount ? `⚠️ 有 ${dupCount} 个文件重复，已跳过` : ""}
        ${dupRows}
        ${theoryWarn ? `<span style="color:#ffb84d">${theoryWarn}</span><br>` : ""}
        ${pracWarn ? `<span style="color:#ffb84d">${pracWarn}</span><br>` : ""}
        ⭐ 获得 ${gain} XP 奖励（累计导入 ${state.imports} 份资料）`;
    } else {
      status.innerHTML = `
        ⚠️ 未创建新目录：${dupCount ? `有 ${dupCount} 个文件重复，已跳过` : "没有可导入的有效资料"}<br>
        ${dupRows}`;
    }
    showToast(data.dir ? `📥 已导入「${data.dir.title}」 · +${gain} XP` : "⚠️ 资料重复，已跳过");
    status.insertAdjacentHTML("beforeend", `<div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap"><button class="exam-btn primary" onclick="showLibrary()">🗂️ 查看资料目录</button><button class="exam-btn ghost" onclick="showImportPanel()">📥 继续导入资料</button></div>`);
    // 导入成功后自动进入目录列表，优先查看刚导入的资料（而非停留在导入界面）
    if (data.dir) {
      const qDone = data.course?.quiz || [];
      Logger.info("import.done", "导入完成", {
        dirTitle: data.dir.title, total: qDone.length,
        theory: qDone.filter((x) => (x.dimension || inferDimension(x)) === "theory").length,
        practical: qDone.filter((x) => (x.dimension || inferDimension(x)) === "practical").length,
        files: fileCount, dup: dupCount, warn: !!(theoryWarn || pracWarn),
      });
    }
    setTimeout(() => showLibrary(), 3500);
    importBusy = false;
  } catch (e) {
    importBusy = false;
    status.className = "parse-status err";
    status.textContent = `❌ ${e.message}`;
  }
}

/* ===== LLM 仿真面试 ===== */
let interviewState = null;   // { job, qIndex, questions, history, started }
let interviewBusyCount = 0;  // 面试竞态守卫：>0 表示面试官正在处理（LLM 请求中），挡住连点发送
let interviewCourses = [];   // 面试聚合的目录课程（切目录模型）

async function startInterview() {
  setNavActive("interview");
  // 面试考核强制要求 LLM
  if (!LLM_KEY) {
    showModal({
      iconHtml: icon("robot"),
      title: "面试考核需要 LLM",
      text: "面试考核由 AI 面试官动态出题、追问并评分，需要先配置 LLM API Key。你可以在设置中填写（支持 DeepSeek 官方或中转站），Key 仅保存在本机浏览器。",
      actions: [
        { label: "⚙️ 去设置", primary: true, onClick: () => showSettings() },
        { label: "先不了", onClick: () => {} },
      ],
    });
    return;
  }
  // 面试基于所有目录聚合的资料（与综合考核一致），而非仅当前课程
  let courses = [];
  try {
    courses = await loadAllDirCourses();
  } catch (e) {
    showToast("⚠️ 加载资料失败，请重试");
    return;
  }
  if (!courses.length) {
    showToast("⚠️ 请先导入学习资料，面试官需要基于你的资料分析岗位");
    goHome();
    return;
  }
  interviewCourses = courses;
  examMode = "interview";
  renderJobSelect();
}

/* 岗位选择：用户自选岗位方向，LLM 加载对应岗位知识库进入面试官角色 */
function renderJobSelect() {
  const jobsHtml = JOB_KNOWLEDGE.length
    ? JOB_KNOWLEDGE.map((j) => `
        <button class="job-card" onclick="startJobInterview('${j.id}')">
          <div class="job-card-name">${esc(j.name)}</div>
          <div class="job-card-summary">${esc(j.summary)}</div>
          <div class="job-card-skills">${j.skills.slice(0, 3).map((s) => esc(s)).join(" · ")}</div>
        </button>`).join("")
    : `<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--warn)">⚠️ 岗位知识库加载失败，请重启应用后重试。</div>`;
  render(null, `
    <button class="exam-btn ghost" onclick="goHome()" style="margin-bottom:18px">← 退出面试</button>
    <h2 class="section-title">${icon("briefcase", "lg")} 选择面试岗位</h2>
    <div style="font-size:12.5px;color:var(--text-2);margin-bottom:16px;line-height:1.8">选择你要面试的岗位，AI 面试官将加载该岗位的知识库（职责 · 核心技能 · 考察维度 · 知识图谱要点 · 追问方向），围绕岗位做多维度严格面试。</div>
    <div class="job-grid">
      ${jobsHtml}
    </div>`);
}

function startJobInterview(jobId) {
  // 防御性检查：面试强制要求 LLM（与 startInterview 一致，防未来新增入口绕过）
  if (!LLM_KEY) {
    showModal({
      iconHtml: icon("robot"),
      title: "面试考核需要 LLM",
      text: "面试考核由 AI 面试官动态出题、追问并评分，需要先配置 LLM API Key。你可以在设置中填写（支持 DeepSeek 官方或中转站），Key 仅保存在本机浏览器。",
      actions: [
        { label: "⚙️ 去设置", primary: true, onClick: () => showSettings() },
        { label: "先不了", onClick: () => {} },
      ],
    });
    return;
  }
  const baseJob = JOB_KNOWLEDGE.find((j) => j.id === jobId) || JOB_KNOWLEDGE[0];
  // 浅拷贝：合并用户从资料提炼的「岗位通用面试题」，作为额外参考弹药（不污染静态知识库）
  const extra = (state.jobExtraQuestions || {})[baseJob.name] || [];
  const job = { ...baseJob, sampleQuestions: [...(baseJob.sampleQuestions || []), ...extra] };
  // 兜底题池：每场面试打乱一次顺序（+ 随机起点），避免多次面试兜底题固定顺序不变
  // D-9 对齐：统一 Fisher-Yates 均匀洗牌（与 buildInterviewQuestionPrompt 一致，避免非均匀 sort）
  const fallbackPool = [...job.sampleQuestions];
  for (let i = fallbackPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [fallbackPool[i], fallbackPool[j]] = [fallbackPool[j], fallbackPool[i]];
  }
  const fallbackStart = Math.floor(Math.random() * Math.max(1, fallbackPool.length));
  const ctx = buildInterviewContext();
  const dims = Object.keys(job.dimensions).slice(0, 4);
  const maxRounds = interviewRoundCount(ctx);
  Logger.begin("iv");   // 面试流程 sessionId（ask/judge/score 整条链聚合）
  Logger.info("interview.start", "开始岗位面试", { job: baseJob.name, maxRounds, dims, extraCount: extra.length });
  interviewState = {
    job, dims, ctx,
    fallbackPool, fallbackStart,
    round: 0, maxRounds,
    history: [],        // [{question, type, dimension, answer}]
    // 开场白直接写入，进入面试间立刻显示（不用等 LLM）
    messages: [{ role: "interviewer", text: `你好，我是本次「${job.name}」岗位的面试官。接下来我会结合岗位要求、你的学习资料，以及真实生产环境的常见场景，进行约 ${maxRounds} 轮提问。请像真实面试一样作答，我会严格追问。`, meta: "开场" }],
    asked: [],          // 已问过的题目文本（去重）
    currentFollows: 0,  // 当前题已追问次数（限制每题追问次数，防死循环）
    started: Date.now(),
  };
  // 选岗位后先展示「面试官准备中」加载动画，再进入面试介绍页
  showInterviewLoading(job, maxRounds, dims);
}

/* 构建面试上下文（聚合所有目录的资料 + 题库），供岗位分析与动态出题复用 */
function buildInterviewContext() {
  const courses = interviewCourses || [];
  const concepts = [];
  const chapters = [];
  const difficulties = [];
  const quiz = [];
  for (const c of courses) {
    for (const cc of (c.concepts || [])) concepts.push(cc);
    for (const ch of (c.chapters || [])) chapters.push(ch);
    for (const d of (c.difficulties || [])) difficulties.push(d);
    for (const q of (c.quiz || [])) quiz.push(q);
  }
  // 随机采样：资料越多采样越多（cap 动态放宽），且每场面试看到的资料子集/顺序不同 → LLM 出题更多样
  // 返回已打乱顺序的子集（既随机选哪些入选，也随机展示顺序）
  const sample = (arr, cap, minCap = 3) => {
    if (!arr.length) return [];
    const target = Math.min(arr.length, Math.max(minCap, Math.ceil(arr.length * 0.5)), cap);
    return shuffle(arr).slice(0, target);
  };
  // 数据统一方案 L1：面试上下文素材统一走 sanitizeMaterial（长度/条数集中在 DataIO.INPUT_LIMITS）
  const conceptTxt = DataIO.sanitizeMaterial(sample(concepts, 30).map((c) => ({ key: "ivConcept", title: c.name, text: c.summary })), { emptyText: "（无概念表）" });
  const chapterTxt = DataIO.sanitizeMaterial(sample(chapters, 24).map((ch) => ({ key: "ivChapter", title: "第" + ch.index + "章 " + ch.title, text: ch.summary })), { emptyText: "（无章节）" });
  const diffTxt = DataIO.sanitizeMaterial(sample(difficulties, 16).map((d) => ({ key: "ivDiff", title: d.title, text: d.detail })), { emptyText: "（无难点）" });
  const quizByDim = {};
  for (const q of quiz) {
    const d = q.dimension || inferDimension(q);
    (quizByDim[d] = quizByDim[d] || []).push(q);
  }
  const cleanSeg = (seg) => DataIO.sanitizeMaterial([seg], { emptyText: "" }).replace(/^- /, "");
  const quizTxt = Object.entries(quizByDim).map(([d, qs]) =>
    `【${d}】${sample(qs, 10, 4).map((q) => cleanSeg({ key: "ivQuiz", text: q.question.replace(/【[^】]*】/g, "") })).join("；")}`
  ).join("\n") || "（题库为空）";
  const abilityTxt = Object.keys(abilityProfilePct() || {}).join("、") || "（无）";
  return {
    conceptTxt, chapterTxt, diffTxt, quizTxt, abilityTxt,
    quizCount: quiz.length,
    conceptCount: concepts.length, chapterCount: chapters.length, diffCount: difficulties.length,
  };
}

/* 根据资料量动态设定面试轮数（资料越丰富，考察越全面） */
function interviewRoundCount(ctx) {
  const n = (ctx.conceptCount || 0) + (ctx.chapterCount || 0) + (ctx.diffCount || 0);
  if (n >= 20) return 8;
  if (n >= 12) return 6;
  if (n >= 6) return 5;
  return 4;
}

/* 面试官准备中的 HUD 加载动画：选岗位后展示，模拟加载岗位知识库 / 匹配角色 / 解析资料，再进入介绍页 */
function showInterviewLoading(job, maxRounds, dims) {
  render(null, `
    <div class="card exam-loading">
      <div class="el-head">
        <span class="el-title"><span class="logo-cursor">&gt;_</span> INTERVIEW PREP <span class="el-mode">[${esc(job.name)}]</span></span>
        <span class="el-tagbox">
          <span class="el-engine llm">AI-INTERVIEWER</span>
          <span class="el-spinner"></span>
        </span>
      </div>
      <div class="el-term" id="interview-loading-log"></div>
      <div class="el-progress"><div class="el-progress-fill" id="interview-loading-bar"></div></div>
      <div class="el-status" id="interview-loading-text"></div>
    </div>`);
  const api = {
    log(text) {
      const box = $("#interview-loading-log");
      if (!box) return;
      const line = document.createElement("div");
      line.className = "el-line";
      line.innerHTML = `<span class="el-ok">✓</span> ${esc(text)}`;
      box.appendChild(line);
      box.scrollTop = box.scrollHeight;
    },
    setStatus(text) {
      const el = $("#interview-loading-text");
      if (el) el.innerHTML = `${esc(text)}<span class="el-cursor"></span>`;
    },
    setProgress(pct) {
      const bar = $("#interview-loading-bar");
      if (bar) bar.style.width = Math.max(0, Math.min(100, pct)) + "%";
    },
  };
  const steps = [
    { text: "加载岗位知识库（职责 · 技能 · 知识图谱）", status: "LOADING JOB KNOWLEDGE BASE" },
    { text: `匹配「${job.name}」面试官角色`, status: "MATCHING INTERVIEWER PERSONA" },
    { text: "解析候选人学习资料与题库", status: "ANALYZING CANDIDATE MATERIALS" },
    { text: `规划 ${maxRounds} 轮考察维度`, status: "PLANNING EXAM DIMENSIONS" },
  ];
  // 预生成第一题：走马灯期间并行出题（进面试间即见题，消除二次等待）
  const st0 = interviewState;
  if (st0 && !st0._preloading) {
    st0._preloading = true;
    runInterviewGraph(st0, "ask").catch(() => { st0._preloading = false; });
  }
  let i = 0;
  const step = () => {
    if (i < steps.length) {
      api.log(steps[i].text);
      api.setStatus(steps[i].status);
      api.setProgress(Math.round(((i + 1) / (steps.length + 1)) * 100));
      i++;
      setTimeout(step, 360);
    } else {
      api.setStatus("INTERVIEW READY");
      api.setProgress(100);
      setTimeout(() => renderInterviewChat(), 520);   // 直接进面试间（旧 renderInterviewIntro 死函数已删）
    }
  };
  step();
}


/* ===== 仿真面试聊天窗口 ===== */
function renderInterviewChat() {
  const st = interviewState;
  if (!st.messages) {
    st.messages = [];
    // 面试官开场白
    st.messages.push({ role: "interviewer", text: `你好，我是本次「${st.job.name}」岗位的面试官。接下来我会结合岗位要求、你的学习资料，以及真实生产环境的常见场景，进行约 ${st.maxRounds} 轮提问。请像真实面试一样作答，我会严格追问。`, meta: "开场" });
  }
  render(() => {
    scrollInterviewToBottom();
    const ta = $("#interview-input");
    if (ta) ta.focus();
  }, `
    <div class="interview-shell">
      <div class="interview-head">
        <div class="iv-avatar">${icon("robot")}</div>
        <div class="iv-info">
          <div class="iv-name">${esc(st.job.name)} · 面试官</div>
          <div class="iv-meta">考察维度：${esc(st.dims.join(" / "))}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="iv-status"><span class="dot"></span>面试中</div>
          <button class="exam-btn ghost" style="padding:4px 10px;font-size:11px" onclick="quitInterview()">✕ 退出</button>
        </div>
      </div>
      <div class="interview-body" id="interview-body">
        ${renderInterviewMessages()}
        <div id="iv-typing-slot"></div>
      </div>
      <div class="interview-inputbar">
        <textarea id="interview-input" placeholder="输入你的回答…（Enter 发送，Shift+Enter 换行）"></textarea>
        <button class="exam-btn primary" id="interview-send" onclick="sendInterviewMessage()" style="padding:11px 20px">发送</button>
      </div>
    </div>`);
  const ta = $("#interview-input");
  if (ta) {
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendInterviewMessage(); }
    });
  }
  // 进入面试间后：预加载已完成（st.current 已有）→ 消息已渲染直接开始；预加载中 → 等它完成；失败/未开始 → 动态生成
  if (!st.roundStarted) {
    st.roundStarted = true;
    if (st.current) {
      // 预加载已完成：第一题消息已在 st.messages（上面 render 已全量显示）
      scrollInterviewToBottom();
    } else if (st._preloading) {
      showInterviewTyping(true);
      const waitFirst = () => {
        if (st.current || !st._preloading) {
          showInterviewTyping(false);
          if (!st.current) generateNextQuestion();   // 预加载失败 → 重新出题
        } else {
          setTimeout(waitFirst, 400);
        }
      };
      waitFirst();
    } else {
      generateNextQuestion();
    }
  }
}

function renderInterviewMessages() {
  const st = interviewState;
  return (st.messages || []).map((m) => {
    const isMe = m.role === "candidate";
    const avatar = isMe ? icon("user") : icon("robot");
    const name = isMe ? displayName() : (st.job.name + " · 面试官");
    // 舞台指示：优先用入队时固化的，否则即时算（覆盖开场白等直接 push 的消息）
    const direction = m.role === "interviewer" ? (m.stage || pickStageDirection(m.meta)) : "";
    return `
      <div class="iv-msg ${isMe ? "me" : ""}">
        <div class="iv-bubble-avatar">${avatar}</div>
        <div>
          ${direction ? `<div class="iv-stage">${esc(direction)}</div>` : ""}
          <div class="iv-bubble">${m.meta ? `<span class="iv-tag">${esc(m.meta)}</span><br>` : ""}${esc(m.text)}</div>
        </div>
      </div>`;
  }).join("");
}

function scrollInterviewToBottom() {
  const body = $("#interview-body");
  if (body) body.scrollTop = body.scrollHeight;
}

/* 面试官「舞台指示」：根据消息类型返回一个动作/神态描述，增强画面感（随机选，避免单调） */
const STAGE_DIRECTIONS = {
  "开场": [
    "（面试官整理了下面前的简历，坐直身子）",
    "（面试官抬头，目光落在你身上）",
    "（面试官清了清嗓子，正式开始）",
    "（面试官把简历翻到第一页，身体微微前倾）",
    "（面试官端起水杯抿了一口，放下）",
    "（面试官扫了你一眼，露出职业性的微笑）",
    "（面试官双手交叉放在桌上，坐正了）",
    "（面试官推了推眼镜，正了正领口）",
  ],
  "出题": [
    "（面试官翻了翻资料，抬起头）",
    "（面试官看了眼屏幕，抛出一个问题）",
    "（面试官思考了一下，开口问道）",
    "（面试官在简历上圈了个重点，抬头）",
    "（面试官手指轻点桌面，抛出问题）",
    "（面试官眯起眼睛，斟酌了一下措辞）",
    "（面试官把笔在纸上轻轻敲了两下）",
    "（面试官目光从屏幕移到你身上，开口）",
  ],
  "追问": [
    "（面试官眉头微皱，语气认真起来）",
    "（面试官推了推眼镜，身体前倾）",
    "（面试官摇了摇头，继续追问）",
    "（面试官目光锐利地盯着你）",
    "（面试官嘴角微微上扬，似乎不太满意）",
    "（面试官的手指在桌上轻轻敲了两下）",
    "（面试官深吸一口气，继续往下问）",
    "（面试官把笔放下，身子往后一靠）",
    "（面试官挑了挑眉，显然没被说服）",
    "（面试官轻轻叹了口气，穷追不舍）",
  ],
  "过渡": [
    "（面试官在本子上记了一笔）",
    "（面试官点点头，翻到下一页）",
    "（面试官抿了抿嘴，没有表态）",
    "（面试官快速写了几个字，继续）",
    "（面试官喝了口水，接着问）",
    "（面试官翻动简历，看向下一项）",
    "（面试官目光扫过评分表，继续）",
    "（面试官轻轻点头，不置可否）",
  ],
};

function pickStageDirection(meta) {
  if (!meta) return "";
  const key = meta === "开场" ? "开场"
    : meta === "追问" ? "追问"
    : meta === "过渡" ? "过渡"
    : meta.includes("题") ? "出题"
    : "";
  const pool = STAGE_DIRECTIONS[key] || [];
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : "";
}

function appendInterviewMessage(role, text, meta) {
  const st = interviewState;
  st.messages = st.messages || [];
  // 面试官消息附舞台指示（动作/神态描述），入队时固化，避免整页重渲染时随机跳变
  const direction = role === "interviewer" ? pickStageDirection(meta) : "";
  st.messages.push({ role, text, meta, stage: direction });
  // 增量追加到 DOM（不整页重渲染，保留输入框焦点）
  const body = $("#interview-body");
  if (body) {
    const wrap = document.createElement("div");
    const isMe = role === "candidate";
    const avatar = isMe ? icon("user") : icon("robot");
    wrap.innerHTML = `
      <div class="iv-msg ${isMe ? "me" : ""}">
        <div class="iv-bubble-avatar">${avatar}</div>
        <div>
          ${direction ? `<div class="iv-stage">${esc(direction)}</div>` : ""}
          <div class="iv-bubble">${meta ? `<span class="iv-tag">${esc(meta)}</span><br>` : ""}${esc(text)}</div>
        </div>
      </div>`;
    const slot = $("#iv-typing-slot");
    // 注意用 firstElementChild：innerHTML 前导空白会产生文本节点，firstChild 会拿到空白而非气泡元素
    const node = wrap.firstElementChild || wrap.firstChild;
    if (slot) body.insertBefore(node, slot); else body.appendChild(node);
    scrollInterviewToBottom();
  }
}

function showInterviewTyping(show) {
  const slot = $("#iv-typing-slot");
  if (!slot) return;
  slot.innerHTML = show
    ? `<div class="iv-msg iv-typing"><div class="iv-bubble-avatar">${icon("robot")}</div><div class="dots"><span></span><span></span><span></span></div></div>`
    : "";
  scrollInterviewToBottom();
}

/* 动态生成下一道面试题：结合岗位 + 资料 + 题库 + 已问过（去重）+ 生产环境实际，题型多样 */
// ===== 面试考核 StateGraph（LangGraph 式：节点 + 条件路由 + 共享状态，human-in-the-loop 用 WAIT） =====
const InterviewGraph = {
  nodes: {
    // 出题节点：LLM 生成或兜底题池 → 等用户作答
    ask: async (st) => {
      interviewBusyCount++;
      showInterviewTyping(true);
      const askedTxt = st.asked.length ? st.asked.map((q) => `- ${q}`).join("\n") : "（暂无）";
      const answeredTxt = st.history.map((h, i) => `${i + 1}. Q: ${h.question}\n   A: ${h.answer.slice(0, 200)}`).join("\n") || "（暂无）";
      const qPrompt = buildInterviewQuestionPrompt(st, askedTxt, answeredTxt);
      try {
        const askResult = await llmJSON({
          system: buildInterviewerSystem(st.job),
          prompt: qPrompt,
          formatHint: INTERVIEW_JSON_HINT,
          expect: "object",
          maxTokens: 800,
          part: "interview-ask",
          validateObj: (o) => DataSchema.validateBySchema(o, DataSchema.OBJECT_SCHEMAS["interview-ask"]),
        });
        showInterviewTyping(false);
        st.current = askResult;
        st.asked.push(askResult.question);
        const typeLabel = { essay: "💬 问答题", scenario: "🛠️ 场景题", code: "💻 代码题", choice: "🎯 选择题" }[askResult.type] || "💬 问答";
        appendInterviewMessage("interviewer", askResult.question, `第 ${st.round + 1} 题 · ${typeLabel} · ${askResult.dimension || ""}`);
        if (askResult.type === "choice" && askResult.options && askResult.options.length) appendInterviewOptions(askResult.options);
      } catch (e) {
        showInterviewTyping(false);
        const fp = (st.fallbackPool && st.fallbackPool.length) ? st.fallbackPool : st.job.sampleQuestions;
        const fstart = st.fallbackStart || 0;
        const fallback = fp[(fstart + st.round) % fp.length];
        if (fallback) {
          st.current = { type: "essay", question: fallback, dimension: st.dims[st.round % st.dims.length] };
          st.asked.push(fallback);
          appendInterviewMessage("interviewer", fallback, `第 ${st.round + 1} 题 · 💬 问答题 · ${st.current.dimension}`);
        } else {
          await finishInterview();
        }
      } finally {
        interviewBusyCount = Math.max(0, interviewBusyCount - 1);
        st._preloading = false;   // 预生成第一题标记：ask 完成/失败即解除
      }
      return { next: "WAIT" };
    },
    // 记录回答节点：写入 history + 弱回答检测
    record: async (st, ans) => {
      const q = st.current || {};
      const t = String(ans).trim();
      const isFollowup = (st.currentFollows || 0) > 0;
      // 弱回答：命中「不知道/不会/拖延词」且没有实质猜测（去掉长度阈值，避免误判长句；带猜测的排除）
      const weakAnswer = /(不知道|不会|不清楚|不懂|没学过|不了解|不确定|也没思路|想不出|这题不会|不会做|我想想|让我想想|再想想|还没想好)/.test(t)
        && !/我觉得|我认为|可能是|应该是|大概是|不太确定但|猜/.test(t);
      st.history.push({
        question: q.question || "", type: q.type || "essay", answer: ans,
        dimension: q.dimension || "", weak: weakAnswer, isFollowup,
        followupText: isFollowup ? (st.asked[st.asked.length - 1] || "") : "",
      });
      return { next: "route" };
    },
    // 路由节点：集中条件判断（连续原题 weak → 提前终止）
    route: (st) => {
      // 连续原题首答 weak ≥3 才终止（一个知识点不会不终止；与 fail 文案「连续」语义一致）
      let consecutiveWeak = 0;
      for (const h of st.history) {
        if (!h.isFollowup) consecutiveWeak = h.weak ? consecutiveWeak + 1 : 0;
        if (consecutiveWeak >= 3) break;
      }
      if (consecutiveWeak >= 3) return { next: "fail" };
      return { next: "judge" };
    },
    // 评估节点：LLM 判断回答 → followup / advance / judged（统一 llmJSON 约束）
    judge: async (st) => {
      const q = st.current || {};
      const curQuestion = q.question || "";
      const last = st.history[st.history.length - 1] || {};
      const ans = last.answer || "";
      const sendBtn = $("#interview-send");
      if (sendBtn) sendBtn.disabled = true;
      showInterviewTyping(true);
      try {
        const followPrompt = buildInterviewFollowPrompt(st, q, curQuestion, ans, INTERVIEWER_TACTICS);
        const judgeResult = await llmJSON({
          system: buildInterviewerSystem(st.job),
          prompt: followPrompt,
          formatHint: INTERVIEW_JSON_HINT,
          expect: "object",
          maxTokens: 700,
          part: "interview-judge",
          validateObj: (o) => DataSchema.validateBySchema(o, DataSchema.OBJECT_SCHEMAS["interview-judge"]),
        });
        showInterviewTyping(false);
        st._followup = judgeResult.followup || "";
        st._advanceReply = judgeResult.advance || "";
        st._judged = judgeResult.judged === "weak" ? "weak" : "ok";
      } catch (e) {
        showInterviewTyping(false);
        st._followup = ""; st._advanceReply = ""; st._judged = "ok";
      }
      return { next: "decide" };
    },
    // 决策节点：是否追问（追问预算随轮次递减，避免耐力赛）
    decide: (st) => {
      // 追问预算随轮次递减：1-2 题追 3、3-4 题追 2、之后 1（避免 8 轮 × 3 追问拖成耐力赛）
      const followBudget = Math.max(1, 3 - Math.floor(st.round / 2));
      const shouldFollow = (st.currentFollows || 0) < followBudget || st._judged === "weak";
      if (shouldFollow && (st.currentFollows || 0) < followBudget + 1) return { next: "follow" };
      return { next: "advance" };
    },
    // 追问节点：显示追问（LLM 追问或兜底）
    follow: (st) => {
      const q = st.current || {};
      const msg = st._followup || buildFallbackFollowup(st, q);
      st.currentFollows = (st.currentFollows || 0) + 1;
      st.asked.push(msg);
      appendInterviewMessage("interviewer", msg, "追问");
      return { next: "WAIT" };
    },
    // 推进节点：轮次+1 → 下一题或结束评分
    advance: async (st) => {
      st.currentFollows = 0;
      st.round++;
      if (st._advanceReply) { appendInterviewMessage("interviewer", st._advanceReply, "过渡"); st._advanceReply = ""; }
      if (st.round >= st.maxRounds) {
        appendInterviewMessage("interviewer", "好的，今天的面试就到这里，感谢你的时间。我来综合评估一下。", "结束");
        await finishInterview();
        return { next: "END" };
      }
      return { next: "ask" };
    },
    // 提前终止节点：连续弱回答，直接判定不合格
    fail: (st) => {
      const weakCount = st.history.filter((h) => h.weak).length;
      showInterviewTyping(false);
      const sb = $("#interview-send");
      if (sb) sb.disabled = true;
      appendInterviewMessage("interviewer", "（面试官合上简历，叹了口气）", "结束");
      appendInterviewMessage("interviewer", `连续 ${weakCount} 次基础问题都没答上来，这次面试到此为止。你的基础还没打牢，建议先回去把「${st.job.name}」的核心概念补扎实，再回来面试。`, "结束");
      const failedResult = {
        totalScore: 20,
        dimensions: [{ name: "面试表达力", score: 15, comment: `连续 ${weakCount} 次直接答「不知道/不会」，连最基础的概念都组织不出答案，缺乏基本功。` }],
        overall: `这次面试暴露出很严重的基础问题：连续 ${weakCount} 次连最基础的概念都答不上来，「${st.job.name}」的核心知识几乎为零。建议先系统补一遍岗位要求里的核心概念，再回来面试。`,
      };
      setTimeout(() => renderInterviewResult(failedResult), 1600);
      return { next: "END" };
    },
  },
};

/* 图执行器：从节点开始链式执行，直到 WAIT（等用户作答）或 END（结束） */
async function runInterviewGraph(st, node, payload) {
  let cur = node;
  let p = payload;
  while (cur && cur !== "WAIT" && cur !== "END") {
    const r = await InterviewGraph.nodes[cur](st, p);
    p = undefined;
    cur = r ? r.next : "END";
  }
}

// 出题入口（HTML 开始按钮 / 下一题）
function generateNextQuestion() {
  runInterviewGraph(interviewState, "ask");
}

// 作答入口（sendInterviewMessage / chooseInterviewOption 调用）：记录 → 路由 → 评估 → 追问/推进
async function proceedInterviewAnswer(ans) {
  const st = interviewState;
  if (interviewBusyCount > 0) { showToast("⏳ 面试官正在回复，请稍候…"); return; }
  interviewBusyCount++;
  try {
    await runInterviewGraph(st, "record", ans);
  } finally {
    interviewBusyCount = Math.max(0, interviewBusyCount - 1);
    const sb = $("#interview-send");
    if (sb) sb.disabled = false;
  }
}

// 推进入口（错误兜底）
function advanceInterview() {
  runInterviewGraph(interviewState, "advance");
}


/* 选择题：在聊天气泡下方渲染选项按钮 */
function appendInterviewOptions(options) {
  const body = $("#interview-body");
  if (!body) return;
  const wrap = document.createElement("div");
  wrap.className = "iv-msg";
  wrap.innerHTML = `
    <div class="iv-bubble-avatar">${icon("robot")}</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;padding-left:44px">
      ${options.map((o, i) => `<button class="exam-btn ghost" style="font-size:13px;padding:8px 14px" onclick="chooseInterviewOption(${i})">${String.fromCharCode(65 + i)}. ${esc(o.replace(/^[A-D][.、)]\s*/, ""))}</button>`).join("")}
    </div>`;
  const slot = $("#iv-typing-slot");
  if (slot) body.insertBefore(wrap, slot); else body.appendChild(wrap);
  // 选择题出现时置灰输入框：明确「点上方选项作答」
  const inp = $("#interview-input");
  if (inp) { inp.disabled = true; inp.placeholder = "点击上方选项作答"; }
  scrollInterviewToBottom();
}

function chooseInterviewOption(i) {
  if (interviewBusyCount > 0) return;   // 竞态守卫：面试官处理中，忽略连点
  const st = interviewState;
  const opts = (st.current && st.current.options) || [];
  const label = opts[i] || (String.fromCharCode(65 + i));
  appendInterviewMessage("candidate", String.fromCharCode(65 + i) + ". " + label.replace(/^[A-D][.、)]\s*/, ""));
  // 选择题程序判对错：立即反馈（correctIndex 比对，不依赖 LLM）
  const ciRaw = Array.isArray(st.current.correctIndex) ? st.current.correctIndex[0] : st.current.correctIndex;
  const ci = Number.isFinite(Number(ciRaw)) ? Number(ciRaw) : null;   // 容错：LLM 可能返回字符串 "1"
  if (ci !== null && st.current.options && st.current.options.length) {
    appendInterviewMessage("interviewer", i === ci ? "✅ 选对了，我们深入一下。" : "❌ 不完全对，我们换个角度看看。", "判分");
  }
  // 恢复输入框（下一题若是选择题会再次置灰）
  const inp = $("#interview-input");
  if (inp) { inp.disabled = false; inp.placeholder = "输入你的回答…"; }
  proceedInterviewAnswer(label);
}

async function sendInterviewMessage() {
  if (interviewBusyCount > 0) { showToast("⏳ 面试官正在回复，请稍候…"); return; }   // 竞态守卫：防连点交错
  const st = interviewState;
  const ta = $("#interview-input");
  const ans = (ta ? ta.value : "").trim();
  if (!ans) { showToast("⚠️ 请先输入你的回答"); return; }
  ta.value = "";
  appendInterviewMessage("candidate", ans);
  proceedInterviewAnswer(ans);
}

/* 兜底追问：LLM 未返回追问内容时，用岗位追问方向生成一个追问，确保「前端强制追问」绝不失效 */
function buildFallbackFollowup(st, q) {
  const hints = st.job.followUpHints || [];
  const hint = hints[(st.currentFollows || 0) % Math.max(hints.length, 1)];
  if (hint) return `我们换个角度深挖一下：${hint}`;
  const dim = q.dimension || "这个知识点";
  return `这道题的核心是「${dim}」。先别管完整方案，说说你目前对「${dim}」了解的部分，哪怕是最基础的也行。`;
}

/* 处理候选人的一条回答：记录 → 面试官回应（追问/肯定并推进）→ 动态生成下一题或结束 */




async function finishInterview() {
  const st = interviewState;
  render(null, `
    <div class="card" style="text-align:center;padding:40px 28px">
      <div style="font-size:40px;margin-bottom:12px">🧠</div>
      <h2 style="font-size:20px;font-weight:800;color:var(--accent);margin-bottom:8px">面试结束，面试官正在综合评分…</h2>
      <div id="interview-score" style="font-size:13px;color:var(--text-2);margin-top:12px">正在评估你的 ${st.history.length} 轮表现…</div>
    </div>`);
  try {
    const historyTxt = st.history.map((h, i) => {
      const label = h.isFollowup ? `Q(追问): ${(h.followupText || "").slice(0, 120)}` : `Q: ${h.question}`;
      return `${i + 1}. [${h.dimension}] ${label}\n   A: ${h.answer.slice(0, 400)}${h.weak ? "（⚠️ 直接答「不知道/不会」，未作答，应严格扣分）" : ""}`;
    }).join("\n\n");
    const scorePrompt = buildInterviewScorePrompt(st, historyTxt);
    // 评分统一走 llmJSON 约束（解析失败自动反馈重出，最多 3 次）
    const scoreResult = await llmJSON({
      system: buildInterviewerSystem(st.job),
      prompt: scorePrompt,
      formatHint: INTERVIEW_JSON_HINT,
      expect: "object",
      maxTokens: 2000,
      temperature: 0.3,
      part: "interview-score",
      validateObj: (o) => DataSchema.validateBySchema(o, DataSchema.OBJECT_SCHEMAS["interview-score"]),
    });
    Logger.info("interview.score", "面试评分完成", { rounds: st.history.length, totalScore: scoreResult && scoreResult.totalScore });
    renderInterviewResult(scoreResult);
  } catch (e) {
    Logger.error("interview.score-fail", "面试评分失败: " + String((e && e.message) || e), { rounds: st.history.length });
    // 评分失败兜底：给一个带总评的结果，避免空结果页（点评/总评全部丢失）
    renderInterviewResult({
      totalScore: null,
      dimensions: [],
      overall: "⚠️ 面试评分服务暂时不可用（可能是网络或 API Key 问题），无法生成逐维度点评。你的面试记录已保存，可稍后在「历史记录」里回看。",
    });
  }
}

function renderInterviewResult(result) {
  const st = interviewState;
  const totalScore = result && typeof result.totalScore === "number" ? Math.max(0, Math.min(100, Math.round(result.totalScore))) : null;
  // BUG-2 修复：评分失败（totalScore null）时不再回退到上一次考核分数，避免误导「通过」并污染面试记录
  const scoreFailed = totalScore === null;
  const pct = scoreFailed ? null : totalScore;
  const ok = !scoreFailed && pct >= 60;

  // 计入考核历史与能力画像（面试维度得分）——评分失败时不入历史/画像/徽章（避免历史分数污染面试记录）
  if (!scoreFailed) {
    state.exams++;
    state.history.push({ date: new Date().toISOString(), mode: "interview", score: pct, total: 100, pct, abilities: {} });
    if (pct >= 80) state.bestInterview = Math.max(state.bestInterview, pct);
    if (!state.modesDone) state.modesDone = [];
    if (!state.modesDone.includes("interview")) state.modesDone.push("interview");
    // 能力画像：按面试维度得分累积（BUG-3/6 修复：维度名对齐 ABILITIES 白名单 + 量纲对齐理论考核）
    if (!state.abilityProfile) state.abilityProfile = {};
    if (result && result.dimensions && result.dimensions.length) {
      for (const d of result.dimensions) {
        const raw = (d.name || "").trim();
        if (!raw) continue;
        // BUG-3：维度名必须落在 ABILITIES 10 维白名单内，白名单外的丢弃，避免污染画像/雷达/岗位匹配
        if (!ABILITIES.includes(raw)) continue;
        if (!state.abilityProfile[raw]) state.abilityProfile[raw] = { sum: 0, count: 0 };
        // BUG-6：量纲对齐理论考核（sum 累加得分、count 累加 1，去掉原来的 ×2）
        state.abilityProfile[raw].sum += (d.score || 0);
        state.abilityProfile[raw].count += 1;
        state.abilityProfile[raw].lastAt = Date.now();
      }
    }
  }
  // 保存完整面试记录（供「面试记录」页面回顾；评分失败也保存并标记 failed）
  if (!state.interviewLogs) state.interviewLogs = [];
  state.interviewLogs.unshift({
    job: st.job.name,
    date: new Date().toISOString(),
    score: pct,
    failed: scoreFailed,
    dimensions: (result && result.dimensions) || [],
    overall: (result && result.overall) || "",
    qa: st.history.map((h) => ({ q: h.isFollowup ? (h.followupText || h.question) : h.question, a: h.answer, weak: !!h.weak, followup: !!h.isFollowup })),
  });
  state.interviewLogs = state.interviewLogs.slice(0, 50);
  saveState();

  const dimsHtml = (result && result.dimensions && result.dimensions.length)
    ? result.dimensions.map((d) => `
      <div style="padding:10px 12px;border-bottom:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px">
          <span style="color:var(--text-0);font-weight:700">${esc(d.name)}</span>
          <span style="font-weight:800;color:${d.score >= 70 ? "#00e5ff" : d.score >= 50 ? "#ffb84d" : "#ff6b6b"}">${d.score} 分</span>
        </div>
        ${d.comment ? `<div style="font-size:12px;color:var(--text-2);line-height:1.7;margin-top:4px">💬 ${esc(d.comment)}</div>` : ""}
      </div>`).join("")
    : "";

  render(null, `
    <button class="exam-btn ghost" onclick="goHome()" style="margin-bottom:18px">← 返回首页</button>
    <div class="card" style="text-align:center;padding:34px 28px">
      <div style="font-size:40px;margin-bottom:10px">${scoreFailed ? "⚠️" : ok ? "🎉" : "💪"}</div>
      <div style="font-size:12px;color:var(--text-2)">${esc(st.job.name)} · 仿真面试结果</div>
      <div style="font-size:52px;font-weight:900;color:${scoreFailed ? "#ffb84d" : ok ? "#00e5ff" : "#ffb84d"};margin:8px 0;font-family:var(--cyber)">${scoreFailed ? "—" : pct + " 分"}</div>
      <div style="font-size:14px;color:${scoreFailed ? "#ffb84d" : ok ? "#2fd6b5" : "#ff6b6b"};font-weight:700">${scoreFailed ? "⚠️ 评分失败（网络或 API Key 问题）" : ok ? "✅ 通过（≥60）" : "❌ 未通过（<60）"}</div>
    </div>
    ${dimsHtml ? `<div class="card" style="margin-top:14px"><div style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--accent)">📊 维度得分</div>${dimsHtml}</div>` : ""}
    ${result && result.overall ? `<div class="card" style="margin-top:14px"><div style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--accent)">📝 面试官总评</div><div style="font-size:13.5px;color:var(--text-1);line-height:1.9">${esc(result.overall)}</div></div>` : ""}
    <div style="margin-top:16px;display:flex;gap:12px;justify-content:center">
      <button class="exam-btn primary" onclick="goHome()">🏠 返回首页</button>
      <button class="exam-btn ghost" onclick="startInterview()">↺ 再来一次</button>
    </div>`);
  updateGamestat();   // C1：面试结束后刷新顶栏状态
}

/* ===== 考核主流程 ===== */
/* 加载所有目录的完整课程（含题目），供综合考核聚合出题 */
async function loadAllDirCourses() {
  const dirs = await refreshDirs();
  const courses = [];
  for (const d of dirs) {
    const res = await fetch(`./api/dir?uid=${encodeURIComponent(UID)}&id=${encodeURIComponent(d.id)}`, { cache: "no-store" });
    if (res.ok) {
      const dd = await res.json();
      if (dd && dd.course && (dd.course.quiz || []).length) {
        courses.push({ ...dd.course, dirId: d.id, dirTitle: d.title });
      }
    }
  }
  return courses;
}

/* 高级加载动画：终端 HUD 风格（理论/实战考核共用）——考核强制要求 LLM，引擎恒为 AI-AUGMENTED */
function showExamLoading(mode) {
  const label = mode === "theory" ? "THEORY EXAM" : "PRACTICAL EXAM";
  const engineTag = "AI-AUGMENTED";   // startExam/startDirExam 已拦截无 LLM，恒为增强模式
  render(null, `
    <div class="card exam-loading">
      <div class="el-head">
        <span class="el-title"><span class="logo-cursor">&gt;_</span> EXAM ENGINE <span class="el-mode">[${label}]</span></span>
        <span class="el-tagbox">
          <span class="el-engine llm">${engineTag}</span>
          <span class="el-spinner"></span>
        </span>
      </div>
      <div class="el-term" id="exam-loading-log"></div>
      <div class="el-progress"><div class="el-progress-fill" id="exam-loading-bar"></div></div>
      <div class="el-status" id="exam-loading-text"></div>
    </div>`);
  const api = {
    log(text) {
      const box = $("#exam-loading-log");
      if (!box) return;
      const line = document.createElement("div");
      line.className = "el-line";
      line.innerHTML = `<span class="el-ok">✓</span> ${esc(text)}`;
      box.appendChild(line);
      box.scrollTop = box.scrollHeight;
    },
    setStatus(text) {
      const el = $("#exam-loading-text");
      if (el) el.innerHTML = `${esc(text)}<span class="el-cursor"></span>`;
    },
    setProgress(pct) {
      const bar = $("#exam-loading-bar");
      if (bar) bar.style.width = Math.max(0, Math.min(100, pct)) + "%";
    },
    // LLM 调用期间缓慢推进伪进度（避免进度条静止让用户以为卡死）
    autoProgress(from, to, stepMs) {
      let p = from;
      const t = setInterval(() => {
        p = Math.min(to, p + 0.8);
        this.setProgress(p);
      }, stepMs || 300);
      return () => clearInterval(t);
    },
  };
  api.log("读取本地题库目录");
  api.log("准备连接 LLM 组卷");
  api.setStatus("INITIALIZING ENGINE + LLM AUGMENTATION");
  api.setProgress(6);
  // 记录开始时间，用于保证动画至少展示一小段（本地加载太快会一闪而过）
  const startTime = Date.now();
  api.finish = async function () {
    const MIN_SHOW = 1800;   // 至少展示 1.8 秒，让动画各阶段都看得清
    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_SHOW) {
      await new Promise((r) => setTimeout(r, MIN_SHOW - elapsed));
    }
    api.setProgress(100);
    const el = $("#exam-loading-text");
    if (el) el.innerHTML = "✅ 试卷就绪";
  };
  return api;
}

function startExam(mode) {
  setNavActive(mode === "practical" ? "practical" : "theory");
  // 理论/实战考核都需要 LLM（出题 + 打标签 + 判分）
  if (!LLM_KEY) {
    const modeName = mode === "theory" ? "理论" : "实战";
    showModal({
      iconHtml: icon("robot"),
      title: `${modeName}考核需要 LLM`,
      text: `${modeName}考核的出题、题目能力打标签、语义判分都由 LLM 完成，需要先配置 API Key（支持 DeepSeek 官方或中转站）。Key 仅保存在本机浏览器，浏览器直连 API，不会上传服务器。`,
      actions: [
        { label: "⚙️ 去设置", primary: true, onClick: () => showSettings() },
        { label: "先不了", onClick: () => {} },
      ],
    });
    return;
  }
  examMode = mode;
  isCrossExam = true;   // 综合考核 = 跨目录
  examDirId = null;
  Logger.begin("exam");
  Logger.info("exam.start", "开始综合考核", { mode });
  const seq = ++examSeq;   // A1：竞态守卫，旧请求返回不覆盖新试卷
  const loading = showExamLoading(mode);
  loadAllDirCourses().then(async (courses) => {
    if (seq !== examSeq) return;   // 已被新考核取代
    loading.log(`聚合目录题库 → ${courses.length} 个目录`);
    loading.setStatus("聚合章节题目");
    loading.setProgress(35);
    let filtered = [];
    const seenQ = new Set();   // 跨目录去重（不同目录可能含相同题）
    for (const c of courses) {
      const quiz = c.quiz || [];
      for (const q of quiz) {
        let ok = false;
        if (mode === "theory") {
          ok = (q.dimension || inferDimension(q)) === "theory" && ["choice", "multi_choice", "true_false", "fill_blank"].includes(q.type);
        } else if (mode === "practical") {
          ok = (q.dimension || inferDimension(q)) === "practical" && q.type === "practical";
        }
        if (!ok) continue;
        const key = String(q.question || "");
        if (seenQ.has(key)) continue;
        seenQ.add(key);
        filtered.push({ ...q, source: c.dirTitle });
      }
    }
    // 程序化组卷：从聚合题库随机抽取（难度/薄弱维度加权 + 反馈坏题剔除 + 随机），不依赖 LLM 现出题
    loading.log("从全题库随机组卷");
    loading.setProgress(75);
    filtered = adaptivePick(filtered, mode === "theory" ? 16 : 10);
    loading.log("题库组卷 → " + filtered.length + " 题（程序随机组卷 · 回顾题稍后注入）");
    if (!filtered.length) {
      showToast("⚠️ 暂无题目，请先导入资料");
      goHome();
      return;
    }
    loading.setProgress(95);
    // D1：回顾题（第 2 次及以后从历史错题/考过题抽 2-3 道，按模式过滤题型）
    loading.log("注入回顾题（错题间隔重考，计入总题量）");
    filtered = injectReviewQuestions(filtered, mode, mode === "theory" ? 16 : 10);
    // 最终防御：按考核模式过滤题型（LLM 动态题/回顾题可能混入其他题型）
    filtered = filtered.filter((q) => mode === "theory"
      ? ["choice", "multi_choice", "true_false", "fill_blank"].includes(q.type)
      : q.type === "practical");
    filtered = filterKnownBad(filtered);   // 已知错题硬黑名单（最终防线）
    filtered = shuffleChoiceOptions(filtered);   // 选项洗牌：正确答案位置随机化
    filtered = shuffle(filtered);   // 题目整体再洗牌：回顾题融入随机位置，每场顺序不同
    loading.setProgress(95);
    await loading.finish();   // 确保动画至少展示一小段，避免本地加载太快一闪而过
    quiz = filtered;
    quizIdx = 0;
    combo = 0;
    correctCount = 0;
    abilityScore = {};
    answers = [];
    renderQuestion();
  }).catch(() => {
    if (seq !== examSeq) return;
    showToast("⚠️ 加载目录失败，请重试");
    goHome();
  });
}

/* 代码实战客观题：渲染代码块，标注行高亮显示 */
function renderCodeBlock(file, code, highlightLines) {
  const lines = String(code || "").split("\n");
  const hl = new Set((highlightLines || []).map((n) => Number(n)));
  const maxNo = Math.max(3, String(lines.length).length);
  const body = lines.map((ln, i) => {
    const n = i + 1;
    const isHl = hl.has(n);
    return `<div class="code-line${isHl ? " hl" : ""}" data-line="${n}"><span class="code-no">${String(n).padStart(maxNo, "0")}</span><span class="code-txt">${esc(ln) || "\u00a0"}</span></div>`;
  }).join("");
  return `<div style="margin-bottom:12px">
    ${file ? `<div style="font-size:11.5px;color:var(--accent-3);font-family:var(--mono);margin-bottom:4px">📄 ${esc(file)}</div>` : ""}
    ${(highlightLines || []).length ? `<div style="font-size:10.5px;color:#ffb84d;margin-bottom:4px">▎标注段：第 ${(highlightLines || []).join("、")} 行（高亮）</div>` : ""}
    <div class="code-block">${body}</div>
  </div>`;
}

function renderQuestion() {
  const q = quiz[quizIdx];
  wrongAttempts = 0;   // 新题重置答错重试状态
  const total = quiz.length;
  const progress = (quizIdx / total) * 100;
  const typeCls = q.type === "multi_choice" || q.type === "true_false" ? "multi"
    : q.type === "fill_blank" ? "fill"
    : q.type === "essay" ? "essay"
    : q.type === "practical" ? "practical" : "";
  const hint = q.type === "multi_choice" ? "（多选：选出所有正确答案）"
    : q.type === "choice" ? "（单选）"
    : q.type === "fill_blank" ? "（输入关键术语，模糊匹配）"
    : q.type === "essay" ? "（先自己组织语言回答，再看参考答案）"
    : q.type === "practical" ? (((q.practical || {}).compareMode === "code_choice") ? "（阅读代码后选择答案）" : "（按任务运行代码，再作答）")
    : "";
  // 难度星级
  const diff = q.difficulty || 2;
  const diffStars = "★".repeat(Math.max(1, Math.min(5, diff))) + "☆".repeat(Math.max(0, 5 - Math.max(1, Math.min(5, diff))));
  // 知识点/能力维度 + 来源
  const ability = q.ability || inferDimension(q);
  const sourceLabel = q.dynamic ? "LLM 动态" : (q.source && q.source !== "current" ? "📚 " + q.source : "📚 题库");

  render(() => {
    $("#exam-view").scrollTop = 0;
    document.getElementById("main")?.scrollTo?.(0, 0);
  }, `
    <div class="exam-progress-bar"><div class="exam-progress-fill" style="width:${progress}%"></div>
      <button class="exam-quit" title="退出考核" onclick="quitExam()">✕</button>
    </div>
    <div class="exam-progress-stat">第 ${quizIdx + 1} / ${total} 题 · 已答对 ${correctCount} 题${combo >= 2 ? ` · 🔥 连击 ×${combo}` : ""}</div>
    <div class="exam-question-head">
      <div class="exam-q-meta">${TYPE_LABEL[q.type] || q.type} · 难度 ${diffStars}</div>
      <span class="exam-q-type ${typeCls}">${TYPE_LABEL[q.type] || q.type}</span>
      ${q.dynamic ? '<span class="exam-q-type" style="background:rgba(255,61,240,0.12);color:#ff3df0">${icon("robot")} LLM 动态</span>' : ""}
      ${q.interview ? '<span class="exam-q-type" style="background:rgba(255,184,77,0.15);color:#ffb84d">💼 面试</span>' : ""}
    </div>
    <div class="exam-q-tags">
      <span class="eq-tag ability">🎯 ${esc(ability)}</span>
      <span class="eq-tag source">${esc(sourceLabel)}</span>
    </div>
    <div class="exam-question">${esc(q.question)}</div>
    <div class="exam-hint">${hint}</div>
    ${questionBody(q)}
    <div style="display:flex;justify-content:flex-start;margin-top:12px">
      <button class="exam-btn ghost exam-feedback-btn" onclick="flagQuestion()">这题有问题？反馈</button>
    </div>
    <div class="exam-nav-btns">
      ${quizIdx > 0 ? `<button class="exam-btn ghost" onclick="prevQuestion()">← 上一题</button>` : "<span></span>"}
      ${answers.some((a) => a.q === q)
        ? `<button class="exam-btn primary" id="submit-btn" onclick="nextQuestion()">${quizIdx === total - 1 ? "🏁 查看成绩" : "下一题 →"}</button>`
        : (q.type === "practical" && (q.practical || {}).compareMode === "code_fill")
          ? `<button class="exam-btn primary" id="submit-btn" onclick="runCodeFill()">▶ 运行代码（${quizIdx === total - 1 ? "最后一步" : "然后下一题"}）</button>`
          : `<button class="exam-btn primary" id="submit-btn" onclick="submitAnswer()">${quizIdx === total - 1 ? "🏁 提交并评分" : "✅ 确认答案 →"}</button>`}
    </div>`);
}

function questionBody(q) {
  if (q.type === "choice" || q.type === "multi_choice") {
    const multi = q.type === "multi_choice";
    return `<div class="qz-options">${(q.options || []).map((opt, i) => `
      <label class="qz-opt">
        <input type="${multi ? "checkbox" : "radio"}" name="q${quizIdx}" value="${i}">
        <span class="qz-opt-key">${String.fromCharCode(65 + i)}</span>
        <span class="qz-opt-text">${esc(opt.replace(/^[A-E][.、)]\s*/, ""))}</span>
      </label>`).join("")}</div>`;
  }
  if (q.type === "true_false") {
    return `<div class="qz-options qz-tf">
      <label class="qz-opt"><input type="radio" name="q${quizIdx}" value="对"><span class="qz-opt-key">✓</span><span class="qz-opt-text">正确</span></label>
      <label class="qz-opt"><input type="radio" name="q${quizIdx}" value="错"><span class="qz-opt-key">✗</span><span class="qz-opt-text">错误</span></label>
    </div>`;
  }
  if (q.type === "fill_blank") {
    return `<input class="qz-essay-input" id="fill-input" placeholder="输入答案（如 NewsItem）…" style="width:100%">`;
  }
  if (q.type === "essay") {
    return `<textarea class="qz-essay-input" id="essay-input" rows="5" placeholder="用自己的话回答…"></textarea>
      <div id="essay-followups" style="margin-top:12px"></div>`;
  }
  if (q.type === "practical") {
    const p = q.practical || {};
    let body = "";
    if (p.files && p.files.length) body += `<div style="font-size:11.5px;color:var(--accent-3);margin-bottom:8px">📄 需运行：${esc(p.files.join(", "))}</div>`;
    if (p.task) body += `<div style="font-size:13.5px;color:var(--text-1);margin-bottom:8px;line-height:1.7">🎯 ${esc(p.task)}</div>`;
    if (p.codeContext) body += `<div style="font-size:12px;color:var(--text-2);margin-bottom:12px;padding:10px 12px;background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:8px;font-family:var(--mono);line-height:1.6;white-space:pre-wrap">📚 ${esc(p.codeContext)}</div>`;
    if (p.compareMode === "choice") {
      body += `<div class="qz-options">${(p.options || []).map((opt, i) => `
        <label class="qz-opt"><input type="radio" name="q${quizIdx}" value="${i}">
        <span class="qz-opt-key">${String.fromCharCode(65 + i)}</span>
        <span class="qz-opt-text">${esc(opt.replace(/^[A-E][.、)]\s*/, ""))}</span></label>`).join("")}</div>`;
    } else if (p.compareMode === "code_choice") {
      // 代码实战客观题：代码块（单文件 code / 多文件 codeBlocks）+ 高亮标注段 + 单选/多选
      const blocks = (p.codeBlocks && p.codeBlocks.length) ? p.codeBlocks
        : (p.code ? [{ file: (p.files || [])[0] || "", code: p.code }] : []);
      body += blocks.map((b) => renderCodeBlock(b.file, b.code, p.highlightLines)).join("");
      body += `<div class="qz-options">${(p.options || []).map((opt, i) => `
        <label class="qz-opt"><input type="${p.multi ? "checkbox" : "radio"}" name="q${quizIdx}" value="${i}">
        <span class="qz-opt-key">${String.fromCharCode(65 + i)}</span>
        <span class="qz-opt-text">${esc(opt.replace(/^[A-E][.、)]\s*/, ""))}</span></label>`).join("")}</div>`;
      if (p.multi) body += `<div style="font-size:11px;color:var(--accent-2);margin-top:6px">☑ 多选：选出所有正确答案</div>`;
    } else if (p.compareMode === "llm_code") {
      body += `<div style="font-size:12px;color:var(--accent);margin-bottom:8px;font-family:var(--mono)">⌨️ 请编写代码实现上面的任务（Python）</div>
      <textarea class="qz-code-input" id="code-input" rows="10" spellcheck="false" placeholder="在这里写你的代码…" style="width:100%;font-family:var(--mono);background:#0a0f16;color:#e6f7ff;border:1px solid var(--border);border-radius:8px;padding:12px;font-size:13px;line-height:1.6;resize:vertical;box-sizing:border-box"></textarea>`;
    } else if (p.compareMode === "code_fill") {
      // 代码补全题：代码缺失关键行（missingLines），用户逐行补全后「运行」验证输出（LLM 判分）
      const lines = String(p.code || "").split("\n");
      const missing = new Set((p.missingLines || []).map((n) => Number(n)));
      const cfBody = lines.map((ln, i) => {
        const n = i + 1;
        if (missing.has(n)) {
          return `<div class="code-line" style="background:rgba(255,184,77,0.09)"><span class="code-no">${String(n).padStart(4, "0")}</span><input class="cf-fill" data-line="${n}" placeholder="← 补充第 ${n} 行（缩进要正确）" style="flex:1;min-width:0;background:transparent;border:none;outline:none;color:#ffd08a;font-family:var(--mono);font-size:12.5px;padding:0 2px"></div>`;
        }
        return `<div class="code-line"><span class="code-no">${String(n).padStart(4, "0")}</span><span class="code-txt">${esc(ln) || "\u00a0"}</span></div>`;
      }).join("");
      body += `<div style="font-size:12px;color:var(--accent);margin-bottom:8px;font-family:var(--mono)">🧩 补齐缺失代码，点击「运行」验证输出（3 次机会）</div>
      <div class="code-block" style="margin-bottom:10px">${cfBody}</div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <button class="exam-btn primary" id="cf-run-btn" onclick="runCodeFill()">▶ 运行代码</button>
        <span id="cf-status" style="font-size:12px;color:var(--text-2);font-family:var(--mono)">剩余 3 次运行机会</span>
      </div>
      <pre id="cf-output" style="display:none;margin-top:10px;background:#0a0f16;border:1px solid var(--border);border-radius:8px;padding:12px;font-family:var(--mono);font-size:12.5px;color:#7ee8c8;white-space:pre-wrap;word-break:break-all;max-height:220px;overflow:auto"></pre>`;
    } else {
      body += `<textarea class="paste-area" id="paste-input" placeholder="运行代码后，把终端输出粘贴到这里，或描述关键区别…"></textarea>`;
    }
    return body;
  }
  return "";
}

function collectAnswer() {
  const q = quiz[quizIdx];
  if (q.type === "choice" || q.type === "multi_choice") {
    const sel = $$(`input[name="q${quizIdx}"]:checked`).map((i) => +i.value);
    return q.type === "multi_choice" ? sel : sel[0];
  }
  if (q.type === "true_false") {
    const r = $(`input[name="q${quizIdx}"]:checked`);
    return r ? r.value : null;
  }
  if (q.type === "fill_blank") return $("#fill-input")?.value?.trim() || "";
  if (q.type === "essay") return $("#essay-input")?.value?.trim() || "";
  if (q.type === "practical") {
    const p = q.practical || {};
    if (p.compareMode === "choice") {
      const r = $(`input[name="q${quizIdx}"]:checked`);
      return r ? +r.value : null;
    }
    if (p.compareMode === "code_choice") {
      const sel = $$(`input[name="q${quizIdx}"]:checked`).map((i) => +i.value);
      return p.multi ? sel : sel[0];
    }
    if (p.compareMode === "llm_code") return $("#code-input")?.value?.trim() || "";
    return $("#paste-input")?.value?.trim() || "";
  }
  return null;
}

/* ===== code_fill 代码补全题：运行验证（LLM 判分）+ 3 次机会 ===== */
const cfRuns = {};   // quizIdx -> 已运行次数

function runCodeFill() {
  const q = quiz[quizIdx];
  const p = (q && q.practical) || {};
  if (answers.some((a) => a.q === q)) { showToast("⚠️ 该题已作答，请继续下一题"); return; }
  if (!cfRuns[quizIdx]) cfRuns[quizIdx] = 0;
  // 组装代码：缺失行用用户输入补回
  const lines = String(p.code || "").split("\n");
  const missing = new Set((p.missingLines || []).map((n) => Number(n)));
  let incomplete = false;
  const filled = lines.map((ln, i) => {
    const n = i + 1;
    if (missing.has(n)) {
      const v = $(`.cf-fill[data-line="${n}"]`)?.value || "";
      if (!v.trim()) incomplete = true;
      return v.replace(/\n/g, "");
    }
    return ln;
  });
  if (incomplete) { showToast("⚠️ 还有缺失行未填写"); return; }
  const code = filled.join("\n");
  const btn = $("#cf-run-btn");
  const st = $("#cf-status");
  if (btn) { btn.disabled = true; btn.textContent = "⏳ 运行中…"; }
  if (st) st.textContent = "⏳ 正在运行…";
  fetch("/api/run-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid: UID, code, timeoutMs: 8000 }),
  }).then((r) => r.json()).then((data) => {
    if (btn) { btn.disabled = false; btn.textContent = "▶ 运行代码"; }
    const outEl = $("#cf-output");
    if (outEl) { outEl.style.display = "block"; outEl.textContent = (data.ok ? "" : "⚠️ ") + ((data.stdout || "") + (data.stderr || "") + (data.error ? "\n" + data.error : "")).trim() || "（无输出）"; }
    // LLM 判断：运行输出是否符合预期（data.ok 且输出包含 expectedOutput）
    const expected = String(p.expectedOutput || "").trim();
    const passed = data.ok && expected && ((data.stdout || "") + (data.stderr || "")).indexOf(expected) >= 0;
    if (passed) {
      if (st) st.textContent = "✅ 输出符合预期，本题通过！";
      finishCodeFill(q, true);
      return;
    }
    cfRuns[quizIdx]++;
    const left = 3 - cfRuns[quizIdx];
    if (st) st.textContent = left > 0 ? "❌ 输出不符合预期，剩余 " + left + " 次机会" : "❌ 3 次机会已用完，本题计错";
    if (left <= 0) {
      if (p.hint) showToast("💡 提示：" + p.hint);
      finishCodeFill(q, false);
    } else {
      showToast("❌ 输出不符合预期，请检查代码后再试（剩余 " + left + " 次）");
    }
  }).catch(() => {
    if (btn) { btn.disabled = false; btn.textContent = "▶ 运行代码"; }
    if (st) st.textContent = "⚠️ 运行服务不可用";
    showToast("⚠️ 运行服务不可用，请检查服务器");
  });
}

function finishCodeFill(q, ok) {
  answers.push({ q, userAns: { codeFill: true, ok }, judged: ok });
  if (ok !== null) recordAsked(q, !ok);
  const ab = q.ability || "提示词工程";
  if (!abilityScore[ab]) abilityScore[ab] = { got: 0, total: 0, n: 0 };
  abilityScore[ab].total += BASE_SCORE[q.type] || 10;
  abilityScore[ab].n += 1;
  if (ok) {
    correctCount++;
    combo++;
    const mult = combo >= 8 ? 2 : combo >= 5 ? 1.5 : combo >= 3 ? 1.2 : 1;
    const gained = Math.round((BASE_SCORE[q.type] || 10) * mult);
    state.xp += gained;
    if (combo > state.bestCombo) state.bestCombo = combo;
    abilityScore[ab].got += BASE_SCORE[q.type] || 10;
    showFeedback(true, gained, q, { codeFill: true });
    showCombo(combo);
    celebrateCorrect();
  } else {
    combo = 0;
    showFeedback(false, 0, q, { codeFill: true });
    burstParticles(window.innerWidth / 2, 160, "#ff6b6b");
  }
  const sb = $("#submit-btn");
  if (sb) {
    sb.textContent = quizIdx === quiz.length - 1 ? "🏁 查看成绩" : "下一题 →";
    sb.onclick = () => nextQuestion();
    sb.disabled = false;
  }
}

function submitAnswer() {
  const q = quiz[quizIdx];
  const userAns = collectAnswer();
  // B2：空选拦截（undefined / 空数组 / 空字符串）
  if (userAns === null || userAns === undefined
    || (Array.isArray(userAns) && userAns.length === 0)
    || (typeof userAns === "string" && !userAns.trim() && q.type !== "essay")) {
    showToast("⚠️ 请先作答再提交");
    return;
  }
  // B3：防止回退重答刷分（该题已提交过则直接跳过）
  if (answers.some((a) => a.q === q)) {
    showToast("⚠️ 该题已作答，请继续下一题");
    return;
  }
  // fill_blank 题：绑定 LLM 时直接 LLM 语义评判（模糊匹配不靠谱，语义识别必须 LLM）
  if (q.type === "fill_blank" && LLM_KEY && String(userAns || "").trim().length >= 2) {
    answers.push({ q, userAns, judged: null });
    const fbAb = q.ability || "提示词工程";
    if (!abilityScore[fbAb]) abilityScore[fbAb] = { got: 0, total: 0, n: 0 };
    abilityScore[fbAb].total += BASE_SCORE[q.type] || 10;
    abilityScore[fbAb].n += 1;
    showFillBlankGradeBox(q, userAns);
    return;
  }
  const judged = judgeAnswer(q, userAns);
  // 错误重试：客观题第一次答错 → 提示再试一次，不判分、不显示答案
  const retryable = ["choice", "multi_choice", "true_false", "fill_blank"].includes(q.type);
  if (judged === false && retryable && wrongAttempts === 0) {
    wrongAttempts = 1;
    showRetryHint(q);
    return;
  }
  answers.push({ q, userAns, judged });
  Logger.info("exam.submit", "", { type: q.type, judged: judged === null ? "llm" : (judged ? "ok" : "wrong"), dimension: q.dimension || "" });
  // 记录考过的题（回顾题机制）
  if (judged !== null) recordAsked(q, judged === false);
  // 能力计分
  const ab = q.ability || "提示词工程";
  if (!abilityScore[ab]) abilityScore[ab] = { got: 0, total: 0, n: 0 };
  abilityScore[ab].total += BASE_SCORE[q.type] || 10;
  abilityScore[ab].n += 1;

  if (judged === true) {
    correctCount++;
    combo++;
    const mult = combo >= 8 ? 2 : combo >= 5 ? 1.5 : combo >= 3 ? 1.2 : 1;
    const gained = Math.round((BASE_SCORE[q.type] || 10) * mult);
    state.xp += gained;
    if (combo > state.bestCombo) state.bestCombo = combo;
    abilityScore[ab].got += BASE_SCORE[q.type] || 10;
    showFeedback(true, gained, q, userAns);
    showCombo(combo);
    celebrateCorrect();
  } else if (judged === false) {
    combo = 0;
    showFeedback(false, 0, q, userAns);
    burstParticles(window.innerWidth / 2, 160, "#ff6b6b");
  } else if (q.type === "practical" && (q.practical || {}).compareMode === "llm_code") {
    // 代码实战题 → LLM 自动判分
    showCodeGradeBox(q, userAns);
  } else if (q.type === "practical" && LLM_KEY) {
    // 代码阅读题（self）→ 提交后直接 LLM 判定，无需额外点一次
    showReadingGradeBox(q, userAns);
  } else {
    // 问答题/无 LLM 的实战 → 展示参考答案，自评按钮
    showEssayFeedback(q);
  }
  checkLevelUp();
  updateGamestat();
  saveState();
}

/* 答对酷炫特效：全屏光晕 + 多重粒子爆发 */
function celebrateCorrect() {
  const cx = window.innerWidth / 2;
  // 全屏光晕闪一下
  const flash = document.createElement("div");
  flash.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:998;background:radial-gradient(circle at 50% 32%, rgba(0,229,255,0.28), rgba(47,214,181,0.10) 45%, transparent 70%);animation:correctFlash 0.9s ease forwards";
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 950);
  // 多重粒子（青色 + 绿色 + 洋红），错峰爆发更有层次
  burstParticles(cx, 180, "#00e5ff", 42);
  burstParticles(cx, 180, "#2fd6b5", 30);
  burstParticles(cx, 180, "#ff3df0", 18);
  setTimeout(() => burstParticles(cx, 210, "#00e5ff", 26), 140);
}

/* 答错重试提示：不显示答案，清空选择，引导再次作答 */
function showRetryHint(q) {
  const navBtns = $(".exam-nav-btns");
  if (navBtns) {
    const old = navBtns.querySelector(".qz-feedback.retry");
    if (old) old.remove();
    const fb = document.createElement("div");
    fb.className = "qz-feedback retry";
    fb.innerHTML = `🤔 <strong>不太对，再试一次！</strong><span style="font-size:11px;color:var(--text-2);margin-left:6px">（再错一次才会显示正确答案）</span>`;
    navBtns.insertBefore(fb, navBtns.firstChild);
  }
  clearAnswerInputs(q);
  burstParticles(window.innerWidth / 2, 160, "#ffb84d", 18);
}

/* 清空当前题输入，便于重新作答 */
function clearAnswerInputs(q) {
  if (q.type === "choice" || q.type === "multi_choice" || q.type === "true_false") {
    $$(`input[name="q${quizIdx}"]`).forEach((inp) => { inp.checked = false; });
  } else if (q.type === "fill_blank") {
    const inp = $("#fill-input");
    if (inp) { inp.value = ""; inp.focus(); }
  } else if (q.type === "practical") {
    const inp = $("#paste-input");
    if (inp) { inp.value = ""; inp.focus(); }
  }
}

function showFeedback(ok, gained, q, userAns) {
  const btn = $("#submit-btn");
  const navBtns = $(".exam-nav-btns");
  const correctText = q.type === "choice" || q.type === "multi_choice"
    ? `正确答案：<strong>${(Array.isArray(q.correctIndex) ? q.correctIndex : [q.correctIndex]).map((i) => String.fromCharCode(65 + i)).join("、")}</strong>`
    : q.type === "true_false" ? `正确答案：<strong>${esc(q.correctAnswer)}</strong>`
    : q.type === "fill_blank" ? `正确答案：<strong>${esc((q.fillAnswers || [q.correctAnswer]).join(" / "))}</strong>`
    : q.type === "practical" && (q.practical || {}).compareMode === "code_fill" ? `预期输出：<strong>${esc((q.practical || {}).expectedOutput || "")}</strong>${(q.practical || {}).hint ? `<br>💡 提示：${esc((q.practical || {}).hint)}` : ""}`
    : "";
  // 选项高亮动画：正确项闪绿，答错的选项闪红
  if (q.type === "choice" || q.type === "multi_choice") {
    const correctIdx = Array.isArray(q.correctIndex) ? q.correctIndex : [q.correctIndex];
    const opts = $$(".qz-opt");
    opts.forEach((opt, i) => {
      if (correctIdx.includes(i)) opt.classList.add("correct-flash");
    });
    if (!ok) {
      const userSel = Array.isArray(userAns) ? userAns : [userAns];
      opts.forEach((opt, i) => {
        if (userSel.includes(i) && !correctIdx.includes(i)) opt.classList.add("wrong-flash");
      });
    }
  }
  const fb = document.createElement("div");
  fb.className = "qz-feedback " + (ok ? "ok" : "no");
  fb.style.marginTop = "14px";
  if (ok) {
    fb.innerHTML = `✅ <strong>回答正确！${gained > 10 ? "+" + gained + " XP（含连击加成）" : "+" + gained + " XP"}</strong>${q.explanation ? "<br>💡 " + esc(q.explanation) : ""}`;
  } else {
    fb.innerHTML = `❌ <strong>回答错误。</strong><br>${correctText}${q.explanation ? "<br>📝 讲解：" + esc(q.explanation) : ""}`;
    // 错题本
    state.wrongBook.unshift({ q: q.question, type: q.type, my: String(userAns), answer: correctText, explanation: q.explanation, ability: q.ability, time: Date.now() });
    state.wrongBook = state.wrongBook.slice(0, 50);
  }
  navBtns.insertBefore(fb, navBtns.firstChild);
  let advanced = false;
  const goNext = () => {
    if (advanced) return;
    advanced = true;
    if (quizIdx === quiz.length - 1) showResult();
    else { quizIdx++; renderQuestion(); }
  };
  btn.textContent = quizIdx === quiz.length - 1 ? "查看成绩" : "下一题 →";
  btn.onclick = goNext;
  btn.disabled = false;   // 修复：之前 disabled=true 导致「下一题」按钮无法点击
  // 答对/答错都【不自动】进入下一题：由用户自己点击「下一题 →」，留足时间查看正确答案与讲解
}

/* 代码实战题：展示判分容器并触发 LLM 判分 */
function showCodeGradeBox(q, userAns) {
  const fb = document.createElement("div");
  fb.className = "qz-feedback essay";
  fb.style.marginTop = "14px";
  fb.innerHTML = `⌨️ <strong>代码已提交，正在判分…</strong>
    <div id="code-grade-box" style="margin-top:10px"></div>`;
  $(".exam-nav-btns").insertBefore(fb, $(".exam-nav-btns").firstChild);
  // BUG-7 修复：判分期间禁用「下一题」，防止绕过判分直接跳题（judged 未设置，不计正确率/错题本）
  $("#submit-btn").disabled = true;
  llmGradeCode(q, userAns);
}

/* LLM 判分代码实战题 */
async function llmGradeCode(q, userAns) {
  const box = $("#code-grade-box");
  if (!box) return;
  const p = q.practical || {};
  const base = (LLM_BASE || "https://api.deepseek.com").replace(/\/+$/, "");
  const model = LLM_MODEL || "deepseek-v4-flash";
  const prompt = buildCodeGradePrompt(q, p, userAns);
  box.innerHTML = `<div style="font-size:13.5px;color:var(--accent)">${icon("robot")} LLM 正在判分…</div>`;
  // 数据统一方案 P1：迁移到 llmJSON 统一调用器（格式约束/反馈重出/日志/空响应软处理）
  try {
    const parsed = await llmJSON({
      system: SYSTEM.codeGrader,
      prompt,
      formatHint: GRADE_JSON_HINT,
      expect: "object",
      part: "grade-code",
      maxTokens: 500,
      temperature: 0.2,
      maxRetries: 2,
      validateObj: (o) => DataSchema.validateBySchema(o, DataSchema.OBJECT_SCHEMAS.grade),
    });
    finishCodeGrade(parsed, box, q);
  } catch (e) {
    box.innerHTML = `<div style="font-size:12.5px;color:var(--warn)">⚠️ LLM 判分失败（${e.message}）。<br><div style="margin-top:6px;color:var(--text-1)">参考答案：<br><pre style="white-space:pre-wrap;font-family:var(--mono);font-size:12px;background:rgba(0,0,0,0.3);padding:10px;border-radius:8px">${esc((p.referenceAnswer || q.answer || "").slice(0, 600))}</pre></div></div>`;
  }
}

function finishCodeGrade(parsed, box, q) {
  // P1：parsed 已是 llmJSON 解析校验后的对象（不再从 data.choices 提取）
  const p = q.practical || {};
  if (!parsed || typeof parsed.score !== "number") {
    box.innerHTML = `<div style="font-size:12.5px;color:var(--warn)">⚠️ 无法解析评分。<br><div style="margin-top:6px;color:var(--text-1)">参考答案：<br><pre style="white-space:pre-wrap;font-family:var(--mono);font-size:12px;background:rgba(0,0,0,0.3);padding:10px;border-radius:8px">${esc((p.referenceAnswer || q.answer || "").slice(0, 600))}</pre></div></div>`;
    return;
  }
  const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
  const fb = parsed.feedback || "";
  const ok = score >= 60;
  box.innerHTML = `
    <div style="padding:12px 14px;border-radius:10px;background:${ok ? "rgba(47,214,181,0.08)" : "rgba(255,107,107,0.08)"};border:1px solid ${ok ? "rgba(47,214,181,0.35)" : "rgba(255,107,107,0.35)"}">
      <div style="font-size:14px;font-weight:800;color:${ok ? "#2fd6b5" : "#ff6b6b"}">${icon("robot")} LLM 评分：${score} 分 ${ok ? "✅ 通过" : "❌ 未通过"}</div>
      ${fb ? `<div style="font-size:12.5px;color:var(--text-1);margin-top:6px;line-height:1.7">💬 ${esc(fb)}</div>` : ""}
      <div style="font-size:11.5px;color:var(--text-2);margin-top:8px">参考实现：<br><pre style="white-space:pre-wrap;font-family:var(--mono);font-size:12px;background:rgba(0,0,0,0.3);padding:10px;border-radius:8px;color:var(--text-1)">${esc((p.referenceAnswer || q.answer || "").slice(0, 600))}</pre></div>
    </div>`;
  applyEssayScore(ok, `LLM 评分 ${score} 分`);
}

/* 代码阅读题：自动 LLM 判定（提交后直接判，无需额外点一次） */
function showReadingGradeBox(q, userAns) {
  const fb = document.createElement("div");
  fb.className = "qz-feedback essay";
  fb.style.marginTop = "14px";
  fb.innerHTML = `📖 <strong>参考答案：</strong><br>${renderMdSimple(q.answer)}${q.explanation ? "<br><br>📝 " + esc(q.explanation) : ""}
    <div id="reading-grade-box" style="margin-top:10px"></div>`;
  $(".exam-nav-btns").insertBefore(fb, $(".exam-nav-btns").firstChild);
  // BUG-7 修复：判分期间禁用「下一题」，防止绕过判分直接跳题
  $("#submit-btn").disabled = true;
  llmGradeReading(q, userAns);
}

async function llmGradeReading(q, userAns) {
  const box = $("#reading-grade-box");
  if (!box) return;
  box.innerHTML = `<div style="font-size:13.5px;color:var(--accent)">${icon("robot")} LLM 正在判定…</div>`;
  const prompt = buildReadingGradePrompt(q, userAns);
  // 数据统一方案 P1：迁移到 llmJSON 统一调用器
  try {
    const parsed = await llmJSON({
      system: SYSTEM.readingGrader,
      prompt,
      formatHint: GRADE_JSON_HINT,
      expect: "object",
      part: "grade-reading",
      maxTokens: 400,
      temperature: 0.2,
      maxRetries: 2,
      validateObj: (o) => DataSchema.validateBySchema(o, DataSchema.OBJECT_SCHEMAS.grade),
    });
    finishLLMGrade(parsed, box);
  } catch (e) {
    box.innerHTML = `<div style="font-size:12.5px;color:var(--warn)">⚠️ LLM 判定失败（${e.message}），可自评：<button class="exam-btn green" style="padding:6px 12px" onclick="selfAssess(true)">👍 讲通了</button> <button class="exam-btn orange" style="padding:6px 12px" onclick="selfAssess(false)">🔄 没讲顺</button></div>`;
  }
}

/* 填空题：绑定 LLM 时语义评判（模糊匹配仅作未绑定时的兜底） */
function showFillBlankGradeBox(q, userAns) {
  const fb = document.createElement("div");
  fb.className = "qz-feedback essay";
  fb.style.marginTop = "14px";
  fb.innerHTML = `✍️ <strong>你的答案：</strong>${esc(userAns)}
    <div id="fill-grade-box" style="margin-top:10px"></div>`;
  $(".exam-nav-btns").insertBefore(fb, $(".exam-nav-btns").firstChild);
  // BUG-3 修复：判分期间禁用提交按钮，防止用户判分中推进下一题
  const fbSb = $("#submit-btn");
  if (fbSb) { fbSb.disabled = true; fbSb.textContent = "判分中…"; }
  llmGradeFillBlank(q, userAns);
}

async function llmGradeFillBlank(q, userAns) {
  const box = $("#fill-grade-box");
  if (!box) return;
  box.innerHTML = `<div style="font-size:13.5px;color:var(--accent)">${icon("robot")} LLM 正在判定…</div>`;
  const accepted = (q.fillAnswers || [q.correctAnswer]).join(" / ");
  const prompt = buildFillBlankPrompt(q, userAns, accepted);
  // 数据统一方案 P1：迁移到 llmJSON 统一调用器
  try {
    const parsed = await llmJSON({
      system: SYSTEM.fillJudge,
      prompt,
      formatHint: FILL_JSON_HINT,
      expect: "object",
      part: "grade-fill",
      maxTokens: 200,
      temperature: 0,
      maxRetries: 2,
      validateObj: (o) => DataSchema.validateBySchema(o, DataSchema.OBJECT_SCHEMAS["grade-fill"]),
    });
    finishFillBlankGrade(parsed, box, q, userAns);
  } catch (e) {
    // 失败降级为模糊匹配
    const judged = judgeAnswer(q, userAns);
    box.innerHTML = `<div style="font-size:12.5px;color:var(--warn)">⚠️ LLM 判定失败，已用模糊匹配兜底。</div>`;
    applyFillBlankResult(q, userAns, judged);
  }
}

function finishFillBlankGrade(parsed, box, q, userAns) {
  // P1：parsed 已是 llmJSON 解析校验后的对象
  const correct = !!(parsed && parsed.correct);
  const reason = (parsed && parsed.reason) || "";
  const accepted = (q.fillAnswers || [q.correctAnswer]).join(" / ");
  box.innerHTML = `<div style="padding:12px 14px;border-radius:10px;background:${correct ? "rgba(47,214,181,0.08)" : "rgba(255,107,107,0.08)"};border:1px solid ${correct ? "rgba(47,214,181,0.35)" : "rgba(255,107,107,0.35)"}">
    <div style="font-size:14px;font-weight:800;color:${correct ? "#2fd6b5" : "#ff6b6b"}">${icon("robot")} LLM 判定：${correct ? "✅ 正确" : "❌ 错误"}</div>
    ${reason ? `<div style="font-size:12.5px;color:var(--text-1);margin-top:6px;line-height:1.7">💬 ${esc(reason)}</div>` : ""}
    <div style="font-size:11.5px;color:var(--text-2);margin-top:6px">标准答案：${esc(accepted)}</div>
  </div>`;
  applyFillBlankResult(q, userAns, correct);
}

function applyFillBlankResult(q, userAns, correct) {
  // BUG-3 修复：按 q 精确查找对应记录（用户在判分中推进下一题时，不再误写最后一条）
  const last = answers.find((a) => a.q === q) || answers[answers.length - 1];
  if (last) last.judged = correct;
  // 判分完成：恢复提交按钮为「下一题」
  const sb = $("#submit-btn");
  if (sb) { sb.disabled = false; sb.textContent = quizIdx === quiz.length - 1 ? "🏁 查看成绩" : "下一题 →"; }
  const ab = q.ability || "提示词工程";
  if (correct) {
    correctCount++;
    combo++;
    const gained = BASE_SCORE[q.type] || 10;
    state.xp += gained;
    if (combo > state.bestCombo) state.bestCombo = combo;
    abilityScore[ab].got += BASE_SCORE[q.type] || 10;
    recordAsked(q, false);
    showFeedback(true, gained, q, userAns);
    showCombo(combo);
    celebrateCorrect();
  } else {
    combo = 0;
    recordAsked(q, true);
    showFeedback(false, 0, q, userAns);
  }
  checkLevelUp();
  updateGamestat();
  saveState();
}

function showEssayFeedback(q) {
  const fb = document.createElement("div");
  fb.className = "qz-feedback essay";
  fb.style.marginTop = "14px";
  fb.innerHTML = `📖 <strong>参考答案：</strong><br>${renderMdSimple(q.answer)}${q.explanation ? "<br><br>📝 " + esc(q.explanation) : ""}
    <div id="essay-grade-box"></div>
    <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap">
      ${LLM_KEY ? `<button class="exam-btn primary" style="padding:8px 18px;font-size:15px" onclick="llmGradeEssay()">${icon("robot")} LLM 自动批改</button>` : ""}
      <button class="exam-btn green" style="padding:8px 18px;font-size:15px" onclick="selfAssess(true)">👍 我讲通了</button>
      <button class="exam-btn orange" style="padding:8px 18px;font-size:15px" onclick="selfAssess(false)">🔄 没讲顺，记入错题</button>
    </div>`;
  $(".exam-nav-btns").insertBefore(fb, $(".exam-nav-btns").firstChild);
  $("#submit-btn").disabled = true;
  $("#submit-btn").textContent = quizIdx === quiz.length - 1 ? "查看成绩" : "下一题 →";
  $("#submit-btn").onclick = () => (quizIdx === quiz.length - 1 ? showResult() : (quizIdx++, renderQuestion()));
  // 追问链
  if (q.followUps && q.followUps.length) {
    const fu = $("#essay-followups");
    fu.innerHTML = `<div style="font-size:11.5px;color:var(--warn);font-weight:700;margin-bottom:6px">💬 面试追问（思考后口头回答）</div>` +
      q.followUps.map((f) => `<div style="font-size:13.5px;color:var(--text-1);line-height:1.7;margin-bottom:4px">${esc(f)}</div>`).join("");
  }
}

function applyEssayScore(ok, note) {
  const q = quiz[quizIdx];
  recordAsked(q, !ok);
  const ab = q.ability || "提示词工程";
  if (!abilityScore[ab]) abilityScore[ab] = { got: 0, total: 0, n: 0 };
  // BUG-2 修复：total/n 已在 submitAnswer 统一累加，这里只补 got，避免 essay/practical 双倍扣分
  if (ok) {
    abilityScore[ab].got += BASE_SCORE[q.type] || 10;
    correctCount++;
    const gained = BASE_SCORE[q.type] || 10;
    state.xp += gained;
    combo++;
    showCombo(combo);
    if (combo > state.bestCombo) state.bestCombo = combo;   // C3：连击计入最高连击
    burstParticles(window.innerWidth / 2, 160, "#00e5ff");
    checkLevelUp();   // C3：答对立即检查升级
  } else {
    combo = 0;
    state.wrongBook.unshift({ q: q.question, type: q.type, my: note || "未掌握", answer: q.answer, explanation: q.explanation, ability: q.ability, time: Date.now() });
    state.wrongBook = state.wrongBook.slice(0, 50);
  }
  // 更新最后一条 answer 的 judged
  const last = answers[answers.length - 1];
  if (last) last.judged = ok;
  // 隐藏所有评分按钮
  $$(".qz-feedback .exam-btn").forEach((b) => (b.disabled = true));
  // 切换下一题按钮
  const btn = $("#submit-btn");
  btn.disabled = false;
  btn.textContent = quizIdx === quiz.length - 1 ? "查看成绩" : "下一题 →";
  btn.onclick = () => (quizIdx === quiz.length - 1 ? showResult() : (quizIdx++, renderQuestion()));
  updateGamestat();
  saveState();
}

function selfAssess(ok) {
  applyEssayScore(ok, "自评未掌握");
}

/* LLM 自动批改问答题：浏览器直连 API，评分 + 反馈 */
async function llmGradeEssay() {
  const q = quiz[quizIdx];
  const userAns = (answers[answers.length - 1] || {}).userAns || "";
  if (!userAns.trim()) { showToast("⚠️ 请先在上方输入你的回答"); return; }
  if (!LLM_KEY) { showToast("⚠️ 未配置 LLM，请到设置页填写 API Key"); return; }
  const box = $("#essay-grade-box");
  if (!box) return;
  box.innerHTML = `<div style="font-size:13.5px;color:var(--accent)">${icon("robot")} LLM 正在批改…</div>`;
  const prompt = buildEssayGradePrompt(q, userAns);
  // 数据统一方案 P1：迁移到 llmJSON 统一调用器（含 400 response_format 降级重试，不再手写）
  try {
    const parsed = await llmJSON({
      system: SYSTEM.essayGrader,
      prompt,
      formatHint: GRADE_JSON_HINT,
      expect: "object",
      part: "grade-essay",
      maxTokens: 400,
      temperature: 0.2,
      maxRetries: 2,
      validateObj: (o) => DataSchema.validateBySchema(o, DataSchema.OBJECT_SCHEMAS.grade),
    });
    finishLLMGrade(parsed, box);
  } catch (e) {
    box.innerHTML = `<div style="font-size:12.5px;color:var(--warn)">⚠️ LLM 批改失败（${e.message}），可改用下方自评。</div>`;
  }
}

function finishLLMGrade(parsed, box) {
  // P1：parsed 已是 llmJSON 解析校验后的对象
  if (!parsed || typeof parsed.score !== "number") {
    box.innerHTML = `<div style="font-size:12.5px;color:var(--warn)">⚠️ 无法解析评分，可改用下方自评。</div>`;
    return;
  }
  const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
  const fb = parsed.feedback || "";
  const ok = score >= 60;
  box.innerHTML = `
    <div style="margin-top:10px;padding:12px 14px;border-radius:10px;background:${ok ? "rgba(47,214,181,0.08)" : "rgba(255,107,107,0.08)"};border:1px solid ${ok ? "rgba(47,214,181,0.35)" : "rgba(255,107,107,0.35)"}">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:14px;font-weight:800;color:${ok ? "#2fd6b5" : "#ff6b6b"}">${icon("robot")} LLM 评分：${score} 分 ${ok ? "✅ 通过" : "❌ 未通过"}</span>
      </div>
      ${fb ? `<div style="font-size:12.5px;color:var(--text-1);margin-top:6px;line-height:1.7">💬 ${esc(fb)}</div>` : ""}
    </div>`;
  applyEssayScore(ok, `LLM 评分 ${score} 分`);
}

function prevQuestion() {
  if (quizIdx > 0) { quizIdx--; renderQuestion(); }
}

function nextQuestion() {
  // 直接跳下一题（用于已作答的题，回到上一题后仍能继续往后）
  if (quizIdx === quiz.length - 1) showResult();
  else { quizIdx++; renderQuestion(); }
}

/* 出题质量反馈：用户觉得题目出得不好/答案有误时，标记回写（存本机，供后续纠偏） */
function flagQuestion() {
  const q = quiz[quizIdx];
  showModal({
    icon: "⚠️",
    title: "反馈题目质量",
    text: "这道题有什么问题？反馈只记录在本机，用于后续优化题库。",
    actions: [
      { label: "题干有误 / 表述不清", onClick: () => doFlagQuestion(q, "题干有误/表述不清") },
      { label: "答案有误", onClick: () => doFlagQuestion(q, "答案有误") },
      { label: "考点 / 难度不合适", onClick: () => doFlagQuestion(q, "考点/难度不合适") },
      { label: "取消", onClick: () => {} },
    ],
  });
}

function doFlagQuestion(q, flag) {
  if (!state.questionFlags) state.questionFlags = [];
  state.questionFlags.unshift({ q: q.question, flag, time: Date.now() });
  state.questionFlags = state.questionFlags.slice(0, 100);
  saveState();
  showToast(`✅ 已记录反馈：${flag}`);
}

function checkLevelUp() {
  // 境界提升检测：综合画像成长 → 等级提升（不再靠 XP）
  state.level = currentLevelIndex() + 1;   // BUG-4 时序修复：同步 state.level，让徽章/结算页用最新等级
  const afterIdx = currentLevelIndex();
  if (afterIdx > beforeRankIdx) {
    const r = currentTitle();
    const banner = $("#combo-banner");
    if (banner) {
      banner.textContent = `🌟 境界提升！${r.icon} ${r.title}`;
      banner.classList.add("show");
      setTimeout(() => banner.classList.remove("show"), 2000);
      burstParticles(window.innerWidth / 2, 160, "#ffb84d", 40);
    }
    beforeRankIdx = afterIdx;
  }
}

/* ---------------- 结果页 ---------------- */
function showResult() {
  state.exams++;
  Logger.info("exam.result", "考核完成", { mode: examMode, total: quiz.length, correct: correctCount, pct: quiz.length ? Math.round((correctCount / quiz.length) * 100) : 0 });
  // 记录本次考核前的境界（用于结束后检测境界提升）
  beforeRankIdx = currentLevelIndex();
  const totalQ = quiz.length;
  const pct = Math.round((correctCount / totalQ) * 100);
  state.lastScore = pct;
  const stars = pct >= 95 ? "⭐⭐⭐⭐⭐" : pct >= 85 ? "⭐⭐⭐⭐" : pct >= 70 ? "⭐⭐⭐" : pct >= 50 ? "⭐⭐" : "⭐";
  const grade = pct >= 95 ? "🏆 完美" : pct >= 85 ? "🎯 优秀" : pct >= 70 ? "📖 良好" : pct >= 50 ? "💪 及格" : "🔁 需复习";

  // 能力得分率
  const abilityPct = {};
  for (const [ab, s] of Object.entries(abilityScore)) {
    if (!ABILITIES.includes(ab)) continue;   // 白名单过滤：辅助题的非白名单 ability（如"AI 应用开发"/"系统与部署"）丢弃
    abilityPct[ab] = s.total ? Math.round((s.got / s.total) * 100) : 0;
  }
  // 记录历史
  state.history.push({ date: new Date().toISOString(), mode: examMode, score: correctCount, total: totalQ, pct, abilities: abilityPct, cross: isCrossExam, dirId: isCrossExam ? null : examDirId });   // dirId: 章节考核所属目录（「已考核」标识依据）
  // C4：跨课程徽章仅在综合考核（聚合多目录）时解锁
  if (isCrossExam) state.crossExam = true;
  if (examMode === "practical") state.practicalDone = true;
  // 模式记录（全能选手徽章）
  if (!state.modesDone) state.modesDone = [];
  if (!state.modesDone.includes(examMode)) state.modesDone.push(examMode);
  // 连续学习记录（同日多次考核不重复计）
  const today = new Date().toISOString().slice(0, 10);
  if (state.lastStudyDay !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (state.lastStudyDay === yesterday) {
      state.streak = (state.streak || 0) + 1;
    } else {
      state.streak = 1;
    }
    state.lastStudyDay = today;
    state.bestStreak = Math.max(state.bestStreak || 0, state.streak);
  }
  // 能力维度历史最佳（记录 ≥75% 的维度，支持「熟练 75% / 精通 90%」两级技术徽章判定）
  if (!state.abilityBest) state.abilityBest = {};
  for (const [ab, p] of Object.entries(abilityPct)) {
    if (p >= 75) state.abilityBest[ab] = Math.max(state.abilityBest[ab] || 0, p);
  }
  // 能力画像累积（综合评估基础水平：按题量加权平均）
  if (!state.abilityProfile) state.abilityProfile = {};
  // 综合考核（跨目录）权重更高：1.5 倍章节考核，反映更强的融会贯通能力
  const crossWeight = isCrossExam ? 1.5 : 1;
  for (const [ab, s] of Object.entries(abilityScore)) {
    if (!ABILITIES.includes(ab)) continue;   // 白名单过滤：与面试路径一致，非白名单维度不进入画像
    if (!state.abilityProfile[ab]) state.abilityProfile[ab] = { sum: 0, count: 0 };
    // 题量加权：sum 累加 (得分率 × 题数)，count 累加题数
    const p = s.total ? Math.round((s.got / s.total) * 100) : 0;
    const n = (s.n || 1) * crossWeight;
    state.abilityProfile[ab].sum += p * n;
    state.abilityProfile[ab].count += n;
    state.abilityProfile[ab].lastAt = Date.now();
  }
  saveState();
  checkLevelUp();   // 画像更新后检测境界提升

  // 能力分析（岗位匹配用综合画像，从严）
  const profilePct = abilityProfilePct();
  const growth = analyzeGrowth(abilityPct);
  const jobs = matchJobs(profilePct);

  // 新解锁徽章检测（严格：每次最多解锁 1 个，慢慢给保留成就感）
  const beforeIds = new Set((state.prevUnlocked || []));
  const nowUnlocked = BADGES.filter((b) => b.check(state)).map((b) => b.id);
  const newBadges = BADGES.filter((b) => !beforeIds.has(b.id) && nowUnlocked.includes(b.id));
  const revealBadges = newBadges.slice(0, 1);
  state.prevUnlocked = [...beforeIds, ...revealBadges.map((b) => b.id)];
  // 徽章解锁奖励：等值 XP（技术向徽章激励）+ 全屏酷炫庆祝动画
  if (revealBadges.length) {
    const b = revealBadges[0];
    const reward = b.ap || 10;
    state.xp += reward;
    setTimeout(() => showBadgeCelebration(b), 900);
  }
  const newBadgeHtml = revealBadges.length ? `<div class="exam-newbadges">
      <div style="font-size:13.5px;color:var(--warn);font-weight:700;margin-bottom:8px">🏅 新成就解锁！</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">${revealBadges.map((b) => `
        <div style="text-align:center;padding:10px 16px;background:rgba(255,184,77,0.1);border:1px solid rgba(255,184,77,0.4);border-radius:12px;animation:viewIn 0.5s ease">
          <div style="font-size:28px">${b.icon}</div>
          <div style="font-size:11.5px;font-weight:700;color:#fff3cc">${b.name}</div>
        </div>`).join("")}</div></div>` : "";
  const title = currentTitle();
  const ap = calcAP(state);

  // 错题列表
  const wrongList = answers.filter((a) => a.judged === false).map((a) => `
    <div class="exam-review-item">
      <div class="eri-status no">❌ 答错</div>
      <div class="eri-q">${esc(a.q.question)}</div>
      <div class="eri-expl">${a.q.explanation ? "💡 " + esc(a.q.explanation) : "（无讲解）"}</div>
    </div>`).join("");
  const rightCount = answers.filter((a) => a.judged === true).length;
  const assess = baseLevelAssessment();

  render(() => {
    const pc = document.getElementById("profile-canvas");
    if (pc) drawRadarProfile(profilePct);
    animateScore(pct);
  }, `
    <button class="exam-btn ghost" onclick="goHome()" style="margin-bottom:14px">← 返回主页</button>
    <div class="exam-result-hero">
      <div class="exam-score-big" id="score-num">0</div>
      <div style="font-size:11.5px;color:var(--text-2);margin-top:4px">得分 <strong style="color:var(--accent)">${pct} 分</strong> · 正确 ${correctCount}/${totalQ}</div>
      <div class="exam-stars">${stars}</div>
      <div class="exam-grade" style="color:${pct >= 70 ? "#00e5ff" : pct >= 50 ? "#ffb84d" : "#ff6b6b"}">${grade}</div>
      <div class="exam-combo-stat">🔥 最高连击 ${state.bestCombo} · ⚡ 本场得分 ${pct} 分 · 📅 连续学习 ${state.streak} 天</div>
      <div style="margin-top:8px;font-size:13.5px;color:var(--text-1)">${title.icon} ${title.title} · 成就点 <strong style="color:var(--warn)">${ap}</strong></div>
      ${newBadgeHtml}
    </div>

    <div class="card" style="margin-top:14px">
      <h3 class="section-title" style="margin-top:0">${icon("radar", "lg")} 综合能力画像</h3>
      <div style="text-align:center;padding:6px 0 4px">
        <div style="font-size:23px;font-weight:900;font-family:var(--cyber);color:${assess.color};letter-spacing:1px">${assess.icon} ${assess.level}</div>
        <div style="font-size:12.5px;color:var(--text-2);margin-top:6px">${assess.desc}</div>
        <div style="font-size:11.5px;color:var(--text-2);margin-top:6px">${Object.keys(profilePct).length} 项能力 · ${state.exams} 次考核 · ${state.imports} 份资料</div>
      </div>
      <div class="radar-wrap"><canvas id="profile-canvas" width="480" height="400"></canvas></div>
      ${abilityLegendHtml(profilePct)}
    </div>

    <div class="exam-two-col">
      <div class="card" style="margin-top:0">
        <h3 class="section-title" style="margin-top:0">${icon("trending-up", "lg")} 增长点</h3>
        ${growth.up.length ? `<div style="font-size:12.5px;color:#00e5ff;line-height:2">${growth.up.map((u) => "✅ " + u).join("<br>")}</div>` : "<div style='font-size:13.5px;color:var(--text-2)'>本次暂无明显增长点，继续加油！</div>"}
        <h3 class="section-title" style="margin-top:18px">🔻 缺失点（需加强）</h3>
        ${growth.down.length ? `<div style="font-size:12.5px;color:#ff6b6b;line-height:2">${growth.down.map((d) => "❌ " + d).join("<br>")}</div>` : "<div style='font-size:13.5px;color:var(--text-2)'>本次无重大缺失，保持！</div>"}
      </div>

      <div class="card" style="margin-top:0">
        <h3 class="section-title" style="margin-top:0">${icon("briefcase", "lg")} 岗位匹配建议</h3>
        <div style="display:flex;flex-direction:column;gap:10px">${jobs}</div>
      </div>
    </div>

    ${wrongList ? `<div class="exam-review-list"><h3 class="section-title">${icon("bookmark", "lg")} 错题回顾</h3>${wrongList}</div>` : ""}

    <div style="margin-top:22px;display:flex;gap:12px;justify-content:center">
      ${examMode === "review"
        ? `<button class="exam-btn primary" onclick="showWrongBook()">📕 返回错题本</button>`
        : `<button class="exam-btn primary" onclick="startExam('${examMode}')">↺ 再来一次</button>`}
      <button class="exam-btn ghost" onclick="goHome()">🏠 返回主页</button>
      <button class="exam-btn orange" onclick="showWrongBook()">📕 查看错题本</button>
    </div>`);
  updateGamestat();   // C1：考核结束后刷新顶栏状态
}

function animateScore(final) {
  let cur = 0;
  const step = () => {
    cur += Math.max(1, Math.round(final / 40));
    if (cur >= final) { cur = final; }
    $("#score-num").textContent = cur;
    if (cur < final) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------------- 能力分析 ---------------- */
/* 综合能力画像：所有考核的能力加权平均（基础水平评估）。
   时间衰减：距离上次考核该维度超过 7 天，旧成绩按 0.85 衰减一次（遗忘曲线）。 */
function renderMdSimple(text) {
  if (!text) return "";
  return esc(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
}

/* ---------------- 徽章/历史/错题本 ---------------- */

/* ===== 个人能力评估页面 =====
 * 展示系统对用户的多维评估：基础水平、能力画像（雷达+进度条）、
 * 岗位匹配、增长/短板分析，以及等级成长路径。 */
function showAssessment() {
  setNavActive("radar");
  const profilePct = abilityProfilePct();
  const profileKeys = Object.keys(profilePct);
  const assess = baseLevelAssessment();
  const growth = analyzeGrowth(profilePct);

  // 岗位匹配：紧凑条形（Top5 + 进度条），替代 matchJobs 大卡列表
  const jobs = (() => {
    const ec = state.exams || 0;
    const strict = ec < 3 ? 0.7 : ec < 5 ? 0.85 : 1;
    const rows = JOBS.map((j) => {
      let num = 0, den = 0;
      for (const [ab, w] of Object.entries(j.weight)) { num += (profilePct[ab] ?? 0) * w; den += w * 100; }
      return { name: j.name, score: Math.round((num / Math.max(den, 1)) * 100 * strict) };
    }).sort((a, b) => b.score - a.score).slice(0, 5);
    return rows.map((r, i) => `
      <div style="margin-bottom:9px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
          <span style="color:${i === 0 ? "#00e5ff" : "var(--text-1)"};font-weight:${i === 0 ? 700 : 400}">${i === 0 ? "🏆 " : ""}${r.name}</span>
          <span style="font-family:var(--mono);font-weight:700;color:${r.score >= 70 ? "#00e5ff" : r.score >= 50 ? "#ffb84d" : "#6b7a90"}">${r.score}%</span>
        </div>
        <div style="height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${r.score}%;background:linear-gradient(90deg,#00e5ff,#2fd6b5);border-radius:3px"></div>
        </div>
      </div>`).join("");
  })();

  // 概览统计（成长路径等级阶梯已移除——首页激励条承载称号进度）
  const unlocked = BADGES.filter((b) => b.check(state)).length;
  const ap = calcAP(state);

  // 维度进度条（无数据时返回空串，空态在外层统一渲染）

  // 能力画像图例：10 色顶点对应（与 Hero 演示一致，替代原两列维度条）
  const assessLegend = profileKeys.length
    ? ABILITIES.map((ab, i) => {
        const v = profilePct[ab] ?? 0;
        const c = HOME_LEGEND_COLORS[i % HOME_LEGEND_COLORS.length];
        return `<div class="dl-row">
          <span class="dl-dot" style="background:${c};box-shadow:0 0 6px ${c}cc"></span>
          <span class="dl-name">${esc(ab)}</span>
          <span class="dl-val" style="color:${c}">${v}%</span>
        </div>`;
      }).join("")
    : "";

  // 能力画像空态（居中、明显、精确说明考核类型）
  const profileEmpty = `
    <div style="text-align:center;padding:34px 20px">
      <div style="font-size:44px;margin-bottom:12px;opacity:0.85">🧬</div>
      <div style="font-size:15px;font-weight:700;color:var(--text-1);margin-bottom:8px">暂无能力画像</div>
      <div style="font-size:13px;color:var(--text-2);line-height:1.9;max-width:460px;margin:0 auto">
        完成任意一次考核（<span style="color:#00e5ff">📘 理论</span> / <span style="color:#ffb84d">🛠️ 实战</span> / <span style="color:#ff3df0">💼 面试</span>）后，<br>系统将根据你的作答表现，生成十维能力画像与雷达图。
      </div>
      <button class="exam-btn primary" style="margin-top:16px" onclick="goHome()">去首页开始考核</button>
    </div>`;

  // 增长点 / 短板
  const growthHtml = (growth.up.length || growth.down.length) ? `
    ${growth.up.length ? `<div style="margin-bottom:8px"><span style="font-size:12.5px;color:#2fd6b5;font-weight:700">📈 增长点：</span><span style="font-size:12.5px;color:var(--text-1)">${growth.up.join(" · ")}</span></div>` : ""}
    ${growth.down.length ? `<div><span style="font-size:12.5px;color:#ffb84d;font-weight:700">⚠️ 待加强：</span><span style="font-size:12.5px;color:var(--text-1)">${growth.down.join(" · ")}</span></div>` : ""}
  ` : "<div class='empty'>完成多次考核后，这里会分析你的增长与短板。</div>";

  const statItems = [
    { label: "考核次数", val: state.exams },
    { label: "导入资料", val: state.imports },
    { label: "连续天数", val: state.streak },
    { label: "成就徽章", val: unlocked + "/" + BADGES.length },
    { label: "成就点", val: ap },
  ];

  render(() => {
    const pc = document.getElementById("assess-canvas");
    if (pc && profileKeys.length) drawRadarProfile(profilePct, "#assess-canvas", { noLabels: true, vertexColors: HOME_LEGEND_COLORS });
  }, `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:18px">
      <h2 class="section-title" style="margin:0">${icon("radar", "lg")} 个人能力评估</h2>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="exam-btn ghost" style="padding:6px 14px;font-size:12px" onclick="exportProfile()">${icon("download")} 导出报告</button>
        <button class="exam-btn ghost" style="padding:6px 14px;font-size:12px" onclick="showBadges()">${icon("award")} 成就徽章</button>
      </div>
    </div>

    <!-- 概览条：等级 + 关键数据（紧凑一行） -->
    <div class="card assess-overview" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <div style="font-size:38px;filter:drop-shadow(0 0 12px ${assess.color})">${assess.icon}</div>
        <div style="flex:1;min-width:170px">
          <div style="font-size:19px;font-weight:800;color:${assess.color};font-family:var(--cyber);letter-spacing:1px">${assess.level}</div>
          <div style="font-size:12px;color:var(--text-2);margin-top:2px">${assess.desc}</div>
        </div>
        ${statItems.map((s) => `
          <div style="text-align:center;min-width:62px;padding:8px 10px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:9px">
            <div style="font-size:17px;font-weight:800;color:#00e5ff;font-family:var(--cyber)">${s.val}</div>
            <div style="font-size:10px;color:var(--text-2);margin-top:2px;font-family:var(--mono)">${s.label}</div>
          </div>`).join("")}
      </div>
    </div>

    <div class="assess-grid">
      <!-- 能力画像：彩色顶点雷达 + 10 色图例（与 Hero 演示一致） -->
      <div class="card" style="margin:0">
        <h3 class="section-title" style="margin:0 0 12px">🧠 能力画像（十维）</h3>
        ${profileKeys.length ? `
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:center">
            <div style="text-align:center"><canvas id="assess-canvas" width="340" height="340"></canvas></div>
            <div class="demo-legend">${assessLegend}</div>
          </div>` : profileEmpty}
      </div>

      <!-- 岗位匹配：紧凑条形 Top5 -->
      <div class="card" style="margin:0">
        <h3 class="section-title" style="margin:0 0 12px">${icon("briefcase", "lg")} 岗位匹配度</h3>
        <div style="font-size:11px;color:var(--text-2);margin-bottom:10px">样本不足从严折扣（<3 次 ×0.7 / <5 次 ×0.85）</div>
        ${jobs}
      </div>

      <!-- 增长与短板 -->
      <div class="card" style="margin:0">
        <h3 class="section-title" style="margin:0 0 10px">📊 增长与短板</h3>
        ${growthHtml}
      </div>

    </div>
  `);
}

function showBadges() {
  const unlocked = BADGES.filter((b) => b.check(state));
  const locked = BADGES.filter((b) => !b.check(state));
  const ap = calcAP(state);
  const title = currentTitle();
  // 按稀有度分组展示
  const byRarity = (list) => ["legendary", "epic", "rare", "common"].map((r) => ({
    r, list: list.filter((b) => b.rarity === r),
  })).filter((g) => g.list.length);
  const card = (b, isUnlocked) => {
    const meta = RARITY_META[b.rarity] || RARITY_META.common;
    return `
    <div class="badge-card ${isUnlocked ? "" : "locked"}" style="border-color:${isUnlocked ? meta.color + "55" : "var(--border)"}">
      <div class="bd-rarity" style="color:${meta.color}">${meta.label} · ${b.ap} AP</div>
      <div class="bd-icon">${b.icon}</div>
      <div class="bd-name">${b.name}</div>
      <div class="bd-desc">${b.desc}</div>
      ${isUnlocked ? "" : '<div style="font-size:11.5px;color:#5a6a7e;margin-top:4px">🔒 未解锁</div>'}
    </div>`;
  };
  let html = "";
  for (const g of byRarity(unlocked)) {
    const meta = RARITY_META[g.r];
    html += `<div style="margin:16px 0 8px;font-size:11.5px;font-weight:700;color:${meta.color}">${meta.label} 徽章（${g.list.length}）</div>
      <div class="badge-grid">${g.list.map((b) => card(b, true)).join("")}</div>`;
  }
  if (locked.length) {
    html += `<div style="margin:16px 0 8px;font-size:11.5px;font-weight:700;color:#5a6a7e">🔒 待解锁（${locked.length}）</div>
      <div class="badge-grid">${locked.map((b) => card(b, false)).join("")}</div>`;
  }
  render(null, `
    <button class="exam-btn ghost" onclick="goHome()" style="margin-bottom:18px">← 返回</button>
    <div style="display:flex;gap:20px;align-items:center;margin-bottom:6px">
      <h2 class="section-title" style="margin:0">${icon("award", "lg")} 成就墙（${unlocked.length}/${BADGES.length}）</h2>
      <div style="font-size:11.5px;color:var(--text-1)">${title.icon} <strong style="color:var(--warn)">${title.title}</strong> · 成就点 <strong style="color:var(--warn)">${ap}</strong></div>
    </div>
    <div style="font-size:11.5px;color:var(--text-2);margin-bottom:10px">稀有度：青铜 → 白银 → 黄金 → 传说 · 每个徽章奖励成就点（AP）</div>
    ${html}`);
}

/* ===== 题库次级页面 ===== */
/* ===== 资料目录管理（一次导入 = 一个章节目录） ===== */
let DIRS = [];   // 目录索引缓存

async function refreshDirs() {
  try {
    const res = await fetch(`./api/dirs?uid=${encodeURIComponent(UID)}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      DIRS = data.dirs || [];
    }
  } catch (e) { DIRS = []; }
  return DIRS;
}

/* 目录无理论/实战题时点击考核按钮的引导（不置灰，点击给说明 + 去配置 Key） */
function examNeeded(dirId, mode) {
  const isTheory = mode === "theory";
  showModal({
    icon: isTheory ? "📘" : "🛠️",
    title: "该目录暂无" + (isTheory ? "理论" : "实战") + "题",
    text: (isTheory ? "理论题（选择/判断/填空）" : "实战题（代码客观题）") + "由 LLM 基于课程内容生成，当前目录还没有。请先配置 API Key，再点「补出题」生成。",
    actions: [
      { label: "⚙️ 去配置 Key", primary: true, onClick: () => showSettings() },
      { label: "知道了", onClick: () => {} },
    ],
  });
}

/* 重新用 LLM 补出客观题（针对导入时 LLM 未出题、导致理论考核灰的目录） */
async function reGenerateQuestions(dirId) {
  if (!LLM_KEY) {
    showModal({
      iconHtml: icon("robot"),
      title: "补出题需要 LLM",
      text: "理论考核需要客观题（选择/判断/填空），这些题由 LLM 基于课程内容生成。请先在「设置」里配置 API Key。",
      actions: [
        { label: "⚙️ 去设置", primary: true, onClick: () => showSettings() },
        { label: "先不了", onClick: () => {} },
      ],
    });
    return;
  }
  Logger.begin("regen");
  Logger.info("import.regen", "开始补出题", { dirId });
  try {
    const res = await fetch(`./api/dir?uid=${encodeURIComponent(UID)}&id=${encodeURIComponent(dirId)}`, { cache: "no-store" });
    if (!res.ok) throw new Error("读取目录失败");
    const dd = await res.json();
    const course = dd.course;
    if (!course) throw new Error("目录无课程数据");
    // 按缺失补到理想量（理论 16 / 实战 10），与导入流程同构：循环补足 + 去重 + 卡死停
    const quiz = course.quiz || [];
    const hasCode = (course.materials || []).some((m) => m.type === "code" || (m.file && /\.(py|ipynb|js|ts|java)$/i.test(m.file)));
    // 统一口径：理论/实战数量不过滤 source（与 showLibrary / 目录索引一致）
    const countTheory = () => quiz.filter((q) => (q.dimension || inferDimension(q)) === "theory").length;
    const countPrac = () => quiz.filter((q) => q.type === "practical").length;
    const needTheory = countTheory() < 16;
    const needPrac = hasCode && countPrac() < 10;
    if (!needTheory && !needPrac) {
      showToast("✅ 题库已完整（理论 " + countTheory() + " · 实战 " + countPrac() + "），无需补出题");
      showLibrary();
      return;
    }
    showToast("正在用 LLM 补出题（" + (needTheory ? "理论" : "") + (needTheory && needPrac ? " + " : "") + (needPrac ? "实战" : "") + "）…");
    // 去重 + 补全 + 入库（与导入流程 hangQ 同逻辑）
    const seenTxt = new Set(quiz.map((q) => (q.question || "") + "|" + q.type));
    let nid = Date.now();   // 13 位毫秒全局唯一，同目录内 nid++ 不重
    const hangQ = (qs) => {
      let added = 0;
      for (const q of qs || []) {
        if (seenTxt.has((q.question || "") + "|" + q.type)) continue;
        q.id = nid++;
        q.source = "llm";
        if (!q.dimension) q.dimension = inferDimension(q);
        q.interview = !!q.interview;
        if (q.type === "essay" && !q.followUps) q.followUps = [];
        normalizeLLMQuestion(q);
        quiz.push(q);
        seenTxt.add((q.question || "") + "|" + q.type);
        added++;
      }
      return added;
    };
    // 循环补足（与导入一致）：首轮按缺失量（下限 4/3），最多 3 轮；0 新增停该方向
    const before = quiz.length;
    let round = 0;
    let thStuck = false, pracStuck = false;
    while (round < 3 && ((countTheory() < 16 && !thStuck) || (hasCode && countPrac() < 10 && !pracStuck))) {
      round++;
      // 缺失量精确补（下限理论 4 / 实战 3）：题型公式已自洽，任意 N 都能正确分配
      const thNeed = Math.max(16 - countTheory(), 4);
      const pracNeed = Math.max(10 - countPrac(), 3);
      const thJob = countTheory() < 16 && !thStuck ? browserLLMGenerate(course, "theory", thNeed).catch(() => null) : Promise.resolve(null);
      const pracJob = hasCode && countPrac() < 10 && !pracStuck ? browserLLMGenerate(course, "practical", pracNeed).catch(() => null) : Promise.resolve(null);
      const [thRes, pracRes] = await Promise.all([thJob, pracJob]);
      if (thRes !== null) { if (!thRes || !thRes.length) thStuck = true; else if (!hangQ(thRes)) thStuck = true; }
      if (pracRes !== null) { if (!pracRes || !pracRes.length) pracStuck = true; else if (!hangQ(pracRes)) pracStuck = true; }
    }
    const added = quiz.length - before;
    if (!added) {
      Logger.warn("import.regen-empty", "补出题未新增题目", { dirId });
      showToast("⚠️ 未新增题目（可能已存在或 LLM 未返回有效题）");
      return;
    }
    await fetch("/api/course-save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: UID, course, dirId }),
    });
    Logger.info("import.regen-done", "补出题完成", { dirId, added, theory: countTheory(), practical: countPrac() });
    showToast(`✅ 已补出 ${added} 道（理论 ${countTheory()} · 实战 ${countPrac()}）`);
    showLibrary();
  } catch (e) {
    Logger.error("import.regen-fail", "补出题失败: " + e.message, { dirId });
    showToast(`⚠️ 补出题失败：${e.message}`);
  }
}

/* 目录列表页：每个目录右侧理论/实战考核按钮 + 改名 + 删目录 + 进入详情 */
async function showLibrary() {
  setNavActive("library");
  const dirs = await refreshDirs();
  const cards = dirs.map((d) => {
    // 纯笔记目录（无代码素材）不显示实战考核按钮；旧目录索引无 hasCode 字段时按 practicalCount 兜底
    const hasCode = d.hasCode === undefined ? d.practicalCount > 0 : !!d.hasCode;
    const theoryReady = d.theoryCount >= 8;   // 理论考核需 ≥8 道（不足置灰）
    const practicalReady = d.practicalCount >= 5;   // 实战考核需 ≥5 道（不足置灰）
    const dirRecs = (state.history || []).filter((h) => h.dirId === d.id);   // 该目录已考核记录（已考核标识 + 最高分）
    const needRegen = !theoryReady || (hasCode && !practicalReady);   // 补出题按钮露出条件：任一方向不足
    return `
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap">
        <div style="flex:1;min-width:220px">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span style="display:flex;align-items:center">${icon("book-open", "lg")}</span>
            <span style="font-size:16px;font-weight:800;color:var(--text-0)">${esc(d.title)}</span>
            ${dirRecs.length ? `<span style="display:inline-flex;align-items:center;gap:5px;font-size:10.5px;padding:2px 9px;border-radius:999px;background:rgba(47,214,181,0.08);border:1px solid rgba(47,214,181,0.3);color:#2fd6b5;font-family:var(--mono)">${icon("check")} 已考核 · 最好成绩 ${Math.max(...dirRecs.map((h) => h.pct))}%</span>` : ""}
            <button class="exam-btn ghost" style="padding:4px 10px;font-size:11.5px" onclick="renameDir('${d.id}', '${jsStr(d.title)}')">${icon("edit-3")} 改名</button>
          </div>
          <div style="display:flex;gap:16px;margin-top:7px;font-size:12px;font-family:var(--mono);flex-wrap:wrap;align-items:center">
            <span style="display:inline-flex;align-items:center;gap:6px;color:var(--text-1);padding:2px 9px;border-radius:6px;background:rgba(0,229,255,0.05);border:1px solid rgba(0,229,255,0.15)">${icon("book-open")} 理论题储备 <b style="color:var(--accent);font-weight:800">${d.theoryCount}</b></span>
            <span style="display:inline-flex;align-items:center;gap:6px;color:var(--text-1);padding:2px 9px;border-radius:6px;background:rgba(255,61,240,0.05);border:1px solid rgba(255,61,240,0.15)">${icon("wrench")} 实战题储备 <b style="color:var(--accent-2);font-weight:800">${d.practicalCount}</b></span>
          </div>
          ${!theoryReady ? `<div style="font-size:11.5px;color:#ffb84d;margin-top:3px">⚠️ 理论题不足（${d.theoryCount}/8）——点「补出题」补齐后即可考核</div>` : ""}
          ${hasCode && !practicalReady ? `<div style="font-size:11.5px;color:#ffb84d;margin-top:3px">⚠️ 实战题不足（${d.practicalCount}/5）——点「补出题」补齐后即可考核</div>` : ""}
          <div style="font-size:11px;color:var(--text-2);margin-top:3px">${d.createdAt ? d.createdAt.slice(0, 16).replace("T", " ") : ""}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${theoryReady
            ? `<button class="exam-btn primary" onclick="startDirExam('${d.id}', 'theory')">${icon("book-open")} 理论考核</button>`
            : `<button class="exam-btn" style="opacity:0.4;cursor:not-allowed;border-color:var(--border)" title="理论题不足 8 道，先补出题或重新导入">${icon("book-open")} 理论考核</button>`}
          ${needRegen ? `<button class="exam-btn" style="color:#ffb84d;border-color:rgba(255,184,77,0.4)" onclick="reGenerateQuestions('${d.id}')">${icon("robot")} 补出题</button>` : ""}
          ${hasCode
            ? (practicalReady
                ? `<button class="exam-btn" onclick="startDirExam('${d.id}', 'practical')">${icon("wrench")} 实战考核</button>`
                : `<button class="exam-btn" style="opacity:0.4;cursor:not-allowed;border-color:var(--border)" title="实战题不足 5 道，先补出题">${icon("wrench")} 实战考核</button>`)
            : ""}
          <button class="exam-btn ghost" onclick="showDirDetail('${d.id}')">${icon("folder")} 管理</button>
          <button class="exam-btn ghost" style="color:#ff6b6b;border-color:rgba(255,107,107,0.4)" onclick="deleteDir('${d.id}')">${icon("trash-2")}</button>
        </div>
      </div>
    </div>`;
  }).join("");

  render(null, `
    <button class="exam-btn ghost" onclick="goHome()" style="margin-bottom:18px">← 返回</button>
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:6px">
      <h2 class="section-title" style="margin:0">${icon("folder", "lg")} 资料目录（${dirs.length}）</h2>
      <button class="exam-btn primary" onclick="showImportPanel()">${icon("upload")} 新建目录（导入资料）</button>
    </div>
    <div style="font-size:12.5px;color:var(--text-2);margin-bottom:14px">每次导入创建一个章节目录。可针对任意目录单独进行理论/实战考核，也可进入目录补充或删减文件。</div>
    ${cards || `<div class="card empty-hint" style="padding:36px;text-align:center">
      <div style="margin-bottom:10px">${icon("folder", "xxl")}</div>
      <div style="font-size:14px;color:var(--text-1);margin-bottom:14px">还没有任何资料目录</div>
      <button class="exam-btn primary" onclick="showImportPanel()">${icon("upload")} 导入资料，创建第一个目录</button>
    </div>`}`);
}

/* 目录详情页：文件清单 + 删文件 + 追加文件 */
async function showDirDetail(dirId) {
  const res = await fetch(`./api/dir?uid=${encodeURIComponent(UID)}&id=${encodeURIComponent(dirId)}`, { cache: "no-store" });
  const dd = res.ok ? await res.json() : {};
  if (!dd || !dd.id) { showToast("⚠️ 目录不存在"); showLibrary(); return; }
  const course = dd.course || {};
  const quiz = course.quiz || [];
  const fileRows = (dd.files || []).map((f) => `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--border)">
      <div style="flex:1;min-width:0">
        <div style="font-size:13.5px;color:var(--text-0);word-break:break-all">${f.kind === "note" ? "📄" : f.kind === "code" ? "💻" : "📊"} ${esc(f.filename)}</div>
        <div style="font-size:11px;color:var(--text-2);margin-top:2px">贡献 ${f.questionCount || 0} 题</div>
      </div>
      <button class="exam-btn ghost" style="color:#ff6b6b;border-color:rgba(255,107,107,0.4);padding:5px 12px;font-size:12px" onclick="deleteDirFile('${dirId}', '${jsStr(f.filename)}')">🗑️ 删除</button>
    </div>`).join("");

  // 按章分组统计（章节考核粒度：只考本章的题）
  const chapMap = {};
  for (const q of quiz) {
    const ch = normChapter(q.chapterRef || q.chapter);
    if (!chapMap[ch]) chapMap[ch] = { theory: 0, practical: 0 };
    const dim = (q.dimension || inferDimension(q));
    if (dim === "theory") chapMap[ch].theory++;
    else if (dim === "practical") chapMap[ch].practical++;
  }
  const chapRows = Object.keys(chapMap).sort((a, b) => a.localeCompare(b, "zh")).map((ch) => {
    const g = chapMap[ch];
    return `<div style="display:flex;align-items:center;gap:12px;padding:9px 4px;border-bottom:1px dashed var(--border);flex-wrap:wrap">
      <span style="flex:1;min-width:120px;font-size:13px;font-weight:700;color:var(--text-0)">${icon("book-open")} ${esc(ch)}</span>
      <span style="font-size:11.5px;color:var(--text-2);font-family:var(--mono)">理论 ${g.theory} · 实战 ${g.practical}</span>
      <span style="display:flex;gap:8px">
        <button class="exam-btn" style="padding:5px 12px;font-size:12px" ${g.theory >= 8 ? `onclick="startDirExam('${dirId}', 'theory', '${jsStr(ch)}')"` : `disabled style="opacity:0.4;cursor:not-allowed" title="本章理论题不足 8 道"`}>理论考核</button>
        <button class="exam-btn" style="padding:5px 12px;font-size:12px" ${g.practical >= 5 ? `onclick="startDirExam('${dirId}', 'practical', '${jsStr(ch)}')"` : `disabled style="opacity:0.4;cursor:not-allowed" title="本章实战题不足 5 道"`}>实战考核</button>
      </span>
    </div>`;
  }).join("");

  render(null, `
    <button class="exam-btn ghost" onclick="showLibrary()" style="margin-bottom:18px">← 返回目录列表</button>
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:6px">
      <h2 class="section-title" style="margin:0">📁 ${esc(dd.title)}</h2>
      <div style="font-size:12.5px;color:var(--text-2)">${dd.files?.length || 0} 个文件 · ${quiz.length} 题</div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:14px;font-weight:700;color:var(--accent)">📄 文件清单</div>
        <button class="exam-btn" onclick="addFileToDir('${dirId}')">📥 追加文件</button>
      </div>
      ${fileRows || "<div class='empty'>目录内暂无文件</div>"}
    </div>

    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:14px;font-weight:700;color:var(--accent)">${icon("book-open")} 按章考核（只考本章题目）</div>
        <div style="font-size:11px;color:var(--text-2);font-family:var(--mono)">章节名已自动归一（如"第2章 Function Calling"→"第2章"）</div>
      </div>
      ${chapRows || '<div class="empty">题库未标注章节，无法按章考核（可用下方全目录考核）</div>'}
    </div>

    <div class="card">
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <span style="font-size:12.5px;color:var(--text-2);font-family:var(--mono)">全目录考核：</span>
        <button class="exam-btn primary" onclick="startDirExam('${dirId}', 'theory')">📘 理论考核</button>
        <button class="exam-btn" onclick="startDirExam('${dirId}', 'practical')">🛠️ 实战考核</button>
        <button class="exam-btn ghost" onclick="renameDir('${dirId}', '${jsStr(dd.title)}')">✏️ 改名</button>
      </div>
    </div>

    <input type="file" id="dir-add-file" multiple style="display:none" onchange="handleDirFileAdd(this.files, '${dirId}')">
    <input type="file" id="dir-add-folder" webkitdirectory directory style="display:none" onchange="handleDirFileAdd(this.files, '${dirId}')">`);
}

/* 追加文件到目录：弹文件选择 */
function addFileToDir(dirId) {
  const inp = $("#dir-add-file");
  if (inp) inp.click();
}

async function handleDirFileAdd(fileList, dirId) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  // 追加文件也会生成题（LLM 驱动），未配置 LLM 则阻止
  if (!LLM_KEY) {
    showModal({
      iconHtml: icon("robot"),
      title: "追加文件需要 LLM",
      text: "追加文件时由 LLM 出题，请先配置 API Key（支持 DeepSeek、阿里百炼等 OpenAI 兼容接口）。",
      actions: [
        { label: "⚙️ 去设置", primary: true, onClick: () => showSettings() },
        { label: "先不了", onClick: () => {} },
      ],
    });
    return;
  }
  const payload = [];
  for (const f of files) {
    const md = await f.text().catch(() => "");
    const relPath = f._relPath || f.webkitRelativePath || f.name;
    if (md.trim()) payload.push({ filename: relPath, md, kind: fileKind(relPath) });
  }
  if (!payload.length) { showToast("⚠️ 没有可读取的文件"); return; }
  Logger.info("dir.file-add", "追加文件", { dirId, files: payload.map((p) => p.filename) });
  showToast("⏳ 正在追加文件…");
  const res = await fetch("/api/dir-file-add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid: UID, id: dirId, files: payload }),
  });
  const data = await res.json();
  if (data.ok) {
    const dupN = (data.duplicates || []).length;
    const errN = (data.errors || []).length;
    // D-8：追加文件有解析失败时明确提示（不再静默）
    showToast(`✅ 追加 ${data.added} 个文件${dupN ? ` · ${dupN} 个重复跳过` : ""}${errN ? ` · ⚠️ ${errN} 个解析失败` : ""}`);
    if (errN) {
      const names = (data.errors || []).map((e) => e.filename).join("、");
      showModal({ icon: "⚠️", title: "部分文件解析失败", text: `以下文件未能生成题目：${names}。请检查内容格式后重试。`, actions: [{ label: "知道了", primary: true, onClick: () => {} }] });
    }
    showDirDetail(dirId);
  } else {
    Logger.error("dir.file-add-fail", "追加文件失败: " + (data.error || ""), { dirId });
    showToast("❌ 追加失败：" + (data.error || ""));
  }
}

async function renameDir(dirId, oldTitle) {
  showModal({
    icon: "✏️",
    title: "修改目录名",
    text: "为这个章节目录设置一个自定义名称。",
    actions: [],
  });
  // 移除默认动作区，改用输入框 + 保存按钮
  const box = document.querySelector(".modal-box");
  const act = box.querySelector(".mb-actions");
  if (act) act.remove();
  const inp = document.createElement("input");
  inp.type = "text";
  inp.value = oldTitle;
  inp.maxLength = 40;
  inp.style.cssText = "width:100%;padding:10px 14px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:9px;color:var(--text-0);font-size:14px;outline:none;margin-bottom:16px";
  box.querySelector(".mb-text").after(inp);
  const saveBtn = document.createElement("button");
  saveBtn.className = "exam-btn primary";
  saveBtn.textContent = "💾 保存";
  saveBtn.style.width = "100%";
  saveBtn.onclick = async () => {
    const title = inp.value.trim();
    if (!title) { showToast("⚠️ 目录名不能为空"); return; }
    const res = await fetch("/api/dir-rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: UID, id: dirId, title }),
    });
    const data = await res.json();
    box.closest(".modal-mask").remove();
    if (data.ok) { Logger.info("dir.rename", "目录改名", { dirId, title }); showToast(`✅ 已改名「${title}」`); showLibrary(); }
    else { Logger.error("dir.rename-fail", "目录改名失败: " + (data.error || ""), { dirId }); showToast("❌ 改名失败：" + (data.error || "")); }
  };
  box.appendChild(saveBtn);
  inp.focus();
}

async function deleteDir(dirId) {
  showModal({
    icon: "🗑️",
    title: "删除整个目录？",
    text: "将删除该章节目录及其全部文件、题目。此操作不可撤销。",
    actions: [
      { label: "取消", onClick: () => {} },
      { label: "确认删除", primary: true, onClick: async () => {
        const res = await fetch("/api/dir-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: UID, id: dirId }),
        });
        const data = await res.json();
        if (data.ok) { Logger.warn("dir.delete", "目录已删除", { dirId }); showToast("✅ 目录已删除"); showLibrary(); }
        else { Logger.error("dir.delete-fail", "目录删除失败: " + (data.error || ""), { dirId }); showToast("❌ 删除失败：" + (data.error || "")); }
      } },
    ],
  });
}

async function deleteDirFile(dirId, filename) {
  showModal({
    icon: "🗑️",
    title: "删除文件？",
    text: `将删除「${filename}」及其贡献的题目。此操作不可撤销。`,
    actions: [
      { label: "取消", onClick: () => {} },
      { label: "确认删除", primary: true, onClick: async () => {
        const res = await fetch("/api/dir-file-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: UID, id: dirId, filename }),
        });
        const data = await res.json();
        if (data.ok) { Logger.warn("dir.file-delete", "删除目录文件", { dirId, filename, removed: data.removedQuestions }); showToast(`✅ 已删除，移除 ${data.removedQuestions} 题`); showDirDetail(dirId); }
        else { Logger.error("dir.file-delete-fail", "删除文件失败: " + (data.error || ""), { dirId, filename }); showToast("❌ 删除失败：" + (data.error || "")); }
      } },
    ],
  });
}

/* 章节名归一化：'2' / '第2章' / '第2章 Function Calling' → '第2章'；无 → '未分章' */
function normChapter(ch) {
  if (!ch) return "未分章";
  const s = String(ch).trim();
  let m = s.match(/第\s*([0-9一二三四五六七八九十百]+)\s*章/);
  if (m) return "第" + m[1] + "章";
  m = s.match(/^([0-9]+)$/);
  if (m) return "第" + m[1] + "章";
  return s;
}

/* 已知错题硬黑名单（代码级最终防线：题目文本含以下片段即过滤，不依赖题库数据/localStorage） */
const KNOWN_BAD_QUESTIONS = [
  "选择 Action → ____ → 记录 Observation",   // ReAct 旧错题：标准三步为 Thought → Action → Observation
];
function filterKnownBad(qs) {
  return qs.filter((q) => !KNOWN_BAD_QUESTIONS.some((b) => String(q.question || "").includes(b)));
}

/* 针对某个目录进行理论/实战考核（chapter = 按章考核：只抽该章题目） */
async function startDirExam(dirId, mode, chapter) {
  // 理论/实战考核都需要 LLM（出题 + 打标签 + 判分）
  if (!LLM_KEY) {
    const modeName = mode === "theory" ? "理论" : "实战";
    showModal({
      iconHtml: icon("robot"),
      title: `${modeName}考核需要 LLM`,
      text: `${modeName}考核的出题、题目能力打标签、语义判分都由 LLM 完成，需要先配置 API Key（支持 DeepSeek 官方或中转站）。`,
      actions: [
        { label: "⚙️ 去设置", primary: true, onClick: () => showSettings() },
        { label: "先不了", onClick: () => {} },
      ],
    });
    return;
  }
  examMode = mode;
  isCrossExam = false;  // 单目录考核，非跨课程
  examDirId = dirId;
  const seq = ++examSeq;   // A1：竞态守卫
  const loading = showExamLoading(mode);
  loading.log("读取目录数据");
  loading.setStatus("加载目录");
  loading.setProgress(20);
  let dd = null;
  try {
    const res = await fetch(`./api/dir?uid=${encodeURIComponent(UID)}&id=${encodeURIComponent(dirId)}`, { cache: "no-store" });
    dd = res.ok ? await res.json() : {};
  } catch (e) {
    showToast("⚠️ 网络错误，加载目录失败");
    return;
  }
  if (seq !== examSeq) return;
  if (!dd || !dd.course) { showToast("⚠️ 目录不存在"); return; }
  loading.log(`加载目录「${dd.title || ""}」`);
  loading.setProgress(40);
  // 用该目录的题出卷（chapter 参数 = 按章考核：只抽该章的题）
  const dirQuiz = dd.course.quiz || [];
  const inChapter = chapter ? (q) => normChapter(q.chapterRef || q.chapter) === chapter : () => true;
  let filtered = [];
  if (mode === "theory") {
    filtered = dirQuiz.filter((q) => inChapter(q) && (q.dimension || inferDimension(q)) === "theory" && ["choice", "multi_choice", "true_false", "fill_blank"].includes(q.type));
  } else if (mode === "practical") {
    filtered = dirQuiz.filter((q) => inChapter(q) && (q.dimension || inferDimension(q)) === "practical");
  }
  if (!filtered.length) {
    filtered = dirQuiz.filter((q) => inChapter(q) && (mode === "theory" ? ["choice", "multi_choice", "true_false", "fill_blank"].includes(q.type) : q.type === "practical"));
  }
  // 程序化组卷：从本章题库随机抽取（难度/薄弱维度加权 + 反馈坏题剔除 + 随机），不依赖 LLM 现出题
  loading.log("从本章题库随机组卷");
  loading.setProgress(75);
  filtered = adaptivePick(filtered, mode === "theory" ? 8 : 5);
  loading.log("题库组卷 → " + filtered.length + " 题（程序随机组卷 · 回顾题稍后注入）");
  if (!filtered.length) { showToast("⚠️ 该目录暂无此类题目，请先导入对应资料"); return; }
  // D1：回顾题（按模式过滤题型，理论考核不注入实战题）
  loading.log("注入回顾题（错题间隔重考，计入总题量）");
  filtered = injectReviewQuestions(filtered, mode, mode === "theory" ? 8 : 5, chapter);
  // 最终防御：按考核模式过滤题型（LLM 动态题/回顾题可能混入其他题型）
  filtered = filtered.filter((q) => mode === "theory"
    ? ["choice", "multi_choice", "true_false", "fill_blank"].includes(q.type)
    : q.type === "practical");
  filtered = filterKnownBad(filtered);   // 已知错题硬黑名单（最终防线）
  filtered = shuffleChoiceOptions(filtered);   // 选项洗牌：正确答案位置随机化
  filtered = shuffle(filtered);   // 题目整体再洗牌：回顾题融入随机位置，每场顺序不同
  loading.setProgress(95);
  await loading.finish();   // 确保动画至少展示一小段
  quiz = filtered;
  quizIdx = 0; combo = 0; correctCount = 0; abilityScore = {}; answers = [];
  renderQuestion();
}

function showHistory() {
  setNavActive("history");
  const rows = state.history.slice().reverse().map((h, i) => `
    <div class="exam-review-item">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="eri-q" style="margin:0">${MODE_LABEL[h.mode] || esc(h.mode)} · ${h.date.slice(0, 16).replace("T", " ")}</div>
        <div style="font-size:23px;font-weight:800;color:${h.pct >= 70 ? "#00e5ff" : "#ffb84d"}">${h.pct} 分</div>
      </div>
      <div style="font-size:11.5px;color:var(--text-2);margin-top:6px">得分 ${h.pct} 分 · ${Object.entries(h.abilities || {}).map(([a, p]) => `${a} ${p}分`).join(" · ")}</div>
    </div>`).join("") || "<div class='empty'>还没有考核记录，去完成一次考核吧！</div>";
  render(null, `
    <button class="exam-btn ghost" onclick="goHome()" style="margin-bottom:18px">← 返回</button>
    <h2 class="section-title">${icon("history", "lg")} 学习历史（${state.history.length} 次）</h2>
    ${rows}`);
}

/* 面试记录页：回顾每次仿真面试的岗位、分数、维度得分、总评 */
function showInterviewHistory() {
  const logs = state.interviewLogs || [];
  const rows = logs.map((log) => `
    <div class="exam-review-item" style="padding:14px 16px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
        <div>
          <div class="eri-q" style="margin:0">💼 ${esc(log.job)}</div>
          <div style="font-size:11px;color:var(--text-2);margin-top:3px">${(log.date || "").slice(0, 16).replace("T", " ")} · ${log.qa ? log.qa.length : 0} 轮问答</div>
        </div>
        <div style="font-size:26px;font-weight:800;color:${log.failed ? "#ffb84d" : log.score >= 60 ? "#00e5ff" : "#ff6b6b"}">${log.failed ? "评分失败" : log.score + " 分"}</div>
      </div>
      ${log.dimensions && log.dimensions.length ? `<div style="margin-top:8px;display:flex;flex-direction:column;gap:4px">${log.dimensions.map((d) => `<div style="font-size:12px;color:var(--text-1);line-height:1.6">· ${esc(d.name)} <span style="font-weight:700;color:${d.score >= 60 ? "#2fd6b5" : "#ffb84d"}">${d.score} 分</span>${d.comment ? ` — ${esc(d.comment)}` : ""}</div>`).join("")}</div>` : ""}
      ${log.overall ? `<div style="font-size:12.5px;color:var(--text-2);margin-top:8px;line-height:1.7;border-top:1px solid var(--border);padding-top:8px">📝 ${esc(log.overall)}</div>` : ""}
      ${log.qa && log.qa.length ? `
      <details style="margin-top:10px"><summary style="font-size:12px;color:var(--accent);cursor:pointer">📖 展开完整问答（${log.qa.length} 轮）</summary>
      <div style="margin-top:8px;font-size:12px;line-height:1.8;color:var(--text-1)">
        ${log.qa.map((qa, qi) => `
        <div style="padding:8px 0;border-bottom:1px dashed var(--border)">
          <div style="color:#ffb84d">${qa.followup ? "↳ 追问" : "Q" + (qi + 1)}. ${esc(qa.q)}</div>
          <div style="color:var(--text-2);margin-top:3px">A. ${esc(qa.a)}${qa.weak ? ` <span style="color:#ff6b6b">（弱回答）</span>` : ""}</div>
        </div>`).join("")}
      </div></details>` : ""}
    </div>`).join("") || "<div class='empty'>还没有面试记录，去完成一次面试考核吧！</div>";
  render(null, `
    <button class="exam-btn ghost" onclick="goHome()" style="margin-bottom:18px">← 返回</button>
    <h2 class="section-title">${icon("briefcase", "lg")} 面试记录（${logs.length} 次）</h2>
    ${rows}`);
}

function showWrongBook() {
  setNavActive("wrongbook");
  const items = state.wrongBook.map((w, i) => `
    <div class="exam-review-item">
      <div class="eri-q">${esc(w.q)}</div>
      <div style="font-size:11.5px;color:var(--text-1);line-height:1.7;margin-top:6px">
        <span style="color:#ff6b6b">我的答案：${esc(w.my)}</span><br>
        <span style="color:#00e5ff">${esc(w.answer)}</span>${w.explanation ? "<br>💡 " + esc(w.explanation) : ""}
        ${w.ability ? `<br><span style="color:#6b7a90">能力维度：${esc(w.ability)}</span>` : ""}
      </div>
    </div>`).join("") || "<div class='empty'>📭 还没有错题<br><span style='font-size:12.5px;color:var(--text-2)'>考核中答错的题会自动收录到这里，方便针对性复盘。</span></div>";
  render(null, `
    <button class="exam-btn ghost" onclick="goHome()" style="margin-bottom:18px">← 返回</button>
    <h2 class="section-title">📕 错题本（${state.wrongBook.length} 题）</h2>
    ${items}
    <div style="margin-top:14px;display:flex;gap:9px;flex-wrap:wrap">
      <button class="exam-btn primary" onclick="retakeWrongBook()">🔁 一键重考错题</button>
      <button class="exam-btn ghost" onclick="clearWrongBook()">🗑️ 清空错题本</button>
    </div>`);
}
function clearWrongBook() {
  state.wrongBook = [];
  saveState();
  showWrongBook();
}

/* 一键重考错题：把错题转成复习题（essay：显示题干 → 重新作答 → 对照标准答案自评） */
function retakeWrongBook() {
  if (!state.wrongBook.length) { showToast("⚠️ 错题本为空"); return; }
  quiz = state.wrongBook.map((w) => ({
    type: "essay",
    question: w.q,
    answer: w.answer,
    explanation: w.explanation || "",
    ability: w.ability || "提示词工程",
    difficulty: 3,
    source: "错题重考",
  }));
  examMode = "review";
  quizIdx = 0; combo = 0; correctCount = 0; abilityScore = {}; answers = [];
  renderQuestion();
}

/* 导出能力画像 / 岗位匹配为 Markdown 报告（下载文件，用于求职准备） */
function exportProfile() {
  const pct = abilityProfilePct();
  const assess = baseLevelAssessment();
  // 岗位匹配数据（复用 matchJobs 的评分逻辑，输出数据而非 HTML）
  const examCount = state.exams || 0;
  const strict = examCount < 3 ? 0.7 : examCount < 5 ? 0.85 : 1;
  const jobScores = JOBS.map((j) => {
    let num = 0, den = 0;
    for (const [ab, w] of Object.entries(j.weight)) {
      num += (pct[ab] ?? 0) * w;
      den += w * 100;
    }
    return { name: j.name, desc: j.desc, score: Math.round((num / Math.max(den, 1)) * 100 * strict) };
  }).sort((a, b) => b.score - a.score);

  const lines = [];
  lines.push("# AI 技能考核中心 · AI Job Skill Gauntlet 能力报告");
  lines.push("");
  lines.push("> 由「AI 技能考核中心 · AI Job Skill Gauntlet」自动生成 · " + new Date().toISOString().slice(0, 16).replace("T", " "));
  lines.push("");
  lines.push("## 基础水平");
  lines.push(`${assess.icon} ${assess.level}：${assess.desc}`);
  lines.push("");
  lines.push("## 能力画像（10 维）");
  for (const ab of ABILITIES) {
    const p = pct[ab];
    lines.push(`- ${ab}：${p !== undefined ? p + "%" : "未考核"}`);
  }
  lines.push("");
  lines.push("## 岗位匹配建议");
  for (const s of jobScores) {
    lines.push(`- ${s.name}（${s.score}%）：${s.desc}`);
  }
  lines.push("");
  lines.push("---");
  lines.push("> 说明：能力画像按「题量加权 + 时间衰减（遗忘曲线）」计算；岗位匹配在样本 <3 次考核时按 0.7 折扣、<5 次按 0.85 折扣，从严不虚高。");

  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "AI岗位能力试炼报告.md";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  showToast("✅ 已导出「AI岗位能力试炼报告.md」");
}

/* ============================================================
 * 新人引导（Onboarding）
 * 「快速开始」页：6 步流程 + 实时状态 + 推荐下一步（已移除高亮 Tour，有快速开始即可）
 * ============================================================ */
const GUIDE_STEPS = [
  { id: "llm", num: "①", icon: "⚙️", title: "配置 LLM", desc: "出题 / 判分 / 面试考核都由 LLM 驱动，先配置 API Key（支持 DeepSeek、阿里百炼等）", jump: showSettings, jumpLabel: "去配置" },
  { id: "import", num: "②", icon: "📥", title: "导入学习资料", desc: "拖入笔记 / 代码 / 文档或文件夹，系统自动解析并生成 12 道考核题", jump: showImportPanel, jumpLabel: "去导入" },
  { id: "chapter", num: "③", icon: "📘", title: "章节考核", desc: "进「资料目录」选章节分阶段考核，优先夯实每章基础", jump: showLibrary, jumpLabel: "去章节" },
  { id: "cross", num: "④", icon: "🎯", title: "综合考核", desc: "聚合全部章节题库组卷，检验整体掌握（理论 / 实战）", jump: () => showExamIntro("theory"), jumpLabel: "去考核" },
  { id: "interview", num: "⑤", icon: "💼", title: "面试考核", desc: "最后挑战：AI 面试官按岗位严格追问，检验综合表达", jump: startInterview, jumpLabel: "去面试" },
  { id: "profile", num: "⑥", icon: "🧬", title: "查看能力画像", desc: "10 维能力雷达 + 岗位匹配 + 等级称号，掌握强弱项并导出报告", jump: showAssessment, jumpLabel: "看画像" },
];

// 步骤完成判断（纯函数，可测试）
function guideStepDone(id) {
  if (id === "llm") return !!(LLM_KEY || "").trim();
  if (id === "import") return (state.imports || 0) > 0 && !!(COURSE && COURSE.quiz && COURSE.quiz.length);
  if (id === "chapter") return (state.history || []).some((h) => h.cross === false);
  if (id === "cross") return !!state.crossExam || (state.history || []).some((h) => h.cross === true);
  if (id === "interview") return (state.interviewLogs || []).length > 0;
  if (id === "profile") return Object.keys(abilityProfilePct()).length > 0;
  return false;
}

// 当前最该做的一步：按顺序第一个未完成；全部完成返回 null
function guideNextStepId() {
  for (const s of GUIDE_STEPS) if (!guideStepDone(s.id)) return s.id;
  return null;
}
function __guideJump(id) {
  const s = GUIDE_STEPS.find((x) => x.id === id);
  if (s && s.jump) s.jump();
}

/* 「快速开始」独立页（侧边栏入口）：复用 GUIDE_STEPS 渲染纵向步骤卡 */
function showQuickStart() {
  setNavActive("quickstart");
  const nextId = guideNextStepId();
  const allDone = !nextId;
  const steps = GUIDE_STEPS.map((s) => {
    const done = guideStepDone(s.id);
    const isNext = s.id === nextId;
    const cls = done ? "done" : (isNext ? "next" : "todo");
    return `
    <div class="guide-step ${cls}" id="gs-${s.id}">
      <div class="gs-badge">${done ? "✓" : s.num}</div>
      <div class="gs-body">
        <div class="gs-title">${s.icon} ${esc(s.title)}</div>
        <div class="gs-desc">${esc(s.desc)}</div>
      </div>
      <div class="gs-cta">${done
        ? `<span class="gs-done-tag">✓ 已完成</span>`
        : isNext
          ? `<button class="exam-btn primary gs-go" onclick="__guideJump('${s.id}')">${esc(s.jumpLabel)} →</button>`
          : `<span class="gs-lock">🔒 待完成</span>`}
      </div>
    </div>`;
  }).join("");
  render(null, `
    <div class="guide-page">
      <h2 class="section-title">${icon("rocket", "lg")} 快速开始</h2>
      <div style="font-size:13px;color:var(--text-1);line-height:1.8;margin:6px 0 16px">按顺序完成 6 步即可上手：配置 LLM → 导入资料 → 章节 → 综合 → 面试 → 画像。已完成的步骤自动打勾，系统会标记你当前最该做的一步。</div>
      ${allDone ? `<div class="card" style="margin-bottom:14px;padding:13px 18px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;border-color:rgba(0,240,255,0.3)">
        <span style="font-size:17px">🎉</span> 恭喜！<strong style="color:var(--accent)">全部引导步骤已完成</strong>，你已经掌握完整流程。
      </div>` : ""}
      <div class="guide-bar" style="margin:0"><div class="gb-steps">${steps}</div></div>
      <div style="margin-top:16px">
      </div>
    </div>`);
}

/* ===== 考核介绍页（综合考核三个模式：说明 + 开启按钮，开启后进加载动画） ===== */
const EXAM_INTRO = {
  theory: {
    title: "理论考核", icon: "brain", from: "#00e5ff", to: "#38bdf8",
    badge: "客观题 · 跨章节综合",
    summary: "聚合全部章节题库，由 LLM 从全题库动态组卷（约 16 题），检验整体掌握与遗忘，题目带 1-5 级难度覆盖多档。",
    items: [
      "题型：单选 / 多选 / 判断 / 填空（概念、原理、术语）",
      "判分：客观题程序即时判分；填空支持语义模糊匹配",
      "附加：能力打标签、连击、错题记录、错题回顾题注入",
    ],
    requires: "需先导入学习资料并配置 LLM（组卷/判分由 LLM 驱动）",
    cta: "开始理论考核",
    start: "startExam('theory')",
  },
  practical: {
    title: "实战考核", icon: "code", from: "#ff3df0", to: "#b026ff",
    badge: "代码实战客观题 · 跨章节综合",
    summary: "跨全部章节的代码实战客观题（约 10 题），检验代码阅读与排错能力：判断代码输出、预测运行结果、定位 Bug。",
    items: [
      "题型：代码实战客观题（单选/多选，可含多文件代码片段）",
      "判分：程序即时判分，零误差",
      "要求：资料中需包含代码文件（py / ipynb / js / ts / java）",
    ],
    requires: "需已导入含代码的资料并配置 LLM",
    cta: "开始实战考核",
    start: "startExam('practical')",
  },
  interview: {
    title: "面试考核", icon: "messages-square", from: "#b026ff", to: "#00e5ff",
    badge: "AI 面试官仿真对话",
    summary: "选择岗位后，AI 面试官按岗位知识图谱（职责/核心技能/考察维度/追问方向）进行多轮严格追问，最终给出综合评分与维度点评。",
    items: [
      "流程：选岗位 → 多轮问答（场景题 + 追问深挖）→ 综合评分",
      "机制：追问预算递减；连续弱回答（≥3 次）提前终止面试",
      "产出：面试记录存档 + 能力画像累积 + 岗位匹配建议",
    ],
    requires: "需配置 LLM；建议先完成理论/实战考核打好基础",
    cta: "开始面试考核",
    start: "startInterview()",
  },
};

function showExamIntro(mode) {
  // 面试考核：专属精致介绍页（岗位预览 + 流程时间线 + 机制/产出 + FAQ）
  if (mode === "interview") return renderInterviewIntro();
  const cfg = EXAM_INTRO[mode] || EXAM_INTRO.theory;
  setNavActive(mode);
  render(null, `
    <div class="exam-intro">
      <div style="display:flex;align-items:center;gap:18px;margin-bottom:20px;flex-wrap:wrap">
        <div style="display:flex;align-items:center">${neonIcon(cfg.icon, "ei-" + mode, cfg.from, cfg.to, "xl")}</div>
        <div style="flex:1;min-width:200px">
          <h2 class="section-title" style="margin:0">${cfg.title}</h2>
          <div style="font-size:12px;color:var(--accent-2);font-family:var(--mono);margin-top:4px">${cfg.badge}</div>
        </div>
      </div>

      <!-- 综合考核：聚合题库统计（与章节卡片「储备」展示逻辑不同） -->
      <div id="exam-intro-stats" class="card" style="margin-bottom:14px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:12px 16px">
        <span style="color:var(--text-2);font-size:12.5px;font-family:var(--mono)">聚合统计加载中…</span>
      </div>

      <div class="card" style="margin-bottom:14px">
        <div style="font-size:14.5px;font-weight:700;color:var(--text-0);margin-bottom:10px;display:flex;align-items:center;gap:9px">${icon("info", "lg")} 考核说明</div>
        <div style="font-size:13.5px;color:var(--text-1);line-height:1.9">${cfg.summary}</div>
        <div style="margin-top:14px;display:flex;flex-direction:column;gap:9px">
          ${cfg.items.map((t) => `<div style="display:flex;align-items:flex-start;gap:9px;font-size:13px;color:var(--text-1);line-height:1.7"><span style="color:var(--accent);margin-top:1px">${icon("check")}</span>${t}</div>`).join("")}
        </div>
      </div>

      <!-- 前置要求：仅未配置 LLM 时显示（已配置则不提示；无目录由上方聚合统计卡引导） -->
      ${LLM_KEY ? "" : `<div class="card" style="margin-bottom:20px;padding:12px 16px;display:flex;align-items:center;gap:10px;border-color:rgba(255,184,77,0.35);background:rgba(255,184,77,0.05)">
        <span style="color:#ffb84d">${icon("alert-triangle")}</span>
        <div style="font-size:12.5px;color:var(--text-1)">${cfg.requires}</div>
      </div>`}

      <button class="exam-btn primary exam-intro-cta" onclick="${cfg.start}">${icon("zap")} ${cfg.cta}</button>
      <div style="margin-top:12px;font-size:11.5px;color:var(--text-2)">点击后进入加载动画：LLM 组卷 / 面试准备 → 完成后自动进入考核。</div>
    </div>
  `);
  // 异步加载聚合题库统计（综合考核 = 聚合全部目录，展示逻辑与章节卡片不同）
  refreshDirs().then((dirs) => {
    const el = document.getElementById("exam-intro-stats");
    if (!el) return;
    if (!dirs.length) {
      el.innerHTML = '<span style="color:var(--text-2);font-size:12.5px;font-family:var(--mono)">暂无目录题库，先去「导入资料」添加学习资料</span>';
      return;
    }
    const t = dirs.reduce((s, d) => s + (d.theoryCount || 0), 0);
    const p = dirs.reduce((s, d) => s + (d.practicalCount || 0), 0);
    // 综合考核战绩：已考次数 + 最高分（cross=true 的记录）
    const crossRecs = (typeof state !== "undefined" && state.history) ? state.history.filter((h) => h.cross === true) : [];
    const doneHtml = crossRecs.length
      ? `<span style="display:inline-flex;align-items:center;gap:6px;color:var(--text-1);font-size:12px;font-family:var(--mono);padding:2px 9px;border-radius:6px;background:rgba(47,214,181,0.07);border:1px solid rgba(47,214,181,0.25)">${icon("trophy")} 综合考核已考 <b style="color:#2fd6b5;font-weight:800">${crossRecs.length}</b> 次 · 最好成绩 <b style="color:#2fd6b5;font-weight:800">${Math.max(...crossRecs.map((h) => h.pct))}%</b></span>`
      : "";
    el.innerHTML = `
      <span style="display:inline-flex;align-items:center;gap:6px;color:var(--text-1);font-size:12.5px;font-family:var(--mono)">${icon("layers", "lg")} 聚合 ${dirs.length} 个目录题库</span>
      <span style="display:inline-flex;align-items:center;gap:6px;color:var(--text-1);font-size:12px;font-family:var(--mono);padding:2px 9px;border-radius:6px;background:rgba(0,229,255,0.05);border:1px solid rgba(0,229,255,0.15)">${icon("book-open")} 理论题储备 <b style="color:var(--accent);font-weight:800">${t}</b></span>
      <span style="display:inline-flex;align-items:center;gap:6px;color:var(--text-1);font-size:12px;font-family:var(--mono);padding:2px 9px;border-radius:6px;background:rgba(255,61,240,0.05);border:1px solid rgba(255,61,240,0.15)">${icon("wrench")} 实战题储备 <b style="color:var(--accent-2);font-weight:800">${p}</b></span>
      ${doneHtml}`;
  }).catch(() => { /* 统计失败静默 */ });
}

/* 面试考核介绍页（精致版）：岗位预览 + 流程时间线 + 机制/产出双栏 + FAQ */
function renderInterviewIntro() {
  setNavActive("interview");
  const jobChips = (typeof JOBS !== "undefined" ? JOBS : []).map((j) => `
    <div class="iv-job" title="点击进入选岗页，可查看岗位知识库详情" onclick="startInterview()">
      <div class="iv-job-ic">${icon("briefcase")}</div>
      <div>
        <div class="iv-job-name">${esc(j.name)}</div>
        <div class="iv-job-desc">${esc(j.desc)}</div>
      </div>
    </div>`).join("");
  const timeline = [
    { icon: "user", title: "选择岗位", desc: "8 个 AI 岗位方向，AI 面试官加载对应岗位知识图谱" },
    { icon: "message-circle", title: "开场问答", desc: "围绕岗位职责/核心技能/知识图谱要点多轮提问" },
    { icon: "search", title: "深挖追问", desc: "答不上时按追问方向深挖；连续弱答提前终止" },
    { icon: "award", title: "综合评分", desc: "总分 + 10 维能力点评 + 面试记录存档" },
  ].map((s, i) => `
    <div class="iv-tl-item">
      <div class="iv-tl-dot">${icon(s.icon)}</div>
      <div class="iv-tl-title">${i + 1}. ${s.title}</div>
      <div class="iv-tl-desc">${s.desc}</div>
    </div>`).join("");
  const mech = [
    ["zap", "追问预算递减", "每轮追问次数有限，逼真模拟真实面试官的时间压力"],
    ["shield", "连续弱答终止", "连续 ≥3 次弱回答（不知道/不会/避重就轻）提前结束面试"],
    ["target", "严格评分", "总评 + 10 维能力逐项点评，不做虚假鼓励"],
  ].map(([ic, t, d]) => `<div class="iv-mech-item">${icon(ic)}<div><strong style="color:var(--text-0)">${t}</strong> — ${d}</div></div>`).join("");
  const gain = [
    ["history", "面试记录存档", "每次面试完整对话可回看，复盘表达与知识盲区"],
    ["trending-up", "能力画像累积", "面试表现计入 10 维能力雷达与等级称号"],
    ["briefcase", "岗位匹配建议", "基于画像给出最匹配岗位与提升方向"],
  ].map(([ic, t, d]) => `<div class="iv-mech-item">${icon(ic)}<div><strong style="color:var(--text-0)">${t}</strong> — ${d}</div></div>`).join("");
  const faqs = [
    ["需要先完成理论/实战考核吗？", "建议先完成，但非强制。面试会暴露真实表达能力，直接挑战也能快速定位短板。"],
    ["没有岗位知识库的资料能面试吗？", "可以。面试按内置岗位知识库（职责/技能/追问方向）驱动，不依赖你导入的资料。"],
    ["面试会被记录吗？", "会。完整对话存档到本机 profile.json，可在「学习历史 → 面试记录」随时回看。"],
  ].map(([q, a]) => `<div class="iv-faq-item"><span class="iv-faq-q">Q：${q}</span>${a}</div>`).join("");
  render(null, `
    <div class="iv-intro">
      <div class="iv-hero">
        <div style="display:flex;align-items:center">${neonIcon("messages-square", "ei-iv", "#b026ff", "#00e5ff", "xl")}</div>
        <div style="flex:1;min-width:200px">
          <h2 class="section-title" style="margin:0">面试考核</h2>
          <div style="font-size:12px;color:var(--accent-2);font-family:var(--mono);margin-top:4px">AI 面试官仿真对话 · 岗位知识图谱驱动 · 严格评分</div>
        </div>
        <div style="font-size:12px;color:var(--text-2);text-align:right">
          <div style="font-family:var(--cyber);font-size:22px;color:var(--accent)">8</div>
          <div>可选岗位</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div style="font-size:14px;font-weight:700;color:var(--text-0);margin-bottom:12px;display:flex;align-items:center;gap:9px">${icon("briefcase", "lg")} 选择面试岗位（点击直接开面）</div>
        <div class="iv-jobs">${jobChips}</div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div style="font-size:14px;font-weight:700;color:var(--text-0);margin-bottom:14px;display:flex;align-items:center;gap:9px">${icon("git-branch", "lg")} 面试流程</div>
        <div class="iv-tl">${timeline}</div>
      </div>

      <div class="iv-two" style="margin-bottom:16px">
        <div class="card" style="margin:0">
          <div style="font-size:13.5px;font-weight:700;color:var(--accent-2);margin-bottom:6px;display:flex;align-items:center;gap:8px">${icon("zap", "lg")} 面试机制</div>
          ${mech}
        </div>
        <div class="card" style="margin:0">
          <div style="font-size:13.5px;font-weight:700;color:var(--accent);margin-bottom:6px;display:flex;align-items:center;gap:8px">${icon("trending-up", "lg")} 面试产出</div>
          ${gain}
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div style="font-size:13.5px;font-weight:700;color:var(--text-0);margin-bottom:10px;display:flex;align-items:center;gap:8px">${icon("help-circle", "lg")} 常见问题</div>
        <div class="iv-faq">${faqs}</div>
      </div>

      ${LLM_KEY ? "" : `<div class="card" style="margin-bottom:20px;padding:12px 16px;display:flex;align-items:center;gap:10px;border-color:rgba(255,184,77,0.35);background:rgba(255,184,77,0.05)">
        <span style="color:#ffb84d">${icon("alert-triangle")}</span>
        <div style="font-size:12.5px;color:var(--text-1)">需配置 LLM（面试由 AI 面试官驱动）；建议先完成理论/实战考核再挑战面试。</div>
      </div>`}

      <button class="exam-btn primary exam-intro-cta" onclick="startInterview()">${icon("messages-square")} 开始面试考核（先选岗位）</button>
      <div style="margin-top:12px;font-size:11.5px;color:var(--text-2)">点击后进入选岗页面 → 开始面试。面试全程 LLM 驱动，结束后自动评分存档。</div>
    </div>
  `);
}

/* ---------------- 居中模态弹窗 ---------------- */
/* options: { title, text, icon, actions: [{label, primary, onClick}], closable } */
function showModal(opts) {
  const mask = document.createElement("div");
  mask.className = "modal-mask";
  const actions = (opts.actions || []).map((a) =>
    `<button class="exam-btn ${a.primary ? "primary" : "ghost"}" style="${a.primary ? "" : "border-color:var(--border)"}" onclick="__modalAction(${opts.actions.indexOf(a)}, this)">${esc(a.label)}</button>`).join("");
  mask.innerHTML = `
    <div class="modal-box">
      ${opts.closable !== false ? `<button class="mb-close" onclick="this.closest('.modal-mask').remove()">✕</button>` : ""}
      ${opts.icon ? `<div class="mb-icon">${opts.iconHtml ? opts.iconHtml : esc(opts.icon)}</div>` : ""}
      ${opts.title ? `<div class="mb-title">${esc(opts.title)}</div>` : ""}
      ${opts.text ? `<div class="mb-text">${esc(opts.text)}</div>` : ""}
      ${actions ? `<div class="mb-actions">${actions}</div>` : ""}
    </div>`;
  // 存 actions 供回调使用
  mask.__actions = opts.actions || [];
  document.body.appendChild(mask);
  // 点击遮罩空白处关闭（点弹窗内部不关）
  mask.addEventListener("click", (e) => {
    if (e.target === mask && opts.closable !== false) mask.remove();
  });
}

function __modalAction(idx, btn) {
  const mask = btn.closest(".modal-mask");
  const actions = mask.__actions || [];
  mask.remove();
  const a = actions[idx];
  if (a && a.onClick) a.onClick();
}

/* ---------------- Toast ---------------- */
let toastEl = null;
let toastTimer = null;
function showToast(msg) {
  // 单例：新提示替换旧的，避免连续触发时多个 toast 重叠
  if (toastEl) { toastEl.remove(); toastEl = null; }
  clearTimeout(toastTimer);
  const t = document.createElement("div");
  t.className = "app-toast";
  t.textContent = msg;
  document.body.appendChild(t);
  toastEl = t;
  toastTimer = setTimeout(() => {
    t.classList.add("hide");
    setTimeout(() => { t.remove(); if (toastEl === t) toastEl = null; }, 250);
  }, 2000);
}

/* ---------------- 徽章解锁庆祝动画 ---------------- */
/* 全屏酷炫弹窗：徽章图标弹性放大 + 稀有度光晕 + 粒子爆发 + 奖励提示 */
function showBadgeCelebration(badge) {
  const meta = RARITY_META[badge.rarity] || RARITY_META.common;
  const mask = document.createElement("div");
  mask.className = "badge-celebrate";
  mask.innerHTML = `
    <div class="bc-glow" style="--c:${meta.color}"></div>
    <div class="bc-icon">${badge.icon}</div>
    <div class="bc-name">${esc(badge.name)}</div>
    <div class="bc-rarity" style="color:${meta.color}">${meta.label}徽章 · ${esc(badge.desc)}</div>
    <div class="bc-reward">+XP ${badge.ap || 10} · +AP ${badge.ap || 10}</div>
    <div class="bc-tip">点击任意处关闭</div>`;
  document.body.appendChild(mask);
  // 粒子爆发（徽章中心）
  burstParticles(window.innerWidth / 2, window.innerHeight / 2 - 40, meta.color, 70);
  // 1.2s 后再补一轮金色粒子（进阶感）
  setTimeout(() => burstParticles(window.innerWidth / 2, window.innerHeight / 2 - 40, "#ffd75b", 40), 550);
  const close = () => {
    if (!mask.isConnected) return;
    mask.classList.add("out");
    setTimeout(() => mask.remove(), 420);
  };
  mask.addEventListener("click", close);
  setTimeout(close, 3600);
}

/* 退出当前考核（确认后放弃进度回首页） */
function quitExam() {
  const done = answers.length, total = quiz.length;
  showModal({
    icon: "⚠️",
    title: "退出考核？",
    text: `已答 ${done}/${total} 题。退出后本次考核进度将不保存，确定退出吗？`,
    actions: [
      { label: "继续答题", onClick: () => {} },
      { label: "确认退出", primary: true, onClick: () => { Logger.warn("exam.quit", "用户中途退出考核", { mode: examMode, answered: answers.length }); examSeq++; quiz = []; quizIdx = 0; answers = []; goHome(); } },
    ],
  });
}

/* 退出面试（确认后放弃记录回首页） */
function quitInterview() {
  showModal({
    icon: "⚠️",
    title: "退出面试？",
    text: "退出后本次面试记录将不保存，确定退出吗？",
    actions: [
      { label: "继续面试", onClick: () => {} },
      { label: "确认退出", primary: true, onClick: () => { Logger.warn("interview.quit", "用户中途退出面试", { job: interviewState && interviewState.job && interviewState.job.name }); interviewBusyCount = 0; interviewState = null; goHome(); } },
    ],
  });
}

/* ---------------- 诊断中心（日志查看/过滤/导出/清空） ---------------- */
let diagFile = "activity";      // activity | app
let diagLimit = 300;
let diagRows = [];              // 当前已加载的解析行
let diagFilter = { level: "", tag: "", keyword: "" };

async function showDiagnostics() {
  setNavActive("diag");
  render(null, `
    <button class="exam-btn ghost" onclick="goHome()" style="margin-bottom:18px">← 返回</button>
    <h2 class="section-title">${icon("terminal", "lg")} 诊断日志</h2>
    <div style="font-size:12px;color:var(--text-2);margin-bottom:14px">记录导入 / 考核 / 面试 / LLM 交互 / 系统错误全链路事件（JSONL 落盘，可过滤、导出，用于问题追踪）</div>
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
        <button class="exam-btn ${diagFile === "activity" ? "primary" : "ghost"}" style="padding:6px 12px;font-size:12px" onclick="diagFile='activity';showDiagnostics()">📋 活动日志</button>
        <button class="exam-btn ${diagFile === "app" ? "primary" : "ghost"}" style="padding:6px 12px;font-size:12px" onclick="diagFile='app';showDiagnostics()">🖥️ 系统日志</button>
        <span style="flex:1"></span>
        <select id="diag-limit" style="padding:6px 10px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;color:var(--text-0);font-size:12px" onchange="diagLimit=Number(this.value);loadDiag()">
          <option value="100">最近 100 行</option>
          <option value="300" selected>最近 300 行</option>
          <option value="1000">最近 1000 行</option>
        </select>
        <button class="exam-btn ghost" style="padding:6px 12px;font-size:12px" onclick="loadDiag()">🔄 刷新</button>
        <button class="exam-btn ghost" style="padding:6px 12px;font-size:12px" onclick="exportDiag()">📤 导出</button>
        <button class="exam-btn" style="padding:6px 12px;font-size:12px;color:#ff6b6b;border-color:rgba(255,107,107,0.4)" onclick="clearDiag()">🗑️ 清空</button>
      </div>
      <div style="display:flex;gap:9px;flex-wrap:wrap">
        <input id="diag-f-level" placeholder="级别过滤: error / warn / info" style="width:160px;padding:7px 11px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;color:var(--text-0);font-size:12px;outline:none">
        <input id="diag-f-tag" placeholder="tag 过滤: 如 llm-start / exam." style="width:200px;padding:7px 11px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;color:var(--text-0);font-size:12px;outline:none">
        <input id="diag-f-keyword" placeholder="session / 内容关键词" style="flex:1;min-width:180px;padding:7px 11px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;color:var(--text-0);font-size:12px;outline:none">
        <button class="exam-btn primary" style="padding:7px 16px;font-size:12px" onclick="applyDiagFilter()">🔎 过滤</button>
      </div>
    </div>
    <div id="diag-status" style="font-size:11.5px;color:var(--text-2);margin-bottom:8px">加载中…</div>
    <div id="diag-list" style="font-family:var(--mono);font-size:11px;line-height:1.7"></div>
  `);
  await loadDiag();
}

async function loadDiag() {
  const status = $("#diag-status");
  const list = $("#diag-list");
  if (!list) return;
  status.textContent = "加载中…";
  try {
    const res = await fetch(`/api/logs?uid=${encodeURIComponent(UID)}&file=${diagFile}&limit=${diagLimit}`, { cache: "no-store" });
    const data = await res.json();
    diagRows = (data.lines || []).map((ln) => { try { return JSON.parse(ln); } catch (e) { return { _raw: ln }; } });
    status.textContent = `共 ${data.total} 行，当前显示最近 ${diagRows.length} 行（${data.path}）`;
    renderDiagRows();
  } catch (e) {
    status.textContent = "读取失败: " + e.message;
  }
}

function applyDiagFilter() {
  diagFilter.level = ($("#diag-f-level") || {}).value || "";
  diagFilter.tag = ($("#diag-f-tag") || {}).value || "";
  diagFilter.keyword = ($("#diag-f-keyword") || {}).value || "";
  renderDiagRows();
}

function renderDiagRows() {
  const list = $("#diag-list");
  if (!list) return;
  const { level, tag, keyword } = diagFilter;
  const kw = (keyword || "").toLowerCase();
  const rows = diagRows.filter((r) => {
    if (level && r.level !== level) return false;
    if (tag && !(r.tag || "").includes(tag)) return false;
    if (kw) {
      const hay = JSON.stringify(r).toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
  if (!rows.length) { list.innerHTML = `<div style="color:var(--text-2);padding:20px;text-align:center">无匹配日志</div>`; return; }
  list.innerHTML = rows.map((r) => {
    const at = (r.at || "").replace("T", " ").slice(0, 19);
    const color = r.level === "error" ? "#ff6b6b" : r.level === "warn" ? "#ffb84d" : "#8fa8c8";
    const tagTxt = r.tag || "-";
    const sessionTxt = r.session ? `<span style="color:#2fd6b5">[${esc(r.session)}]</span> ` : "";
    const msgTxt = esc(r.msg || "");
    const payloadTxt = r.payload && Object.keys(r.payload).length ? `<span style="color:var(--text-2)"> ${esc(JSON.stringify(r.payload).slice(0, 400))}</span>` : "";
    const rawTxt = r._raw ? `<span style="color:var(--text-2)">${esc(r._raw.slice(0, 300))}</span>` : "";
    return `<div style="padding:4px 8px;border-left:2px solid ${color}22;background:rgba(255,255,255,0.015);margin-bottom:3px;border-radius:4px;white-space:pre-wrap;word-break:break-all">` +
      `<span style="color:var(--text-2)">${at}</span> <span style="color:${color}">${esc(r.level || "info")}</span> ${sessionTxt}<span style="color:${color}">${esc(tagTxt)}</span> ${msgTxt}${payloadTxt}${rawTxt}</div>`;
  }).join("");
}

function exportDiag() {
  const txt = diagRows.map((r) => (r._raw ? r._raw : JSON.stringify(r))).join("\n");
  const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${diagFile}-log-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  showToast("📤 已导出 " + diagRows.length + " 行日志");
}

async function clearDiag() {
  if (!confirm("确定清空「" + (diagFile === "app" ? "系统日志" : "活动日志") + "」吗？此操作不可撤销（不影响业务数据）。")) return;
  try {
    const res = await fetch("/api/logs-clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: UID, file: diagFile }),
    });
    const data = await res.json();
    if (data.ok) { showToast("✅ 日志已清空"); loadDiag(); }
    else showToast("❌ 清空失败：" + (data.error || ""));
  } catch (e) {
    showToast("❌ 清空失败：" + e.message);
  }
}

/* ---------------- 初始化 ---------------- */
async function init() {
  try {
    await loadData();
  } catch (e) {
    $("#exam-view").innerHTML = `<div style="color:#ff6b6b;padding:30px;text-align:center">
      <h2>无法加载课程数据</h2><p>${esc(e.message)}</p>
      <p style="color:#9fb4c8;font-size:15px">请导入你的学习资料，系统将自动解析并出题。</p></div>`;
    return;
  }
  await loadJobKnowledge();   // 加载岗位知识库（job_knowledge.json 数据库）
  loadState();
  renderSidebar();   // 常驻左侧导航
  updateGamestat();
  goHome();
  // 欢迎弹窗已移除（v2.1.1）：未配置 LLM 的引导由首页顶条「⚠️ 未配置 LLM」状态 + 设置页承担
}

document.addEventListener("DOMContentLoaded", init);

// Logo 悬停彩蛋：平时静态渐变（GPU 零开销），鼠标悬停时渐变流动 2 秒（SMIL beginElement 触发）
document.addEventListener("DOMContentLoaded", () => {
  const logo = document.querySelector(".logo-title");
  if (!logo) return;
  logo.addEventListener("mouseenter", () => {
    logo.querySelectorAll("animate").forEach((a) => { try { a.beginElement(); } catch (e) { /* SMIL 不可用时忽略 */ } });
  });
});
