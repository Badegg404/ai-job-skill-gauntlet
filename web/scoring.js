/* scoring.js — 判分与 LLM 输出校验（纯函数，无 DOM 依赖）
 * 覆盖：客观题判分、判断题归一化、坏题校验、截断 JSON 补全 */
"use strict";

function inferDimension(q) {
  if (q.type === "practical") return "practical";
  if (q.interview || q.type === "essay") return "interview";
  return "theory";
}

/* ===== 主渲染入口 ===== */

function extractLLMQuestions(data) {
  const content = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content : "";
  if (!content) return [];
  let parsed = null;
  try { parsed = JSON.parse(content); } catch (e) { /* fallthrough */ }
  if (!parsed) {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) {
      try { parsed = JSON.parse(m[0]); } catch (e) {
        // JSON 可能被 max_tokens 截断，尝试补全右括号/引号
        const fixed = fixTruncatedJSON(m[0]);
        if (fixed) { try { parsed = JSON.parse(fixed); } catch (e2) {} }
      }
    }
  }
  const qs = (parsed && parsed.questions) ? parsed.questions : [];
  // 逐题：归一化 → 校验，坏题直接丢弃（程序兜底 LLM 不可靠输出）
  return qs
    .filter((q) => q && q.question)
    .map(normalizeLLMQuestion)
    .filter(validateLLMQuestion);
}

/* 补全被 max_tokens 截断的 JSON：尝试补右括号与引号 */

function fixTruncatedJSON(text) {
  let s = text.trim();
  const stack = [];   // 未闭合的括号栈（记录类型，逆序补正确闭合符）
  let inStr = false, prev = "";
  for (const ch of s) {
    if (ch === '"' && prev !== "\\") inStr = !inStr;
    if (!inStr) {
      if (ch === "{" || ch === "[") stack.push(ch);
      else if (ch === "}" || ch === "]") { if (stack.length) stack.pop(); }
    }
    prev = ch;
  }
  let changed = false;
  while (stack.length) {
    s += stack.pop() === "{" ? "}" : "]";
    changed = true;
  }
  // 补未闭合字符串引号
  if (inStr) { s += '"'; changed = true; }
  return changed ? s : null;
}

/* 校验 LLM 题目字段完整性：任何关键字段缺失/越界都判为坏题（程序兜底） */

function validateLLMQuestion(q) {
  if (!q || !q.question) return false;
  const t = q.type;
  const validTypes = ["choice", "multi_choice", "true_false", "fill_blank", "essay", "practical"];
  if (!validTypes.includes(t)) return false;
  // 选择题：必须 >=2 选项，且 correctIndex 在范围内
  if (t === "choice" || t === "multi_choice") {
    if (!Array.isArray(q.options) || q.options.length < 2) return false;
    const ci = Array.isArray(q.correctIndex) ? q.correctIndex : [q.correctIndex];
    if (!ci.length) return false;
    if (ci.some((i) => Number(i) < 0 || Number(i) >= q.options.length)) return false;
  }
  // 判断题：必须有 correctAnswer
  if (t === "true_false" && !q.correctAnswer) return false;
  // 填空题：必须有答案
  if (t === "fill_blank" && !q.correctAnswer && !(Array.isArray(q.fillAnswers) && q.fillAnswers.length)) return false;
  // 问答题/实战题：必须有参考答案
  if (t === "essay" && !q.answer) return false;
  if (t === "practical") {
    const p = q.practical || {};
    if (p.compareMode === "code_choice") {
      // 代码客观题：必须含选项 + 代码（单文件 code / 多文件 codeBlocks）
      if (!Array.isArray(p.options) || p.options.length < 2) return false;
      const ci = Array.isArray(p.correctIndex) ? p.correctIndex : [p.correctIndex];
      if (!ci.length || ci.some((i) => Number(i) < 0 || Number(i) >= p.options.length)) return false;
      if (!p.code && !(Array.isArray(p.codeBlocks) && p.codeBlocks.length)) return false;
    } else if (!q.answer && !p.referenceAnswer) return false;
  }
  return true;
}

/* 归一化 LLM 生成的题目：correctIndex 转数组、ability 白名单、字段补全。
   修复 B1（数字 correctIndex 判分恒错 + TypeError 卡死）与 S4（能力维度任意值注入）。 */

function normalizeLLMQuestion(q) {
  if (!q) return q;
  // choice 题的 correctIndex 统一为数组（LLM 可能返回数字 0-3）
  if (q.type === "choice") {
    if (!Array.isArray(q.correctIndex)) {
      const idx = parseInt(q.correctIndex, 10);
      q.correctIndex = Number.isFinite(idx) ? [idx] : [0];
    }
  }
  // multi_choice 同理
  if (q.type === "multi_choice" && !Array.isArray(q.correctIndex)) {
    q.correctIndex = [parseInt(q.correctIndex, 10) || 0];
  }
  // true_false 题的 correctAnswer 归一化为「对」/「错」（LLM 可能返回 正确/错误/True/False 等）
  if (q.type === "true_false") {
    const c = String(q.correctAnswer || "").trim().toLowerCase();
    if (/^(正确|对|true|t|是|yes|y|√|✓)$/.test(c)) q.correctAnswer = "对";
    else if (/^(错误|错|false|f|否|no|n|×|✗)$/.test(c)) q.correctAnswer = "错";
    else q.correctAnswer = "对";
  }
  // practical 代码客观题归一化
  if (q.type === "practical") {
    const p = q.practical || {};
    if (p.compareMode === "code_choice") {
      if (!Array.isArray(p.correctIndex)) p.correctIndex = [parseInt(p.correctIndex, 10) || 0];
      p.multi = !!p.multi;
      if (!p.subtype) p.subtype = "code_choice";
      if (!Array.isArray(p.files)) p.files = [];
      if (Array.isArray(p.highlightLines)) {
        p.highlightLines = p.highlightLines.map(Number).filter((n) => Number.isFinite(n));
      }
      if (!p.options) p.options = [];
    }
  }
  // ability 白名单：非 10 维名单的维度归入「未分类」——D-1 修复：不再全塞进「提示词工程」导致画像系统性失真；
  // 未分类题在计分时仍正常（correctCount/XP），但不会进入能力画像/雷达/岗位匹配（showResult 按白名单过滤）
  if (!ABILITIES.includes(q.ability)) q.ability = "未分类";
  if (!q.dimension) q.dimension = inferDimension(q);
  q.interview = !!q.interview;
  if (q.type === "essay" && !q.followUps) q.followUps = [];
  return q;
}

/* ===== 考核时 LLM 动态出题（题库 + 动态混合） ===== */

function judgeAnswer(q, userAns) {
  if (q.type === "choice") {
    const correct = Array.isArray(q.correctIndex) ? q.correctIndex : [q.correctIndex];
    return +userAns === correct[0];
  }
  if (q.type === "multi_choice") {
    const correctArr = Array.isArray(q.correctIndex) ? q.correctIndex : [q.correctIndex];
    const user = [...(Array.isArray(userAns) ? userAns : [userAns])].sort().join(",");
    const correct = [...correctArr].sort().join(",");
    return user === correct;
  }
  if (q.type === "true_false") return userAns === q.correctAnswer;
  if (q.type === "fill_blank") {
    const ans = String(userAns || "").trim().toLowerCase();
    if (ans.length < 1) return false; // 空答案不判对（单字符答案如「A」「1」也应允许，BUG-8 修复）
    const accepted = (q.fillAnswers || [q.correctAnswer]).map((a) => String(a).trim().toLowerCase());
    // 仅完整相等兜底（语义判断交给 LLM，这里不再做子串模糊匹配）
    return accepted.some((a) => a === ans);
  }
  if (q.type === "essay") return null; // 自评
  if (q.type === "practical") {
    const p = q.practical || {};
    if (p.compareMode === "choice") return +userAns === p.correctIndex;
    if (p.compareMode === "code_choice") {
      if (p.multi) {
        const user = [...(Array.isArray(userAns) ? userAns : [userAns])].sort().join(",");
        const correct = [...(Array.isArray(p.correctIndex) ? p.correctIndex : [p.correctIndex])].sort().join(",");
        return user === correct;
      }
      const correctIdx = Array.isArray(p.correctIndex) ? p.correctIndex[0] : p.correctIndex;
      return +userAns === correctIdx;
    }
    if (p.compareMode === "paste") {
      // 匹配预期模式关键词
      const pat = p.expectedPattern || "";
      const matched = pat.split("|").filter((k) => k && String(userAns || "").includes(k.trim()));
      return matched.length >= 1;
    }
    return null; // self 自评
  }
  return null;
}
