/* ============================================================
 * prompts.js — 所有 LLM 提示词统一管理
 *
 * 职责：集中维护「角色设定 / 出题 / 判分 / 面试」的所有 prompt。
 * 原则（贯穿所有 prompt）：
 *   1. 严格：考察真实掌握，拒绝背书；判分不轻易给高分，答错要能暴露知识盲区
 *   2. 输出稳定：所有 LLM 调用都明确 JSON schema，程序据此解析 + 兜底校验
 *   3. 数据正确：输入字段与程序解析严格对应（correctIndex 数组 / ability 白名单等）
 * ============================================================ */

/* ---------- 能力维度白名单（10 维，出题打标签共用） ---------- */
const ABILITY_WHITELIST = "提示词工程|RAG 与知识库|工具调用|向量与 Embedding|Agent 核心机制|模型微调|开发框架|部署与推理|算法与神经网络|面试表达力";

/* ---------- 统一角色设定（system prompt） ---------- */
const SYSTEM = {
  // 出题专家：严格考察真实掌握 + 只输出 JSON（导入出题 / 考核出题共用）
  examiner: "你是资深的 AI 大模型应用开发出题专家，擅长把学习资料转化为能区分「真懂」与「死记硬背」的考核题。严格考察候选人对提示词工程、RAG、Function Calling、Agent、微调、部署推理等的真实掌握程度，拒绝背书式题目，题目要有区分度、能暴露真实知识盲区。只输出符合要求的 JSON，不得输出任何额外文字、注释或 markdown。",
  // 代码判分
  codeGrader: "你是严格的代码评审，客观评分，判断代码是否正确、可运行、思路是否合理，不轻易给高分。只输出 JSON。",
  // 代码阅读判分
  readingGrader: "你是严格的 AI 工程师，客观评分，判断回答是否准确抓住代码功能与关键步骤，不轻易给高分。只输出 JSON。",
  // 填空/语义判定
  fillJudge: "你是严格的 AI 面试官，客观判定答案语义是否一致，只输出 JSON：{\"correct\": true/false, \"reason\": \"...\"}。",
  // 问答判分
  essayGrader: "你是严格的面试官，客观评分，不轻易给高分，指出亮点与不足。只输出 JSON。",
};

/* ---------- 教学法指引（出题共用） ---------- */
const TEACHING_METHODS = `【出题教学法（务必融入，让题目考察真理解而非死记硬背）】
- 费曼技巧：部分题要求「用最简单的话向一个不懂的人解释」，能去术语化讲清楚才是真懂
- 苏格拉底追问：面试题附层层追问（是什么 → 为什么 → 如果反过来/换场景会怎样）
- 布鲁姆分类：覆盖记忆/理解/应用/分析/评价/创造，避免只考名词背诵
- 主动回忆：填空题挖掉关键步骤/术语，考察能否凭理解补全
- 类比迁移：让考生用生活类比解释抽象机制
- 反例与边界：考察「在什么情况下会失效/不适用」，而非死记标准答案`;

/* ============================================================
 * 出题 prompt
 * ============================================================ */

/* 导入出题（理论部分）：缺省 16 道——与实战拆分两次请求，避免一次超长截断；重复由前端 seenTxt 去重兜底
 * 题型自洽分配：判断 = 填空 = ⌊N/4⌋，选择 = N − 2×⌊N/4⌋（任意 N 都自洽，16 → 8 选择 + 4 判断 + 4 填空） */
function buildImportTheoryPrompt(courseTitle, concepts, chapters, difficulties, badTxt, count) {
  const N = count || 16;               // 本次生成题数（缺省 14）
  const nJudge = Math.floor(N / 4);    // 判断题数 = 填空题数
  const nChoice = N - 2 * nJudge;      // 选择题数（N − 2×⌊N/4⌋）
  return `你是一名资深的 AI 大模型应用开发出题专家，擅长把学习资料转化为能区分「真懂」与「死记硬背」的考核题。

请根据下面的课程内容生成考核题，用于评估学生对 AI/Agent 知识的掌握程度。

【课程】${courseTitle}
【核心概念】
${concepts}
【章节要点】
${chapters}
【难点】
${difficulties}
${badTxt ? `
【被反馈的题目（用户反馈过有问题，禁止生成相同或高度雷同的题）】
${badTxt}` : ""}

${TEACHING_METHODS}

请生成 ${N} 道理论题（${nChoice} 道概念辨析选择 + ${nJudge} 道判断 + ${nJudge} 道填空）——作为理论考核题库，覆盖不同知识点、不要雷同：

一、理论维度（dimension 填 "theory"）—— 考察概念/原理的客观掌握，全为客观题（选择 / 判断 / 填空）：
  ${nChoice} 道概念辨析选择题（4 选项，correctIndex 为 0-3，题干基于核心概念，覆盖不同知识点、不要雷同）
  ${nJudge} 道判断题（true_false，correctAnswer 填 "对" 或 "错"）：题干陈述本身必须语义自洽、可直接判定真伪——题干说法正确就填「对」，说法错误就填「错」，并在 explanation 说明对错原因。出「错」题时，请在题干里写一个「本身错误」的技术说法（如把概念/机制说反），禁止用「不符合课程案例 / 与 demo 不同」这类题外理由判定对错（判断题只考陈述本身的真伪，不考是否与某案例一致）。
  ${nJudge} 道填空题（fill_blank，fillAnswers 给 2-3 个可接受答案）

输出 JSON 格式（严格，不要多余文字）：
{
  "questions": [
    {
      "type": "choice|true_false|fill_blank",
      "question": "题干",
      "options": ["A...", "B...", "C...", "D..."],
      "correctIndex": 0,
      "correctAnswer": "答案",
      "fillAnswers": ["可接受答案1"],
      "answer": "标准答案",
      "explanation": "讲解（≤40字）：为什么对/错",
      "ability": "${ABILITY_WHITELIST}",
      "difficulty": 3,
      "dimension": "theory",
      "chapterRef": null
    }
  ]
}`;
}

/* 导入出题（实战部分）：缺省 10 道 code_choice（引用真实代码）——与理论拆分两次请求 */
function buildImportPracticalPrompt(courseTitle, concepts, chapters, difficulties, codeFiles, badTxt, count) {
  return `你是一名资深的 AI 大模型应用开发出题专家，擅长把学习资料转化为能区分「真懂」与「死记硬背」的考核题。

请根据下面的课程内容生成考核题，用于评估学生对 AI/Agent 知识的掌握程度。

【课程】${courseTitle}
【核心概念】
${concepts}
【章节要点】
${chapters}
【难点】
${difficulties}
${codeFiles ? `【代码文件】
${codeFiles}` : ""}
${badTxt ? `
【被反馈的题目（用户反馈过有问题，禁止生成相同或高度雷同的题）】
${badTxt}` : ""}

${TEACHING_METHODS}

请生成 ${count || 10} 道代码实战题——全部为代码客观题（code_choice），总量必须 ${count || 10} 道；类型多样化、不要雷同：

二、实战维度（dimension 填 "practical"）—— 基于课程【真实代码】：
  A. code_choice 代码客观题（type 用 "practical"，practical.compareMode 填 "code_choice"），共 ${count || 10} 道：必须引用上面「代码文件」里的真实代码（真实文件名/函数名/代码片段），类型多样化（不要全同一种，5 种类型尽量都覆盖，同一段代码也可以从不同角度出题但要保证不雷同），在以下 5 种中选：
  - spotlight 代码片段作用题：practical.code 放真实代码片段，highlightLines 标注其中一段的行号，问「标注段的作用/功能是什么」（单选，multi=false）
  - functions 代码功能多选：practical.code 放真实代码，问「这段代码实现的【关键功能】有哪几个」（多选，multi=true）
  - trace 输出预测：practical.code 放真实代码 + 题干给输入，问「运行结果/输出是什么」（单选）
  - bugfix Bug 修复：practical.code 放有缺陷的真实代码，highlightLines 标注问题行，问「正确的修复是哪个」（单选）
  - progression 递进 / compare 对比：当代码文件有多个（如 demo-1.py、demo-2.py 名称有序），用 practical.codeBlocks（[{"file":"demo-1.py","code":"..."},{"file":"demo-2.py","code":"..."}]）出跨文件题——问「相对上一版新增的关键能力 / 两种实现的本质区别与优劣」（单选或 multi=true 多选）
  题干要贴合真实业务场景，不要空泛；code_choice 题正确选项必须对应代码的真实行为，practical.correctIndex 填正确选项下标数组（单选 [n]，多选 [a,b,...]）。

输出 JSON 格式（严格，不要多余文字）：
{
  "questions": [
    {
      "type": "practical",
      "question": "题干（描述代码上下文与问题）",
      "practical": {
        "subtype": "spotlight|functions|trace|bugfix|progression|compare",
        "compareMode": "code_choice",
        "files": ["demo-2.py"],
        "code": "展示的代码片段（单文件题）",
        "codeBlocks": [{"file": "demo-1.py", "code": "..."}, {"file": "demo-2.py", "code": "..."}],
        "highlightLines": [10, 11, 12],
        "multi": false,
        "options": ["A...", "B...", "C...", "D..."],
        "correctIndex": [1],
        "referenceAnswer": "解析要点（≤40字）"
      },
      "answer": "解析",
      "explanation": "讲解（≤40字）：为什么选这个",
      "ability": "${ABILITY_WHITELIST}",
      "difficulty": 4,
      "dimension": "practical",
      "chapterRef": null
    }
  ]
}`;
}

/* 导入资料时的出题：生成 26 道考核题（理论 16 + 实战 10，理论客观题 + 代码实战客观题）；前端单轮调用后去重入库。
 * 说明：这里【不生成面试题】——面试题需要岗位针对性，由面试考核时按岗位动态生成（buildInterviewQuestionPrompt）。
 * 岗位通用面试题（参考弹药）由 generateJobQuestions 在导入后单独提炼 3 道，存进 jobExtraQuestions。 */
function buildImportPrompt(courseTitle, concepts, chapters, difficulties, codeFiles, badTxt) {
  return `你是一名资深的 AI 大模型应用开发出题专家，擅长把学习资料转化为能区分「真懂」与「死记硬背」的考核题。

请根据下面的课程内容生成考核题，用于评估学生对 AI/Agent 知识的掌握程度。

【课程】${courseTitle}
【核心概念】
${concepts}
【章节要点】
${chapters}
【难点】
${difficulties}
${codeFiles ? `【代码文件】
${codeFiles}` : ""}
${badTxt ? `
【被反馈的题目（用户反馈过有问题，禁止生成相同或高度雷同的题）】
${badTxt}` : ""}

${TEACHING_METHODS}

请生成 26 道题，覆盖两大考核维度（理论 16 + 实战 10）——实战题多生成一些，作为考核抽题的备选池（避免考核时反复抽到同样的题）：

一、理论维度（dimension 填 "theory"）—— 考察概念/原理的客观掌握，全为客观题（选择 / 判断 / 填空）：
  8 道概念辨析选择题（4 选项，correctIndex 为 0-3，题干基于核心概念，覆盖不同知识点、不要雷同）
  4 道判断题（true_false，correctAnswer 填 "对" 或 "错"）：题干陈述本身必须语义自洽、可直接判定真伪——题干说法正确就填「对」，说法错误就填「错」，并在 explanation 说明对错原因。出「错」题时，请在题干里写一个「本身错误」的技术说法（如把概念/机制说反），禁止用「不符合课程案例 / 与 demo 不同」这类题外理由判定对错（判断题只考陈述本身的真伪，不考是否与某案例一致）。
  4 道填空题（fill_blank，fillAnswers 给 2-3 个可接受答案）

二、实战维度（dimension 填 "practical"）—— 基于课程【真实代码】的代码实战客观题（type 用 "practical"，practical.compareMode 填 "code_choice"）：
  10 道，必须引用上面「代码文件」里的真实代码（真实文件名/函数名/代码片段），类型多样化（10 道不要全同一种，5 种类型尽量都覆盖，同一段代码也可以从不同角度出题但要保证不雷同），在以下 5 种中选：
  - spotlight 代码片段作用题：practical.code 放真实代码片段，highlightLines 标注其中一段的行号，问「标注段的作用/功能是什么」（单选，multi=false）
  - functions 代码功能多选：practical.code 放真实代码，问「这段代码实现的【关键功能】有哪几个」（多选，multi=true）
  - trace 输出预测：practical.code 放真实代码 + 题干给输入，问「运行结果/输出是什么」（单选）
  - bugfix Bug 修复：practical.code 放有缺陷的真实代码，highlightLines 标注问题行，问「正确的修复是哪个」（单选）
  - progression 递进 / compare 对比：当代码文件有多个（如 demo-1.py、demo-2.py 名称有序），用 practical.codeBlocks（[{"file":"demo-1.py","code":"..."},{"file":"demo-2.py","code":"..."}]）出跨文件题——问「相对上一版新增的关键能力 / 两种实现的本质区别与优劣」（单选或 multi=true 多选）
  题干要贴合真实业务场景，不要空泛；正确选项必须对应代码的真实行为。

输出 JSON 格式（严格，不要多余文字）：
{
  "questions": [
    {
      "type": "choice|true_false|fill_blank",
      "question": "题干",
      "options": ["A...", "B...", "C...", "D..."],
      "correctIndex": 0,
      "correctAnswer": "答案",
      "fillAnswers": ["可接受答案1"],
      "answer": "标准答案",
      "explanation": "讲解（≤40字）：为什么对/错",
      "ability": "${ABILITY_WHITELIST}",
      "difficulty": 3,
      "dimension": "theory|practical",
      "chapterRef": null
    },
    {
      "type": "practical",
      "question": "题干（描述代码上下文与问题）",
      "practical": {
        "subtype": "spotlight|functions|trace|bugfix|progression|compare",
        "compareMode": "code_choice",
        "files": ["demo-2.py"],
        "code": "展示的代码片段（单文件题）",
        "codeBlocks": [{"file": "demo-1.py", "code": "..."}, {"file": "demo-2.py", "code": "..."}],
        "highlightLines": [10, 11, 12],
        "multi": false,
        "options": ["A...", "B...", "C...", "D..."],
        "correctIndex": [1],
        "referenceAnswer": "解析要点（≤40字）" 
      },
      "answer": "解析",
      "explanation": "讲解（≤40字）：为什么选这个",
      "ability": "${ABILITY_WHITELIST}",
      "difficulty": 4,
      "dimension": "practical",
      "chapterRef": null
    }
  ]
}`;
}

/* 考核时的动态出题（理论/实战模式） */
function buildExamPrompt(conceptTxt, chapterTxt, mode, count, abilities, codeTxt, badTxt) {
  const whitelist = abilities || ABILITY_WHITELIST;
  const modeDesc = mode === "theory"
    ? "理论考核：只出客观知识题（选择/多选/判断/填空），考察概念、原理、机制的准确掌握"
    : "实战考核：生成代码实战题——约 3/4 为代码客观题（引用课程真实代码，ABCD 单选/多选，程序判分），约 1/4 为写代码任务题（学生写代码后由你判分）";

  const typeRequirement = mode === "theory"
    ? "题型在 choice（单选4选项）/ true_false（判断）/ fill_blank（填空）中选，多样化。判断题（true_false）的 correctAnswer 只能填「对」或「错」，且必须与题干陈述本身的真伪一致：题干说法正确就填「对」，说法错误就填「错」，并在 explanation 里说明对错原因；禁止用「不符合课程案例 / 与 demo 不同」这类题外理由判定对错。"
    : "题型大部分用 practical 代码客观题（practical.compareMode 填 \"code_choice\"）：必须引用上面「代码文件」里的真实代码（真实文件名/函数名/片段），类型在 spotlight（标注段作用，单选）/ functions（功能多选，multi=true）/ trace（输出预测，单选）/ bugfix（修复缺陷，单选）/ progression（多文件递进）/ compare（多文件对比）中多样化选取，附 options + correctIndex（数组）+ code 或 codeBlocks；少量（约 1/4）用 practical 写代码任务题（compareMode 填 \"llm_code\"）：给具体编码任务，附 referenceAnswer 和 scoringPoints（2-4 条）；还可以用 practical 代码补全题（compareMode 填 \"code_fill\"）。硬性要求（缺一不可）： a) 代码必须**自包含可独立运行**：只用 Python 标准库（禁止第三方库如 numpy/requests、禁止读文件/网络/外部数据），是一个能直接 `python3` 跑完的完整脚本；可以从课程真实代码里截取自包含片段，或基于课程概念创作自包含示例； b) 挖掉 2-4 个**关键逻辑行**（条件判断/循环/返回值/关键函数调用，如 `if x > threshold:`、`return result`），不挖 def/class/语法结构行；missingLines 填缺失行的 1-based 行号数组，code 字段放**完整代码文本**（含缺失行内容，便于定位行号）； c) 必须提供 expectedOutput：程序**正常跑完应输出的关键内容**（精确到关键字符串，一般是 print 出的内容）；以及 hint（1 句提示，学生 3 次运行失败后展示）。";

  const jsonSchema = mode === "theory"
    ? `{"questions": [{"type": "choice|true_false|fill_blank", "question": "题干", "options": ["A","B","C","D"], "correctIndex": 0, "correctAnswer": "答案", "fillAnswers": ["可接受答案"], "explanation": "讲解（≤200字）", "ability": "能力维度名", "difficulty": 2, "dimension": "${mode}", "chapterRef": null}]}`
    : `{"questions": [{"type": "practical", "question": "题干", "practical": {"subtype": "spotlight|functions|trace|bugfix|progression|compare", "compareMode": "code_choice", "files": ["demo-2.py"], "code": "代码片段", "codeBlocks": [{"file": "demo-1.py", "code": "..."}], "highlightLines": [10], "multi": false, "options": ["A","B","C","D"], "correctIndex": [1], "referenceAnswer": "解析"}, "answer": "解析", "explanation": "讲解（≤200字）", "ability": "能力维度名", "difficulty": 4, "dimension": "practical", "chapterRef": null}, {"type": "practical", "question": "任务描述（含具体要求）", "practical": {"task": "具体编码任务", "codeContext": "可选的代码上下文/提示", "referenceAnswer": "参考实现代码", "scoringPoints": ["评分要点1","评分要点2"], "compareMode": "llm_code"}, "answer": "参考实现", "explanation": "讲解与评分要点（≤200字）", "ability": "能力维度名", "difficulty": 4, "dimension": "practical", "chapterRef": null}]}`;

  return `你是一名 AI 岗位出题专家。请根据候选人的学习资料，生成 ${count} 道考核题。

【考核模式】${modeDesc}

【学习资料】
概念：
${conceptTxt}
章节：
${chapterTxt}
${codeTxt ? `代码文件：
${codeTxt}` : ""}
${badTxt ? `被反馈的题目（用户反馈过有问题，禁止生成相同或高度雷同的题）：
${badTxt}
` : ""}
出题要求：
1. 题目必须贴合资料内容，考察真实理解而非背书。${codeTxt ? "实战题必须结合上面列出的具体代码文件出题（引用真实函数名/变量名/业务逻辑），禁止出泛化的通用编码题。" : ""}
2. ${typeRequirement}
3. 每道题标注所属能力维度（ability），只能从以下 10 个里选：${whitelist}。
4. 出题方向轮换覆盖以下核心知识点（每次随机选取其中 2-3 个方向优先，避免每轮都出相同知识点，题目之间不要高度雷同）：
   - RAG：分块策略、混合检索 vs 纯向量、RAG 效果评估、Query 改写
   - Agent：CoT/ReAct、Memory 记忆、工具调用、自主性 vs 可控性
   - 框架：LangChain 六大组件、LCEL、LangChain vs LlamaIndex vs AutoGen
   - 微调：LoRA 原理、SFT vs RLHF、微调数据工程与评估
   - 部署：KV Cache、PagedAttention、Continuous Batching、vLLM vs SGLang
5. 知识准确性（重要）：涉及标准概念/机制时必须准确无误——例如 ReAct 循环的标准三步是 Thought（思考）→ Action（行动）→ Observation（观察），先思考再行动、观察后进入下一轮；禁止编造步骤名、顺序或术语。不确定时可考察概念理解而非机械定义。
6. 教学法融入（让题目考察真理解而非背书）：
   - 费曼技巧：部分题要求「用最简单的话向一个不懂的人解释」，能去术语化讲清楚才是真懂
   - 苏格拉底追问：面试/问答题附层层追问（是什么 → 为什么 → 如果反过来/换场景会怎样）
   - 布鲁姆分类：覆盖记忆/理解/应用/分析/评价/创造，避免只考名词背诵
   - 主动回忆：填空题挖掉关键步骤/术语，考察能否凭理解补全
   - 类比迁移：让考生用生活类比解释抽象机制（如「向量检索像什么」）
   - 反例与边界：考察「在什么情况下会失效/不适用」，而非死记标准答案

只输出 JSON：
${jsonSchema}`;
}

/* ============================================================
 * 判分 prompt
 * ============================================================ */

function buildCodeGradePrompt(q, p, userAns) {
  // 数据统一方案 L1：素材统一 sanitizeMaterial（长度配置在 DataIO.INPUT_LIMITS）
  const refTxt = DataIO.sanitizeMaterial([{ key: "reference", text: p.referenceAnswer || q.answer || "" }], { prefix: "" });
  const ansTxt = DataIO.sanitizeMaterial([{ key: "userAnswer", text: userAns }], { prefix: "" });
  const ctxTxt = DataIO.sanitizeMaterial([{ key: "codeContext", text: p.codeContext || "" }], { prefix: "" });
  return `你是一名资深 AI 工程师。请判分学生这道代码实战题。

【任务】${p.task || q.question}
${p.codeContext ? `【代码上下文】${ctxTxt}\n` : ""}【参考实现】
${refTxt}

【学生代码】
${ansTxt}

请判断学生代码是否正确、可运行、思路是否合理。给出 0-100 整数分，并用一两句给出反馈（亮点 + 不足 + 改进建议）。只输出 JSON：
{"score": 85, "feedback": "..."}`;
}

function buildReadingGradePrompt(q, userAns) {
  return `你是一名资深 AI 工程师。请判定学生对这道代码阅读题的回答是否准确抓住了代码的功能与关键步骤。

【题目】${q.question}
【参考答案】${DataIO.sanitizeMaterial([{ key: "reference", text: q.answer || "" }], { prefix: "" })}
【学生回答】${DataIO.sanitizeMaterial([{ key: "userAnswerShort", text: userAns }], { prefix: "" })}

请给出 0-100 整数分，并用一两句反馈（亮点 + 不足）。只输出 JSON：
{"score": 85, "feedback": "..."}`;
}

function buildFillBlankPrompt(q, userAns, accepted) {
  return `你是一名严格的 AI 面试官。请判断学生的填空题答案是否与标准答案语义一致。

【题目】${q.question}
【标准答案】${accepted}
【学生答案】${userAns}

请判断是否正确（允许同义表达、大小写/中英文等价、合理简称）。只输出 JSON：
{"correct": true, "reason": "一句话判定理由"}`;
}

function buildEssayGradePrompt(q, userAns) {
  return `你是一名资深的 AI 岗位面试官。请批改学生这道问答题的回答。

【题目】${q.question}
【参考答案】${DataIO.sanitizeMaterial([{ key: "referenceShort", text: q.answer || "" }], { prefix: "" })}
【学生回答】${DataIO.sanitizeMaterial([{ key: "userAnswerShort", text: userAns }], { prefix: "" })}

请给出 0-100 的整数分数，并用一两句话给出反馈（指出亮点与不足）。只输出 JSON：
{"score": 85, "feedback": "..."}`;
}

/* ============================================================
 * 面试 prompt
 * ============================================================ */

/* 生成岗位专属的面试官角色提示词（不同岗位匹配不同角色与考察重点） */
function buildInterviewerSystem(job) {
  const kp = (job.knowledgePoints && job.knowledgePoints.length)
    ? `\n【岗位知识图谱要点（可据此深挖）】\n${job.knowledgePoints.map((k) => `- ${k}`).join("\n")}`
    : "";
  // 优先用岗位专属的面试官角色定位（systemRole，手写、更针对性）；否则回退到职责+技能动态拼接
  const role = job.systemRole
    ? job.systemRole
    : `你是「${job.name}」的资深面试官，正在主持一场多维度技术面试。
【岗位职责】${job.duties.join("；")}
【核心技能考察】${job.skills.join("、")}`;
  return `${role}${kp}
【面试原则】出题必须贴合该岗位的真实生产环境与工作场景，追问犀利、直击要害；客观评分、不轻易给高分、指出具体短板。只输出 JSON，不得输出任何额外文字。`;
}

function buildInterviewQuestionPrompt(st, askedTxt, answeredTxt) {
  // 打乱参考题顺序，避免 LLM 每次都按固定顺序参考、导致出题顺序雷同
  // D-9 修复：统一用 Fisher-Yates 均匀洗牌（原 sort(() => Math.random()-0.5) 非均匀）
  const shuffleArr = (a) => { const x = [...(a || [])]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
  const samples = shuffleArr(st.job.sampleQuestions);
  const reals = shuffleArr(st.job.realQuestions);
  return `你是「${st.job.name}」的资深面试官，正在面试一位候选人。请生成「下一道」面试题。

【岗位职责】${st.job.duties.join("；")}
【岗位典型面试题参考】${samples.join("；")}
【岗位真实面试真题参考（来自大厂面经，尽量贴近这些真题的风格与深度）】${reals.join("；")}
【本次考察维度】${st.dims.join("、")}

【候选人学习资料 · 核心概念】
${st.ctx.conceptTxt}
【资料 · 章节要点】
${st.ctx.chapterTxt}
【资料 · 难点】
${st.ctx.diffTxt}
【题库已有题目】
${st.ctx.quizTxt}

【已经问过的问题（务必避免重复、避免雷同）】
${askedTxt}
【候选人已回答记录（务必据此调整难度：答得好可逐步加深；连续答「不知道 / 不会」则大幅降级、从最基础的概念问起）】
${answeredTxt}

出题要求：
0. 【务必随机变换——最关键】参考题（典型题/真题）只用于把握「风格与深度」，**禁止按参考题的顺序逐条出题，也禁止照搬参考题的场景**。每次面试都要结合「已经问过的问题」和「候选人回答」，从不同角度、不同业务场景随机生成新题。
1. 【预设场景再提问——最关键】每个问题都必须先给一个具体、可想象的真实业务场景（例：「假设你要给电商系统做一个订单处理 Agent，用户可以说『改收货地址』『把某商品换成大一号』『取消部分商品』，需要调用库存/价格/物流等多个接口，且可能中途改主意」），再基于这个场景问「你会怎么做 / 怎么选 / 为什么」。**禁止**「你们项目中……」「介绍一下你的项目」「你如何定义……」这类假设候选人已有现成项目经验的空泛问法——候选人可能没有项目，空泛问题让他无从回答。
2. 紧密结合候选人资料里的概念、章节、难点，让题目有针对性。
3. 【难度自适应】如果候选人前面多次答「不知道 / 不会 / 不清楚」，下一题务必大幅降低难度——从最基础的概念入手（如「你知道 XX 是干什么的吗」），不要再出需要实战经验的难题；等答上来再逐步加深。
4. 题型要多样化，从以下类型中选一种（优先选还没有用过的类型）：
   - scenario：给出一个真实业务/生产场景，让候选人决策或排障（默认首选，最能考察真实能力）
   - essay：开放式问答（讲清原理与权衡）
   - code：给出一段代码或让候选人描述实现/找 bug
   - choice：一道 4 选 1 的选择题（options 为 4 个选项，correctIndex 填正确选项下标 0-3，供程序判对错）
5. 只输出 JSON：
{"type": "essay|scenario|code|choice", "question": "面试官提出的问题（自然、口语化，像真人面试）", "dimension": "维度名（只能从：${ABILITY_WHITELIST} 中选）", "options": ["A...", "B...", "C...", "D..."], "correctIndex": 0}`;
}

function buildInterviewFollowPrompt(st, q, curQuestion, ans, tactics) {
  const followed = st.currentFollows || 0;
  const weakCount = (st.history || []).filter((h) => h.weak).length;   // 累计弱回答次数
  const hints = st.job.followUpHints || [];
  const hintsTxt = hints.length ? hints.join("；") : "（无）";
  const MIN_FOLLOWS = 3;   // 每题至少追问 3 次（由前端强制，这里只负责生成两种文案）
  return `你是「${st.job.name}」岗位最严厉的面试官。候选人刚回答了这道题：

【题目类型】${q.type || "essay"}
【你的问题】${curQuestion}
【候选人回答】${DataIO.sanitizeMaterial([{ key: "ivAnswer", text: ans }], { prefix: "" })}
【本题已追问次数】${followed} 次
【候选人累计弱回答次数】${weakCount} 次（答「不知道/不会/不清楚」或避重就轻）

【面试官追问技巧】${tactics.join("；")}
【岗位预置追问方向（⚠️ 仅供候选人答不上来时的兜底参考，正常追问【禁止】使用）】${hintsTxt}

【第一步 · 回答分析（必须执行，不要跳过）】
仔细分析候选人刚才的回答，从回答内容中找出 2-3 个可深挖的具体点，例如：
- 回答中提到的机制/设计选择：为什么这么选？代价与权衡是什么？
- 回答中模糊、省略、一笔带过的环节：具体怎么做的？边界在哪？
- 回答里隐含的假设或遗漏的边界情况：如果输入/环境变化会怎样？
- 回答与本主题相关但未展开的细节
把分析结果用「可深挖点」列出，然后基于其中【最有价值的一个点】生成追问。

【第二步 · 生成追问（务必遵守）】
1. 追问必须【从候选人的回答内容出发】延伸，直接针对回答中的某个具体说法，让候选人感受到你在听、在深挖。
2. 【禁止从岗位预置追问方向里机械挑选】，禁止问与本题主题无关的方向（例：本题是长文档摘要，就不要问「失败重试/幂等/上下文串扰」这类无关方向，除非候选人的回答自己提到了）。
3. 追问要【具体、详细、有技术含量】：完整描述要深挖的点（含具体机制/场景/权衡/反例），至少 2 句话，让候选人能针对性回答。禁止「说说看」「换个角度深挖」「再讲详细点」这类空泛问法。
4. 难度自适应：答「不知道/不会/不清楚」→ 降级为最基础的子问题；回答尚可 → 往深挖（为什么/代价/边界/反例/生产坑）；回答已很完整 → 换一个与本题强相关的角度（性能/可维护性/规模化）继续压榨。

正例（从回答延伸、具体）：候选人答「把 20 万字切片交给多个子 agent 各自摘要再汇总」，追问应类似——「你提到多个子 agent 各自摘要后汇总——如果两个子 agent 对同一部分给出互相矛盾的结论，你的汇总节点怎么处理？直接合并还是加一致性校验？这个校验本身的 token 成本怎么控制？」
反例（跑题、空泛，禁止）：「我们换个角度深挖一下：追问失败重试、幂等、上下文串扰的坑」——这是从预置方向里挑的、与本题主题无关，禁止。

请同时准备「追问」和「推进」两种回复，只输出一个 JSON：
{"followup": "点评 + 追问（至少 2 句，具体详细）", "advance": "简短肯定 + 过渡的一句话", "judged": "weak|ok"}

要求：
- followup：先一句话点评（肯定对的 + 点出不足），再抛一个【具体详细】的追问（按第二步执行）。若候选人答「不知道 / 不会 / 不清楚 / 没学过」，务必降级——把原问题拆成更基础的子问题追问（例：「没关系，先从最简单的说起——你知道 X 是干什么的吗」）。若候选人用「装插件 / 用现成库 / 调 API 就行」回避，务必识破并追问核心。
- 【嘲讽尺度】若候选人累计弱回答 ≥ 2 次，点评时可以带点犀利、带点嘲讽的幽默（如「这已经是第 N 次答不上来了，这些可都是最基础的」「你的简历是不是有点注水了」），让面试有真实压力感；但**保持专业，禁止人身攻击、辱骂、贬低人格**，讽刺点到为止。
- advance：简短肯定 + 自然过渡到下一题。
- judged：候选人这次回答是「不知道 / 不会 / 不清楚 / 没学过」、避重就轻、或明显肤浅 → 填 "weak"；否则 → 填 "ok"。`;
}

function buildInterviewScorePrompt(st, historyTxt) {
  const sc = st.job.scoring || {};
  const weakCount = (st.history || []).filter((h) => h.weak).length;
  const scTxt = sc.标准
    ? `优秀≥${sc.优秀 || 90}、良好≥${sc.良好 || 75}、及格≥${sc.及格 || 60}；${sc.标准}`
    : "严格标准，不轻易给高分";
  return `你是「${st.job.name}」岗位最严厉的资深面试官。以下是候选人的面试记录：

${historyTxt}

请严格、客观地评分（0-100），并给出各维度得分与总评。评分参考：${scTxt}。

【评分规则（务必严格遵守）】
- 你是最严厉的面试官，不轻易给高分，模糊、肤浅、回避的回答都要从严。
- 凡是记录里标注「直接答不知道/不会，未作答」的，该维度得分应大幅扣减（这类回答一律按 0 分计入该维度），连续多次答不知道的，总评分不应超过 30 分。
- 用「装个插件 / 用现成库 / 调 API 就行」这类话回避核心设计的，也按未真正作答从严扣分。
${weakCount >= 3 ? `- 【嘲讽】候选人累计 ${weakCount} 次答「不知道/不清楚」，overall 里可以带点犀利、带点嘲讽的幽默点评（如「基础都没打牢，建议先回去把基本功补上」「这个水平和简历描述差距不小」），但保持专业，禁止人身攻击、辱骂。` : ""}

【维度名约束（必须遵守）】dimensions 里每个 name 只能从以下 10 个能力维度中选一个，禁止自造维度名：${ABILITY_WHITELIST}。

【点评要求（务必严格遵守）】
- 每个维度的 comment 要写得【详细、犀利、一针见血】：具体指出候选人这个维度「哪里答得可以、哪里答得差或答错」，禁止写空话套话（如「还不错」「有待提高」「基本掌握」这类废话）。例：「ReAct 和 Plan-and-Execute 的区别都答不上来，基础概念完全没掌握，建议从最基础的 Agent 范式补起」。
- overall 要【犀利】：直接点出最致命的短板，给出具体、可执行的改进建议，不要客套。

只输出 JSON：
{"totalScore": 75, "dimensions": [{"name": "Agent 核心机制", "score": 70, "comment": "详细犀利的点评：具体指出得分点与失分点"}], "overall": "犀利的总评：直击短板 + 一条具体改进建议"}`;
}

/* 从导入资料提炼「岗位通用面试题」：LLM 判断资料最贴近哪个岗位，并生成该岗位的场景面试题，作为面试出题的参考弹药 */
function buildJobQuestionPrompt(course, jobNames) {
  // 数据统一方案 L1：job 出题素材统一 sanitizeMaterial
  const concepts = DataIO.sanitizeMaterial((course.concepts || []).map((c) => ({ key: "jobConcept", title: c.name, text: c.summary })), { emptyText: "（无）" });
  const chapters = DataIO.sanitizeMaterial((course.chapters || []).map((ch) => ({ key: "jobChapter", title: ch.title, text: ch.summary })), { emptyText: "（无）" });
  const titleTxt = DataIO.sanitizeMaterial([{ key: "jobTitle", text: course.title || "" }], { prefix: "" });
  return `你是 AI 岗位面试题库整理员。以下是一份学习资料的概要：

【资料标题】${titleTxt}
【核心概念】${concepts}
【章节要点】${chapters}

请做两件事：
1. 判断这份资料最贴近以下哪个岗位：${jobNames.join("、")}（只能选一个，选最贴近的）。
2. 为这个岗位生成 3 道「预设真实业务场景 + 问怎么做/怎么选/为什么」风格的面试题，题目要结合这份资料里的知识点，让面试官有新的参考弹药。

要求：场景具体可落地，禁止「介绍一下你的项目」「你如何定义」这类空泛问法。

只输出 JSON：
{"jobName": "岗位名", "questions": ["面试题1", "面试题2", "面试题3"]}`;
}
