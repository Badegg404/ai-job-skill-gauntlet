# AI 岗位能力试炼 — 会话交接文档（新会话必读）

> 用法：把「## 新会话开场白」整段复制给新会话的第一个消息，然后正常对话即可。

## 新会话开场白

你是「AI 岗位能力试炼」项目的开发助手。请先读项目根目录的 HANDOFF.md（本文件）和 skill 方法论文档，再开始工作。

项目：/Users/huaidan/Desktop/AI Coding/AI面试能力评估 —— 本地 AI 面试/考核桌面应用（Python stdlib 后端 + 原生 JS 前端 + 浏览器直连 OpenAI 兼容 LLM）。
方法论 skill：项目根目录 程序开发方法论-skill.md（含宁缺毋滥全套、评审循环、LLM 集成坑——动手前必读；2026-08-23 起从 ~/Desktop/skill/ 移入项目统一管理）。

## 项目现状（2026-08-24 会话结束时）

- 最新 commit：本地已提交（未推送），含数据统一方案 + UI 全面优化（详见 docs/评审-数据统一方案与UI优化.md）
- 测试：122 全绿（后端 26 + 前端 96，./run_tests.sh）
- **数据统一方案**（docs/数据统一方案.md）：L1 输入清洗 web/dataio.js（INPUT_LIMITS/sanitizeMaterial/shieldMaterial）→ L2 统一调用器 llmJSON（7 处直接 fetch 全部迁移）→ L3 输出 schema web/schema.js（QUESTION_SCHEMA/OBJECT_SCHEMAS/validateBySchema；validateLLMQuestion 重构为数据驱动）
- **UI 优化**（docs/UI优化方案.md）：SVG 图标系统（web/icons.js，Lucide 49 个，icon()/neonIcon()）、常驻左侧导航（分组可折叠）、首页改为产品展示厅（docs/首页重构方案.md：Hero+Showcase 四卡+我的数据+成长激励条）、能力雷达图霓虹重绘（渐变填充/渐变描边/入场动画）、面试考核独立一级导航 + 精致介绍页、新手引导 Tour 移除（快速开始页替代）、顶栏霓虹灯牌标题
- 运行中：http://127.0.0.1:8765/exam.html（重启：kill $(lsof -ti :8765) + open dist/AI岗位能力试炼.app）
- 用户 LLM：model deepseek-v4-flash，base https://api.agicto.cn/v1（中转站，易空响应/限流——导入失败读日志，见下）

## 架构关键点

1. **llmJSON 约束层**（web/exam.js ~924-1055）：所有 LLM 交互统一走它。opts {system, prompt, formatHint, minCount, part, maxTokens, expect, validateObj}。Agently custom() 机制：格式约束块 + 解析失败反馈重出（≤3 次）；**空响应软处理**（attempt≥2 返回 lastNonEmpty||[]，不 throw）；**有多少收多少**（lastNonEmpty 兜底）；仅从未出过题才 throw。
2. **InterviewGraph**（web/exam.js ~1860-2000）：StateGraph 八节点 ask/record/route/judge/decide/follow/advance/fail；WAIT=等用户，END=结束；追问预算随轮次递减；连续原题 weak≥3 才 fail；追问链入评分（isFollowup/followupText）；预生成第一题（_preloading）。
3. **导入规则（宁缺毋滥定案）**：目标理论 16（8 选择+4 判断+4 填空）+ 实战 10（全 code_choice，放弃批量 llm_code，考核时动态生成兜底）；首轮 16/10 + 最多 2 轮补足（合计 3 轮），每轮按缺失量精确补（理论下限 4、实战 3，thNeed=alignTheoryCount 已删改 Math.max(16-count,4)）；0 新增停该方向；不足 8/5 不失败——降级可用（导入成功+XP 照发+考核按钮置灰+补出题高亮）。
4. **题型公式自洽**（web/prompts.js buildImportTheoryPrompt）：N=count||16；nJudge=⌊N/4⌋；nChoice=N−2×nJudge（任意 N 自洽）。
5. **挂库**：前端 hangQ（去重 seenTxt + normalize）→ data.course.quiz；成功提示必须用 data.course.quiz（挂库后），不能用 data.dir.course（后端挂库前）。
6. **防重入**：importBusy 锁（导入中再次点击提示并忽略，成功/失败都复位）。
7. **日志系统**（实现详见本文件下方「日志系统」说明，规划文档已随实施完成归档删除）：
   - 前端 web/logger.js：Logger 单例（begin 生成 sessionId / info/warn/error / 50ms 批量上报 /api/log），window.onerror + unhandledrejection 全局兜底；reportDebug 升级为其内部实现（旧 tag 调用点零改动）
   - 后端 server.py：stdlib logging——app.log（全局：启动/请求/未捕获异常，RotatingFileHandler 2MB×5）+ 用户 logs/activity.log（业务事件 JSONL）；do_GET/do_POST 统一包装（请求耗时 + 顶层 traceback）；except:pass 审计补 warn
   - 接口：/api/log（批量上报）、/api/logs（只读，file=activity|app&limit）、/api/logs-clear（清空）；旧 /api/import-debug 保留兼容
   - GUI：首页「🔍 诊断日志」→ 按级别/tag/session 过滤 + 导出 + 清空
   - 隐私：API key 永不入日志；payload 快照截断（1500/800/2000 字上限）

8. **数据统一三层**：L1 web/dataio.js 清洗（sanitizeMaterial：控制字符清理/空白归一/按 key 条数+长度截断/前缀可配；shieldMaterial 注入防护）；L3 web/schema.js 校验（validateBySchema 数据驱动：when/or/type/enum/whitelist/range/rangeFn/detail 嵌套；ability 白名单含「未分类」兜底）；OBJECT_SCHEMAS 挂到 8 个 llmJSON validateObj 调用点。
9. **SVG 图标系统**：web/icons.js（Lucide ISC 协议，内联 currentColor 可继承发光）；icon(name, cls) 通用 + neonIcon(name, gid, from, to) 渐变描边（大图标用）；CSS .svg-icon/.lg/.xl/.xxl。新图标：下载到 /tmp 后 python 合并进 icons.js（正则提取 ICONS JSON → 追加 → 写回）。
10. **侧边栏**：SIDE_NAV 支持 children 分组（章节考核=导入+目录；综合考核=理论+实战；面试考核独立一级）；toggleSideGroup 折叠（localStorage dsh.navCollapsed.* 记忆）；setNavActive 激活子项自动展开父组。
11. **首页=产品展示厅**（goHome）：Hero（价值主张+双 CTA+演示雷达 HOME_EXAMPLE_PCT）→ Showcase 四卡（buildShowcaseHTML，HOME_EXAMPLES 静态示例，不依赖 LLM/数据）→ 我的数据（真实雷达+最近动态，无数据空态）→ 成长激励条（下一称号进度+连击/徽章/AP/下一步推荐 guideNextStepId）。

## 测试（tests/test_frontend.js 96 + test_backend.py 26）

- 关键测试：parseLLMJSON 容错（剥代码块/截断）、findQuestionsArray、count 参数化（4→2/1/1）、alignTheoryCount 不变量（现改为公式断言）、导入拆分 prompt 断言。
- 日志测试：前端 Logger 单测（begin/session、行组装、级别、flush 批量上报、reportDebug 兼容）；后端 log_json 行格式/级别映射/RotatingFileHandler。

## 已知坑（踩过的）

- **重置后数据复活（能力画像/记录/徽章）**：saveState 是 fire-and-forget 的 /api/profile-save，重置前挂起的旧请求晚于 reset-all 到达会被无条件写回 → 旧数据复活（用户实测：重置后综合能力画像数据还在）。根治：reset-all 写 reset-ts 墓碑（毫秒时间戳），profile-save 带 clientTs，clientTs < reset-ts 的请求丢弃（server.py is_stale_profile_save；saveState body 带 clientTs；resetAllData 顺序=重置内存→清 localStorage→reset-all→saveState 空 state 落盘→reload）
- 转义地狱：TS 模板字符串→python→JS 链，用 base64 管道/read+edit 精确替换，别信嵌套转义（写含模板字符串的 JS 用 \${ 转义或字符串拼接）
- 日志测试/本地联调：用 EXAM_CENTER_HOME=/tmp/xxx 起临时服务器，避免污染真实用户目录；沙箱下 ~/.exam-center 可能不可写（PermissionError 是沙箱限制，非代码 bug）
- 前端 Logger 必须挂到全局（window + globalThis 双暴露），否则 vm 测试环境取不到
- 用户 LLM 服务易限流空响应——导入失败先读日志，别猜
- 改 prompt 数量/题型时保持「公式自洽」与测试同步
- 新版本打包：.venv-build/bin/pyinstaller --clean --noconfirm build.spec（后台跑 ~2 分钟）
- GitHub 推送：git -c http.proxy=http://127.0.0.1:7890 push "https://x-access-token:$(cat ~/.dsh/github-token)@github.com/Badegg404/ai-job-skill-gauntlet.git" main:main（仅用户要求才推）

## 协作模式

- 用户会让 Claude 执行方案、harness 评审（或反向）——评审五维度：逻辑/数据/边界/一致性/回归
- 产品决策变更（题量/规则）必须用户拍板，不默认通过
- 用户实测报 bug → 先复现/读日志定位根因，再修，再测试，再提交
- 提交信息用中文，格式「fix:/feat: 内容」

## GitHub 同步（完整说明）

- **何时推**：本地 commit 随时做；**push 仅当用户明确要求**（「同步 GitHub」）——不主动推
- **推送命令**（在项目根目录）：
  ```bash
  git -c http.proxy=http://127.0.0.1:7890 push "https://x-access-token:$(cat ~/.dsh/github-token)@github.com/Badegg404/ai-job-skill-gauntlet.git" main:main
  ```
- **要点**：token 在 ~/.dsh/github-token（内联 $(cat ...)，不要用 ${VAR} 会被插值）；仓库无 origin remote，用显式 URL；走 7890 代理
- **验证**：推送输出 tail 应显示 `xxx..yyy main -> main`；也可 `git log --oneline -1` 确认最新 commit
- **仓库**：https://github.com/Badegg404/ai-job-skill-gauntlet（已可访问，同学分享链接）
## 总结经验到 skill（持续约定）

- 方法论文档：项目根目录 程序开发方法论-skill.md（宁缺毋滥全套、评审循环、LLM 集成坑、bug 案例库）
- 约定：每次开发/修 bug/评审后，把新踩的坑和新经验**沉淀到 skill**（现象→根因→解法），并**检查重复与过时**（如 3.8 空响应条就因逻辑演进更新过）
- 更新时保持通用方法论口吻（示例来自本项目，映射到通用场景），宁缺毋滥原则贯穿
- 大改动或新会话开工前先读 skill
## 遗留/待办

- README 可能停留在 v2.0 时期，未更新最新功能（用户分享给同学前可更新 CHANGELOG）
- 旧 interviewLogs 无 followup 字段（展开区兼容，追问文本历史未存）
- 笔记自带测验题（source current）计入 quizCount 但不参与考核——是否从统计剔除由用户定
## 项目文件结构

- server.py —— ThreadingHTTPServer（零框架），路由含 /api/dir-build、/api/dirs、/api/course-save、/api/import-debug、/api/dir-delete 等
- pipeline.py —— 资料→目录构建；process_aux_file 返回 ([], material)（纯 LLM）；build_comprehensive_interviews（每目录 5 道综合面试题，id 4000+i）
- parser/note_parser.py —— 笔记解析（含内嵌测验块 → source current 题，不参与考核）
- storage.py —— 数据持久化；rebuild_dirs_index 生成目录索引（含 hasCode 字段）
- web/exam.js —— 前端主逻辑 ~4700 行（导入/考核/面试/目录/徽章/诊断中心）
- web/logger.js —— 前端统一日志（Logger 单例 + 批量上报 + 全局错误捕获）
- web/scoring.js —— parseLLMJSON/findQuestionsArray/extractLLMQuestions/validateLLMQuestion
- web/prompts.js —— 全部 prompt（SYSTEM/TEACHING_METHODS/JSON_FORMAT_HINT/INTERVIEW_JSON_HINT/构建函数）
- web/profile.js、job_knowledge.json（8 岗位数据）
- tests/test_frontend.js（85）+ test_backend.py（23）+ run_tests.sh
- build.spec + .venv-build/bin/pyinstaller —— 打包 dist/AI岗位能力试炼.app

## 用户数据位置

- ~/.exam-center/users/dev_9937b387036a/ —— 用户目录
  - dirs/d_*.json —— 每个章节目录（含 course.quiz 题库）+ dirs/index.json（目录索引含 hasCode/theoryCount/practicalCount）
  - import-debug.log —— 旧导入诊断日志（兼容保留，新日志走 logs/activity.log）
  - logs/activity.log —— 活动日志（JSONL，前端批量上报 + 后端业务事件；RotatingFileHandler 2MB×5 轮转）
  - profile.json / course.json 等
- ~/.exam-center/logs/app.log —— 全局系统日志（启动/请求/未捕获异常）

## 面试模块关键行为（StateGraph 定案）

- 追问预算随轮次递减：followBudget = max(1, 3 - floor(round/2))（1-2 题追 3、3-4 追 2、之后 1）
- 连续原题首答 weak ≥3 才 fail（record 弱词正则含拖延词 + 实质猜测排除）
- 选择题：出现时输入框置灰（「点击上方选项作答」）+ 选后程序判对错（correctIndex 比对，Number 容错字符串下标）
- 预生成第一题：showInterviewLoading 并行 ask（_preloading 标记），renderInterviewChat 三分支
- 面试记录：qa 存 followup 标记 + followupText，展开区「↳ 追问」前缀；评分失败显示「评分失败」
- finishInterview 评分 historyTxt 按「Q / Q(追问)」组织（追问链进评分）

## V2 之后升级史（用户问过，简短版）

纯 LLM 驱动（移除引擎题）→ 导入稳定性（失败保留目录/诊断日志/数量门槛演进：一次必满→累积补足→有多少收多少→16+10×3 轮）→ 面试 StateGraph + llmJSON 统一约束 → 面试体验（追问递减/连续 weak/预生成/选择题判对错）→ 工程修复（防重入/数据源/maxTokens 死变量）→ **日志系统**（前端 Logger + 后端 stdlib logging + GUI 诊断中心）。## 项目文件结构

- server.py —— ThreadingHTTPServer（零框架），路由含 /api/dir-build、/api/dirs、/api/course-save、/api/import-debug、/api/log、/api/logs、/api/logs-clear、/api/dir-delete 等；stdlib logging（app.log + activity.log）
- pipeline.py —— 资料→目录构建；process_aux_file 返回 ([], material)（纯 LLM）；build_comprehensive_interviews（每目录 5 道综合面试题，id 4000+i）
- parser/note_parser.py —— 笔记解析（含内嵌测验块 → source current 题，不参与考核）
- storage.py —— 数据持久化；rebuild_dirs_index 生成目录索引（含 hasCode 字段）
- web/exam.js —— 前端主逻辑 ~4700 行（导入/考核/面试/目录/徽章/诊断中心）
- web/logger.js —— 前端统一日志（Logger 单例 + 批量上报 + 全局错误捕获）
- web/scoring.js —— parseLLMJSON/findQuestionsArray/extractLLMQuestions/validateLLMQuestion
- web/prompts.js —— 全部 prompt（SYSTEM/TEACHING_METHODS/JSON_FORMAT_HINT/INTERVIEW_JSON_HINT/构建函数）
- web/profile.js、job_knowledge.json（8 岗位数据）
- tests/test_frontend.js（85）+ test_backend.py（23）+ run_tests.sh
- build.spec + .venv-build/bin/pyinstaller —— 打包 dist/AI岗位能力试炼.app

## 用户数据位置

- ~/.exam-center/users/dev_9937b387036a/ —— 用户目录
  - dirs/d_*.json —— 每个章节目录（含 course.quiz 题库）+ dirs/index.json（目录索引含 hasCode/theoryCount/practicalCount）
  - import-debug.log —— 旧导入诊断日志（兼容保留，新日志走 logs/activity.log）
  - logs/activity.log —— 活动日志（JSONL，前端批量上报 + 后端业务事件；RotatingFileHandler 2MB×5 轮转）
  - profile.json / course.json 等
- ~/.exam-center/logs/app.log —— 全局系统日志（启动/请求/未捕获异常）

## 面试模块关键行为（StateGraph 定案）

- 追问预算随轮次递减：followBudget = max(1, 3 - floor(round/2))（1-2 题追 3、3-4 追 2、之后 1）
- 连续原题首答 weak ≥3 才 fail（record 弱词正则含拖延词 + 实质猜测排除）
- 选择题：出现时输入框置灰（「点击上方选项作答」）+ 选后程序判对错（correctIndex 比对，Number 容错字符串下标）
- 预生成第一题：showInterviewLoading 并行 ask（_preloading 标记），renderInterviewChat 三分支
- 面试记录：qa 存 followup 标记 + followupText，展开区「↳ 追问」前缀；评分失败显示「评分失败」
- finishInterview 评分 historyTxt 按「Q / Q(追问)」组织（追问链进评分）

## V2 之后升级史（用户问过，简短版）

纯 LLM 驱动（移除引擎题）→ 导入稳定性（失败保留目录/诊断日志/数量门槛演进：一次必满→累积补足→有多少收多少→16+10×3 轮）→ 面试 StateGraph + llmJSON 统一约束 → 面试体验（追问递减/连续 weak/预生成/选择题判对错）→ 工程修复（防重入/数据源/maxTokens 死变量）。
