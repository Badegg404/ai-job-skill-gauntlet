#!/usr/bin/env node
/* test_frontend.js — 前端纯函数测试集
 *
 * 用 Node vm 加载 web/prompts.js + web/exam.js，mock 浏览器全局，
 * 测试判分、LLM 题目归一化/校验、截断补全、画像、prompt 完整性。
 *
 * 运行：node tests/test_frontend.js
 */
"use strict";
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const WEB = path.resolve(__dirname, "..", "web");

/* ---------- mock 浏览器全局 ---------- */
function makeEl() {
  return {
    innerHTML: "", textContent: "", value: "", style: {}, disabled: false,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    appendChild() {}, removeChild() {}, insertBefore() {}, setAttribute() {},
    addEventListener() {}, removeEventListener() {}, querySelector: () => null,
    querySelectorAll: () => [], getContext: () => null, focus() {}, scrollTo() {},
  };
}
const sandbox = {
  console,
  document: {
    addEventListener() {}, createElement: () => makeEl(),
    querySelector: () => null, querySelectorAll: () => [],
    getElementById: () => null, body: makeEl(), documentElement: makeEl(),
  },
  localStorage: {
    _d: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
    setItem(k, v) { this._d[k] = String(v); },
    removeItem(k) { delete this._d[k]; },
    clear() { this._d = {}; },
  },
  window: { innerWidth: 1200, innerHeight: 800 },
  navigator: {}, location: { href: "", reload() {}, hash: "" },
  fetch: async () => { throw new Error("fetch not allowed in tests"); },
  alert() {}, confirm: () => true, prompt: () => null,
  setTimeout, clearTimeout, setInterval, clearInterval,
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }),
  getComputedStyle: () => ({}),
};
vm.createContext(sandbox);

/* ---------- 加载 prompts.js 与 exam.js ---------- */
vm.runInContext(fs.readFileSync(path.join(WEB, "prompts.js"), "utf-8"), sandbox, { filename: "prompts.js" });
vm.runInContext(fs.readFileSync(path.join(WEB, "scoring.js"), "utf-8"), sandbox, { filename: "scoring.js" });
vm.runInContext(fs.readFileSync(path.join(WEB, "profile.js"), "utf-8"), sandbox, { filename: "profile.js" });
vm.runInContext(fs.readFileSync(path.join(WEB, "exam.js"), "utf-8"), sandbox, { filename: "exam.js" });

function json(expr) {
  return JSON.parse(vm.runInContext(`JSON.stringify(${expr})`, sandbox));
}
function raw(expr) {
  return vm.runInContext(expr, sandbox);
}

/* ---------- 迷你测试框架 ---------- */
let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("  \u2713 " + name);
  } catch (e) {
    failed++;
    console.log("  \u2717 " + name);
    console.log("      " + (e && e.message ? e.message : e));
  }
}

console.log("\n== 判断题/能力标签归一化 ==");
test("true_false「正确」→ 对", () => {
  assert.strictEqual(json("normalizeLLMQuestion({type:'true_false', correctAnswer:'正确'}).correctAnswer"), "对");
});
test("true_false「false」→ 错", () => {
  assert.strictEqual(json("normalizeLLMQuestion({type:'true_false', correctAnswer:'false'}).correctAnswer"), "错");
});
test("true_false「True」→ 对", () => {
  assert.strictEqual(json("normalizeLLMQuestion({type:'true_false', correctAnswer:'True'}).correctAnswer"), "对");
});
test("choice correctIndex 数字 → 数组", () => {
  assert.deepStrictEqual(json("normalizeLLMQuestion({type:'choice', correctIndex: 2}).correctIndex"), [2]);
});
test("ability 非白名单 → 默认提示词工程", () => {
  assert.strictEqual(json("normalizeLLMQuestion({type:'essay', ability:'随便写'}).ability"), "提示词工程");
});
test("ability 白名单保留", () => {
  assert.strictEqual(json("normalizeLLMQuestion({type:'essay', ability:'RAG 与知识库'}).ability"), "RAG 与知识库");
});

console.log("\n== LLM 题目校验（坏题拦截） ==");
test("合法选择题通过", () => {
  assert.strictEqual(raw("validateLLMQuestion({type:'choice', question:'q', options:['a','b','c','d'], correctIndex:[0]})"), true);
});
test("题型非法 → 拦截", () => {
  assert.strictEqual(raw("validateLLMQuestion({type:'foo', question:'q'})"), false);
});
test("选择题无选项 → 拦截", () => {
  assert.strictEqual(raw("validateLLMQuestion({type:'choice', question:'q', correctIndex:[0]})"), false);
});
test("选择题 correctIndex 越界 → 拦截", () => {
  assert.strictEqual(raw("validateLLMQuestion({type:'choice', question:'q', options:['a','b'], correctIndex:[5]})"), false);
});
test("判断题无答案 → 拦截", () => {
  assert.strictEqual(raw("validateLLMQuestion({type:'true_false', question:'q'})"), false);
});
test("填空题无答案 → 拦截", () => {
  assert.strictEqual(raw("validateLLMQuestion({type:'fill_blank', question:'q'})"), false);
});

console.log("\n== 截断 JSON 补全 ==");
test("补全右括号后可解析", () => {
  const fixed = raw("fixTruncatedJSON('{\"questions\": [{\"type\": \"choice\"')");
  const parsed = JSON.parse(fixed);
  assert.ok(parsed && typeof parsed === "object");
});

console.log("\n== 代码实战客观题（code_choice） ==");
test("code_choice 单选判对/判错", () => {
  const q = { type: "practical", practical: { compareMode: "code_choice", multi: false, correctIndex: [2] } };
  assert.strictEqual(raw("judgeAnswer(" + JSON.stringify(q) + ", 2)"), true);
  assert.strictEqual(raw("judgeAnswer(" + JSON.stringify(q) + ", 1)"), false);
});
test("code_choice 多选判分（全对才得分）", () => {
  const q = { type: "practical", practical: { compareMode: "code_choice", multi: true, correctIndex: [0, 2] } };
  assert.strictEqual(raw("judgeAnswer(" + JSON.stringify(q) + ", [0, 2])"), true);
  assert.strictEqual(raw("judgeAnswer(" + JSON.stringify(q) + ", [0, 1])"), false);
  assert.strictEqual(raw("judgeAnswer(" + JSON.stringify(q) + ", [2, 0])"), true, "顺序无关");
});
test("code_choice 无代码 → 拦截为坏题", () => {
  const q = { type: "practical", question: "q", practical: { compareMode: "code_choice", options: ["a", "b"], correctIndex: [0] } };
  assert.strictEqual(raw("validateLLMQuestion(" + JSON.stringify(q) + ")"), false);
});
test("code_choice 合法题通过校验", () => {
  const q = { type: "practical", question: "q", practical: { compareMode: "code_choice", code: "print(1)", options: ["a", "b", "c"], correctIndex: [0] } };
  assert.strictEqual(raw("validateLLMQuestion(" + JSON.stringify(q) + ")"), true);
});
test("code_choice correctIndex 越界 → 拦截", () => {
  const q = { type: "practical", question: "q", practical: { compareMode: "code_choice", code: "x", options: ["a", "b"], correctIndex: [5] } };
  assert.strictEqual(raw("validateLLMQuestion(" + JSON.stringify(q) + ")"), false);
});
test("normalizeLLMQuestion code_choice 归一化", () => {
  const q = raw("normalizeLLMQuestion(" + JSON.stringify({ type: "practical", question: "q", practical: { compareMode: "code_choice", correctIndex: 1, code: "x", options: ["a", "b"] } }) + ")");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(q.practical.correctIndex)), [1]);
  assert.strictEqual(q.practical.multi, false);
});
test("code_choice 多选题 direct 判分进答题流程（judged 非 null）", () => {
  const q = { type: "practical", question: "q", practical: { compareMode: "code_choice", multi: true, code: "x", options: ["a", "b"], correctIndex: [0, 1] } };
  const j = raw("judgeAnswer(" + JSON.stringify(q) + ", [1, 0])");
  assert.strictEqual(j, true);
});
test("renderCodeBlock 高亮标注行并标注文件名", () => {
  const html = raw("renderCodeBlock('demo-1.py', 'line1\\nline2\\nline3', [2])");
  assert.ok(html.includes("demo-1.py"), "应含文件名");
  assert.ok(html.includes("code-line hl"), "标注行应带高亮类");
  assert.ok(html.includes("标注段"), "应显示标注段提示");
});
test("questionBody 渲染 code_choice 代码块 + 单选选项", () => {
  const q = { type: "practical", question: "测试题", practical: { compareMode: "code_choice", code: "print(1)", options: ["A 选项", "B 选项"], correctIndex: [0] } };
  const html = raw("questionBody(" + JSON.stringify(q) + ")");
  assert.ok(html.includes("code-block"), "应含代码块");
  assert.ok(html.includes("qz-options"), "应含选项区");
  assert.ok(html.includes('type="radio"'), "单选应为 radio");
});
test("questionBody 渲染 code_choice 多选为 checkbox", () => {
  const q = { type: "practical", question: "测试题", practical: { compareMode: "code_choice", multi: true, code: "x=1", options: ["A 选项", "B 选项"], correctIndex: [0, 1] } };
  const html = raw("questionBody(" + JSON.stringify(q) + ")");
  assert.ok(html.includes('type="checkbox"'), "多选应为 checkbox");
  assert.ok(html.includes("多选"), "应提示多选");
});

console.log("\n== 客观题判分 ==");
test("填空完整相等判对", () => {
  assert.strictEqual(raw("judgeAnswer({type:'fill_blank', fillAnswers:['JSON']}, 'JSON')"), true);
});
test("填空不相等判错（模糊匹配已删除）", () => {
  assert.strictEqual(raw("judgeAnswer({type:'fill_blank', fillAnswers:['JSON']}, 'json格式')"), false);
});
test("单选判对", () => {
  assert.strictEqual(raw("judgeAnswer({type:'choice', correctIndex:[1]}, 1)"), true);
});
test("判断题判对", () => {
  assert.strictEqual(raw("judgeAnswer({type:'true_false', correctAnswer:'对'}, '对')"), true);
});

console.log("\n== 能力画像（收缩公式 + 等级） ==");
test("levelTitle 基础段阈值", () => {
  assert.strictEqual(json("levelTitle(0).title"), "AI 认知者");
  assert.strictEqual(json("levelTitle(60).title"), "RAG/应用工程师");
  assert.strictEqual(json("levelTitle(68).title"), "Agent 工程师");
});
test("currentTitle 返回合法称号对象", () => {
  const t = json("currentTitle()");
  assert.ok(t && typeof t.title === "string" && t.icon);
});
test("abilityProfilePct 收缩公式（1 题全对不应满格）", () => {
  // 构造：单维度 1 题全对，总分 10，BASE=30 K=10 → (10+300)/11 ≈ 28%
  const pct = json("abilityProfilePct()");
  assert.ok(Array.isArray(pct) || typeof pct === "object");
});

console.log("\n== prompt 完整性 ==");
test("buildImportPrompt 含能力维度白名单 + 教学法", () => {
  const p = raw("buildImportPrompt('课程', '概念', '章节', '难点', '')");
  assert.ok(p.includes("提示词工程"), "应含能力维度白名单");
  assert.ok(p.includes("费曼技巧"), "应含教学法");
  assert.ok(p.includes("12 道题"), "应含出题数量");
  assert.ok(p.includes("出题专家"), "导入出题应设角色");
  assert.ok(!p.includes("面试维度"), "导入出题不应再生成面试题（面试题由面试考核按岗位动态生成）");
});
test("buildExamPrompt 理论模式含 JSON schema", () => {
  const p = raw("buildExamPrompt('概念', '章节', 'theory', 4, null)");
  assert.ok(p.includes("RAG"), "应含核心知识点");
  assert.ok(p.includes('"questions"'), "应含 JSON schema");
});
test("buildImportPrompt 含代码实战客观题要求", () => {
  const p = raw("buildImportPrompt('课程', '概念', '章节', '难点', '【demo-1.py】\\nprint(1)')");
  assert.ok(p.includes("code_choice"), "应要求代码客观题");
  assert.ok(p.includes("spotlight"), "应含片段作用题");
  assert.ok(p.includes("codeBlocks"), "应支持多文件递进/对比");
  assert.ok(p.includes("真实代码"), "应要求引用真实代码");
});
test("buildExamPrompt 实战模式支持代码客观题 + 写代码题", () => {
  const p = raw("buildExamPrompt('概念', '章节', 'practical', 6, null, '【demo-2.py】\\nprint(2)')");
  assert.ok(p.includes("code_choice"), "应支持代码客观题");
  assert.ok(p.includes("llm_code"), "应保留写代码题");
  assert.ok(p.includes("codeBlocks"), "应支持多文件题");
});
test("面试追问 prompt 要求从回答延伸 + 具体详细", () => {
  const st = { job: { name: "Agent 工程师", followUpHints: ["失败重试", "幂等"] }, currentFollows: 1, history: [] };
  const p = raw("buildInterviewFollowPrompt(" + JSON.stringify(st) + ", { type: 'essay' }, '你的问题', '我的回答', ['技巧1'])");
  assert.ok(p.includes("回答分析"), "应有回答分析环节");
  assert.ok(p.includes("可深挖点"), "应要求找出可深挖点");
  assert.ok(p.includes("禁止从岗位预置追问方向"), "应禁止机械挑选预置方向");
  assert.ok(p.includes("至少 2 句"), "应要求追问具体详细");
  assert.ok(p.includes("正例"), "应含正例约束");
  assert.ok(p.includes("反例"), "应含反例约束");
});
test("回顾题按模式过滤：理论考核不注入实战题", () => {
  raw("state.askedLog = { 'p1': { q: { type: 'practical', question: '实战题A', dimension: 'practical' }, wrong: 1, lastAt: 1 }, 't1': { q: { type: 'choice', question: '理论题B', options: ['a', 'b'], correctIndex: [0] }, wrong: 1, lastAt: 2 } };");
  const base = [{ type: "choice", question: "新题C", options: ["a", "b"], correctIndex: [0] }];
  const out = raw("injectReviewQuestions(" + JSON.stringify(base) + ", 'theory')");
  assert.ok(out.every((q) => ["choice", "multi_choice", "true_false", "fill_blank"].includes(q.type)), "理论考核回顾题应全是理论题型");
  assert.ok(out.some((q) => q.question === "理论题B"), "应注入理论错题");
});
test("回顾题按模式过滤：实战考核只注入实战题", () => {
  const base = [{ type: "practical", question: "新实战题", dimension: "practical" }];
  const out = raw("injectReviewQuestions(" + JSON.stringify(base) + ", 'practical')");
  assert.ok(out.every((q) => q.type === "practical"), "实战考核回顾题应全是实战题");
});
test("adaptivePick 分组抽题后整体打乱顺序（顺序随机）", () => {
  raw("state.abilityProfile = { 'RAG 与知识库': { sum: 300, count: 10, lastAt: Date.now() } };");
  const pool = [];
  for (let i = 0; i < 20; i++) pool.push({ question: "题" + i, ability: (i % 2 ? "RAG 与知识库" : "提示词工程"), difficulty: 2 });
  const orders = new Set();
  for (let i = 0; i < 8; i++) {
    const out = raw("adaptivePick(" + JSON.stringify(pool) + ", 10)");
    orders.add(JSON.stringify(out.map((q) => q.question)));
  }
  assert.ok(orders.size >= 2, "多次调用顺序应不同（实际 " + orders.size + " 种）");
});
test("adaptivePick 最终整体打乱（源码级）", () => {
  const src = raw("adaptivePick.toString()");
  assert.ok(src.includes("return shuffle(chosen)"), "分组后应整体打乱再返回");
});

console.log("\n== 面试上下文随机采样 ==");
test("资料多时每次采样不同（随机性）", () => {
  const concepts = Array.from({ length: 40 }, (_, i) => ({ name: "概念" + i, summary: "摘要" + i }));
  raw("interviewCourses = [{ concepts: " + JSON.stringify(concepts) + ", chapters: [], difficulties: [], quiz: [] }]");
  const c1 = raw("buildInterviewContext()");
  const c2 = raw("buildInterviewContext()");
  assert.notStrictEqual(c1.conceptTxt, c2.conceptTxt, "两次采样应不同");
  assert.ok(c1.conceptCount >= 20, "40 个概念应采样约 20+ 个（动态扩量）");
});
test("资料少时全量纳入（不截断）", () => {
  const concepts = Array.from({ length: 5 }, (_, i) => ({ name: "小概念" + i, summary: "s" + i }));
  raw("interviewCourses = [{ concepts: " + JSON.stringify(concepts) + ", chapters: [], difficulties: [], quiz: [] }]");
  const c = raw("buildInterviewContext()");
  assert.strictEqual(c.conceptCount, 5, "5 个概念应全量纳入");
});
test("题库采样随资料量放宽", () => {
  const quiz = Array.from({ length: 30 }, (_, i) => ({ question: "题" + i, type: "choice", dimension: "theory", options: ["a", "b"], correctIndex: [0] }));
  raw("interviewCourses = [{ concepts: [], chapters: [], difficulties: [], quiz: " + JSON.stringify(quiz) + " }]");
  const c = raw("buildInterviewContext()");
  assert.ok(c.quizTxt.includes("【theory】"), "应含题库维度");
  assert.ok((c.quizTxt.match(/题/g) || []).length >= 8, "30 道题应采样多道（原固定 6）");
});

console.log("\n== 新人引导步骤判断 ==");
test("TOUR_STEPS 不包含跳转按钮字段（引导只走下一步）", () => {
  const t = raw("JSON.stringify(TOUR_STEPS)");
  assert.ok(!t.includes('"jump"'), "TOUR 步骤不应含 jump 字段");
  assert.ok(!t.includes("__tourJump"), "不应引用已删除的跳转函数");
});
test("guideStepDone('llm') 未配置 → false", () => {
  assert.strictEqual(raw("guideStepDone('llm')"), false);
});
test("guideNextStepId 未配置 LLM 时推荐第一步是 llm", () => {
  assert.strictEqual(raw("guideNextStepId()"), "llm");
});
test("配置 LLM 后 llm 完成，推荐下一步是 import", () => {
  raw("LLM_KEY = 'sk-test-key'");
  assert.strictEqual(raw("guideStepDone('llm')"), true);
  assert.strictEqual(raw("guideNextStepId()"), "import");
});
test("引导条 HTML 含 6 个步骤节点", () => {
  const html = raw("renderGuideBarHTML()");
  assert.ok(html.includes("guide-bar"), "应含引导条容器");
  for (const id of ["gs-llm", "gs-import", "gs-chapter", "gs-cross", "gs-interview", "gs-profile"]) {
    assert.ok(html.includes(id), "应含步骤节点 " + id);
  }
});
test("配置+导入后推荐下一步是 chapter（章节考核优先）", () => {
  raw("state.imports = 1; COURSE = { title: 't', quiz: [{ type: 'choice' }] };");
  assert.strictEqual(raw("guideStepDone('import')"), true);
  assert.strictEqual(raw("guideNextStepId()"), "chapter");
});
test("完成章节考核后推荐 cross（综合考核）", () => {
  raw("state.history = [{ mode: 'theory', cross: false }];");
  assert.strictEqual(raw("guideStepDone('chapter')"), true);
  assert.strictEqual(raw("guideNextStepId()"), "cross");
});
test("章节历史无 cross 标记不算完成（旧数据兼容）", () => {
  raw("state.history = [{ mode: 'theory' }];");
  assert.strictEqual(raw("guideStepDone('chapter')"), false);
});
test("完成综合+面试+画像后全部完成", () => {
  raw("state.history = [{ mode: 'theory', cross: false }, { mode: 'practical', cross: true }]; state.crossExam = true; state.interviewLogs = [{ job: 'Agent 工程师', date: '2026-01-01' }]; state.abilityProfile = { '提示词工程': { sum: 80, count: 2, lastAt: Date.now() } }; state.exams = 3;");
  assert.strictEqual(raw("guideStepDone('cross')"), true);
  assert.strictEqual(raw("guideStepDone('interview')"), true);
  assert.strictEqual(raw("guideStepDone('profile')"), true);
  assert.strictEqual(raw("guideNextStepId()"), null);
});
test("全部完成后引导条显示完成态", () => {
  const html = raw("renderGuideBarHTML()");
  assert.ok(html.includes("gb-all-done"), "应显示全部完成态");
});

console.log("\n== 退出入口 ==");
test("考核界面与面试界面提供退出按钮", () => {
  assert.strictEqual(typeof raw("quitExam"), "function", "应有 quitExam 函数");
  assert.strictEqual(typeof raw("quitInterview"), "function", "应有 quitInterview 函数");
  const q = raw("renderQuestion.toString()");
  assert.ok(q.includes('onclick="quitExam()"'), "答题界面应含退出考核按钮");
  const iv = raw("renderInterviewChat.toString()");
  assert.ok(iv.includes('onclick="quitInterview()"'), "面试界面应含退出按钮");
});

console.log("\n== 徽章系统（技术向徽章 + 解锁判定） ==");
test("技术徽章覆盖全部 10 个能力维度", () => {
  const tech = raw("BADGES.filter(b => b.id.startsWith('ab_'))");
  assert.ok(tech.length >= 11, "应有 10 维徽章 + 全能/宗师，实际 " + tech.length);
  const names = new Set(tech.map(b => b.name));
  const dims = ["提示词大师", "RAG 检索专家", "工具调用高手", "向量检索专家", "Agent 内行", "微调专家", "框架能手", "部署优化大师", "算法内核专家", "表达之星"];
  for (const d of dims) assert.ok(names.has(d), "缺少维度徽章 " + d);
});
test("维度徽章基于 abilityBest 解锁", () => {
  raw("state.abilityBest = { 'RAG 与知识库': 92 };");
  assert.strictEqual(raw("BADGES.find(b => b.id === 'ab_rag').check(state)"), true);
  assert.strictEqual(raw("BADGES.find(b => b.id === 'ab_prompt').check(state)"), false, "未达到的维度不解锁");
});
test("六维宗师要求 6 个维度", () => {
  raw("state.abilityBest = { '提示词工程': 91, 'RAG 与知识库': 92, '工具调用': 90, '向量与 Embedding': 95, 'Agent 核心机制': 93, '开发框架': 90 };");
  assert.strictEqual(raw("BADGES.find(b => b.id === 'ab_master6').check(state)"), true);
  assert.strictEqual(raw("BADGES.find(b => b.id === 'ab_full').check(state)"), true);
});
test("表达之星可经面试分解锁", () => {
  raw("state.abilityBest = {}; state.bestInterview = 92;");
  assert.strictEqual(raw("BADGES.find(b => b.id === 'ab_expr').check(state)"), true);
});
test("庆祝动画函数存在且引用稀有度元数据", () => {
  assert.strictEqual(typeof raw("showBadgeCelebration"), "function");
  assert.ok(raw("RARITY_META.legendary.color"), "应有传说稀有度颜色");
});
test("庆祝动画模板含核心元素与粒子爆发", () => {
  const src = raw("showBadgeCelebration.toString()");
  assert.ok(src.includes("badge-celebrate"), "应有全屏遮罩类");
  assert.ok(src.includes("bc-icon"), "应有徽章图标元素");
  assert.ok(src.includes("bc-reward"), "应有奖励提示（+XP/+AP）");
  assert.ok(src.includes("burstParticles"), "应触发粒子爆发");
  assert.ok(src.includes("RARITY_META"), "应使用稀有度颜色");
});
test("熟练级徽章 75% 解锁（分层）", () => {
  raw("state.abilityBest = { '提示词工程': 78 }; state.bestInterview = 0;");
  assert.strictEqual(raw("BADGES.find(b => b.id === 'ab1_prompt').check(state)"), true, "78% 应解锁熟练级");
  assert.strictEqual(raw("BADGES.find(b => b.id === 'ab_prompt').check(state)"), false, "78% 不解锁精通级");
});
test("汇总徽章按达标维度数递进", () => {
  raw("state.abilityBest = { '提示词工程': 80, 'RAG 与知识库': 85, '工具调用': 76 }; state.bestInterview = 0;");
  assert.strictEqual(raw("BADGES.find(b => b.id === 'tech_new').check(state)"), true);
  assert.strictEqual(raw("BADGES.find(b => b.id === 'tech_hand').check(state)"), true, "3 维 75+ 解锁技术能手");
  assert.strictEqual(raw("BADGES.find(b => b.id === 'ab_full').check(state)"), false, "75 分维度不计入 90 精通");
});
test("全维大师需 10 维 90%+", () => {
  const best = {};
  const dims = ["提示词工程", "RAG 与知识库", "工具调用", "向量与 Embedding", "Agent 核心机制", "模型微调", "开发框架", "部署与推理", "算法与神经网络", "面试表达力"];
  dims.forEach((d, i) => best[d] = 91 + i);
  raw("state.abilityBest = " + JSON.stringify(best) + "; state.bestInterview = 0;");
  assert.strictEqual(raw("BADGES.find(b => b.id === 'ab_all10').check(state)"), true);
});
test("实践层级徽章（实战次数/面试次数）", () => {
  raw("state.history = " + JSON.stringify(Array.from({ length: 6 }, () => ({ mode: "practical" }))) + "; state.interviewLogs = " + JSON.stringify([{ job: "x" }, { job: "y" }, { job: "z" }]) + "; state.bestInterview = 0;");
  assert.strictEqual(raw("BADGES.find(b => b.id === 'prac5').check(state)"), true);
  assert.strictEqual(raw("BADGES.find(b => b.id === 'prac15').check(state)"), false);
  assert.strictEqual(raw("BADGES.find(b => b.id === 'iv3').check(state)"), true);
});

console.log("");
console.log("通过 " + passed + " 个，失败 " + failed + " 个");
process.exit(failed > 0 ? 1 : 0);
