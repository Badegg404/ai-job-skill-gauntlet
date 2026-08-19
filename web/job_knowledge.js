/* ===== AI 岗位面试知识库（加载器） =====
 * 数据本体在 job_knowledge.json —— 一个可长期维护的数据库。
 * 维护方式见 docs/岗位知识库维护说明.md
 * 每个岗位字段：id/name/category/summary/duties/skills/dimensions/
 *              knowledgePoints/sampleQuestions/followUpHints/scoring/realQuestions
 */
"use strict";

let JOB_KNOWLEDGE = [];   // 运行时从 job_knowledge.json 加载

/* 从 JSON 数据库加载岗位知识库；返回加载到的岗位数（0 表示加载失败） */
async function loadJobKnowledge() {
  try {
    const res = await fetch("./job_knowledge.json", { cache: "no-store" });
    if (res.ok) {
      const db = await res.json();
      if (db && Array.isArray(db.jobs) && db.jobs.length) {
        JOB_KNOWLEDGE = db.jobs;
        return JOB_KNOWLEDGE.length;
      }
    }
  } catch (e) { /* ignore */ }
  return 0;
}

/* 通用面试官追问技巧（仿真严格性） */
const INTERVIEWER_TACTICS = [
  "候选人答完先复述其要点，再追问「为什么这样设计」而非「是什么」",
  "遇到背结论式的回答，追问一个反例或边界情况",
  "遇到模糊回答，要求用具体数字/场景落地",
  "遇到犹豫，适当施压但保持专业，不咄咄逼人",
  "每个维度结束时给一句中性反馈（如「了解了」），不提前透露评价",
  "追问候选人的真实项目经历，避免纸上谈兵",
  "优先追问「生产环境/线上」的实际问题：并发、故障排查、性能瓶颈、成本、可观测性",
  "把候选人拉回真实场景：『如果现在线上出这个问题，你会怎么定位和处理？』",
];
