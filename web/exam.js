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
  { score: 68, title: "Agent 工程师", icon: "🤖" },
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
  // 同步到服务器（跨浏览器持久化）
  try {
    fetch(`./api/profile-save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: UID, profile: state }),
    }).catch(() => {});
  } catch (e) { /* ignore */ }
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
async function llmPickQuestions(pool, mode, count, scope) {
  // scope: "chapter"（章节考核，从本章题库挑、聚焦本章）| "cross"（综合考核，从全题库挑、跨章节覆盖）
  if (!LLM_KEY || !pool || pool.length < count) return null;
  const NL = String.fromCharCode(10);
  const brief = pool.slice(0, 100).map((q, i) =>
    i + "｜[" + q.type + "] " + String(q.question || "").slice(0, 60) + "（维度:" + (q.ability || "?") + " 难度:" + (q.difficulty || 2) + "）"
  ).join(NL);
  const modeLabel = mode === "theory" ? "理论" : "实战";
  const goal = scope === "chapter"
    ? "这是一场【章节考核】：从本章节题库中挑选 " + count + " 道" + modeLabel + "题组卷。要求：聚焦本章节核心知识点、题目与本章资料强相关、难度适中为主、题型适度多样、题目之间不要雷同。"
    : "这是一场【综合考核】：从整个题库（跨章节/跨目录）中挑选 " + count + " 道" + modeLabel + "题组卷。要求：跨章节覆盖、维度尽量多样不扎堆、难度有阶梯（基础到进阶）、题目之间不要雷同、优先选质量高有区分度、贴合真实业务的题。";
  const prompt = "你是出题组长。" + goal + NL +
    "只输出 JSON：{'picks': [编号数组]}，编号取自上面列表行首数字。" + NL + "候选题：" + NL + brief;
  try {
    let base = String(LLM_BASE || "https://api.deepseek.com");
    while (base.endsWith("/")) base = base.slice(0, -1);
    const res = await fetch(base + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + LLM_KEY },
      body: JSON.stringify({
        model: LLM_MODEL || "deepseek-chat",
        messages: [{ role: "system", content: "你只输出 JSON，不输出任何其他文字。" }, { role: "user", content: prompt }],
        temperature: 0.6, max_tokens: 300, response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const content = (await res.json()).choices[0].message.content;
    let parsed = null;
    try { parsed = JSON.parse(content); } catch (e) {
      const a = content.indexOf("{"), b = content.lastIndexOf("}");
      if (a >= 0 && b > a) try { parsed = JSON.parse(content.slice(a, b + 1)); } catch (e2) {}
    }
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
    const clean = pool.filter((q) => !badTexts.has(q.question));
    if (clean.length >= Math.min(limit, pool.length)) pool = clean;
  }
  if (softTexts.size) {
    const rest = pool.filter((q) => !softTexts.has(q.question));
    if (rest.length >= limit) pool = rest;
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

function injectReviewQuestions(filtered, mode) {
  const log = state.askedLog || {};
  const entries = Object.values(log);
  if (!entries.length) return filtered;
  // 题型过滤：回顾题必须与当前考核模式匹配（理论考核绝不注入实战题，反之亦然）
  const typeOk = (q) => {
    if (mode === "practical") return q && q.type === "practical";
    if (mode === "theory") return q && ["choice", "multi_choice", "true_false", "fill_blank"].includes(q.type);
    return true;   // 其他模式（面试等）不过滤
  };
  // 优先错题，且按「距离上次答错的时间」从远到近排序（间隔重复：越久越该复习）
  const wrongs = entries.filter((e) => typeOk(e.q) && e.wrong > 0)
    .sort((a, b) => (a.lastAt || 0) - (b.lastAt || 0));
  const others = entries.filter((e) => typeOk(e.q) && !e.wrong)
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
  // 回顾题插到试卷最前面（优先重考）
  return chosen.concat(filtered);
}

function render(view, html) {
  $("#exam-view").innerHTML = html;
  if (typeof view === "function") view();
}

async function goHome() {
  const courseTitle = COURSE ? COURSE.title : "加载中…";
  await refreshDirs();   // 题库按目录存储：以目录聚合判断（脱离 course.json 单课程镜像）
  const quizCount = (DIRS || []).reduce((s, d) => s + (d.quizCount || 0), 0);
  const isEmpty = !(DIRS || []).length || quizCount === 0;
  const assess = baseLevelAssessment();
  const profilePct = abilityProfilePct();
  const profileKeys = Object.keys(profilePct);
  const needLLM = !LLM_KEY;   // LLM 配置是考核前提，未配置直接灰卡
  const modeCards = [
    { icon: "📘", title: "理论考核", desc: "跨章节综合 · 概念/原理/判断等客观知识题", tag: "需 LLM", onClick: "startExam('theory')", disabled: isEmpty || needLLM },
    { icon: "🛠️", title: "实战考核", desc: "跨章节综合 · 代码实战客观题（代码作用/输出预测/Bug 修复）", tag: "需 LLM", onClick: "startExam('practical')", disabled: isEmpty || needLLM },
    { icon: "💼", title: "面试考核", desc: "AI 面试官仿真对话，按岗位技能严格追问", tag: "需 LLM", onClick: "startInterview()", disabled: isEmpty || needLLM },
  ];
  const cards = modeCards.map((m) => `
    <div class="mode-card ${m.disabled ? "disabled" : ""}" ${m.disabled ? "" : `onclick="${m.onClick}"`}>
      <div class="mc-icon">${m.icon}</div>
      <div class="mc-title">${m.title}</div>
      <div class="mc-desc">${m.desc}</div>
      <div class="mc-tag">${m.tag}</div>
    </div>`).join("");

  const emptyState = isEmpty ? `
    <div class="card empty-hint" style="margin:18px 0;text-align:center;padding:30px">
      <div style="font-size:40px;margin-bottom:10px">📥</div>
      <div style="font-size:21px;font-weight:800;color:var(--accent);font-family:var(--cyber);letter-spacing:1px">SYS:// 题库为空</div>
      <div style="font-size:11.5px;color:var(--text-1);margin:10px auto;max-width:520px;line-height:1.8">系统默认不预置任何考题。<br>导入你的学习资料，出题引擎将自动生成「理论客观题（选择 / 判断 / 填空）· 实战场景题」，并为对应岗位提炼面试参考题。</div>
      <button class="exam-btn primary" style="margin-top:14px" onclick="showImportPanel()">📥 导入资料并自动出题</button>
    </div>` : "";

  const profileCard = profileKeys.length ? `
    <div class="card" style="margin-top:18px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <h3 class="section-title" style="margin:0">🧬 综合能力画像</h3>
        <div style="display:flex;align-items:center;gap:12px">
          <button class="exam-btn ghost" style="padding:6px 12px;font-size:12px" onclick="exportProfile()">📤 导出报告</button>
          <div style="font-size:19px;font-weight:900;font-family:var(--cyber);color:${assess.color}">${assess.icon} ${assess.level}</div>
        </div>
      </div>
      <div style="font-size:12.5px;color:var(--text-2);margin:6px 0 10px">${assess.desc}</div>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="radar-wrap"><canvas id="home-profile-canvas" width="480" height="400"></canvas></div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${profileKeys.slice().sort((a, b) => (profilePct[b] - profilePct[a])).map((ab) => `
            <div>
              <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:3px">
                <span style="color:var(--text-1)">${ab}</span>
                <span style="color:#ff3df0;font-weight:700;font-family:var(--mono)">${profilePct[ab]}%</span>
              </div>
              <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">
                <div style="height:100%;width:${profilePct[ab]}%;background:linear-gradient(90deg,#00e5ff,#ff3df0);border-radius:3px"></div>
              </div>
            </div>`).join("")}
          <div style="font-size:11.5px;color:var(--text-2);margin-top:6px">基于 ${state.exams} 次考核 · ${state.imports} 份导入资料的综合评估</div>
        </div>
      </div>
    </div>` : "";

  render(() => {
    const pc = document.getElementById("home-profile-canvas");
    if (pc) drawRadarProfile(profilePct, "#home-profile-canvas");
  }, `
    <div class="exam-hero" style="margin-bottom:26px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--border)">
        <div style="font-size:12px;color:var(--accent-2);font-family:var(--mono);letter-spacing:1px;display:flex;align-items:center;gap:7px"><span style="color:#ff3df0">&gt;_</span> SYSTEM // AI 岗位能力试炼 · AI Job Skill Gauntlet</div>
        <div style="font-size:11.5px;color:var(--text-2);font-family:var(--mono);display:flex;align-items:center;gap:9px">👤 ${esc(displayName())}<span style="color:var(--border)">|</span>${LLM_KEY ? "🤖 " + esc(LLM_MODEL || "deepseek-chat") : "⚠️ 未配置 LLM"}</div>
      </div>
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px">
        <div style="font-size:36px;line-height:1;flex-shrink:0">📚</div>
        <h1 style="font-size:30px;font-weight:800;margin:0;color:var(--accent);text-shadow:0 0 18px rgba(0,229,255,0.35);letter-spacing:1px;line-height:1.2">${esc(courseTitle)}</h1>
      </div>
      <div style="font-size:13.5px;color:var(--text-1);line-height:1.7;padding-left:52px">你好，${esc(displayName())}。导入资料 → 自动出题 → 三大维度考核 → 综合评估。</div>
    </div>
    ${!LLM_KEY ? `
    <div class="card" style="margin-bottom:20px;padding:13px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;border-color:rgba(255,61,240,0.35);background:linear-gradient(90deg,rgba(255,61,240,0.07),rgba(176,38,255,0.05))">
      <div style="font-size:13px;color:var(--text-1)">💡 <strong style="color:var(--accent-2)">提示</strong>：本系统核心能力（题库组卷、出题、题目打标签、语义判分、岗位匹配）由 LLM 驱动，请先在「⚙️ 设置」中配置 API Key，否则无法开始考核。</div>
      <button class="exam-btn" style="padding:7px 16px;font-size:13px" onclick="showSettings()">⚙️ 去设置</button>
    </div>` : ""}
    ${renderGuideBarHTML()}
    <div style="display:flex;gap:12px;margin-bottom:20px">
      <button class="exam-btn primary" onclick="showImportPanel()">📥 导入资料</button>
      <button class="exam-btn ghost" onclick="showLibrary()">🗂️ 资料目录</button>
      <button class="exam-btn ghost" onclick="showAssessment()">🧬 能力评估</button>
      <button class="exam-btn ghost" onclick="showSettings()">⚙️ 设置</button>
    </div>
    ${emptyState}
    <h3 class="section-title" style="margin:4px 0 14px">🎯 综合考核</h3>
    <div style="margin:0 0 14px;font-size:13.5px;color:var(--text-1);line-height:1.9;background:rgba(0,229,255,0.04);border:1px solid var(--border);border-radius:10px;padding:12px 15px">
      🗂️ 想按单个章节分阶段考核，请进「<strong style="color:var(--accent-2)">资料目录</strong>」选择对应章节。<br>
      💡 聚合全部章节题库，LLM 从题库组卷、检验整体掌握与遗忘；点下方卡片开始。
    </div>
    <div class="mode-grid">${cards}</div>
    ${profileCard}
    <div style="margin-top:20px;display:flex;gap:12px;flex-wrap:wrap">
      <button class="exam-btn ghost" onclick="showBadges()">🏅 成就徽章</button>
      <button class="exam-btn ghost" onclick="showHistory()">📈 学习历史</button>
      <button class="exam-btn ghost" onclick="showInterviewHistory()">💼 面试记录</button>
      <button class="exam-btn ghost" onclick="showWrongBook()">📕 错题本</button>
    </div>`);
  updateGamestat();   // C1：回到首页时刷新顶栏状态
}

function saveLLMSettings() {
  const k = $("#llm-key-input"), b = $("#llm-base-input"), m = $("#llm-model-input");
  if (!k || !b || !m) return;
  setLLMConfig(k.value, b.value, m.value);
  // 保存后重渲染设置页，顶部摘要显示已保存的模型名 + 地址
  showSettings();
  showToast(LLM_KEY ? `🤖 已保存：${LLM_MODEL || "deepseek-chat"}` : "⚠️ 已清除 LLM 配置（需配置后才能考核）");
}

/* ===== 设置 ===== */
function showSettings() {
  render(null, `
    <button class="exam-btn ghost" onclick="goHome()" style="margin-bottom:18px">← 返回</button>
    <h2 class="section-title">⚙️ 设置</h2>

    <div class="card" style="margin-bottom:14px">
      <div style="font-size:14px;font-weight:700;margin-bottom:10px;color:var(--accent)">🤖 LLM 出题引擎（必需）</div>
      <div style="font-size:12.5px;margin-bottom:12px;padding:9px 12px;border-radius:8px;${LLM_KEY ? "background:rgba(47,214,181,0.08);border:1px solid rgba(47,214,181,0.3);color:#2fd6b5" : "background:rgba(255,255,255,0.03);border:1px solid var(--border);color:var(--text-2)"}">
        ${LLM_KEY
          ? `✅ 当前生效：<strong>${esc(LLM_MODEL || "deepseek-chat")}</strong> @ ${esc(LLM_BASE || "https://api.deepseek.com")}`
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
          <input type="text" id="llm-model-input" value="${esc(LLM_MODEL)}" placeholder="模型名 (deepseek-chat)" style="flex:1;padding:10px 14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:9px;color:var(--text-0);font-size:13px;outline:none">
        </div>
        <div style="display:flex;gap:9px">
          <button class="exam-btn primary" onclick="saveLLMSettings()">💾 保存设置</button>
          <button class="exam-btn ghost" onclick="testLLMConnection()">🔌 测试连接</button>
        </div>
        <div style="display:flex;gap:9px;align-items:center;margin-top:2px">
          <button class="exam-btn ghost" onclick="readLocalLLMEnv()">🔍 从本机环境读取 Key</button>
          <span style="font-size:10.5px;color:var(--text-2)">可选：读取本机环境变量（如 DASHSCOPE_API_KEY / DEEPSEEK_API_KEY）自动填入，需手动点「保存」生效。</span>
        </div>
      </div>
      <div style="font-size:10.5px;color:var(--text-2);margin-top:8px;font-family:var(--mono)">Key 仅存于本机 localStorage，LLM 请求由浏览器直发。</div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div style="font-size:14px;font-weight:700;margin-bottom:10px;color:var(--accent)">👤 用户信息</div>
      <div style="font-size:12.5px;color:var(--text-1);line-height:2">
        <div>用户名（昵称）</div>
        <div style="display:flex;gap:9px;margin:4px 0 10px">
          <input type="text" id="nickname-input" value="${esc(NICKNAME)}" placeholder="例如：小明 / 阿强" maxlength="20" style="flex:1;padding:10px 14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:9px;color:var(--text-0);font-size:13px;outline:none">
          <button class="exam-btn primary" onclick="saveNickname()">💾 保存</button>
        </div>
        <div>用户 ID：<span style="font-family:var(--mono);color:var(--accent-2)">${esc(UID)}</span></div>
        <div style="font-size:11.5px;color:var(--text-2)">昵称仅用于界面显示与对话称呼，不影响用户 ID（数据仍按 ID 隔离存储）。</div>
      </div>
    </div>

    <div class="card">
      <div style="font-size:14px;font-weight:700;margin-bottom:10px;color:var(--accent)">🗑️ 数据管理</div>
      <div style="display:flex;gap:9px;flex-wrap:wrap">
        <button class="exam-btn" onclick="clearWrongBook()">清空错题本</button>
        <button class="exam-btn" onclick="resetAllData()" style="color:#ff6b6b;border-color:#ff6b6b">⚠️ 重置全部数据</button>
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
  showToast("🔌 正在测试连接…");
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
    body: JSON.stringify({ model: model || "deepseek-chat", messages: [{ role: "user", content: "hi" }], max_tokens: 5 }),
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
    if (ok) { showToast("✅ 连接成功，API 可用"); return; }
    showToast("❌ 连接失败：" + errMsg.slice(0, 150));
  }).catch((e) => showToast("❌ 网络错误：" + e.message));
}

async function resetAllData() {
  if (!confirm("确定要彻底重置所有数据吗？将清空：考核记录、徽章、错题本、资料目录、课程库、昵称，以及 LLM 配置。此操作不可撤销。")) return;
  // 1. 清空服务器端数据（当前课程、课程库、资料目录、档案、导入存档）
  try {
    await fetch("./api/reset-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: UID }),
    });
  } catch (e) { /* ignore */ }
  // 2. 清空浏览器 localStorage（昵称、LLM 配置、state、uid 缓存；保留 llmGuided，欢迎弹窗严格只出现一次）
  try {
    ["examCenter.uid", "examCenter.nickname", "examCenter.llmKey", "examCenter.llmBase", "examCenter.llmModel", "examCenter.v1"].forEach((k) => localStorage.removeItem(k));
  } catch (e) { /* ignore */ }
  // 3. 重置内存状态（含昵称、课程、LLM）
  state = { nickname: "", xp: 0, level: 1, exams: 0, bestCombo: 0, lastScore: 0, bestInterview: 0, crossExam: false, practicalDone: false, modesDone: [], streak: 0, bestStreak: 0, lastStudyDay: "", abilityBest: {}, abilityProfile: {}, imports: 0, history: [], wrongBook: [], interviewLogs: [], jobExtraQuestions: {}, askedLog: {} };
  NICKNAME = "";
  LLM_KEY = ""; LLM_BASE = ""; LLM_MODEL = "";
  COURSE = null;
  showToast("✅ 已彻底重置，恢复到初始状态");
  // 重新加载，回到全新用户状态（重新获取 uid、加载空数据）
  setTimeout(() => location.reload(), 900);
}

/* ===== 资料导入 ===== */
function showImportPanel() {
  // LLM 是出题主力，未配置则阻止导入（与「LLM 驱动」一致）
  if (!LLM_KEY) {
    showModal({
      icon: "🤖",
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
    <h2 class="section-title">📥 导入资料</h2>
    <div class="card">
      <div class="drop-zone" id="import-drop">
        <div class="dz-icon">📁</div>
        <div class="dz-title">拖拽文件或文件夹到这里</div>
        <div class="dz-sub">系统自动识别笔记、代码、数据等文件并出题</div>
        <div style="display:flex;gap:12px;justify-content:center;margin-top:16px;flex-wrap:wrap">
          <button class="exam-btn primary" onclick="document.getElementById('import-folder').click()">📁 导入文件夹</button>
          <button class="exam-btn" onclick="document.getElementById('import-file').click()">📄 导入文件</button>
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
  // 导入诊断：失败详情上报服务端落盘（~/.exam-center/users/{uid}/import-debug.log），供排查
  try {
    await fetch("/api/import-debug", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: UID || "", tag, payload }),
    }).catch(() => {});
  } catch (e) {}
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

async function llmJSON(opts) {
  // opts: { system, prompt, formatHint, minCount, maxRetries, part, maxTokens, expect }
  // expect: "questions"（默认）返回题目数组（归一化+校验）；"object" 返回任意解析成功的 JSON 对象（面试出题/追问/评分）
  // 两者都带校验失败反馈重出（Agently custom() 机制）
  if (!LLM_KEY) return [];
  const base = String(LLM_BASE || "https://api.deepseek.com").replace(/\/+$/, "");
  const model = LLM_MODEL || "deepseek-chat";
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
        if (attempt >= 2) {
          lastErr = new Error("LLM 返回空内容（服务可能限流），已重试 " + attempt + " 次");
          reportDebug("llm-fail", { part, msg: lastErr.message });
          throw lastErr;
        }
        await new Promise((r) => setTimeout(r, 1500));
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
      if (attempt >= 2) {
        lastErr = new Error("LLM 返回空内容（服务可能限流），已重试 " + attempt + " 次");
        reportDebug("llm-fail", { part, msg: lastErr.message });
        throw lastErr;
      }
      await new Promise((r) => setTimeout(r, 1500));
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
async function browserLLMGenerate(course, part) {
  // part: "theory" 只生成理论 16 道 | "practical" 只生成实战 10 道 | 缺省全量（26 道，兼容旧调用）
  if (!LLM_KEY) return [];
  const base = (LLM_BASE || "https://api.deepseek.com").replace(/\/+$/, "");
  const model = LLM_MODEL || "deepseek-chat";

  // 课程素材摘要（用于生成题目）
  const concepts = (course.concepts || []).slice(0, 10)
    .map((c) => `- ${c.name}: ${(c.summary || "").slice(0, 80)}`).join("\n") || "（无概念表）";
  const chapters = (course.chapters || []).slice(0, 12)
    .map((ch) => `- 第${ch.index}章 ${ch.title}: ${(ch.summary || "").slice(0, 60)}`).join("\n") || "（无章节）";
  const difficulties = (course.difficulties || []).slice(0, 5)
    .map((d) => `- ${d.title}`).join("\n") || "（无难点）";
  // 代码文件内容（出题素材：按文件名排序，利于 LLM 识别递进/对比关系，基于真实代码出实战题）
  const codeFiles = (course.materials || [])
    .filter((m) => m.type === "code" || (m.file && /\.(py|ipynb|js|ts|java)$/i.test(m.file)))
    .sort((a, b) => (a.file || a.path || "").localeCompare(b.file || b.path || ""))
    .slice(0, 8)
    .map((m, i) => `[文件${i + 1}] ${m.file || m.path}（${m.lines || "?"} 行）\n${(m.preview || "").slice(0, 400)}`).join("\n\n");

  // 有代码文件才要求实战题：纯笔记目录（无代码素材）跳过实战硬校验，避免「无代码却要代码题」结构性必败
  const hasCode = codeFiles.trim().length > 0;

  // 分设 token：理论轮纯文字 4500 足够，实战轮带真实代码 7000（避免统一偏大浪费或偏小截断）
  const maxTokens = part === "theory" ? 4500 : part === "practical" ? 7000 : 10000;
  const system = SYSTEM.examiner;
  const prompt = part === "theory"
    ? buildImportTheoryPrompt((course.title || "").slice(0, 50), concepts, chapters, difficulties, flaggedQuestionTxt())
    : part === "practical"
    ? buildImportPracticalPrompt((course.title || "").slice(0, 50), concepts, chapters, difficulties, codeFiles, flaggedQuestionTxt())
    : buildImportPrompt((course.title || "").slice(0, 50), concepts, chapters, difficulties, codeFiles, flaggedQuestionTxt());

  // 实战硬校验仅在有代码文件时生效（纯笔记目录实战轮可返回空，不阻塞导入）
  // 最低可用量门槛（宁缺毋滥）：单批 ≥8/5 即收，理想量 16/10 由导入主流程累积补足
  const minCount = part === "theory" ? 8 : part === "practical" ? (hasCode ? 5 : 0) : (hasCode ? 13 : 8);
  const qs = await llmJSON({
    system: SYSTEM.examiner,
    prompt,
    formatHint: JSON_FORMAT_HINT,
    minCount,
    part,
  });
  return qs;
}

/* 从导入资料提炼「岗位通用面试题」：LLM 判断资料最贴近的岗位 + 生成 3 道场景面试题（扩充面试参考弹药） */
async function generateJobQuestions(course) {
  if (!LLM_KEY) return null;
  try {
    const base = (LLM_BASE || "https://api.deepseek.com").replace(/\/+$/, "");
    const model = LLM_MODEL || "deepseek-chat";
    const jobNames = (JOB_KNOWLEDGE || []).map((j) => j.name);
    if (!jobNames.length) return null;
    const prompt = buildJobQuestionPrompt(course, jobNames);
    const res = await fetch(base + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + LLM_KEY },
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 800, response_format: { type: "json_object" } }),
    });
    if (!res.ok) return null;
    const content = (await res.json()).choices[0].message.content;
    const parsed = JSON.parse(content);
    if (parsed && parsed.jobName && Array.isArray(parsed.questions) && parsed.questions.length) {
      return { jobName: parsed.jobName, questions: parsed.questions };
    }
    return null;
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

async function llmExamQuestions(courses, mode, count = 4) {
  if (!LLM_KEY) return [];
  const base = (LLM_BASE || "https://api.deepseek.com").replace(/\/+$/, "");
  const model = LLM_MODEL || "deepseek-chat";

  // 汇总所有目录的素材
  const concepts = [];
  const chapters = [];
  const codeFiles = [];
  for (const c of courses) {
    for (const cc of (c.concepts || [])) concepts.push(`${c.title}·${cc.name}: ${(cc.summary || "").slice(0, 60)}`);
    for (const ch of (c.chapters || [])) chapters.push(`${c.title}·第${ch.index}章 ${ch.title}: ${(ch.summary || "").slice(0, 40)}`);
    for (const m of (c.materials || [])) {
      if (m.type === "code" || (m.file && /\.(py|ipynb|js|ts|java)$/i.test(m.file))) {
        codeFiles.push(`【${m.file || m.path}】\n${(m.preview || "").slice(0, 150)}`);
      }
    }
  }
  const conceptTxt = concepts.slice(0, 12).join("\n") || "（无概念表）";
  const chapterTxt = chapters.slice(0, 12).join("\n") || "（无章节）";
  const codeTxt = codeFiles.slice(0, 6).join("\n") || "";

  const prompt = buildExamPrompt(conceptTxt, chapterTxt, mode, count, ABILITIES.join("、"), codeTxt, flaggedQuestionTxt());

  const res = await fetch(base + "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + LLM_KEY },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: SYSTEM.examiner }, { role: "user", content: prompt }],
      temperature: 0.8, max_tokens: 3000, response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    if (res.status === 400) {
      const res2 = await fetch(base + "/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + LLM_KEY },
        body: JSON.stringify({ model, messages: [{ role: "system", content: SYSTEM.examiner }, { role: "user", content: prompt }], temperature: 0.8, max_tokens: 3000 }),
      });
      if (res2.ok) return extractLLMQuestions(await res2.json());
    }
    return [];
  }
  const qs = extractLLMQuestions(await res.json());
  // 补全字段（含 correctIndex 归一化 + ability 白名单），维度强制为考核模式
  for (const q of qs) {
    normalizeLLMQuestion(q);
    q.dimension = mode;
    q.dynamic = true;
    q.source = "🤖 LLM 动态";
  }
  return qs;
}

/* 核心：批量导入多份 .md */
async function handleImportFileList(mdFiles) {
  if (!mdFiles.length) return;
  // 兜底：未配置 LLM 不导入（showImportPanel 已拦截，这里防拖拽等入口绕过）
  if (!LLM_KEY) {
    showModal({
      icon: "🤖",
      title: "导入资料需要 LLM",
      text: "导入时由 LLM 出题，请先配置 API Key（支持 DeepSeek、阿里百炼等 OpenAI 兼容接口）。",
      actions: [
        { label: "⚙️ 去设置", primary: true, onClick: () => showSettings() },
        { label: "先不了", onClick: () => {} },
      ],
    });
    return;
  }
  const status = $("#import-status");
  status.className = "parse-status loading";
  setImportProgress(3, "🚀", "准备导入", `${mdFiles.length} 份资料`);

  try {
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
      setImportProgress(10, "🤖", "LLM 正在生成题目", "理论 + 实战并行 · 浏览器直连 · Key 不出浏览器");
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
        // 并行两次请求：理论 16 道 + 实战 10 道（同步开始、全部结束后进入下一环节；重复由 seenTxt 去重兜底）
        // 注：「题库 = 考核 × 2 考两次不重复」仅对章节考核成立（8×2=16）；综合考核单目录 16 道会被抽满，需导入 ≥2 个目录聚合才够 2 次量
        // ⑥ 修复：LLM 题 id 用时间戳派生的全局近似唯一起点（LLM 题本无 id，existingIds 去重是死逻辑，已删除）
        // 纯笔记目录（无代码素材）：实战题无代码可引用，跳过实战硬校验（理论题仍必须生成）
        const hasCode = (data.course.materials || []).some((m) => m.type === "code" || (m.file && /\.(py|ipynb|js|ts|java)$/i.test(m.file)));
        // 纯笔记目录不发实战请求（无代码素材，发了也白发还浪费请求；宁缺毋滥）
        const genParts = [
          { key: "theory", label: "生成理论题 ing..", icon: "📘" },
          ...(hasCode ? [{ key: "practical", label: "生成实战题 ing..", icon: "🛠️" }] : []),
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
          genParts.map((gp) => browserLLMGenerate(data.course, gp.key))
        );
        // 只有请求被拒绝（LLM 真不可用 / 空响应重试耗尽）才整体失败；空数组交给下面的累积补足（宁缺毋滥：不差几道就全丢）
        const hardFail = results.findIndex((r) => r.status === "rejected");
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
        const countLlmCode = () => (data.course.quiz || []).filter((q) => q.type === "practical" && (q.practical || {}).compareMode === "llm_code").length;
        // 理论累积补足（目标 16；单批给 ≥8 即收，不足由这里补）
        let thRetries = 0;
        while (thRetries < 3 && countTheory() < 16) {
          thRetries++;
          const stElT = partsBox ? partsBox.querySelector(`.imp-part[data-part="theory"] .imp-part-state`) : null;
          if (stElT) stElT.textContent = "⏳ 补足理论（" + thRetries + "/3）…";
          let extra = null;
          try { extra = await browserLLMGenerate(data.course, "theory"); } catch (e) { await new Promise((r) => setTimeout(r, 800)); continue; }
          if (!extra || !extra.length) break;
          if (!hangQ(extra)) break;
        }
        // 实战累积补足（目标 10，有代码文件才补）
        let pracRetries = 0;
        while (hasCode && pracRetries < 3 && countPrac() < 10) {
          pracRetries++;
          const stElP = partsBox ? partsBox.querySelector(`.imp-part[data-part="practical"] .imp-part-state`) : null;
          if (stElP) stElP.textContent = "⏳ 补足实战（" + pracRetries + "/3）…";
          let extra = null;
          try { extra = await browserLLMGenerate(data.course, "practical"); } catch (e) { await new Promise((r) => setTimeout(r, 800)); continue; }
          if (!extra || !extra.length) break;
          if (!hangQ(extra)) break;
        }
        // 最低可用量校验：理论 <8 或（有代码时）实战 <5 才失败——保留目录不删，可补出题
        if (countTheory() < 8 || (hasCode && countPrac() < 5)) {
          clearInterval(pTimer);
          const err = new Error("题目生成不足（理论 " + countTheory() + "/8 · 实战 " + countPrac() + "/5），目录已保留，可重新导入或点「🤖 补出题」");
          throw err;
        }
        const stElP2 = partsBox ? partsBox.querySelector(`.imp-part[data-part="practical"] .imp-part-state`) : null;
        const lblP = partsBox ? partsBox.querySelector(`.imp-part[data-part="practical"] .imp-part-label`) : null;
        if (lblP) lblP.textContent = "完成 " + countPrac() + " 道（含写代码 " + countLlmCode() + " 道）";
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
        reportDebug("import-fail", { msg: String((e && e.message) || e) });
        // 失败不再自动删除目录：保留后端已解析的资料与文件清单，用户可重试、补出题或手动删除
        const msg = String((e && e.message) || e);
        const reason = /failed to fetch|fetch failed|network|net::/i.test(msg)
          ? "无法连接 API 服务（网络错误）"
          : msg;
        status.className = "parse-status err";
        status.innerHTML = `⚠️ 导入失败，原因是：${esc(reason)}。目录已保留（未删除），可重新导入或点「🤖 补出题」修复。`;
        return;   // 阻止后续成功流程（COURSE 赋值 / 发 XP / status=ok 覆盖失败文案）
      }
    }

    // 更新当前课程 + 目录列表
    if (data.course) COURSE = data.course;

    // 奖励：XP + 记录（按实际导入的文件数）
    const fileCount = data.fileCount || 0;
    const totalQ = data.totalQuestions || 0;
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
      const q = data.dir.course?.quiz || [];
      const theoryN = q.filter((x) => (x.dimension || inferDimension(x)) === "theory").length;
      const pracN = q.filter((x) => (x.dimension || inferDimension(x)) === "practical").length;
      status.innerHTML = `
        ✅ 已创建章节目录「<strong style="color:var(--accent)">${esc(data.dir.title)}</strong>」<br>
        📚 生成 <strong style="color:var(--accent)">${totalQ}</strong> 题（理论 ${theoryN} · 实战 ${pracN}）· ${fileCount} 个文件<br>
        ${dupCount ? `⚠️ 有 ${dupCount} 个文件重复，已跳过` : ""}
        ${dupRows}
        ⭐ 获得 ${gain} XP 奖励（累计导入 ${state.imports} 份资料）`;
    } else {
      status.innerHTML = `
        ⚠️ 未创建新目录：${dupCount ? `有 ${dupCount} 个文件重复，已跳过` : "没有可导入的有效资料"}<br>
        ${dupRows}`;
    }
    showToast(data.dir ? `📥 已导入「${data.dir.title}」 · +${gain} XP` : "⚠️ 资料重复，已跳过");
    status.insertAdjacentHTML("beforeend", `<div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap"><button class="exam-btn primary" onclick="showLibrary()">🗂️ 查看资料目录</button><button class="exam-btn ghost" onclick="showImportPanel()">📥 继续导入资料</button></div>`);
    // 导入成功后自动进入目录列表，优先查看刚导入的资料（而非停留在导入界面）
    if (data.dir) setTimeout(() => showLibrary(), 3500);
  } catch (e) {
    status.className = "parse-status err";
    status.textContent = `❌ ${e.message}`;
  }
}

/* ===== LLM 仿真面试 ===== */
let interviewState = null;   // { job, qIndex, questions, history, started }
let interviewBusyCount = 0;  // 面试竞态守卫：>0 表示面试官正在处理（LLM 请求中），挡住连点发送
let interviewCourses = [];   // 面试聚合的目录课程（切目录模型）

async function startInterview() {
  // 面试考核强制要求 LLM
  if (!LLM_KEY) {
    showModal({
      icon: "🤖",
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
    <h2 class="section-title">💼 选择面试岗位</h2>
    <div style="font-size:12.5px;color:var(--text-2);margin-bottom:16px;line-height:1.8">选择你要面试的岗位，AI 面试官将加载该岗位的知识库（职责 · 核心技能 · 考察维度 · 知识图谱要点 · 追问方向），围绕岗位做多维度严格面试。</div>
    <div class="job-grid">
      ${jobsHtml}
    </div>`);
}

function startJobInterview(jobId) {
  // 防御性检查：面试强制要求 LLM（与 startInterview 一致，防未来新增入口绕过）
  if (!LLM_KEY) {
    showModal({
      icon: "🤖",
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
  const conceptTxt = sample(concepts, 30)
    .map((c) => `- ${c.name}：${(c.summary || "").slice(0, 60)}`).join("\n") || "（无概念表）";
  const chapterTxt = sample(chapters, 24)
    .map((ch) => `- 第${ch.index}章 ${ch.title}：${(ch.summary || "").slice(0, 50)}`).join("\n") || "（无章节）";
  const diffTxt = sample(difficulties, 16)
    .map((d) => `- ${d.title}：${(d.detail || "").slice(0, 60)}`).join("\n") || "（无难点）";
  const quizByDim = {};
  for (const q of quiz) {
    const d = q.dimension || inferDimension(q);
    (quizByDim[d] = quizByDim[d] || []).push(q);
  }
  const quizTxt = Object.entries(quizByDim).map(([d, qs]) =>
    `【${d}】${sample(qs, 10, 4).map((q) => q.question.replace(/【[^】]*】/g, "").slice(0, 50)).join("；")}`
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
      setTimeout(() => renderInterviewIntro(), 520);
    }
  };
  step();
}

function renderInterviewIntro() {
  const st = interviewState;
  render(null, `
    <button class="exam-btn ghost" onclick="goHome()" style="margin-bottom:18px">← 退出面试</button>
    <div class="card" style="text-align:center;padding:36px 28px">
      <div style="font-size:40px;margin-bottom:12px">🤖</div>
      <h2 style="font-size:20px;font-weight:800;color:var(--accent);margin-bottom:8px">${esc(st.job.name)} · 仿真面试</h2>
      <div style="font-size:13px;color:var(--text-1);line-height:1.8;margin-bottom:6px">面试官将围绕以下维度严格考察：</div>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:18px">
        ${st.dims.map((d) => `<span style="font-size:12px;padding:4px 12px;border-radius:20px;background:rgba(0,229,255,0.1);border:1px solid rgba(0,229,255,0.3);color:#00e5ff">${esc(d)}</span>`).join("")}
      </div>
      <div style="font-size:12.5px;color:var(--text-2);margin-bottom:20px">约 ${st.maxRounds} 轮提问 · 面试官会结合岗位要求、你的资料与生产环境实际动态出题，题型多样 · 请认真作答</div>
      <button class="exam-btn primary" style="font-size:16px;padding:12px 32px" onclick="renderInterviewChat()">🚀 进入面试间</button>
    </div>`);
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
        <div class="iv-avatar">🤖</div>
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
    const avatar = isMe ? "👤" : "🤖";
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
    const avatar = isMe ? "👤" : "🤖";
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
    ? `<div class="iv-msg iv-typing"><div class="iv-bubble-avatar">🤖</div><div class="dots"><span></span><span></span><span></span></div></div>`
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
          validateObj: (o) => (o && o.question ? null : "缺少 question 字段"),
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
    <div class="iv-bubble-avatar">🤖</div>
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
  const ci = Array.isArray(st.current.correctIndex) ? st.current.correctIndex[0] : st.current.correctIndex;
  if (typeof ci === "number" && st.current.options && st.current.options.length) {
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
    });
    renderInterviewResult(scoreResult);
  } catch (e) {
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
    qa: st.history.map((h) => ({ q: h.question, a: h.answer, weak: !!h.weak })),
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
  // 理论/实战考核都需要 LLM（出题 + 打标签 + 判分）
  if (!LLM_KEY) {
    const modeName = mode === "theory" ? "理论" : "实战";
    showModal({
      icon: "🤖",
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
  const seq = ++examSeq;   // A1：竞态守卫，旧请求返回不覆盖新试卷
  const loading = showExamLoading(mode);
  loadAllDirCourses().then(async (courses) => {
    if (seq !== examSeq) return;   // 已被新考核取代
    loading.log(`聚合目录题库 → ${courses.length} 个目录`);
    loading.setStatus("聚合章节题目");
    loading.setProgress(35);
    let filtered = [];
    for (const c of courses) {
      const quiz = c.quiz || [];
      for (const q of quiz) {
        if (mode === "theory") {
          if ((q.dimension || inferDimension(q)) === "theory" && ["choice", "multi_choice", "true_false", "fill_blank"].includes(q.type)) {
            filtered.push({ ...q, source: c.dirTitle });
          }
        } else if (mode === "practical") {
          if ((q.dimension || inferDimension(q)) === "practical") filtered.push({ ...q, source: c.dirTitle });
        }
      }
    }
    // LLM 从全题库动态挑选组卷（不经过 adaptivePick 前置砍池；失败回退程序抽题）
    loading.log("LLM 从全题库动态挑选组卷");
    loading.setStatus("LLM 正在从题库组卷");
    const stopP1 = loading.autoProgress(60, 74);
    const llmPicked = await llmPickQuestions(filtered, mode, mode === "theory" ? 16 : 10, "cross");
    stopP1();
    loading.setProgress(75);
    filtered = (llmPicked && llmPicked.length) ? llmPicked : adaptivePick(filtered, mode === "theory" ? 16 : 10);
    loading.log("题库组卷 → " + filtered.length + " 题（LLM 挑选 / 程序兜底 · 回顾题稍后注入）");
    if (!filtered.length) {
      showToast("⚠️ 暂无题目，请先导入资料");
      goHome();
      return;
    }
    // 题库不足时，LLM 动态生成补足缺口（不替换 LLM 已挑的题，避免稀释组卷质量）
    if (LLM_KEY && filtered.length < (mode === "theory" ? 16 : 10)) {
      const need = (mode === "theory" ? 16 : 10) - filtered.length;
      loading.log("题库不足 → LLM 动态生成 " + need + " 道补足");
      loading.setStatus("LLM 动态补充缺题");
      const stopP2 = loading.autoProgress(75, 94);
      try {
        const dyn = await llmExamQuestions(courses, mode, need);
        if (seq !== examSeq) return;
        if (dyn && dyn.length) filtered = filtered.concat(dyn).slice(0, mode === "theory" ? 16 : 10);
      } catch (e) { /* 忽略 */ } finally {
        stopP2();
        loading.setProgress(95);
      }
    } else {
      loading.setProgress(95);
    }
    // D1：回顾题（第 2 次及以后从历史错题/考过题抽 2-3 道，按模式过滤题型）
    loading.log("注入回顾题（错题间隔重考）");
    filtered = injectReviewQuestions(filtered, mode);
    // 最终防御：按考核模式过滤题型（LLM 动态题/回顾题可能混入其他题型）
    filtered = filtered.filter((q) => mode === "theory"
      ? ["choice", "multi_choice", "true_false", "fill_blank"].includes(q.type)
      : q.type === "practical");
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
  const sourceLabel = q.dynamic ? "🤖 LLM 动态" : (q.source && q.source !== "current" ? "📚 " + q.source : "📚 题库");

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
      ${q.dynamic ? '<span class="exam-q-type" style="background:rgba(255,61,240,0.12);color:#ff3df0">🤖 LLM 动态</span>' : ""}
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
  const model = LLM_MODEL || "deepseek-chat";
  const prompt = buildCodeGradePrompt(q, p, userAns);
  box.innerHTML = `<div style="font-size:13.5px;color:var(--accent)">🤖 LLM 正在判分…</div>`;
  try {
    const res = await fetch(base + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + LLM_KEY },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: SYSTEM.codeGrader }, { role: "user", content: prompt }],
        temperature: 0.2, max_tokens: 500, response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    finishCodeGrade(await res.json(), box, q);
  } catch (e) {
    box.innerHTML = `<div style="font-size:12.5px;color:var(--warn)">⚠️ LLM 判分失败（${e.message}）。<br><div style="margin-top:6px;color:var(--text-1)">参考答案：<br><pre style="white-space:pre-wrap;font-family:var(--mono);font-size:12px;background:rgba(0,0,0,0.3);padding:10px;border-radius:8px">${esc((p.referenceAnswer || q.answer || "").slice(0, 600))}</pre></div></div>`;
  }
}

function finishCodeGrade(data, box, q) {
  const content = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : "";
  let parsed = null;
  try { parsed = JSON.parse(content); } catch (e) {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) { try { parsed = JSON.parse(m[0]); } catch (e2) {} }
  }
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
      <div style="font-size:14px;font-weight:800;color:${ok ? "#2fd6b5" : "#ff6b6b"}">🤖 LLM 评分：${score} 分 ${ok ? "✅ 通过" : "❌ 未通过"}</div>
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
  box.innerHTML = `<div style="font-size:13.5px;color:var(--accent)">🤖 LLM 正在判定…</div>`;
  const base = (LLM_BASE || "https://api.deepseek.com").replace(/\/+$/, "");
  const model = LLM_MODEL || "deepseek-chat";
  const prompt = buildReadingGradePrompt(q, userAns);
  try {
    const res = await fetch(base + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + LLM_KEY },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: SYSTEM.readingGrader }, { role: "user", content: prompt }],
        temperature: 0.2, max_tokens: 400, response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    finishLLMGrade(await res.json(), box);
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
  if (fbSb) { fbSb.disabled = true; fbSb.textContent = "🤖 判分中…"; }
  llmGradeFillBlank(q, userAns);
}

async function llmGradeFillBlank(q, userAns) {
  const box = $("#fill-grade-box");
  if (!box) return;
  box.innerHTML = `<div style="font-size:13.5px;color:var(--accent)">🤖 LLM 正在判定…</div>`;
  const base = (LLM_BASE || "https://api.deepseek.com").replace(/\/+$/, "");
  const model = LLM_MODEL || "deepseek-chat";
  const accepted = (q.fillAnswers || [q.correctAnswer]).join(" / ");
  const prompt = buildFillBlankPrompt(q, userAns, accepted);
  try {
    const res = await fetch(base + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + LLM_KEY },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: SYSTEM.fillJudge }, { role: "user", content: prompt }],
        temperature: 0, max_tokens: 200, response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    finishFillBlankGrade(await res.json(), box, q, userAns);
  } catch (e) {
    // 失败降级为模糊匹配
    const judged = judgeAnswer(q, userAns);
    box.innerHTML = `<div style="font-size:12.5px;color:var(--warn)">⚠️ LLM 判定失败，已用模糊匹配兜底。</div>`;
    applyFillBlankResult(q, userAns, judged);
  }
}

function finishFillBlankGrade(data, box, q, userAns) {
  const content = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : "";
  let parsed = null;
  try { parsed = JSON.parse(content); } catch (e) {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) { try { parsed = JSON.parse(m[0]); } catch (e2) {} }
  }
  const correct = !!(parsed && parsed.correct);
  const reason = (parsed && parsed.reason) || "";
  const accepted = (q.fillAnswers || [q.correctAnswer]).join(" / ");
  box.innerHTML = `<div style="padding:12px 14px;border-radius:10px;background:${correct ? "rgba(47,214,181,0.08)" : "rgba(255,107,107,0.08)"};border:1px solid ${correct ? "rgba(47,214,181,0.35)" : "rgba(255,107,107,0.35)"}">
    <div style="font-size:14px;font-weight:800;color:${correct ? "#2fd6b5" : "#ff6b6b"}">🤖 LLM 判定：${correct ? "✅ 正确" : "❌ 错误"}</div>
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
      ${LLM_KEY ? `<button class="exam-btn primary" style="padding:8px 18px;font-size:15px" onclick="llmGradeEssay()">🤖 LLM 自动批改</button>` : ""}
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
  box.innerHTML = `<div style="font-size:13.5px;color:var(--accent)">🤖 LLM 正在批改…</div>`;
  const base = (LLM_BASE || "https://api.deepseek.com").replace(/\/+$/, "");
  const model = LLM_MODEL || "deepseek-chat";
  const prompt = buildEssayGradePrompt(q, userAns);
  try {
    const res = await fetch(base + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + LLM_KEY },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: SYSTEM.essayGrader }, { role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 400,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      // 中转站可能不支持 response_format，重试一次
      if (res.status === 400) {
        const res2 = await fetch(base + "/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + LLM_KEY },
          body: JSON.stringify({ model, messages: [{ role: "system", content: SYSTEM.essayGrader }, { role: "user", content: prompt }], temperature: 0.2, max_tokens: 400 }),
        });
        if (res2.ok) return finishLLMGrade(await res2.json(), box);
      }
      throw new Error(`API ${res.status}`);
    }
    finishLLMGrade(await res.json(), box);
  } catch (e) {
    box.innerHTML = `<div style="font-size:12.5px;color:var(--warn)">⚠️ LLM 批改失败（${e.message}），可改用下方自评。</div>`;
  }
}

function finishLLMGrade(data, box) {
  const content = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : "";
  let parsed = null;
  try { parsed = JSON.parse(content); } catch (e) {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) { try { parsed = JSON.parse(m[0]); } catch (e2) {} }
  }
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
        <span style="font-size:14px;font-weight:800;color:${ok ? "#2fd6b5" : "#ff6b6b"}">🤖 LLM 评分：${score} 分 ${ok ? "✅ 通过" : "❌ 未通过"}</span>
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
  state.history.push({ date: new Date().toISOString(), mode: examMode, score: correctCount, total: totalQ, pct, abilities: abilityPct, cross: isCrossExam });   // cross: 章节考核(false) / 综合考核(true)，供引导条判定
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
      <div style="font-size:11.5px;color:var(--text-2);margin-top:4px">正确 ${correctCount}/${totalQ} · ${pct}%</div>
      <div class="exam-stars">${stars}</div>
      <div class="exam-grade" style="color:${pct >= 70 ? "#00e5ff" : pct >= 50 ? "#ffb84d" : "#ff6b6b"}">${grade}</div>
      <div class="exam-combo-stat">🔥 最高连击 ${state.bestCombo} · ⚡ 本场得分 ${rightCount}/${totalQ} · 📅 连续学习 ${state.streak} 天</div>
      <div style="margin-top:8px;font-size:13.5px;color:var(--text-1)">${title.icon} ${title.title} · 成就点 <strong style="color:var(--warn)">${ap}</strong></div>
      ${newBadgeHtml}
    </div>

    <div class="card" style="margin-top:14px">
      <h3 class="section-title" style="margin-top:0">🧬 综合能力画像</h3>
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
        <h3 class="section-title" style="margin-top:0">📈 增长点</h3>
        ${growth.up.length ? `<div style="font-size:12.5px;color:#00e5ff;line-height:2">${growth.up.map((u) => "✅ " + u).join("<br>")}</div>` : "<div style='font-size:13.5px;color:var(--text-2)'>本次暂无明显增长点，继续加油！</div>"}
        <h3 class="section-title" style="margin-top:18px">🔻 缺失点（需加强）</h3>
        ${growth.down.length ? `<div style="font-size:12.5px;color:#ff6b6b;line-height:2">${growth.down.map((d) => "❌ " + d).join("<br>")}</div>` : "<div style='font-size:13.5px;color:var(--text-2)'>本次无重大缺失，保持！</div>"}
      </div>

      <div class="card" style="margin-top:0">
        <h3 class="section-title" style="margin-top:0">💼 岗位匹配建议</h3>
        <div style="display:flex;flex-direction:column;gap:10px">${jobs}</div>
      </div>
    </div>

    ${wrongList ? `<div class="exam-review-list"><h3 class="section-title">📕 错题回顾</h3>${wrongList}</div>` : ""}

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
  const profilePct = abilityProfilePct();
  const profileKeys = Object.keys(profilePct);
  const assess = baseLevelAssessment();
  const jobs = matchJobs(profilePct);
  const growth = analyzeGrowth(profilePct);

  // 成长路径（基础段线性 + 专家分支平级 + 全栈汇聚 + 大师顶点）
  const t = currentTitle();
  const unlocked = BADGES.filter((b) => b.check(state)).length;
  const ap = calcAP(state);
  const avg = profileAvgScore();
  const curIdx = currentLevelIndex();

  // 专家方向精通情况
  const expertReached = EXPERT_TRACKS.filter((tr) => (profilePct[tr.ability] || 0) >= tr.threshold);

  const rankRow = (r) => {
    const reached = r.reached;
    return `
    <div style="display:flex;align-items:center;gap:12px;padding:9px 14px;border-radius:10px;margin-bottom:6px;
      background:${reached ? "rgba(255,184,77,0.08)" : "rgba(255,255,255,0.02)"};
      border:1px solid ${reached ? "rgba(255,184,77,0.35)" : "var(--border)"}">
      <span style="font-size:20px">${r.icon}</span>
      <div style="flex:1">
        <div style="font-weight:700;font-size:13.5px;color:${reached ? "#fff3cc" : "var(--text-1)"}">Lv.${r.rankNo} ${r.title} <span style="font-size:10.5px;color:var(--text-2);font-family:var(--mono)">（${r.desc}）</span></div>
        ${r.tracks ? r.tracks.map((tr) => `
          <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-top:3px;color:${tr.reached ? "#2fd6b5" : "var(--text-2)"}">
            <span>${tr.icon} ${tr.title}</span><span style="font-family:var(--mono)">${tr.val}%</span>
          </div>`).join("") : ""}
      </div>
      <span style="font-size:11.5px;color:${reached ? "#00e5ff" : "var(--text-2)"}">${reached ? "✅ 已达成" : "🔒"}</span>
    </div>`;
  };

  const ranks = [
    { rankNo: 8, title: GRAND_MASTER_TITLE.title, icon: GRAND_MASTER_TITLE.icon, desc: "画像 ≥98%", reached: avg >= 98 },
    { rankNo: 7, title: FULL_STACK_TITLE.title, icon: FULL_STACK_TITLE.icon, desc: "三个专家方向均 ≥75%", reached: expertReached.length >= EXPERT_TRACKS.length },
    { rankNo: 6, title: "专家方向", icon: "🔀", desc: "三选一 · 达到即解锁", reached: expertReached.length >= 1, tracks: EXPERT_TRACKS.map((tr) => ({ icon: tr.icon, title: tr.title, val: Math.round(profilePct[tr.ability] || 0), reached: (profilePct[tr.ability] || 0) >= tr.threshold })) },
    ...LEVEL_TITLES.slice().reverse().map((lt, i) => ({ rankNo: LEVEL_TITLES.length - i, title: lt.title, icon: lt.icon, desc: `画像 ≥${lt.score}%`, reached: avg >= lt.score })),
  ];
  const ladder = ranks.map(rankRow).join("");

  // 维度进度条（无数据时返回空串，空态在外层统一渲染）
  const bars = profileKeys.length
    ? profileKeys.slice().sort((a, b) => (profilePct[b] - profilePct[a])).map((ab) => `
      <div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:3px">
          <span style="color:var(--text-1)">${ab}</span>
          <span style="color:#ff3df0;font-weight:700;font-family:var(--mono)">${profilePct[ab]}%</span>
        </div>
        <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${profilePct[ab]}%;background:linear-gradient(90deg,#00e5ff,#ff3df0);border-radius:3px"></div>
        </div>
      </div>`).join("")
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
    if (pc && profileKeys.length) drawRadarProfile(profilePct, "#assess-canvas");
  }, `
    <button class="exam-btn ghost" onclick="goHome()" style="margin-bottom:18px">← 返回</button>
    <h2 class="section-title">🧬 个人能力评估</h2>

    <!-- 概览：基础水平 + 关键数据 -->
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="font-size:40px;filter:drop-shadow(0 0 12px ${assess.color})">${assess.icon}</div>
          <div>
            <div style="font-size:20px;font-weight:800;color:${assess.color};font-family:var(--cyber);letter-spacing:1px">${assess.level}</div>
            <div style="font-size:12.5px;color:var(--text-2);margin-top:3px">${assess.desc}</div>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
        ${statItems.map((s) => `
          <div style="flex:1;min-width:90px;text-align:center;padding:12px 8px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px">
            <div style="font-size:20px;font-weight:800;color:#00e5ff;font-family:var(--cyber)">${s.val}</div>
            <div style="font-size:11px;color:var(--text-2);margin-top:3px;font-family:var(--mono)">${s.label}</div>
          </div>`).join("")}
      </div>
    </div>

    <!-- 能力画像：雷达 + 进度条 -->
    <div class="card" style="margin-bottom:16px">
      <h3 class="section-title" style="margin:0 0 14px">🧠 能力画像（十维）</h3>
      ${profileKeys.length ? `
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="radar-wrap"><canvas id="assess-canvas" width="480" height="400"></canvas></div>
        <div style="display:flex;flex-direction:column;gap:8px">${bars}</div>
      </div>` : profileEmpty}
    </div>

    <!-- 岗位匹配 -->
    <div class="card" style="margin-bottom:16px">
      <h3 class="section-title" style="margin:0 0 14px">💼 岗位匹配度</h3>
      ${jobs}
    </div>

    <!-- 增长分析 -->
    <div class="card" style="margin-bottom:16px">
      <h3 class="section-title" style="margin:0 0 14px">📊 增长与短板分析</h3>
      ${growthHtml}
    </div>

    <!-- 成长路径（等级阶梯） -->
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <h3 class="section-title" style="margin:0">🚀 成长路径</h3>
        <div style="font-size:12px;color:var(--text-2);font-family:var(--mono)">当前：${t.icon} ${t.title} · 综合画像 ${avg}%</div>
      </div>
      ${ladder}
      <div style="margin-top:12px"><button class="exam-btn ghost" onclick="showBadges()">🏅 查看成就徽章</button></div>
    </div>`);
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
      <h2 class="section-title" style="margin:0">🏅 成就墙（${unlocked.length}/${BADGES.length}）</h2>
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
    text: (isTheory ? "理论题（选择/判断/填空）" : "实战题（代码客观题）") + "由 LLM 基于课程内容生成，当前目录还没有。请先配置 API Key，再点「🤖 补出题」生成。",
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
      icon: "🤖",
      title: "补出题需要 LLM",
      text: "理论考核需要客观题（选择/判断/填空），这些题由 LLM 基于课程内容生成。请先在「设置」里配置 API Key。",
      actions: [
        { label: "⚙️ 去设置", primary: true, onClick: () => showSettings() },
        { label: "先不了", onClick: () => {} },
      ],
    });
    return;
  }
  try {
    const res = await fetch(`./api/dir?uid=${encodeURIComponent(UID)}&id=${encodeURIComponent(dirId)}`, { cache: "no-store" });
    if (!res.ok) throw new Error("读取目录失败");
    const dd = await res.json();
    const course = dd.course;
    if (!course) throw new Error("目录无课程数据");
    // 按缺失补：理论不足补理论（16 道）、实战不足（有代码文件时）补实战（10 道）——不再无脑全量 26
    const quiz = course.quiz || [];
    const hasCode = (course.materials || []).some((m) => m.type === "code" || (m.file && /\.(py|ipynb|js|ts|java)$/i.test(m.file)));
    const theoryCount = quiz.filter((q) => (q.dimension || inferDimension(q)) === "theory").length;
    const pracCount = quiz.filter((q) => q.type === "practical" && q.source === "llm").length;
    const needTheory = theoryCount < 8;
    const needPrac = hasCode && pracCount < 10;
    if (!needTheory && !needPrac) {
      showToast("✅ 题库已完整（理论 " + theoryCount + " · 实战 " + pracCount + "），无需补出题");
      showLibrary();
      return;
    }
    showToast("🤖 正在用 LLM 补出题（" + (needTheory ? "理论" : "") + (needTheory && needPrac ? " + " : "") + (needPrac ? "实战" : "") + "）…");
    let llmQ = [];
    if (needTheory) llmQ = llmQ.concat(await browserLLMGenerate(course, "theory"));
    if (needPrac) llmQ = llmQ.concat(await browserLLMGenerate(course, "practical"));
    if (!llmQ || !llmQ.length) {
      showToast("⚠️ LLM 未返回有效题目，请检查 Key 或稍后重试");
      return;
    }
    // ⑥ 修复：LLM 题 id 用全局近似唯一起点（原 existingIds 去重为死逻辑，已删除）
    let nid = Date.now();   // 13 位毫秒全局唯一，同目录内 nid++ 不重
    let added = 0;
    for (const q of llmQ) {
      q.id = nid++;
      q.source = "llm";
      if (!q.dimension) q.dimension = inferDimension(q);
      q.interview = !!q.interview;
      if (q.type === "essay" && !q.followUps) q.followUps = [];
      normalizeLLMQuestion(q);
      course.quiz.push(q);
      added++;
    }
    if (!added) {
      showToast("⚠️ 未新增题目（可能已存在）");
      return;
    }
    await fetch("/api/course-save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: UID, course, dirId }),
    });
    showToast(`✅ 已补出 ${added} 道题，理论考核现在可用`);
    showLibrary();
  } catch (e) {
    showToast(`⚠️ 补出题失败：${e.message}`);
  }
}

/* 目录列表页：每个目录右侧理论/实战考核按钮 + 改名 + 删目录 + 进入详情 */
async function showLibrary() {
  const dirs = await refreshDirs();
  const cards = dirs.map((d) => {
    const theoryOn = d.theoryCount ? "startDirExam('" + d.id + "', 'theory')" : "examNeeded('" + d.id + "', 'theory')";
    const practicalOn = d.practicalCount ? "startDirExam('" + d.id + "', 'practical')" : "examNeeded('" + d.id + "', 'practical')";
    return `
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap">
        <div style="flex:1;min-width:220px">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span style="font-size:22px">📚</span>
            <span style="font-size:16px;font-weight:800;color:var(--text-0)">${esc(d.title)}</span>
            <button class="exam-btn ghost" style="padding:4px 10px;font-size:11.5px" onclick="renameDir('${d.id}', '${jsStr(d.title)}')">✏️ 改名</button>
          </div>
          <div style="font-size:12px;color:var(--text-2);margin-top:6px;font-family:var(--mono)">
            ${d.fileCount} 个文件 · ${d.quizCount} 题（理论 ${d.theoryCount} · 实战 ${d.practicalCount} · 面试 ${d.interviewCount}）
          </div>
          ${!d.theoryCount ? `<div style="font-size:11.5px;color:#ffb84d;margin-top:3px">⚠️ 理论题缺失（LLM 生成未完成）——点「🤖 补出题」补齐后即可考核</div>` : ""}
          <div style="font-size:11px;color:var(--text-2);margin-top:3px">${d.createdAt ? d.createdAt.slice(0, 16).replace("T", " ") : ""}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <button class="exam-btn primary" onclick="${theoryOn}">📘 理论考核</button>
          ${!d.theoryCount ? `<button class="exam-btn" style="color:#ffb84d;border-color:rgba(255,184,77,0.4)" onclick="reGenerateQuestions('${d.id}')">🤖 补出题</button>` : ""}
          <button class="exam-btn" onclick="${practicalOn}">🛠️ 实战考核</button>
          <button class="exam-btn ghost" onclick="showDirDetail('${d.id}')">📁 管理</button>
          <button class="exam-btn ghost" style="color:#ff6b6b;border-color:rgba(255,107,107,0.4)" onclick="deleteDir('${d.id}')">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join("");

  render(null, `
    <button class="exam-btn ghost" onclick="goHome()" style="margin-bottom:18px">← 返回</button>
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:6px">
      <h2 class="section-title" style="margin:0">🗂️ 资料目录（${dirs.length}）</h2>
      <button class="exam-btn primary" onclick="showImportPanel()">📥 新建目录（导入资料）</button>
    </div>
    <div style="font-size:12.5px;color:var(--text-2);margin-bottom:14px">每次导入创建一个章节目录。可针对任意目录单独进行理论/实战考核，也可进入目录补充或删减文件。</div>
    ${cards || `<div class="card empty-hint" style="padding:36px;text-align:center">
      <div style="font-size:40px;margin-bottom:10px">📭</div>
      <div style="font-size:14px;color:var(--text-1);margin-bottom:14px">还没有任何资料目录</div>
      <button class="exam-btn primary" onclick="showImportPanel()">📥 导入资料，创建第一个目录</button>
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

    <div class="card">
      <div style="display:flex;gap:10px;flex-wrap:wrap">
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
      icon: "🤖",
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
    if (data.ok) { showToast(`✅ 已改名「${title}」`); showLibrary(); }
    else showToast("❌ 改名失败：" + (data.error || ""));
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
        if (data.ok) { showToast("✅ 目录已删除"); showLibrary(); }
        else showToast("❌ 删除失败：" + (data.error || ""));
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
        if (data.ok) { showToast(`✅ 已删除，移除 ${data.removedQuestions} 题`); showDirDetail(dirId); }
        else showToast("❌ 删除失败：" + (data.error || ""));
      } },
    ],
  });
}

/* 针对某个目录进行理论/实战考核 */
async function startDirExam(dirId, mode) {
  // 理论/实战考核都需要 LLM（出题 + 打标签 + 判分）
  if (!LLM_KEY) {
    const modeName = mode === "theory" ? "理论" : "实战";
    showModal({
      icon: "🤖",
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
  // 用该目录的题出卷
  const dirQuiz = dd.course.quiz || [];
  let filtered = [];
  if (mode === "theory") {
    filtered = dirQuiz.filter((q) => (q.dimension || inferDimension(q)) === "theory" && ["choice", "multi_choice", "true_false", "fill_blank"].includes(q.type));
  } else if (mode === "practical") {
    filtered = dirQuiz.filter((q) => (q.dimension || inferDimension(q)) === "practical");
  }
  if (!filtered.length) {
    filtered = dirQuiz.filter((q) => (mode === "theory" ? ["choice", "multi_choice", "true_false", "fill_blank"].includes(q.type) : q.type === "practical"));
  }
  // LLM 从本章节全题库动态挑选组卷（不经过 adaptivePick 前置砍池；失败回退程序抽题）
  loading.log("LLM 从本章题库动态挑选组卷");
  loading.setStatus("LLM 正在从本章题库组卷");
  const stopP1 = loading.autoProgress(60, 74);
  const llmPicked = await llmPickQuestions(filtered, mode, mode === "theory" ? 8 : 5, "chapter");
  stopP1();
  loading.setProgress(75);
  filtered = (llmPicked && llmPicked.length) ? llmPicked : adaptivePick(filtered, mode === "theory" ? 8 : 5);
  loading.log("题库组卷 → " + filtered.length + " 题（LLM 挑选 / 程序兜底 · 回顾题稍后注入）");
  if (!filtered.length) { showToast("⚠️ 该目录暂无此类题目，请先导入对应资料"); return; }
  // 题库不足时，LLM 动态生成补足缺口（不替换 LLM 已挑的题，避免稀释组卷质量）
  if (LLM_KEY && filtered.length < (mode === "theory" ? 8 : 5)) {
    const need = (mode === "theory" ? 8 : 5) - filtered.length;
    loading.log("题库不足 → LLM 动态生成 " + need + " 道补足");
    loading.setStatus("LLM 动态补充缺题");
    const stopP2 = loading.autoProgress(75, 94);
    try {
      const dyn = await llmExamQuestions([dd.course], mode, need);
      if (seq !== examSeq) return;
      if (dyn && dyn.length) filtered = filtered.concat(dyn).slice(0, mode === "theory" ? 8 : 5);
    } catch (e) { /* 忽略 */ } finally {
      stopP2();
      loading.setProgress(95);
    }
  } else {
    loading.setProgress(95);
  }
  // D1：回顾题（按模式过滤题型，理论考核不注入实战题）
  loading.log("注入回顾题（错题间隔重考）");
  filtered = injectReviewQuestions(filtered, mode);
  // 最终防御：按考核模式过滤题型（LLM 动态题/回顾题可能混入其他题型）
  filtered = filtered.filter((q) => mode === "theory"
    ? ["choice", "multi_choice", "true_false", "fill_blank"].includes(q.type)
    : q.type === "practical");
  loading.setProgress(95);
  await loading.finish();   // 确保动画至少展示一小段
  quiz = filtered;
  quizIdx = 0; combo = 0; correctCount = 0; abilityScore = {}; answers = [];
  renderQuestion();
}

function showHistory() {
  const rows = state.history.slice().reverse().map((h, i) => `
    <div class="exam-review-item">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="eri-q" style="margin:0">${MODE_LABEL[h.mode] || esc(h.mode)} · ${h.date.slice(0, 16).replace("T", " ")}</div>
        <div style="font-size:23px;font-weight:800;color:${h.pct >= 70 ? "#00e5ff" : "#ffb84d"}">${h.pct}%</div>
      </div>
      <div style="font-size:11.5px;color:var(--text-2);margin-top:6px">${h.score}/${h.total} · ${Object.entries(h.abilities || {}).map(([a, p]) => `${a} ${p}%`).join(" · ")}</div>
    </div>`).join("") || "<div class='empty'>还没有考核记录，去完成一次考核吧！</div>";
  render(null, `
    <button class="exam-btn ghost" onclick="goHome()" style="margin-bottom:18px">← 返回</button>
    <h2 class="section-title">📈 学习历史（${state.history.length} 次）</h2>
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
          <div style="color:#ffb84d">Q${qi + 1}. ${esc(qa.q)}</div>
          <div style="color:var(--text-2);margin-top:3px">A. ${esc(qa.a)}${qa.weak ? ` <span style="color:#ff6b6b">（弱回答）</span>` : ""}</div>
        </div>`).join("")}
      </div></details>` : ""}
    </div>`).join("") || "<div class='empty'>还没有面试记录，去完成一次面试考核吧！</div>";
  render(null, `
    <button class="exam-btn ghost" onclick="goHome()" style="margin-bottom:18px">← 返回</button>
    <h2 class="section-title">💼 面试记录（${logs.length} 次）</h2>
    ${rows}`);
}

function showWrongBook() {
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
  lines.push("# AI 岗位能力试炼 · AI Job Skill Gauntlet 能力报告");
  lines.push("");
  lines.push("> 由「AI 岗位能力试炼 · AI Job Skill Gauntlet」自动生成 · " + new Date().toISOString().slice(0, 16).replace("T", " "));
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
 * 1) 首页常驻「快速开始」引导条：4 步流程 + 实时状态 + 推荐下一步
 * 2) 首次使用自动播放高亮 Tour：全屏遮罩 + 目标高亮 + 步骤气泡
 * ============================================================ */
const GUIDE_KEY = "examCenter.onboarded";     // 是否看过引导 Tour
let guideForceFull = false;                   // 引导条强制显示完整 4 步

// 6 步流程（顺序即推荐顺序：先夯实章节 → 再综合检验 → 最后面试）
const GUIDE_STEPS = [
  { id: "llm", num: "①", icon: "⚙️", title: "配置 LLM", desc: "出题 / 判分 / 面试考核都由 LLM 驱动，先配置 API Key（支持 DeepSeek、阿里百炼等）", jump: showSettings, jumpLabel: "去配置" },
  { id: "import", num: "②", icon: "📥", title: "导入学习资料", desc: "拖入笔记 / 代码 / 文档或文件夹，系统自动解析并生成 12 道考核题", jump: showImportPanel, jumpLabel: "去导入" },
  { id: "chapter", num: "③", icon: "📘", title: "章节考核", desc: "进「资料目录」选章节分阶段考核，优先夯实每章基础", jump: showLibrary, jumpLabel: "去章节" },
  { id: "cross", num: "④", icon: "🎯", title: "综合考核", desc: "聚合全部章节题库组卷，检验整体掌握（理论 / 实战）", jump: () => { const g = document.querySelector("#exam-view .mode-grid"); if (g) g.scrollIntoView({ behavior: "smooth", block: "center" }); }, jumpLabel: "去考核" },
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

// 首页「快速开始」引导条 HTML
function renderGuideBarHTML() {
  if (!guideForceFull) {
    const nextId = guideNextStepId();
    if (!nextId) {
      return `<div class="guide-bar gb-all-done" id="guide-bar">
        <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;flex-wrap:wrap">
          <span style="font-size:18px">🎉</span>
          <div style="font-size:13.5px;color:var(--text-1)">恭喜！<strong style="color:var(--accent)">全部引导步骤已完成</strong>，你已经掌握完整流程。</div>
        </div>
        <button class="exam-btn ghost" style="padding:6px 12px;font-size:12px" onclick="startGuideTour()">👀 新手引导演示</button>
        <button class="exam-btn ghost" style="padding:6px 12px;font-size:12px" onclick="__guideShowAll()">📋 查看完整流程</button>
      </div>`;
    }
  }
  const nextId = guideNextStepId();
  const steps = GUIDE_STEPS.map((s) => {
    const done = guideStepDone(s.id);
    const isNext = s.id === nextId;
    const cls = done ? "done" : (isNext ? "next" : "todo");
    return `
    <div class="guide-step ${cls}" id="gs-${s.id}">
      <div class="gs-badge">${done ? "✅" : s.num}</div>
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
  return `<div class="guide-bar" id="guide-bar">
    <div class="gb-head">
      <div class="gb-title">🚀 快速开始 <span class="gb-sub">按顺序完成 6 步即可上手 · 章节 → 综合 → 面试 · 已完成自动打勾</span></div>
      <button class="exam-btn ghost gb-replay" onclick="startGuideTour()">👀 新手引导演示</button>
    </div>
    <div class="gb-steps">${steps}</div>
  </div>`;
}

function __guideShowAll() { guideForceFull = true; goHome(); }
function __guideJump(id) {
  const s = GUIDE_STEPS.find((x) => x.id === id);
  if (s && s.jump) s.jump();
}

/* ---------- 高亮引导 Tour ---------- */
const TOUR_STEPS = [
  { icon: "🤖", title: "欢迎来到 AI 岗位能力试炼", text: "这是一套本地 AI 岗位面试能力评估系统：导入学习资料 → LLM 自动出题 → 三种考核（章节 → 综合 → 面试）→ 10 维能力画像 + 岗位匹配。下面带你走一遍完整流程。", sel: null },
  { icon: "⚙️", title: "第 1 步 · 配置 LLM", text: "出题、语义判分、岗位匹配都由 LLM 驱动。请先在「设置」中填入 API Key（支持 DeepSeek、阿里百炼等 OpenAI 兼容接口），Key 仅保存在本机浏览器，不会上传服务器。", sel: 'button[onclick="showSettings()"]' },
  { icon: "📥", title: "第 2 步 · 导入学习资料", text: "点击「导入资料」，拖入笔记、代码、文档或整个文件夹，系统自动解析并生成考核题（选择 / 判断 / 填空 + 实战场景题）。", sel: 'button[onclick="showImportPanel()"]' },
  { icon: "📘", title: "第 3 步 · 章节考核（建议优先）", text: "进「资料目录」选择单个章节分阶段考核（理论 / 实战），先夯实每一章的基础，掌握局部再谈整体。", sel: 'button[onclick="showLibrary()"]' },
  { icon: "🎯", title: "第 4 步 · 综合考核", text: "跨全部章节混合出题，检验整体掌握与遗忘点：📘 理论考核（客观题）+ 🛠️ 实战考核（代码实战客观题）。", sel: ".mode-grid" },
  { icon: "💼", title: "第 5 步 · 面试考核（最后挑战）", text: "选一个岗位（Agent 工程师 / RAG 工程师等 8 个方向），AI 面试官按岗位知识图谱严格追问、深挖、甚至提前结束面试。建议完成前两步考核后再来。", sel: '.mode-card[onclick="startInterview()"]' },
  { icon: "🧬", title: "第 6 步 · 查看能力画像", text: "完成考核后回到首页，可查看 10 维能力雷达图、岗位匹配度、等级称号，并导出评估报告。", sel: 'button[onclick="showAssessment()"]' },
  { icon: "🚀", title: "全部完成 🎉", text: "首页顶部常驻「快速开始」引导条会实时标记你的进度并推荐下一步；随时可点「新手引导演示」重看本教程。祝你试炼顺利！", sel: null },
];

let tourStep = -1;
let tourEls = null;          // { mask, hole, bubble }
let tourScrollHandler = null;

function startGuideTour() {
  closeGuideTour();
  localStorage.setItem(GUIDE_KEY, "1");
  tourStep = 0;
  const mask = document.createElement("div");
  mask.className = "tour-mask";
  mask.innerHTML = `<div class="tour-hole"></div><div class="tour-bubble"></div>`;
  document.body.appendChild(mask);
  tourEls = { mask, hole: mask.querySelector(".tour-hole"), bubble: mask.querySelector(".tour-bubble") };
  // 点击高亮目标区域（穿透到按钮）→ 关闭 tour 并让按钮正常执行
  mask.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.closest && t.closest(".tour-target")) closeGuideTour();
  }, true);
  tourScrollHandler = () => {
    if (!tourEls) return;
    const s = TOUR_STEPS[tourStep];
    if (s && s.sel) { const el = $(s.sel); if (el) positionTour(el); }
  };
  window.addEventListener("scroll", tourScrollHandler, true);
  window.addEventListener("resize", tourScrollHandler);
  showTourStep(0);
}

function showTourStep(i) {
  if (!tourEls) return;
  const prev = TOUR_STEPS[tourStep];
  if (prev && prev.sel) { const p = $(prev.sel); if (p) p.classList.remove("tour-target"); }
  tourStep = i;
  const s = TOUR_STEPS[i];
  if (!s) { closeGuideTour(); return; }
  tourEls.bubble.classList.remove("tb-center");
  tourEls.bubble.style.transform = "none";
  tourEls.bubble.innerHTML = `
    <div class="tb-icon">${s.icon}</div>
    <div class="tb-title">${esc(s.title)}</div>
    <div class="tb-text">${esc(s.text)}</div>
    <div class="tb-actions">
      ${i > 0 ? `<button class="exam-btn ghost" onclick="__tourPrev()">← 上一步</button>` : ""}
      ${i < TOUR_STEPS.length - 1 ? `<button class="exam-btn" onclick="__tourNext()">下一步 →</button>` : `<button class="exam-btn primary" onclick="__tourDone()">开始体验</button>`}
      <button class="exam-btn ghost" style="border-color:var(--border)" onclick="__tourSkip()">跳过</button>
    </div>`;
  if (s.sel) {
    const el = $(s.sel);
    if (el) {
      el.classList.add("tour-target");
      try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) { /* ignore */ }
      setTimeout(() => { if (tourEls) positionTour(el); }, 420);
    } else { centerTourBubble(); }
  } else { centerTourBubble(); }
}

function centerTourBubble() {
  if (!tourEls) return;
  tourEls.hole.style.display = "none";
  tourEls.bubble.classList.add("tb-center");
  tourEls.bubble.style.left = "50%";
  tourEls.bubble.style.top = "50%";
  tourEls.bubble.style.transform = "translate(-50%, -50%)";
}

function positionTour(el) {
  if (!tourEls) return;
  const rect = el.getBoundingClientRect();
  const hole = tourEls.hole, bubble = tourEls.bubble;
  hole.style.display = "block";
  hole.style.left = (rect.left - 4) + "px";
  hole.style.top = (rect.top - 4) + "px";
  hole.style.width = (rect.width + 8) + "px";
  hole.style.height = (rect.height + 8) + "px";
  const bw = 360, bh = bubble.offsetHeight || 200;
  const left = Math.min(Math.max(rect.left + rect.width / 2 - bw / 2, 12), window.innerWidth - bw - 12);
  let top, arrow;
  if (rect.top - bh - 18 > 10) { top = rect.top - bh - 18; arrow = "down"; }
  else if (rect.bottom + bh + 18 < window.innerHeight - 10) { top = rect.bottom + 18; arrow = "up"; }
  else { top = 12; arrow = "up"; }
  bubble.classList.remove("tb-arrow-up", "tb-arrow-down");
  bubble.classList.add(arrow === "up" ? "tb-arrow-up" : "tb-arrow-down");
  bubble.style.left = left + "px";
  bubble.style.top = top + "px";
  bubble.style.transform = "none";
}

function __tourNext() { showTourStep(tourStep + 1); }
function __tourPrev() { showTourStep(tourStep - 1); }
function __tourSkip() { closeGuideTour(); }
function __tourDone() { closeGuideTour(); }
function closeGuideTour() {
  if (tourScrollHandler) {
    window.removeEventListener("scroll", tourScrollHandler, true);
    window.removeEventListener("resize", tourScrollHandler);
    tourScrollHandler = null;
  }
  if (!tourEls) return;
  const s = TOUR_STEPS[tourStep];
  if (s && s.sel) { const el = $(s.sel); if (el) el.classList.remove("tour-target"); }
  tourEls.mask.remove();
  tourEls = null;
  tourStep = -1;
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
      ${opts.icon ? `<div class="mb-icon">${esc(opts.icon)}</div>` : ""}
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
      { label: "确认退出", primary: true, onClick: () => { examSeq++; quiz = []; quizIdx = 0; answers = []; goHome(); } },
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
      { label: "确认退出", primary: true, onClick: () => { interviewBusyCount = 0; interviewState = null; goHome(); } },
    ],
  });
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
  updateGamestat();
  goHome();
  // 新人引导：首次使用（未看过引导）且题库为空 → 自动播放高亮 Tour
  if (!localStorage.getItem(GUIDE_KEY) && !(COURSE && COURSE.quiz && COURSE.quiz.length)) {
    setTimeout(() => startGuideTour(), 600);
  }
  // 已看过引导但未配置 LLM → 弹一次性配置提醒（只弹一次，之后可在设置里随时配置）
  if (!LLM_KEY && localStorage.getItem(GUIDE_KEY) && !localStorage.getItem("examCenter.llmGuided")) {
    localStorage.setItem("examCenter.llmGuided", "1");
    setTimeout(() => {
      showModal({
        icon: "🤖",
        title: "欢迎使用 AI 岗位能力试炼 · AI Job Skill Gauntlet",
        text: "本系统的核心能力——出题、题目能力打标签、语义判分、岗位匹配——都由 LLM 驱动。建议先配置 LLM API Key（支持 DeepSeek 官方或中转站），才能完整体验理论 / 实战 / 面试三种考核。Key 仅保存在本机浏览器，浏览器直连 API，不会上传服务器。",
        actions: [
          { label: "⚙️ 去配置 LLM", primary: true, onClick: () => showSettings() },
          { label: "稍后再说", onClick: () => {} },
        ],
      });
    }, 500);
  }
}

document.addEventListener("DOMContentLoaded", init);
