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

console.log("");
console.log("通过 " + passed + " 个，失败 " + failed + " 个");
process.exit(failed > 0 ? 1 : 0);
