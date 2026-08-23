# 评审文案：数据统一方案 + UI 全面优化（2026-08-24 全量）

> 交付物：列出本次**全部相关文件完整路径**与更改缘由。
> 测试基线：122 全绿（前端 96 + 后端 26，./run_tests.sh）

---

## 一、数据统一方案（输入 → 处理 → 输出）

**缘由**：此前 LLM 交互三类散乱——素材在调用点各自 slice() 截断（长度/条数散落 8 处）、7 处直接 fetch 绕过统一层、输出校验手写 if 不可复用。统一为三层。

### 1.1 输入层（L1）
- 新建 `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/dataio.js`：INPUT_LIMITS（14 组 {count,len}，与历史 slice 值对齐）、sanitizeMaterial（控制字符清理/空白归一/按 key 截断/prefix 可配）、shieldMaterial 注入防护；全局暴露 window.DataIO
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/exam.html`：引入 dataio.js 脚本标签
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/tests/test_frontend.js`：加载顺序加入 dataio.js + schema.js（logger→dataio→schema→prompts→scoring→profile→exam）

### 1.2 处理层（L2）—— 7 处直接 fetch 全迁 llmJSON
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/exam.js`：llmPickQuestions / llmGradeCode / llmGradeReading / llmGradeFillBlank / llmGradeEssay / generateJobQuestions / llmExamQuestions 全部迁移；新增 GRADE/FILL/PICK/JOB 4 个格式约束常量
- 关键参数：pick(maxTokens 300·温度0.6·null→adaptivePick)、grade-code(500·0.2)、grade-fill(温度0·模糊匹配兜底)、job(800·0.7)、exam-dynamic(3000·0.8·minCount 0)

### 1.3 输出层（L3）
- 新建 `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/schema.js`：QUESTION_SCHEMA（12 条规则，含 difficulty [1,5] / explanation ≤200 强校验、ability 白名单含「未分类」）、OBJECT_SCHEMAS（8 组）、validateBySchema（when/or/type/enum/whitelist/range/rangeFn/detail）
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/scoring.js`：validateLLMQuestion 重构为 validateBySchema 数据驱动
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/exam.js`：8 处 validateObj 全部切换 OBJECT_SCHEMAS（interview-judge/score 为新增校验点）

### 1.4 素材组装点统一
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/exam.js`：buildInterviewContext（ivConcept/ivChapter/ivDiff/ivQuiz）、llmExamQuestions（conceptBrief/chapterBrief/codePreview）、llmPickQuestions 候选题面（quizBrief）
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/prompts.js`：buildCodeGradePrompt / buildReadingGradePrompt / buildEssayGradePrompt / buildInterviewFollowPrompt / buildJobQuestionPrompt 散落 slice 全部迁移（新增 referenceShort/ivAnswer/jobConcept/jobChapter/jobTitle）

### 1.5 测试
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/tests/test_frontend.js`：新增 6 个（sanitizeMaterial 截断/前缀/控制字符、shieldMaterial、QUESTION_SCHEMA 强化与等价、OBJECT_SCHEMAS）

---

## 二、UI 全面优化（保留赛博基因 × 产品化）

**缘由**：用户反馈 emoji 图标土、页面冗长、导航层级深、缺产品展示。

### 2.1 SVG 图标系统
- 新建 `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/icons.js`：Lucide 线框图标 49 个（ISC 协议，currentColor 可继承霓虹色/发光）
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/exam.js`：icon(name, cls) 通用渲染 + neonIcon(name, gid, from, to) 渐变描边；三大考核卡图标语义化（brain=理论/code=实战/messages-square=面试）+ 霓虹渐变配色
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/style.css`：.svg-icon 系列（尺寸/发光/弹窗 46px/对话头像）
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/exam.html`：引入 icons.js

### 2.2 常驻左侧导航
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/exam.js`：SIDE_NAV 支持 children 分组（章节考核=导入/目录；综合考核=理论/实战；面试考核独立一级）、renderSidebar、setNavActive（激活子项自动展开父组）、toggleSideGroup（折叠记忆 dsh.navCollapsed.*）
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/exam.html`：新增 aside#app-sidebar 容器
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/style.css`：侧栏 fixed 悬浮（position:fixed 视口左侧）、分组标题与一级项对齐、子目录 12px 缩小、折叠箭头/高亮

### 2.3 考核介绍页
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/exam.js`：showExamIntro(mode)（说明+特性+前置+大 CTA→showExamLoading 加载动画→进考核）；renderInterviewIntro 面试专属精致版（岗位 8 卡+4 步时间线+机制/产出双栏+FAQ）
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/style.css`：.iv-intro 系列样式

### 2.4 首页重构为产品展示厅
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/exam.js`：goHome 重写——① Hero（主标题「把大模型变成考官，为你的技能把关」+ 副句「由 LLM 驱动的动态 AI 考核系统」+ 4 能力标签 + 双 CTA + 340×340 演示雷达 noLabels+10 色顶点+右侧色点图例）；② buildShowcaseHTML 四卡（HOME_EXAMPLES 静态示例）；③ 我的数据（真实雷达+最近动态+空态）；④ 成长激励条（下一称号进度+连击/徽章/AP/下一步推荐）
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/style.css`：.home-hero/.home-tagline/.home-sub/.home-value/.hv-item/.demo-legend/.dl-*/.showcase-*/.sc-*/.home-motivate 等
- 演示雷达图例色板 `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/exam.js` HOME_LEGEND_COLORS（10 色）

### 2.5 能力雷达图霓虹重绘
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/profile.js`：drawRadarProfile 重写（径向渐变填充青→品红→紫、霓虹渐变描边双层光晕、环形刻度、最大值放大高亮、入场动画、opts.noLabels/vertexColors）
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/exam.js`：能力画像页雷达改彩色顶点+10 色图例（真实数据），删除旧两列维度条与残留旧版「成长路径」卡（修复画像页空白 bug）

### 2.6 页面瘦身
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/exam.js`：首页删除与侧栏重复按钮组；能力画像页六卡纵向→两栏看板；移除新手引导 Tour（startGuideTour/TOUR_STEPS/遮罩 CSS，−9.7KB；误删 GUIDE_STEPS 已从 git HEAD 恢复）
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/style.css`：.assess-grid 两栏布局、.tour-* 样式删除

### 2.7 顶栏霓虹标题
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/exam.html`：「AI知识考核中心」→「AI 技能考核中心」+ span.logo-title
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/style.css`：.logo-title 青→品红→紫流动渐变 + 双层辉光（logoShine 动画）
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/exam.js`：侧栏品牌 + SYSTEM 标识 + 导出报告 + 欢迎弹窗产品名统一为「AI 技能考核中心」

### 2.8 机器人 emoji 全局替换
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/exam.js`：38 处 🤖 清零（弹窗 showModal 新增 iconHtml 支持 SVG、面试对话头像、判分/评分提示、来源标签、顶栏状态、toast/按钮纯文本去 emoji）
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/profile.js`：2 处徽章 icon 🤖→⚙️
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/style.css`：.mb-icon .svg-icon 46px、.iv-avatar/.iv-bubble-avatar .svg-icon 尺寸

### 2.9 静态资源版本注入修复
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/server.py`：版本注入原只覆盖 4 个文件（style/neural/job_knowledge/exam.js），新增的 icons.js/dataio.js/schema.js/profile.js/prompts.js/scoring.js/logger.js 不在列表 → 浏览器缓存旧版（首页空白/旧 UI 的根因之一）。已扩展到全部本地 JS/CSS（按 mtime 生成 ?v=）

---

## 三、文档收拢与新增（完整路径）

- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/docs/数据统一方案.md`（新）：三层方案+调用点清单+约束表
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/docs/UI优化方案.md`（新）：现状诊断+ModelScope 借鉴+图标系统+布局方向
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/docs/首页重构方案.md`（新）：首页产品展示厅设计（PM/运营五层布局）
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/docs/产品架构图.md` + `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/docs/产品架构图.html`（新）：产品完整架构流程图 6 图
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/docs/评审-数据统一方案与UI优化.md`（本文件）
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/HANDOFF.md`（更新）：项目现状/架构关键点/测试基线同步
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/程序开发方法论-skill.md` + `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/项目开发提示词文档.md`（从桌面与 ~/Desktop/skill 移入项目根目录统一管理）

---

## 四、行为等价保障（迁移合规）

- 组卷失败 → null → adaptivePick 兜底；判分失败 → 评分失败/自评/模糊匹配兜底（原逻辑）
- 组卷 minCount 0（宁缺毋滥）；填空模糊匹配保留；素材长度与历史 slice 值对齐
- 隐私：用户作答永不入日志（llmJSON 只记 promptLen）

## 五、验证

- ./run_tests.sh：前端 96 + 后端 26 = 122 全绿（原 123：Tour 测试 −1、QuickStart +2、dataio/schema +6）
- node --check 全部通过；vm 沙箱实测 goHome/showAssessment 渲染正常；浏览器实测首页/侧栏/介绍页/雷达/面试页/顶栏霓虹

## 六、需注意的既有约定

- 本地提交随时可做；**推 GitHub 需用户明确说「同步」**
- 中文 commit 信息（feat:/fix:/chore: 前缀）；产品规则变更需用户批准；测试保持全绿

## 七、附录：全部相关文件路径（集中清单）

> 本评审文案自身：`/Users/huaidan/Desktop/AI Coding/AI面试能力评估/docs/评审-数据统一方案与UI优化.md`

**修改（8 个）：**
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/exam.js`
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/style.css`
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/exam.html`
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/profile.js`
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/prompts.js`
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/scoring.js`
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/server.py`
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/tests/test_frontend.js`
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/HANDOFF.md`

**新增（7 个）：**
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/icons.js`
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/dataio.js`
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/web/schema.js`
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/docs/数据统一方案.md`
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/docs/UI优化方案.md`
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/docs/首页重构方案.md`
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/docs/产品架构图.md`
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/docs/产品架构图.html`

**移入项目统一管理（2 个）：**
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/程序开发方法论-skill.md`
- `/Users/huaidan/Desktop/AI Coding/AI面试能力评估/项目开发提示词文档.md`
