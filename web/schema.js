/* web/schema.js — LLM 输出统一 schema（数据驱动校验，纯函数）
 *
 * 数据统一方案 L3：字段规则用配置表表达，validateLLMQuestion / validateObj 统一走 validateBySchema。
 * 规则项：{ field, required?, or?, when?, type?, enum?, whitelist?（函数或数组）, min?, max?, range?, rangeFn?, detail? }
 *  - when:    (obj) => boolean，条件字段（如按题型）
 *  - or:      与另一字段二选一（fillAnswers or correctAnswer）
 *  - type:    "string"|"number"|"boolean"|"array"，支持 "array|number"
 *  - whitelist: 数组或函数（运行时求值，如 ABILITIES）
 *  - detail:  嵌套对象校验 { mode: {子规则} }，按 val.compareMode 匹配
 */
(function () {
  "use strict";

  /* 题目 schema：每题必过（等价并强化原 validateLLMQuestion） */
  const QUESTION_SCHEMA = [
    { field: "question", type: "string", required: true, min: 1 },
    { field: "type", enum: ["choice", "multi_choice", "true_false", "fill_blank", "essay", "practical"] },
    { field: "options", type: "array", min: 2, when: (o) => o.type === "choice" || o.type === "multi_choice" },
    { field: "correctIndex", when: (o) => o.type === "choice" || o.type === "multi_choice" || (o.type === "practical" && o.practical && o.practical.compareMode === "code_choice"),
      rangeFn: (v, o) => { const arr = Array.isArray(v) ? v : [v]; return arr.length > 0 && arr.every((i) => Number(i) >= 0 && Number(i) < (o.options || []).length); } },
    { field: "correctAnswer", type: "string", required: true, when: (o) => o.type === "true_false" },
    { field: "fillAnswers", type: "array", min: 1, or: "correctAnswer", when: (o) => o.type === "fill_blank" },
    { field: "answer", type: "string", required: true, when: (o) => o.type === "essay" },
    { field: "practical", when: (o) => o.type === "practical", detail: {
        code_choice: {
          options: { type: "array", min: 2, required: true },
          correctIndex: { rangeFn: (v, o) => { const arr = Array.isArray(v) ? v : [v]; return arr.length > 0 && arr.every((i) => Number(i) >= 0 && Number(i) < (o.options || []).length); } },
          code: { type: "string", or: "codeBlocks", when: (p) => p.compareMode === "code_choice" },
          codeBlocks: { type: "array" },
        },
        llm_code: { referenceAnswer: true },
        code_fill: { code: { type: "string", required: true }, missingLines: { type: "array", required: true }, expectedOutput: { type: "string", required: true }, hint: { type: "string" } },
      } },
    // 数据统一方案 P3 新增强校验：difficulty 范围 / explanation 长度
    { field: "difficulty", type: "number", range: [1, 5] },
    { field: "explanation", type: "string", max: 200 },
    { field: "dimension", enum: ["theory", "practical", "interview"] },
    // 白名单含「未分类」：normalizeLLMQuestion 会把名单外的 ability 兜底为「未分类」，是合法值
    { field: "ability", whitelist: () => (typeof ABILITIES !== "undefined" ? [...ABILITIES, "未分类"] : ["未分类"]) },
  ];

  /* 对象模式 schema（判分/组卷/面试/job 出题） */
  const OBJECT_SCHEMAS = {
    "grade":          [{ field: "score", type: "number", required: true, range: [0, 100] }],
    "grade-fill":     [{ field: "correct", type: "boolean", required: true }],
    "pick":           [{ field: "picks", type: "array", required: true }],
    "job":            [{ field: "jobName", type: "string", required: true }, { field: "questions", type: "array", required: true, min: 1 }],
    "interview-ask":  [{ field: "question", type: "string", required: true, min: 1 }],
    "interview-judge":[{ field: "judged", enum: ["weak", "ok"] }],
    "interview-score":[ { field: "totalScore", type: "number", range: [0, 100] }, { field: "dimensions", type: "array" }],
  };

  function _isEmpty(v) { return v === undefined || v === null || v === ""; }

  /* 遍历 schema 校验，返回错误信息或 null */
  function validateBySchema(obj, schema) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return "输出不是对象";
    for (const rule of schema || []) {
      if (rule.when && !rule.when(obj)) continue;
      const val = obj[rule.field];
      if (rule.required && _isEmpty(val)) return "缺少字段 " + rule.field;
      if (rule.or && _isEmpty(val) && _isEmpty(obj[rule.or])) return "缺少字段 " + rule.field + " 或 " + rule.or;
      if (_isEmpty(val)) continue;
      if (rule.type) {
        const types = rule.type.split("|");
        const okT = types.some((t) => t === "array" ? Array.isArray(val) : typeof val === t);
        if (!okT) return "字段 " + rule.field + " 类型错误";
      }
      if (rule.enum && !rule.enum.includes(val)) return "字段 " + rule.field + " 值不在允许范围";
      if (rule.whitelist) {
        const wl = typeof rule.whitelist === "function" ? rule.whitelist() : rule.whitelist;
        if (Array.isArray(wl) && !wl.includes(val)) return "字段 " + rule.field + " 不在白名单";
      }
      if (Array.isArray(val)) {
        if (rule.min && val.length < rule.min) return "字段 " + rule.field + " 数量不足";
      } else if (typeof val === "string") {
        if (rule.min && val.length < rule.min) return "字段 " + rule.field + " 过短";
        if (rule.max && val.length > rule.max) return "字段 " + rule.field + " 过长";
      } else if (typeof val === "number") {
        if (rule.range && (val < rule.range[0] || val > rule.range[1])) return "字段 " + rule.field + " 超出范围";
      }
      if (rule.rangeFn && !rule.rangeFn(val, obj)) return "字段 " + rule.field + " 校验失败";
      if (rule.detail && val && typeof val === "object" && !Array.isArray(val)) {
        const mode = val.compareMode;
        const sub = (mode && rule.detail[mode]) ? rule.detail[mode] : null;
        if (sub) {
          const subSchema = Object.keys(sub).map((k) => {
            const r = sub[k];
            if (r === true) return { field: k, required: true };
            if (r && typeof r === "object") return { field: k, ...r };
            return { field: k, required: !!r };
          });
          const subErr = validateBySchema(val, subSchema);
          if (subErr) return subErr;
        }
      }
    }
    return null;
  }

  const API = { QUESTION_SCHEMA, OBJECT_SCHEMAS, validateBySchema };
  if (typeof window !== "undefined") window.DataSchema = API;
  if (typeof globalThis !== "undefined") globalThis.DataSchema = API;
})();
