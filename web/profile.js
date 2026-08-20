/* profile.js — 能力画像与岗位匹配（依赖 exam.js 的常量与 state，运行时访问）
 * 覆盖：等级、能力收缩公式、雷达图、岗位匹配 */
"use strict";

function profileAvgScore() {
  const pct = abilityProfilePct();
  const vals = Object.values(pct);
  if (!vals.length) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}
// 当前等级序号（0-7 → Lv.1-8；Lv.6 是三个平级专家方向）
function currentLevelIndex() {
  const pct = abilityProfilePct();
  const avg = profileAvgScore();
  if (avg >= 98) return 7;                                     // Lv.8 大师
  const mastered = EXPERT_TRACKS.filter((t) => (pct[t.ability] || 0) >= t.threshold).length;
  if (mastered >= EXPERT_TRACKS.length) return 6;              // Lv.7 全栈
  if (mastered >= 1) return 5;                                 // Lv.6 专家方向（平级）
  let idx = 0;
  for (let i = 0; i < LEVEL_TITLES.length; i++) {
    if (avg >= LEVEL_TITLES[i].score) idx = i; else break;
  }
  return idx;                                                  // 0-4 → Lv.1-5
}

function levelTitle(score) {
  let cur = LEVEL_TITLES[0];
  for (const t of LEVEL_TITLES) if (score >= t.score) cur = t;
  return cur;
}

// 当前等级称号（含专家分支 + 全栈 + 大师的汇聚逻辑）
function currentTitle() {
  const pct = abilityProfilePct();
  const avg = profileAvgScore();
  if (avg >= 98) return GRAND_MASTER_TITLE;
  const mastered = EXPERT_TRACKS.filter((t) => (pct[t.ability] || 0) >= t.threshold);
  if (mastered.length >= EXPERT_TRACKS.length) return FULL_STACK_TITLE;
  if (mastered.length >= 1) {
    // 多个方向精通时显示分数最高的那个方向
    return mastered.reduce((a, b) => (pct[a.ability] || 0) >= (pct[b.ability] || 0) ? a : b);
  }
  return levelTitle(avg);
}

// 徽章定义（rarity: common青铜 / rare白银 / epic黄金 / legendary传说）
const BADGES = [
  // —— 学习历程 ——
  { id: "first", icon: "🚀", name: "首次考核", desc: "完成第一次考核", rarity: "common", ap: 10, check: (s) => s.exams >= 1 },
  { id: "exams5", icon: "📚", name: "五次磨砺", desc: "累计完成 5 次考核", rarity: "common", ap: 10, check: (s) => s.exams >= 5 },
  { id: "exams10", icon: "📖", name: "十次坚持", desc: "累计完成 10 次考核", rarity: "rare", ap: 20, check: (s) => s.exams >= 10 },
  { id: "exams25", icon: "🏛️", name: "二十五次奋斗", desc: "累计完成 25 次考核", rarity: "epic", ap: 35, check: (s) => s.exams >= 25 },
  { id: "exams50", icon: "🎓", name: "五十次大师", desc: "累计完成 50 次考核", rarity: "legendary", ap: 60, check: (s) => s.exams >= 50 },
  // —— 连击 ——
  { id: "combo3", icon: "🎯", name: "三连击", desc: "连击达到 3", rarity: "common", ap: 10, check: (s) => s.bestCombo >= 3 },
  { id: "combo5", icon: "🔥", name: "五连击", desc: "连击达到 5", rarity: "rare", ap: 20, check: (s) => s.bestCombo >= 5 },
  { id: "combo10", icon: "⚡", name: "十连击", desc: "连击达到 10", rarity: "epic", ap: 35, check: (s) => s.bestCombo >= 10 },
  { id: "combo15", icon: "🌪️", name: "十五连击", desc: "连击达到 15", rarity: "epic", ap: 35, check: (s) => s.bestCombo >= 15 },
  { id: "combo20", icon: "💫", name: "二十连击", desc: "连击达到 20", rarity: "legendary", ap: 60, check: (s) => s.bestCombo >= 20 },
  // —— 成绩 ——
  { id: "score90", icon: "💪", name: "高分突破", desc: "单次考核 ≥ 90%", rarity: "rare", ap: 20, check: (s) => s.history.some((h) => h.pct >= 90) },
  { id: "full", icon: "🎯", name: "满分达人", desc: "单次考核 100%", rarity: "epic", ap: 35, check: (s) => s.history.some((h) => h.pct === 100) },
  { id: "full3", icon: "🏅", name: "三次满分", desc: "3 次考核满分", rarity: "legendary", ap: 60, check: (s) => s.history.filter((h) => h.pct === 100).length >= 3 },
  { id: "perfect", icon: "🌟", name: "完美之星", desc: "5 次考核满分", rarity: "legendary", ap: 80, check: (s) => s.history.filter((h) => h.pct === 100).length >= 5 },
  // —— 模式 ——
  { id: "cross", icon: "🎓", name: "跨课程大师", desc: "完成跨课程综合考核", rarity: "rare", ap: 20, check: (s) => s.crossExam },
  { id: "interview", icon: "💼", name: "面试高手", desc: "面试模拟 ≥ 80 分", rarity: "epic", ap: 35, check: (s) => s.bestInterview >= 80 },
  { id: "practical", icon: "🛠️", name: "实战精英", desc: "完成实战考核", rarity: "rare", ap: 20, check: (s) => s.practicalDone },
  { id: "allModes", icon: "🗺️", name: "全能选手", desc: "完成全部 4 种考核模式", rarity: "epic", ap: 35, check: (s) => s.modesDone && s.modesDone.length >= 4 },
  // —— 等级 ——（对应 8 级体系：Lv.1-8）
  { id: "lv3", icon: "🌟", name: "进阶者", desc: "达到等级 3", rarity: "common", ap: 10, check: (s) => s.level >= 3 },
  { id: "lv5", icon: "💎", name: "资深学者", desc: "达到等级 5", rarity: "rare", ap: 20, check: (s) => s.level >= 5 },
  { id: "lv7", icon: "👑", name: "全栈 AI 工程师", desc: "达到等级 7（全栈 AI 工程师）", rarity: "epic", ap: 35, check: (s) => s.level >= 7 },
  { id: "lv8", icon: "🚀", name: "AI 大师", desc: "达到等级 8（AI 大师）", rarity: "legendary", ap: 60, check: (s) => s.level >= 8 },
  // —— 连续学习 ——
  { id: "streak3", icon: "📅", name: "三日之约", desc: "连续 3 天学习", rarity: "common", ap: 10, check: (s) => s.bestStreak >= 3 },
  { id: "streak7", icon: "🗓️", name: "一周全勤", desc: "连续 7 天学习", rarity: "rare", ap: 20, check: (s) => s.bestStreak >= 7 },
  { id: "streak14", icon: "📆", name: "半月坚守", desc: "连续 14 天学习", rarity: "epic", ap: 35, check: (s) => s.bestStreak >= 14 },
  { id: "streak30", icon: "🏵️", name: "月度全勤", desc: "连续 30 天学习", rarity: "legendary", ap: 60, check: (s) => s.bestStreak >= 30 },
  // —— 能力维度精通（技术向徽章：10 个能力维度各一枚，≥ 90% 解锁）——
  { id: "ab_prompt", icon: "💬", name: "提示词大师", desc: "提示词工程 ≥ 90%", rarity: "epic", ap: 35, check: (s) => Object.prototype.hasOwnProperty.call(s.abilityBest || {}, "提示词工程") },
  { id: "ab_rag", icon: "🔍", name: "RAG 检索专家", desc: "RAG 与知识库 ≥ 90%", rarity: "epic", ap: 35, check: (s) => Object.prototype.hasOwnProperty.call(s.abilityBest || {}, "RAG 与知识库") },
  { id: "ab_tools", icon: "🧰", name: "工具调用高手", desc: "工具调用 ≥ 90%", rarity: "epic", ap: 35, check: (s) => Object.prototype.hasOwnProperty.call(s.abilityBest || {}, "工具调用") },
  { id: "ab_vector", icon: "🧲", name: "向量检索专家", desc: "向量与 Embedding ≥ 90%", rarity: "epic", ap: 35, check: (s) => Object.prototype.hasOwnProperty.call(s.abilityBest || {}, "向量与 Embedding") },
  { id: "ab_agent", icon: "🤖", name: "Agent 内行", desc: "Agent 核心机制 ≥ 90%", rarity: "epic", ap: 35, check: (s) => Object.prototype.hasOwnProperty.call(s.abilityBest || {}, "Agent 核心机制") },
  { id: "ab_finetune", icon: "🔬", name: "微调专家", desc: "模型微调 ≥ 90%", rarity: "epic", ap: 35, check: (s) => Object.prototype.hasOwnProperty.call(s.abilityBest || {}, "模型微调") },
  { id: "ab_arch", icon: "🏗️", name: "框架能手", desc: "开发框架 ≥ 90%", rarity: "epic", ap: 35, check: (s) => Object.prototype.hasOwnProperty.call(s.abilityBest || {}, "开发框架") },
  { id: "ab_deploy", icon: "⚙️", name: "部署优化大师", desc: "部署与推理 ≥ 90%", rarity: "epic", ap: 35, check: (s) => Object.prototype.hasOwnProperty.call(s.abilityBest || {}, "部署与推理") },
  { id: "ab_algo", icon: "🧮", name: "算法内核专家", desc: "算法与神经网络 ≥ 90%", rarity: "epic", ap: 35, check: (s) => Object.prototype.hasOwnProperty.call(s.abilityBest || {}, "算法与神经网络") },
  { id: "ab_expr", icon: "🎙️", name: "表达之星", desc: "面试表达力 ≥ 90%（或面试考核 ≥ 90 分）", rarity: "epic", ap: 35, check: (s) => Object.prototype.hasOwnProperty.call(s.abilityBest || {}, "面试表达力") || (s.bestInterview || 0) >= 90 },
  { id: "ab_full", icon: "🧠", name: "全能大脑", desc: "3 个能力维度 ≥ 90%", rarity: "legendary", ap: 60, check: (s) => Object.keys(s.abilityBest || {}).length >= 3 },
  { id: "ab_master6", icon: "🏆", name: "六维宗师", desc: "6 个能力维度 ≥ 90%", rarity: "legendary", ap: 80, check: (s) => Object.keys(s.abilityBest || {}).length >= 6 },
  // —— 资料导入 ——
  { id: "imp1", icon: "📥", name: "首份资料", desc: "导入第一份学习资料", rarity: "common", ap: 10, check: (s) => s.imports >= 1 },
  { id: "imp5", icon: "📚", name: "资料收集者", desc: "累计导入 5 份资料", rarity: "rare", ap: 20, check: (s) => s.imports >= 5 },
  { id: "imp10", icon: "🗂️", name: "资料馆主", desc: "累计导入 10 份资料", rarity: "epic", ap: 35, check: (s) => s.imports >= 10 },
  { id: "imp20", icon: "🏛️", name: "资料大师", desc: "累计导入 20 份资料", rarity: "legendary", ap: 60, check: (s) => s.imports >= 20 },
];

const RARITY_META = {
  common: { label: "青铜", color: "#cd9a5b" },
  rare: { label: "白银", color: "#c0c8d8" },
  epic: { label: "黄金", color: "#ffd75b" },
  legendary: { label: "传说", color: "#ff6bd6" },
};

function calcAP(s) {
  return BADGES.filter((b) => b.check(s)).reduce((sum, b) => sum + (b.ap || 10), 0);
}

const TYPE_LABEL = { choice: "单选题", multi_choice: "多选题", true_false: "判断题", fill_blank: "填空题", essay: "问答题", practical: "实战题" };
const MODE_LABEL = { theory: "📘 理论考核", practical: "🛠️ 实战考核", interview: "💼 面试考核" };
const BASE_SCORE = { choice: 10, multi_choice: 15, true_false: 10, fill_blank: 12, essay: 20, practical: 25 };

const LS_KEY = "examCenter.v1";

/* ---------------- 用户身份 ---------------- */
let UID = "";              // 当前用户 ID（设备绑定，由服务器分配，跨浏览器一致）
let NICKNAME = "";         // 用户自定义昵称（localStorage 持久化，展示用）
let LLM_KEY = "";          // 用户填写的 LLM API Key（localStorage）
let LLM_BASE = "";         // OpenAI 兼容 Base URL（可填中转站）
let LLM_MODEL = "";        // 模型名

function abilityProfilePct() {
  const out = {};
  const now = Date.now();
  for (const [ab, rec] of Object.entries(state.abilityProfile || {})) {
    if (!rec || !rec.count) continue;
    let sum = rec.sum, count = rec.count;
    // 时间衰减：超过 7 天未考该维度，得分向中性 50% 回归（遗忘曲线）
    if (rec.lastAt) {
      const days = Math.floor((now - rec.lastAt) / 86400000);
      const decays = Math.floor(days / 7);
      for (let i = 0; i < decays && i < 6; i++) {
        // 向 50% 回归：sum 朝 count*50 靠拢 15%
        sum = sum * 0.85 + count * 50 * 0.15;
      }
    }
    if (count > 0) {
      // 从严收缩：样本少时向很低的基准（30%）回归，避免「刚考一两次就虚高」
      // BASE=30 表示第一次考核后从很低起步；K=10 相当于预设 10 道「30% 的中性题」
      // 只有通过多次、大量、不同维度的考核，分数才会缓慢爬升
      const BASE = 30, K = 10;
      const shrunk = (sum + BASE * K) / (count + K);
      out[ab] = Math.round(shrunk);
    }
  }
  return out;
}

/* 基础水平评级：根据综合画像给出水平描述（含短板提示 + 样本量门槛） */

function baseLevelAssessment() {
  const pct = abilityProfilePct();
  const entries = Object.entries(pct);
  // 境界统一走 LEVEL_TITLES（成长路径），不另设评级，所有提升都围绕这一套体系
  const t = levelTitle(profileAvgScore());
  if (!entries.length) {
    return { level: t.title, icon: t.icon, desc: "完成至少一次考核后，系统将基于你的能力画像评估基础水平。", color: "var(--text-2)" };
  }
  const vals = entries.map(([, v]) => v);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  // 找短板：最低维度低于平均 20 分以上
  const sorted = [...entries].sort((a, b) => a[1] - b[1]);
  const weakest = sorted[0];
  let weakNote = "";
  if (weakest && weakest[1] < avg - 20) {
    weakNote = `，但「${weakest[0]}」仅 ${weakest[1]}%，是明显短板，建议优先补强`;
  }
  const sampleNote = entries.length < 3 ? "（当前数据样本较少，评估仅供参考）" : "";
  return { level: t.title, icon: t.icon, color: "#00e5ff", desc: `综合画像 ${Math.round(avg)}%${weakNote}${sampleNote}。` };
}

function analyzeGrowth(abilityPct) {
  const prev = state.history[state.history.length - 2]?.abilities || {};
  const up = [], down = [];
  for (const [ab, p] of Object.entries(abilityPct)) {
    const prevP = prev[ab];
    if (p >= 80) up.push(`${ab}（${p}%）已掌握`);
    if (prevP !== undefined && p < prevP - 10) down.push(`${ab}（${p}%，较上次 -${prevP - p}%）`);
    else if (p < 50) down.push(`${ab}（${p}%）低于及格线，建议复习`);
  }
  return { up: up.slice(0, 5), down: down.slice(0, 5) };
}

function matchJobs(profilePct) {
  // 从严考核：样本不足时匹配度打折，轻易不给高匹配（避免一两次考核就虚高）
  const examCount = state.exams || 0;
  const strict = examCount < 3 ? 0.7 : examCount < 5 ? 0.85 : 1;
  const scores = JOBS.map((j) => {
    let num = 0, den = 0;
    for (const [ab, w] of Object.entries(j.weight)) {
      num += (profilePct[ab] ?? 0) * w;
      den += w * 100;
    }
    const raw = Math.round((num / Math.max(den, 1)) * 100);
    return { job: j, score: Math.round(raw * strict) };
  }).sort((a, b) => b.score - a.score);
  return scores.map((s, i) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:rgba(255,255,255,0.03);border-radius:10px;border:1px solid ${i === 0 ? "rgba(47,214,181,0.4)" : "var(--border)"}">
      <div>
        <div style="font-weight:700;color:${i === 0 ? "#00e5ff" : "#fff"}">${i === 0 ? "🏆 " : ""}${s.job.name}</div>
        <div style="font-size:11.5px;color:var(--text-2)">${s.job.desc}</div>
      </div>
      <div style="font-size:23px;font-weight:800;color:${s.score >= 70 ? "#00e5ff" : s.score >= 50 ? "#ffb84d" : "#6b7a90"}">${s.score}%</div>
    </div>`).join("");
}

/* ---------------- 雷达图 ---------------- */
/* 综合能力画像雷达（品红系，表示长期累积） */

function drawRadarProfile(profilePct, canvasId) {
  const canvas = $(canvasId || "#profile-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 62;
  const n = ABILITIES.length;
  ctx.clearRect(0, 0, W, H);
  for (let ring = 1; ring <= 5; ring++) {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
      const r = (R * ring) / 5;
      const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // 数据区域（品红填充 + 品红描边）
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    const v = (profilePct[ABILITIES[i % n]] ?? 0) / 100;
    const x = cx + Math.cos(ang) * R * v, y = cy + Math.sin(ang) * R * v;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(255,61,240,0.18)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,61,240,0.85)";
  ctx.lineWidth = 2;
  ctx.shadowColor = "rgba(255,61,240,0.5)";
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.shadowBlur = 0;
  // 数据点
  for (let i = 0; i < n; i++) {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    const v = (profilePct[ABILITIES[i]] ?? 0) / 100;
    const x = cx + Math.cos(ang) * R * v, y = cy + Math.sin(ang) * R * v;
    ctx.fillStyle = "rgba(255,61,240,1)";
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // 维度名称标签（画在顶点外圈，按角度调整对齐，避免重叠）
  ctx.font = "11px -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif";
  for (let i = 0; i < n; i++) {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    const cosA = Math.cos(ang), sinA = Math.sin(ang);
    const labelR = R + 30;
    const x = cx + cosA * labelR;
    const y = cy + sinA * labelR;
    if (Math.abs(cosA) < 0.35) {
      // 顶部/底部：居中
      ctx.textAlign = "center";
      ctx.textBaseline = sinA < 0 ? "top" : "bottom";
    } else {
      // 左右两侧：靠内侧对齐，避免被裁切
      ctx.textAlign = cosA > 0 ? "left" : "right";
      ctx.textBaseline = "middle";
    }
    ctx.fillStyle = "rgba(210,225,240,0.88)";
    ctx.fillText(ABILITIES[i], x, y);
  }
}

/* 渲染能力维度图例（雷达图下方的文字，上下排放，与图形分开） */

function abilityLegendHtml(profilePct) {
  return `<div class="radar-legend">${ABILITIES.map((ab) => {
    const v = profilePct[ab] ?? 0;
    const color = v >= 80 ? "#00e5ff" : v >= 60 ? "#2fd6b5" : v >= 40 ? "#ffb84d" : "#ff6b6b";
    return `<div class="rl-item">
      <span class="rl-dot" style="background:${color}"></span>
      <span class="rl-name">${esc(ab)}</span>
      <span class="rl-val" style="color:${color}">${v}%</span>
    </div>`;
  }).join("")}</div>`;
}

/* ---------------- 简化 markdown ---------------- */
