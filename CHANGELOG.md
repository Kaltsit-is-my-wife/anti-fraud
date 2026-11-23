# 变更记录

本文件记录项目中已经完成的功能调整、问题修复，以及调研阶段确认的实现现状和待办事项。  
详细的架构和长期开发约定优先参考 [CLAUDE.md](./CLAUDE.md)。

## 2026-11-23 - 新增待测试清单并记录回复通知时序问题

### 问题场景

- 文章评论回复通知目前在评论提交时立即发送，而不是审核通过后发送；评论被驳回或隐藏时，被回复者仍可能收到指向不可见评论的通知。
- 本轮改动和 PR #11 的待测试项分散在 CHANGELOG、测试文档和临时记录中，缺少统一清单。

### 修改方案

- 在 [docs/planning/improvement-backlog.md](./docs/planning/improvement-backlog.md) 新增 `IMP-009`：文章评论回复通知延后到审核通过。
- 新增 [docs/planning/pending-tests.md](./docs/planning/pending-tests.md)，集中记录：
  - 文章评论审核链路
  - 存储清理 P0 修复
  - 存储清理引用扫描补齐
  - 视频分页补测
  - 题库 P0 与迁移
  - 题库管理 UI 回归
  - 合并与部署收尾
- 在 [docs/README.md](./docs/README.md) 登记待测试清单。

### 验证结果

- 本次仅新增/更新文档，未修改运行时代码。
- `pending-tests.md` 的测试项来自当前代码审查和 `IMP-008`，尚未执行。

## 2026-11-23 - 落地成员 B 文章评论审核补丁并清理根目录副本

### 问题场景

`member-b` 的页面和云函数改动此前直接放在仓库根目录，无法被小程序编译或云函数部署；同时根目录 `review-center.js`、`index.js` 基于旧版本，缺少 main 上已有的关键词风险展示。

### 修改方案

- [pages/article-detail](./pages/article-detail/article-detail.js)、[pages/community-post-detail](./pages/community-post-detail/community-post-detail.js)：补上评论提交成功的 Toast「评论已提交，审核通过后显示」。
- [cloudfunctions/getReviewTasks](./cloudfunctions/getReviewTasks/index.js)：增加 `article_comment` 的目标元数据和来源信息补全，保留现有 `keywordHits` / `keywordHitLevel`。
- [pages/review-center](./pages/review-center/review-center.js)：增加「文章评论」类型和评论对象/父评论信息展示，保留风险等级和命中关键词展示。
- [cloudfunctions/createComment](./cloudfunctions/createComment/index.js)：文章评论改为写入 `pending_review`，事务创建 `review_tasks`，并回写 `reviewTaskId`；帖子评论仍保持 `published`。
- [cloudfunctions/getComments](./cloudfunctions/getComments/index.js)：只返回 `approved` 和历史 `published`，待审核/驳回/隐藏不展示。
- [cloudfunctions/reviewContent](./cloudfunctions/reviewContent/index.js)：增加 `article_comment → comments` 审核回写。
- 删除根目录副本：`article-detail.js`、`community-post-detail.js`、`index.js`、`review-center.js`、`review-center.wxml`。
- 将根目录 `胡璟旭_测试手册.md` 移动到 [docs/guides/review-center-test.md](./docs/guides/review-center-test.md)，并登记到 `docs/README.md`。

### 验证结果

- `node --check` 通过：`pages/article-detail/article-detail.js`、`pages/community-post-detail/community-post-detail.js`、`cloudfunctions/getReviewTasks/index.js`、`pages/review-center/review-center.js`、`cloudfunctions/createComment/index.js`、`cloudfunctions/getComments/index.js`、`cloudfunctions/reviewContent/index.js`。
- `git diff --check` 通过。
- **尚未完成**：未部署 `createComment`、`getComments`、`getReviewTasks`、`reviewContent`，未在真机/真实云环境验证文章评论进入审核中心、审核回写和前台可见性。

## 2026-11-23 - 修复存储清理引用截断并关闭实际删除入口

### 问题场景

- `cleanupStorageFiles` 的引用查询使用 `.limit(1000)`，但云函数单次查询最多返回 100 条，`docs.length >= 1000` 的保守分支永远不会执行。引用文件如果排在 100 条之后，可能被误判为无人引用并删除。
- 视频管理页仍向管理员暴露“执行清理”，直接调用 `dryRun: false`；但引用检查尚未覆盖 `topics.contentBlocks[].imageUrl`、`articles.content` 等字段。
- 删除视频的确认文案仍写“云存储文件会保留”，但 `deleteVideo` 现在会把旧文件登记到清理队列。

### 修改方案

- [cloudfunctions/cleanupStorageFiles](./cloudfunctions/cleanupStorageFiles/index.js)：
  - 引用查询改为 100 条一批分页拉取，累计超过 10000 条时按“仍被引用”保守处理。
  - 增加 `STORAGE_CLEANUP_ALLOW_REAL_DELETE=true` 环境变量门禁，默认关闭；未配置时 `dryRun: false` 返回“引用检查尚未覆盖全部内容，暂不支持实际删除”。
- [pages/video-management](./pages/video-management/video-management.js)：
  - 管理页暂时隐藏“执行清理”，只保留 dry-run 检查。
  - `executeStorageCleanup` 增加默认关闭的前端开关和提示。
  - 删除视频确认文案改为“删除记录并登记旧文件到清理队列”。
- 同步更新 [docs/operations/storage_cleanup.md](./docs/operations/storage_cleanup.md)、视频分页/清理测试文档和 [CLAUDE.md](./CLAUDE.md)。

### 验证结果

- `node --check cloudfunctions/cleanupStorageFiles/index.js` 通过。
- `node --check pages/video-management/video-management.js` 通过。
- `git diff --check` 通过。
- **尚未完成**：未重新部署 `cleanupStorageFiles`，未在真实数据上验证分批引用查询和实际删除开关。

## 2026-11-22 - 题库转换脚本移入 tools 供团队复用

### 问题场景

- 题库转换脚本原先放在 `test/conversion_tools/`，而 `test/` 已被 `.gitignore` 排除，团队成员拉代码后拿不到脚本。

### 修改方案

- 新增 [tools/question-bank-converter/convert.js](./tools/question-bank-converter/convert.js)：
  - 支持命令行参数：`node tools/question-bank-converter/convert.js <input.txt> <output.json> [--label 2025]`；
  - 按题号、A–F 选项、`答案/正确答案`、可选解析解析 txt；
  - 只保留单选题，跳过多选题、重复题干、重复选项组等异常题；
  - 输出小程序“题目管理 → 批量导入”使用的 JSON 数组；
  - 无外部依赖，Node.js 直接运行。
- 新增 [tools/question-bank-converter/README.md](./tools/question-bank-converter/README.md)，说明输入格式、输出格式、跳过规则和限制。
- 更新 [CLAUDE.md](./CLAUDE.md)、[docs/README.md](./docs/README.md) 和 [docs/guides/question-bank-operation-guide.md](./docs/guides/question-bank-operation-guide.md) 的工具入口。
- 本地 `test/question_bank/` 下的源 txt、生成 JSON 和转换说明仍按 `.gitignore` 保留在本地，不随本次提交入库。

### 验证结果

- `node --check tools/question-bank-converter/convert.js` 通过。
- 使用本地 2025/2026 源文件跑通：2025 转换 10 题、跳过 10 道多选；2026 转换 99 题、跳过第 17 题（选项与题干不匹配）。
- 新脚本生成结果与原先本地脚本的输出逐字节一致。
- 本次未执行小程序实际导入；网页控制台直接导入仍需补全 `questionId`、`normalizedQuestion`、`bankIds`、时间戳并转 JSON Lines。

## 2026-11-22 - 题库转换脚本与本地测试题库 JSON

### 问题场景

- 需要把 2025/2026 反诈 txt 题库转成小程序“题目管理 → 批量导入”模板，用于本地批量导入测试。
- 网页控制台的单条“插入文档”不能直接批量导入，且不会自动补 `questionId`、`normalizedQuestion`、`bankIds`、`bankId` 和时间戳。

### 修改方案

- 在本地新增转换脚本 `test/conversion_tools/convert_question_bank.js`（`test/` 已被 `.gitignore` 排除，不纳入 Git）：
  - 读取 `test/question_bank/2025/2025全民反诈.txt`、`test/question_bank/2026/2026反诈题目.txt`；
  - 只保留单选题，跳过多选题；
  - 输出 `test/question_bank/2025/2025全民反诈.json`、`test/question_bank/2026/2026反诈题目.json`；
  - 2026 原文件缺少解析，脚本按题型模板自动补写；按关键词生成标签并粗分难度。
- 转换结果：2025 保留 10 道单选题（第 11–20 题为多选题，跳过）；2026 保留 99 道单选题（原第 17 题选项与题干不匹配，跳过）。
- 新增本地 `test/question_bank/转换说明.md`，记录题量、跳过项、人工复核点和导入方式。
- 本次生成的 JSON 只用于小程序批量导入；如果要在网页控制台导入，需要另行补全字段并转成 JSON Lines。

### 验证结果

- 两个 JSON 文件均可被 `JSON.parse` 解析；每道题都有 4 个选项、合法 `answerIndex`、非空解析和 `isActive: true`。
- 已检查两个输出文件之间没有重复题干。
- 小程序批量导入路径已由用户实际验证可用；本次完整的 99/10 题尚未全部执行导入。
- 2026 解析为脚本自动补写，答案分布集中在 B/C/D（无 A），建议导入前人工复核；2025 前 10 题包含“招嫖转刷单”话术，发布前需按内容规范复核。
- `test/` 目录被 `.gitignore` 排除，转换脚本、源 txt、生成 JSON 和转换说明均保留在本地，不随本次提交入库。

## 2026-11-21 - 补充 CloudBase 数据管理维护视频和题库说明

### 问题场景

- 组长希望用电脑浏览器直接维护视频和题库数据，但数据管理界面是通用数据库编辑器，字段、关联关系和发布规则不直观，容易改错。

### 修改方案

- 新增 [docs/operations/cloudbase-data-management-video-question-bank.md](./docs/operations/cloudbase-data-management-video-question-bank.md)，说明：
  - 从云开发控制台/数据管理进入；
  - `videos`、`question_banks`、`quiz_questions` 的导入字段和字段注释；
  - 视频/题库日常新增、修改、发布、下线、停用和维护规则；
  - 备份、导入、权限和常见坑。
- 更新 [docs/README.md](./docs/README.md) 文档导航。

### 验证结果

- 文档中的集合名、字段名、状态值和发布规则已与当前代码及题库操作指南对齐。
- 本次仅新增/更新文档，未修改运行时代码，无需执行 JavaScript 语法检查。
- 数据管理入口和界面可用性需在目标云环境按实际控制台确认。
## 2026-11-20 - 调整题库管理提示并记录暂缓验收

### 问题场景

- 视频分页测试需要 21 条以上已发布视频，当前数据量不足，无法完整跑一遍。
- 存储清理测试本身只需要 2–4 条测试视频和测试文件，不需要 20 条；但实际删除仍受 `cleanupStorageFiles` 引用扫描缺口限制。
- 题库管理页已有 placeholder，但提示文案偏短，示例不明确。
- `docs/guides/` 中部分指南自 2026-10-30 起未更新，与当前实现混在一起。

### 修改方案

- [pages/question-bank-management](./pages/question-bank-management/question-bank-management.wxml) 的输入框/文本域 placeholder 改为更明确的示例提示，输入文本后仍自动消失。
- [pages/question-editor](./pages/question-editor/question-editor.wxml) 将正确答案、难度从数字输入框改为选择器：
  - 正确答案范围随当前选项数量变化（A–F），直接选字母，不再手动输入 0–5。
  - 难度固定为 1–5，显示“最简单”到“最难”。
  - 保存时仍写入 `answerIndex` / `difficulty`，数据结构不变。
- 选项编辑从“多行文本、一行一个”改为固定选项行：
  - 默认 A、B 两个输入框，可添加至 A–F，最多 6 个。
  - 可逐项删除，最少保留 2 个。
  - 删除当前正确选项或删除前面的选项时，正确选项索引自动收敛。
  - 保存前要求每个可见选项都非空，避免空行占位。
- [pages/quiz](./pages/quiz/quiz.js) 将选项点击下标统一转为数字，并校验 `Number.isInteger`，避免字符串或 `NaN` 进入交卷参数。
- 视频分页暂按通过验收处理，补充 21 条以上视频数据后再补测。
- 存储清理确认数据要求为 2–4 条测试视频，不是 20 条；当前先按 dry-run/暂缓处理，补齐 `topics.contentBlocks`、`articles.content` 等引用扫描前不执行 `dryRun: false`。
- 将 5 份 2026-10-30 及更早的指南移动到 [docs/archive/guides/](./docs/archive/guides/)：
  - `ai_image_guide.md`
  - `project-handoff.md`
  - `question-bank-management-plan.md`
  - `resume_project_highlight.md`
  - `topic-and-question-bank-init.md`
- 新增归档说明，更新 `docs/README.md`、`README.md`、`docs/guides/developer-handoff.md`、`docs/archive/README.md` 和 `CLAUDE.md` 的链接。

### 验证结果

- 题库管理页仅修改 placeholder 文案，未改变表单字段和保存逻辑。
- 题目编辑页正确答案/难度选择器和选项固定行已通过 `node --check`；尚未在开发者工具中重新编译验证。
- 多选项测试返回“答案格式不正确”时，先确认 `submitQuizAttempt` 已重新部署为当前版本：旧版只允许索引 0–3，当前版本允许 0–5。
- 视频分页、存储清理尚未在真实数据上完整验收，记录为暂按通过/待补测。
- 已检查归档目录和文档链接；未修改运行时代码逻辑。

## 2026-11-17 - 补充视频分页与存储清理简易测试说明

### 问题场景

- 之前新增的视频分页与存储清理测试说明内容较细，适合开发/验收人逐项执行，但组长快速验收时步骤偏多。

### 修改方案

- 新增 [docs/guides/video-pagination-storage-cleanup-simple-test.md](./docs/guides/video-pagination-storage-cleanup-simple-test.md)，用大白话覆盖：
  - 部署哪 5 个云函数；
  - 用户端/管理端分页怎么点、看什么结果；
  - 替换/删除视频后怎么查 `storage_cleanup_tasks`；
  - dry-run、实际删除、引用保护和权限怎么测；
  - 通过标准、常见问题和测试数据清理。
- 在详细版 [video-pagination-storage-cleanup-test.md](./docs/guides/video-pagination-storage-cleanup-test.md)、[CLAUDE.md](./CLAUDE.md)、[docs/README.md](./docs/README.md)、[docs/operations/storage_cleanup.md](./docs/operations/storage_cleanup.md) 和 [member-c-learning-video.md](./docs/team-collaboration/member-c-learning-video.md) 中增加简易版入口。

### 验证结果

- 文档中的云函数名、页面路径、错误提示和测试步骤已与当前代码对齐。
- 本次仅新增/更新文档，未修改运行时代码，无需执行 JavaScript 语法检查。
- 文档中的云端/真机测试仍需按步骤实际执行。

## 2026-11-17 - 补充题库 P0 简易测试说明

### 问题场景

- 题库 P0 修复已经落地，但之前的操作指南偏功能说明，组长或非开发验收人不一定知道先测什么、怎么判断通过。

### 修改方案

- 新增 [docs/guides/question-bank-p0-simple-test.md](./docs/guides/question-bank-p0-simple-test.md)，用大白话写清楚：
  - 测试前要重新部署哪些云函数；
  - 5/6/7 选项题怎么测；
  - 草稿/下线题库怎么用普通用户账号验证；
  - 超过 100 道题怎么检查管理端是否完整。
- 更新 [docs/README.md](./docs/README.md) 文档导航。

### 验证结果

- 文档中的函数名、页面路径、错误提示和测试步骤已与当前代码对齐。
- 本次仅新增/更新文档，未修改运行时代码，无需执行 JavaScript 语法检查。
- 文档中的云端/真机测试仍需按步骤实际执行。

## 2026-11-17 - 题库 P0 收口：5/6 选项判分、发布状态隔离与分批查询

### 问题场景

- 编辑器、批量导入和答题页都支持 A–F 选项，但 `submitQuizAttempt` 只接受答案索引 `0–3`。5/6 选项题的正确答案如果是 E/F，用户无法答对；选择 E/F 还会直接返回“答案格式不正确”。
- `getQuizQuestions` 只过滤 `isActive: true`，没有校验题库状态；用户直接调用云函数时可以抽到草稿/下线题库的题。`submitQuizAttempt` 也只校验题目与题库的关联关系，不校验题库是否已发布，绕过前端仍可交卷得分。
- 题库模块多处直接 `.get()` 全量读取，云函数单次查询上限会导致只处理前 100 条：管理列表看不到后面的题、统计和发布校验失真、用户抽题只能从部分题目中抽、查重漏题、删除题库前关联题统计错误。

### 修改方案

- [cloudfunctions/submitQuizAttempt](./cloudfunctions/submitQuizAttempt/index.js)：
  - 答案索引上限从 `0–3` 放宽到 `0–5`，并在加载题目后按每道题的实际选项数再次校验，4 选项题仍只能提交 0–3。
  - 用户侧必须传真实题库 ID，且 `question_banks.status === 'published'`；`default_bank`、`__unassigned__`、`__all__` 被拒绝。
- [cloudfunctions/getQuizQuestions](./cloudfunctions/getQuizQuestions/index.js)：
  - 非预览模式必须传真实且已发布的题库 ID；草稿/下线题库只允许管理员 `preview` 预览。
  - 题库没有可用题目时返回“当前题库暂无可用题目”。
  - 启用题目改为分批拉取后按题库过滤。
- [cloudfunctions/saveQuizQuestion](./cloudfunctions/saveQuizQuestion/index.js)、[cloudfunctions/importQuizQuestions](./cloudfunctions/importQuizQuestions/index.js)：
  - 选项数量限制为 2–6 个（A–F），超过 6 个拒绝保存/导入。
  - 编辑历史题时如果缺少 `questionId`，自动补写一个，便于修复旧数据后正常交卷判分。
  - 查重改为分批拉取全部题目。
- [pages/question-editor](./pages/question-editor/question-editor.js)：同步增加 2–6 个选项的校验和输入提示。
- 发布校验/题库统计增加“选项数量、答案索引或 `questionId` 异常”的检查；用户抽题和题库题量统计过滤异常选项/答案/缺少题目 ID 的历史题，避免下发无法在 A–F 界面作答或无法交卷判分的题目。
- [pages/quiz](./pages/quiz/quiz.js)：删除 `default_bank` 默认值，未传题库时显示“未选择题库”；[quiz.wxml](./pages/quiz/quiz.wxml) 增加无可用题目空态。
- 题库模块全量读取改为分批拉取（每批 100 条）：
  - [getQuizQuestionList](./cloudfunctions/getQuizQuestionList/index.js)：管理题目列表。
  - [getAdminQuestionBankList](./cloudfunctions/getAdminQuestionBankList/index.js)：题库/题目统计与发布校验。
  - [getQuestionBanks](./cloudfunctions/getQuestionBanks/index.js)：用户侧题库题量。
  - [saveQuestionBank](./cloudfunctions/saveQuestionBank/index.js)：发布前题目统计。
  - [saveQuizQuestion](./cloudfunctions/saveQuizQuestion/index.js)：同题干查重。
  - [importQuizQuestions](./cloudfunctions/importQuizQuestions/index.js)：导入查重。
  - [deleteQuestionBank](./cloudfunctions/deleteQuestionBank/index.js)：删除前关联题统计。
  - [initQuestionBanks](./cloudfunctions/initQuestionBanks/index.js)：初始化关联未归档题目。
- 更新 [CLAUDE.md](./CLAUDE.md)、[docs/guides/question-bank-operation-guide.md](./docs/guides/question-bank-operation-guide.md)、[docs/guides/question-bank-redeploy-list.md](./docs/guides/question-bank-redeploy-list.md)、[docs/guides/developer-handoff.md](./docs/guides/developer-handoff.md)、[member-c-learning-video.md](./docs/team-collaboration/member-c-learning-video.md)。

### 验证结果

- `node --check` 通过：本次修改的全部题库相关云函数、`pages/question-editor/question-editor.js`、`pages/quiz/quiz.js`。
- 已完成代码层静态检查；以下云端/真机回归仍待执行：
  - 5 选项题（正确答案 E）和 6 选项题（正确答案 F）可以预览、交卷并正确判分；7 选项题被拒绝保存/导入。
  - 普通用户直接调用 `getQuizQuestions` / `submitQuizAttempt` 传草稿/下线题库 ID，返回“题库不存在或未发布”；管理员 `preview` 可以查看草稿题库。
  - 题目池超过 100 条后，管理列表、题库统计、发布校验、用户抽题、查重和删除题库检查都能覆盖全部题目。
  - 普通用户调用 `getQuizQuestions` 传 `preview: true` 返回“无管理权限，不能预览题库”。
  - 选项数或答案索引异常的历史题会阻止题库发布；用户侧抽题和题库题量统计不会包含这类题。
- 部署要求：重新部署 `getQuizQuestions`、`submitQuizAttempt`、`saveQuizQuestion`、`importQuizQuestions`、`getQuizQuestionList`、`getAdminQuestionBankList`、`getQuestionBanks`、`saveQuestionBank`、`deleteQuestionBank`；如使用初始化函数，也重新部署 `initQuestionBanks`。前端重新编译。

## 2026-11-16 - 补充视频分页与存储清理测试说明

### 问题场景

- 视频分页和旧云存储文件清理已经实现，但缺少可直接交给组长/验收人执行的手工测试步骤；仅靠 `node --check` 无法验证分页加载、权限隔离、宽限期、引用保护和实际删除行为。
- 清理函数涉及真实删除云存储文件，需要明确测试环境、测试数据、dry-run 顺序和回滚注意事项。

### 修改方案

- 新增 [docs/guides/video-pagination-storage-cleanup-test.md](./docs/guides/video-pagination-storage-cleanup-test.md)，覆盖：
  - 部署云函数、创建集合和索引、准备 21+ 条分页数据、准备清理测试文件；
  - 用户端和管理端分页测试项；
  - 替换/删除登记、dry-run、实际删除、引用保护、权限、`saveVideo` 修复验证；
  - 测试记录表、通过标准、常见问题排查和测试数据清理。
- 更新 [docs/README.md](./docs/README.md) 文档导航，并在 [docs/operations/storage_cleanup.md](./docs/operations/storage_cleanup.md) 和 [member-c-learning-video.md](./docs/team-collaboration/member-c-learning-video.md) 中增加测试说明入口。

### 验证结果

- 文档中的函数名、页面路径、权限规则和返回字段已与当前代码及 [docs/operations/storage_cleanup.md](./docs/operations/storage_cleanup.md) 对齐。
- 本次仅新增/更新文档，未修改运行时代码，无需执行 JavaScript 语法检查。
- 文档中的云端和真机测试步骤尚未执行，需要在目标云环境按清单验收。
## 2026-11-16 - 新增成员 B 审核中心分支调研报告

### 问题场景

`member-b` 提交 `4f115ec` 把页面和云函数改动放在仓库根目录，且文章评论审核链路缺少 `createComment` / `getComments` / `reviewContent` 的核心实现，无法直接合并上线。

### 修改方案

- 新增 [docs/research/review-center-branch-review-2026-11-16.md](./docs/research/review-center-branch-review-2026-11-16.md)。
- 在 [docs/README.md](./docs/README.md) 的调研分类中登记。
- 报告记录：文件路径映射、文章评论审核链路缺失、旧版本补丁覆盖风险、测试手册与代码不一致、最小修复清单和验收标准。

### 验证结果

- 已对照分支根目录文件、真实页面路径和 `createComment`、`getComments`、`reviewContent` 代码逐项核对。
- 本次仅新增调研文档，未修改运行时代码。

## 2026-11-16 - 整理 P0-01 验收记录并归档合并说明

### 问题场景

P0-01 主链路已完成真机验收，但 `CHANGELOG.md` 中 2026-11-08 和 2026-11-14 两条记录仍标记“尚未完成（需人工验收）”；根目录 `Changelog-ysy.md` 是一次性合并说明，不适合长期留在仓库根目录。

### 修改方案

- 更新 `CHANGELOG.md` 中两条 P0-01 记录的验证结果：
  - 已完成：`saveTopic` / `submitTopicComment` 部署、话题创建/配图/编辑/发布/下线、评论提交与审核通过/驳回/隐藏、旧话题兼容、图片目录、三账号页面权限显示。
  - 未单独验收但不阻塞合并：直接调用管理云函数的越权测试、Banner 本地降级图、9 图上限真机验证。
- 将 `Changelog-ysy.md` 移动到 [docs/team-collaboration/archive/Changelog-ysy.md](./docs/team-collaboration/archive/Changelog-ysy.md)，并在归档 README 中登记。
- 清理本地 `.temp/` 临时文件。

### 验证结果

- 已核对 `saveTopic` / `submitTopicComment` 已部署，真机主链路通过。
- 已确认归档路径和文档引用有效。
- 本次仅修改文档、移动合并说明和清理临时文件，未修改运行时代码。

## 2026-11-16 - 记录话题管理上传按钮布局待改进项

### 问题场景

话题管理页的「上传封面」和「添加配图」都是大号胶囊按钮，但分属封面图和正文配图两个不同区块，视觉上像同一组同级操作，层级不清晰，按钮宽度、对齐和间距也不统一。

### 修改方案

- 在 [docs/planning/improvement-backlog.md](./docs/planning/improvement-backlog.md) 新增 `IMP-007`，记录布局问题、期望结果、建议方案和验收标准。
- 将现状截图保存到 [docs/assets/improvement-backlog/IMP-007-topic-upload-buttons.png](./docs/assets/improvement-backlog/IMP-007-topic-upload-buttons.png)，并在 Backlog 中引用。
- 本次仅记录问题和截图，不修改 `topic-management` 页面代码。

### 验证结果

- 已核对当前 WXML：封面按钮在 `cover-tools`，配图按钮在 `content-image-section` 的 `section-head`，两者确实属于不同区块。
- 本次仅新增文档和截图，未修改运行时代码，无需执行 JavaScript 语法检查。

## 2026-11-16 - 补充审核、刷新与 UI 改版待改进项

### 问题场景

审核回复类任务缺少父评论上下文；多数列表页没有下拉刷新；页面 UI 缺少统一设计语言。这些问题不属于当前主链路阻塞，但会影响审核判断、内容更新效率和后续维护成本。

### 修改方案

- 在 [docs/planning/improvement-backlog.md](./docs/planning/improvement-backlog.md) 新增三条：
  - `IMP-004`：审核中心回复类任务展示父评论原文、作者和状态。
  - `IMP-005`：主要列表页补充下拉刷新，并避免与 `onShow` 重复请求。
  - `IMP-006`：小程序 UI 统一设计与改版。
- `IMP-006` 标记为 `HOLD`，并写明开工时机：至少等 P0（话题、审核、权限）和 P1（题库、题目、视频）完成并验收，同时完成文章、Banner、登录绑定、积分答题等主链路回归后，再开始设计审计和组件库。

### 验证结果

- 已核对 `getReviewTasks` 当前只补充 `parentId`，审核中心只展示父评论 ID。
- 已核对当前只有 `pages/index`、`pages/learning-records` 实现 `onPullDownRefresh`，只有 `pages/backpack`、`pages/learning-records` 开启 `enablePullDownRefresh`。
- 本次仅新增文档内容，未修改运行时代码，无需执行 JavaScript 语法检查。

## 2026-11-16 - 记录话题与视频管理的待改进项

### 问题场景

话题管理和视频管理目前依赖手动输入 ID/日期，运营使用成本高、容易填错，且编辑时难以确认关联内容是否正确。

### 修改方案

- 在 [docs/planning/improvement-backlog.md](./docs/planning/improvement-backlog.md) 新增三条待改进项：
  - `IMP-001`：话题开始/结束日期改为年-月-日轮盘选择。
  - `IMP-002`：话题关联文章/视频改为可视化选择，不再手动输入 ID。
  - `IMP-003`：视频关联文章/话题改为可视化选择，不再手动输入 ID。
- 每条记录包含状态、优先级、类型、来源、负责人、问题、期望结果、建议方案和验收标准。

### 验证结果

- 已检查条目格式与 `improvement-backlog.md` 模板一致。
- 本次仅新增文档内容，未修改运行时代码，无需执行 JavaScript 语法检查。

## 2026-11-16 - 归档二期规划并建立待改进项 Backlog

### 问题场景

`docs/planning/` 同时存放历史二期规划和当前工作，新的待改进项没有明确入口，容易和已归档的二期计划混在一起。

### 修改方案

- 将 `docs/planning/` 下的二期规划文档整体移动到 `docs/archive/phase2-planning/`，包括计划、需求、Backlog、任务拆分、验收、管理端优先级、数据模型和预算等 14 份文档。
- 新增 [docs/planning/improvement-backlog.md](./docs/planning/improvement-backlog.md)，作为当前阶段的待改进项入口，包含状态、优先级、类型、来源、负责人和验收标准模板。
- 更新 [README.md](./README.md)、[ARCHITECTURE.md](./ARCHITECTURE.md)、[CLAUDE.md](./CLAUDE.md)、[docs/README.md](./docs/README.md)、[docs/archive/README.md](./docs/archive/README.md) 和四份 `docs/team-collaboration/member-*.md` 中的规划链接。
- 归档文档内部的 `docs/planning/phase2_*` 文本引用同步改为 `docs/archive/phase2-planning/phase2_*`。

### 验证结果

- `docs/planning/` 当前只剩 `improvement-backlog.md`。
- 已执行全局检索，没有残留 `docs/planning/phase2_*`、`../planning/phase2_*` 或 `./planning/phase2_*` 引用。
- 本次仅移动和新增文档，未修改运行时代码，无需执行 JavaScript 语法检查。

## 2026-11-15 - 视频列表分页（用户端与管理端）

### 问题场景

- 用户端 `getVideos` 没有分页参数，`pages/video` 固定传 `pageSize: 20`，所以用户最多只能看到 20 条已发布视频；函数内部先取单次查询上限内的数据再内存排序，数据量增长后排序和可见性都不可靠。
- 管理端 `getAdminVideoList` 直接读取全部 `videos` 文档，没有分页，超过单次查询上限后管理页看不到后面的视频。
- 原有排序只在函数内对已取回的数据做内存排序，无法和 `skip + limit` 分页配合。

### 修改方案

- [cloudfunctions/getVideos](./cloudfunctions/getVideos/index.js)：接受 `page`、`pageSize`（默认 20，最大 50），使用 `where({ status: 'published' })` + `orderBy('sort','asc')` + `orderBy('publishedAt','desc')` + `orderBy('_id','asc')` + `skip` + `limit(pageSize + 1)` 查询，返回 `list`、`page`、`pageSize`、`hasMore`。
- [cloudfunctions/getAdminVideoList](./cloudfunctions/getAdminVideoList/index.js)：同样支持 `page`、`pageSize`，按 `sort` 升序、`updatedAt` 倒序、`_id` 升序分页。
- [pages/video/video.js](./pages/video/video.js)：改为分页加载；支持下拉刷新和触底“加载更多”；追加时按 `_id` 去重；内置演示视频只在第一页合并，避免每页重复。
- [pages/video/video.wxml](./pages/video/video.wxml)、[video.wxss](./pages/video/video.wxss)、[video.json](./pages/video/video.json)：增加加载更多/没有更多状态、下拉刷新配置。
- [pages/video-management/video-management.js](./pages/video-management/video-management.js)、[.wxml](./pages/video-management/video-management.wxml)、[.json](./pages/video-management/video-management.json)：管理列表改为分页，保存/删除后重新加载第一页；增加触底和“加载更多”按钮。
- 建议在云开发控制台为 `videos` 创建组合索引：`status` 升序 + `sort` 升序 + `publishedAt` 降序；管理端可使用 `sort` 升序 + `updatedAt` 降序。

### 验证结果

- `node --check` 通过：`cloudfunctions/getVideos/index.js`、`cloudfunctions/getAdminVideoList/index.js`、`pages/video/video.js`、`pages/video-management/video-management.js`。
- 已完成代码层静态检查；以下真机/体验版回归仍待执行：
  - 准备超过 20 条已发布视频，验证首屏 20 条、触底/按钮加载更多、无重复、末页显示“没有更多了”。
  - 管理端准备超过 20 条视频，验证分页、编辑后列表刷新、删除后列表刷新。
  - 验证下拉刷新会回到第一页，内置演示视频不会在第二页重复出现。
- 部署要求：重新部署 `getVideos`、`getAdminVideoList`；前端重新编译。

## 2026-11-15 - 视频旧云存储文件清理队列

### 问题场景

- `saveVideo` 替换视频地址或封面、`deleteVideo` 删除草稿/已下线视频记录后，旧文件仍保留在云存储中，长期占用容量并产生费用。
- `deleteVideo` 按交付约定只删除 `videos` 数据库文档，不能直接删除云存储文件；此前也没有任何清理队列或运维策略。
- `saveVideo` 编辑不存在的视频 `id` 时，`update` 实际更新 0 条却返回成功；编辑已发布视频还会把 `publishedAt` 重置为当前时间。

### 修改方案

- 新增集合 `storage_cleanup_tasks`：记录 `fileId`、`fileType`、`sourceCollection`、`sourceField`、`sourceId`、`reason`、`status`、`attempts`、`eligibleAt` 等字段。
- [cloudfunctions/saveVideo](./cloudfunctions/saveVideo/index.js)：
  - 编辑前读取原视频；视频地址或封面发生变化时，把旧的 `cloud://` 文件登记到清理队列，默认 7 天宽限期。
  - 修复编辑不存在 `id` 时静默成功的问题，返回“视频不存在或已删除”。
  - 编辑已发布视频时保留原 `publishedAt`；下线后重新发布才写入新的发布时间。
- [cloudfunctions/deleteVideo](./cloudfunctions/deleteVideo/index.js)：删除记录前把原 `videoUrl` / `coverImage` 的 `cloud://` 文件登记到清理队列；不直接调用 `cloud.deleteFile`，仍只删除 `videos` 文档。
- 新增 [cloudfunctions/cleanupStorageFiles](./cloudfunctions/cleanupStorageFiles/index.js)：
  - 小程序端默认 `dryRun: true`，只检查不删除；必须显式传 `dryRun: false` 才执行。云控制台/定时触发器未配置自动删除时同样默认 dry-run。
  - 读取 `eligibleAt <= 当前时间` 的 `pending` 任务，单次默认 20 个、最大 50 个。
  - 删除前检查 `videos`、`articles`、`topics`、`question_banks`、`banners`、`users`、`public_profiles`、`posts`、`scam_reports` 的引用（支持数组字段）；任一查询失败或结果被截断时，本批全部按“仍被引用”处理。
  - 删除失败最多重试 3 次，每次间隔 1 天；超过后标记 `failed`。
  - 小程序端调用时 `operator` 只能 dry-run，只有 `isAdmin` 可以实际删除；云控制台/定时触发器无 OPENID，默认仍为 dry-run，配置环境变量 `STORAGE_CLEANUP_AUTO_DELETE=true` 后才默认执行实际删除。
- [pages/video-management](./pages/video-management/video-management.js)：新增“存储清理”面板，operator 可检查，管理员可确认后执行删除。
- 新增 [docs/operations/storage_cleanup.md](./docs/operations/storage_cleanup.md)，并更新 [CLAUDE.md](./CLAUDE.md)、[docs/README.md](./docs/README.md)、[docs/guides/developer-handoff.md](./docs/guides/developer-handoff.md)、[member-c-learning-video.md](./docs/team-collaboration/member-c-learning-video.md)。
- 上线前已经存在的历史孤立文件不会自动入队；文档第 10 节说明了一次性盘点流程。
- 宽限期可通过环境变量 `STORAGE_CLEANUP_GRACE_DAYS` 调整（1–30 天，默认 7 天）。
- [cloudfunctions/cleanupStorageFiles/config.json](./cloudfunctions/cleanupStorageFiles/config.json) 设置 `timeout: 60`、`triggers: []`；默认不自动定时执行。

### 验证结果

- `node --check` 通过：`cloudfunctions/saveVideo/index.js`、`cloudfunctions/deleteVideo/index.js`、`cloudfunctions/cleanupStorageFiles/index.js`、`pages/video-management/video-management.js`。
- 已完成代码层静态检查；以下云端/真机回归仍待执行：
  - 替换视频地址或封面后，`storage_cleanup_tasks` 出现 `pending` 任务，`eligibleAt` 约为 7 天后。
  - 删除草稿/已下线视频后，`videos` 文档被删除，清理任务出现，云存储文件不会立即删除。
  - `cleanupStorageFiles({ dryRun: true })` 只返回待清理列表；`dryRun: false` 且管理员执行后文件被删除。
  - 仍被其他视频/文章/话题/题库/Banner/头像引用的文件被标记 `skipped_referenced`，不会删除。
  - operator 执行实际删除返回“仅管理员可以执行实际删除”；普通用户返回“无管理权限”。
- 部署要求：新增并部署 `cleanupStorageFiles`；重新部署 `saveVideo`、`deleteVideo`。首次执行前先在云开发控制台或管理页运行 dry-run。

## 2026-11-14 - P0-01 新增代码规范整改（仅限本次改动的文件）

### 问题场景

- 对照根目录 `CLAUDE.md`「调试日志规范」核对提交 `fd0154a` 的新增代码，发现新增的 4 处报错仍是散文格式（`console.error('xxx failed:', err)`），不符合「Console 日志统一为一行 JSON」。
- `cloudfunctions/submitTopicComment/index.js` 缺中文模块头注释，与「源文件通常保留中文模块头注释」不一致；本次已修改该文件的评论写入逻辑，需同步补上。
- 新增的 `utils/logger.js` 未在 `CLAUDE.md` 公共工具章节登记，违反「功能变化时同步更新相关文档」。

本次整改范围严格限定为 `fd0154a` 改动过的文件，未触碰其他成员的页面、云函数与文档。

### 修改方案

- 新增 [utils/logger.js](./utils/logger.js)：`createLogger(module)` 返回 `log(level, stage, detail)`，输出 `[module] {"ts","level","stage",...}` 单行 JSON，`level` 白名单为 `INFO`/`WARN`/`ERROR`，`detail` 不允许携带 openid 等敏感字段。
- [pages/topic-management](./pages/topic-management/topic-management.js)：接入 `createLogger('topic-management')`，把 9 处 `console.error` 全部改为结构化日志（其中 4 处为本次新增、5 处为同一文件内的历史写法，统一格式避免一个文件两种日志风格）；`stage` 使用 `covers:resolve-failed`、`list:load-failed`、`edit:resolve-images-failed`、`upload:preview-resolve-failed`、`upload:failed`、`cover:choose-failed`、`content-image:choose-failed`、`save:failed`、`delete:failed`。同时清理新增代码块中的行尾空格与多余空行。
- [cloudfunctions/saveTopic](./cloudfunctions/saveTopic/index.js)、[cloudfunctions/submitTopicComment](./cloudfunctions/submitTopicComment/index.js)：云函数目录独立部署无法跨目录 `require`，在本文件内定义同名 `log()`，异常分支分别输出 `save:failed`、`submit:failed`；`submitTopicComment` 补中文模块头注释（上游依赖、入参、输出）。
- [CLAUDE.md](./CLAUDE.md)：公共工具章节登记 `utils/logger.js`；调试日志规范补充云函数侧的实现方式。

### 验证结果

- `node --check` 通过：`utils/logger.js`、`pages/topic-management/topic-management.js`、`cloudfunctions/saveTopic/index.js`、`cloudfunctions/submitTopicComment/index.js`。
- `grep console.` 复核：上述 4 个文件中除 `log()` 内部按级别调用 `console.error/warn/log` 外，业务代码已无散文日志。
- 云函数 `exports.main` 返回结构未变（`{ success, data?, errMsg? }`），调用方无需调整；`saveTopic` 的 `contentImages` 语义（空数组清空、缺省沿用）保持不变。
- WXML/JSON 本轮未改动，无需重新校验。
- 已完成真机验收：`saveTopic` / `submitTopicComment` 已部署；话题创建、正文配图、编辑回显、发布/下线、评论提交与审核通过/驳回/隐藏均通过；`operator` / `reviewer` / 普通用户的页面入口权限显示正常。
- 未单独验收（不作为合并阻塞项）：直接调用管理云函数的越权测试、Banner 本地降级图、9 图上限真机验证；验收步骤见 PR 描述与 [docs/guides/topic-publish-test.md](./docs/guides/topic-publish-test.md)。

## 2026-11-08 - P0-01 话题发布主链路收口：正文配图、状态下标修复、Banner 图与图片目录合并

### 问题场景

- 话题正文只能写纯文本：`pages/topic-management` 只有封面图输入，`saveTopic` 也只会把 `contentText` 拆成 `text` 内容块，运营无法给话题补配图，与“话题要有文章、视频、配图等配套资源”的验收要求不一致。
- 状态下拉显示错位：`topic-management.wxml` 用 `{{statusOptions.indexOf(form.status)}}` 作为 picker 的 `value`，WXML 表达式不支持方法调用，编辑已发布（`published`）或已下线（`offline`）话题时选择器会跳回第一项 `draft`，运营容易在保存时误改状态。
- 首页轮播只有纯色渐变：`HOME_BANNERS` 只有 4 条渐变兜底，没有 Banner 图，无法直接看到图片效果。
- 图片目录重复：根目录同时存在 `image/` 与 `images/`，`image/问题已找到-修复方案/` 下 11 张截图有 8 张是完全重复的文件，另有孤立的 `image.png`。

### 修改方案

- 话题正文配图（成员 A 范围）：
  - [cloudfunctions/saveTopic](./cloudfunctions/saveTopic/index.js) 新增 `contentImages`（`[{ imageUrl, caption }]`，最多 9 张）入参，生成 `image` 内容块；内容块统一重排 `sort`，顺序为正文段落 → 配图 → `article_link` → `video_link` → 未知类型块。
    - 传空数组表示清空配图；不传该字段（旧版调用方）时沿用库内已有配图，避免历史数据被静默删除。
    - 未识别的历史内容块类型继续保留，不再因为重新保存而丢失。
  - [pages/topic-management](./pages/topic-management/topic-management.js) 新增正文配图区：`addContentImage` 选择图片后上传到云存储 `topics/content/`，`onContentImageCaptionInput` 编辑图注，`removeContentImage` 逐张移除；列表项显示配图数量。
  - 抽出 `uploadImageToCloud` / `showUploadError`，封面上传与配图上传共用云存储上传和 `-503002` 权限提示逻辑。
  - [pages/topic-detail](./pages/topic-detail/topic-detail.wxml) 配图块在 `imageUrl` 为空时只渲染图注，不再出现破图。
- 状态下标修复：新增 `data.statusIndex`，在 `editTopic` / `onStatusChange` / `resetForm` 中维护，WXML 改用 `value="{{statusIndex}}"`。
- 评论写入兼容：`submitTopicComment` 事务内 `add` 的返回值同时兼容 `_id` 与 `id`，取不到 ID 时显式报错，避免不同 `wx-server-sdk` 版本下评论写入静默失败导致评价链路断开。
- Banner 图：[images/banners/](./images/banners/) 新增 4 张 900×537 JPEG（10–12 KB）轮播背景图，`HOME_BANNERS` 增加 `image` 字段指向本地图，云端不可用时降级轮播直接出图；文案仍由页面 `slide-text` 叠加，图片本身不含文字。
  - 正式首页仍以 `banners` 集合为准，上传与写入步骤见新增的 [docs/operations/banner-image-upload.md](./docs/operations/banner-image-upload.md)。
- 图片目录合并：`image/问题已找到-修复方案/` 按 MD5 去重后保留 3 张 articles 列表截图，重命名为 `articles-list-01/02/03.png`，连同 `image.png`（重命名为 `chat-input-bar.png`）一起并入 `images/问题已找到-修复方案/`，删除根目录 `image/` 与 `image.png`。
- 文档同步：`CLAUDE.md`（社区内容块、Banner 图片、images 目录）、`images/FOLDER.md`、`pages/topic-management/FOLDER.md`、`docs/guides/topic-publish-test.md`、`docs/README.md`。

### 验证结果

- `node --check` 通过：`cloudfunctions/saveTopic/index.js`、`cloudfunctions/submitTopicComment/index.js`、`pages/topic-management/topic-management.js`、`pages/index/index.js`、`pages/topic-detail/topic-detail.js`。
- 本地离线模拟（内存数据库替换 `wx-server-sdk`，直接加载真实云函数，脚本不提交）验证主链路 42 项断言全部通过：
  - 普通用户 `saveTopic` 返回“无管理权限”；管理端列表普通用户不可读。
  - 草稿话题在 `getTopics` / `getTopicDetail` 均不可见；发布后列表可见、详情返回正文块与配图块。
  - 关联文章只返回 `status=2` 已发布记录，草稿文章被过滤；关联视频只返回 `published`。
  - 评论提交后 `comments.status = pending_review`，同时生成 `review_tasks`（`sourceId` 指向评论、状态 `pending_review`），评论回写 `reviewTaskId`；审核前讨论区为空。
  - 5 秒内重复提交被合并；高危敏感词被拦截；回复记录 `parentId` / `replyToUid`。
  - 审核通过后 `comments.status = approved` 且讨论区可见；驳回后不可见。
  - 话题下线后列表与详情均不可见；旧版调用（不传 `contentImages`）保留库内已有配图。
- 本地离线模拟验证页面逻辑 31 项断言全部通过：编辑已发布话题时 `statusIndex = 1`、正文多段拼接、配图与封面预览解析、图注写入对应下标、移除配图、保存入参（`contentImages` 只含 `imageUrl`/`caption`、不传 `coverImagePreview`）、空标题拦截、重置清空。
- WXML 标签闭合与 `{{ }}` 配对检查通过；`app.json`、页面 `.json` JSON 解析通过。
- 已完成真机回归：配图上传、预览、长图展示、编辑回显、发布/下线、评论进入 `pending_review`、审核通过/驳回/隐藏、旧话题兼容、图片目录。
- 已完成部署：`saveTopic`、`submitTopicComment` 已部署到目标云环境。
- 未单独验收（不作为合并阻塞项）：
  - 9 图上限的真机验证（离线模拟已通过）。
  - 4 张 Banner 本地降级图的真机展示，以及正式 `banners` 集合上传后的首页轮播效果。
  - 直接调用管理云函数的越权测试（页面入口权限显示已通过）。

## 2026-11-05 - 归档历史分工文档并建立当前 3+1 分工

### 问题场景

根目录的三份 `member-*.md` 和 `docs/team-collaboration/member-d-support-and-acceptance.md` 属于上一阶段分工，已经和当前“二期管理端与运营链路收口”的任务边界不一致。继续把旧文档留在根目录，容易让后续开发者误以为文章、Banner、视频仍是当前主任务。

### 修改方案

- 将以下历史分工说明移动到 `docs/team-collaboration/archive/`：
  - `member-a-article-cms.md`
  - `member-b-banner.md`
  - `member-c-video.md`
  - `member-d-support-and-acceptance.md`
- 新增 [docs/team-collaboration/archive/README.md](./docs/team-collaboration/archive/README.md)，说明归档用途。
- 新增四份按角色拆分的当前分工文档：
  - [member-a-content-community.md](./docs/team-collaboration/member-a-content-community.md)
  - [member-b-permission-review.md](./docs/team-collaboration/member-b-permission-review.md)
  - [member-c-learning-video.md](./docs/team-collaboration/member-c-learning-video.md)
  - [member-d-review-acceptance.md](./docs/team-collaboration/member-d-review-acceptance.md)
- 保留 `docs/team-collaboration/acceptance-checklist.md` 在原位置，它仍是当前使用的本地验收工作表，不归档、不纳入 Git。
- 更新 [CLAUDE.md](./CLAUDE.md) 和 [docs/README.md](./docs/README.md) 中的协作文档引用。
- 修正旧 CHANGELOG 中指向 `member-b-banner.md` 的链接路径。

### 验证结果

- 已确认根目录不再保留 `member-*.md`。
- 已更新 `CLAUDE.md`、`docs/README.md` 和旧 CHANGELOG 链接。
- 本次仅移动和新增文档，未修改运行时代码，无需执行 JavaScript 语法检查。

## 2026-11-05 - 视频管理新增非已发布视频记录删除

### 问题场景

视频管理页只能创建、编辑、发布和下线，没有删除入口；草稿和已下线视频无法清理，`videos` 集合会持续堆积。已发布视频不应从用户端被直接移除，云存储中的视频/封面文件也不应由管理端在用户端删除。

### 修改方案

- 新增 [cloudfunctions/deleteVideo](./cloudfunctions/deleteVideo/index.js)：
  - 校验 `isAdmin === true` 或 `roles` 包含 `operator`；普通用户、审核员返回“无管理权限”。
  - 只删除 `videos` 集合中的文档；`status === 'published'` 返回“已发布视频不能删除，请先下线”。
  - 不调用 `cloud.deleteFile`，`videoUrl` / `coverImage` 指向的云存储文件继续保留。
- [pages/video-management](./pages/video-management/video-management.js)：
  - 列表增加“删除记录”按钮，仅非 `published` 视频显示；已发布视频显示“已发布视频不可删除，请先下线”。
  - 使用 `catchtap` 阻止删除按钮触发列表卡的编辑事件。
  - 删除前弹出确认框，明确“仅删除数据库记录，云存储文件保留”。
  - 删除成功后刷新列表；如果删除的是当前编辑项，同时重置表单。
- 同步 [CLAUDE.md](./CLAUDE.md) 的云函数清单、视频发布步骤和部署注意事项。

### 验证结果

- `node --check cloudfunctions/deleteVideo/index.js` 通过。
- `node --check pages/video-management/video-management.js` 通过。
- **尚未完成**：未部署 `deleteVideo`，未真机验证。需部署后验收：
  - 普通用户/审核员调用返回“无管理权限”
  - `operator` 可以删除 `draft` / `offline` 记录
  - `published` 视频被拒绝删除，提示先下线
  - 删除后管理列表不再显示，云存储文件仍保留

## 2026-11-05 - 增加视频上传诊断日志与临时日志规范

### 问题场景

视频管理页上传视频时没有进度、没有成功或失败回调，页面停留在上传状态。视频使用 `wx.cloud.uploadFile` 直传云存储，不经过云函数，因此云函数日志没有记录，无法判断问题发生在选择文件、创建上传任务、上传进度还是回调阶段。

### 修改方案

- [pages/video-management/video-management.js](./pages/video-management/video-management.js) 增加统一 `[video-upload]` 前缀的 JSON 诊断日志，覆盖：
  - 选择视频/封面的开始、结果、取消、超限、失败
  - 上传任务创建、进度、10 秒心跳、成功/失败回调、同步异常
  - `saveVideo` 保存开始、成功、失败
- 新增 [logs/README.md](./logs/README.md)，规定临时日志目录、命名、Console 格式、记录文件模板和脱敏要求。
- 新增 [logs/2026-11-05-video-upload.md](./logs/2026-11-05-video-upload.md)，记录本次视频上传排查的观测点和待填日志。
- [CLAUDE.md](./CLAUDE.md) 增加“调试日志规范”，说明 `logs/` 与 `pages/logs/` 的区别、日志格式和生命周期。
- 增加开发者工具平台判断：当 `wx.chooseMedia` 返回空 `tempFiles` 时，DevTools 提示改用真机或手动填写视频地址；真机仍保留通用失败提示。
- 诊断完成后恢复视频按钮的 `disabled="{{uploadingVideo}}"`。

### 验证结果

- `node --check pages/video-management/video-management.js` 通过。
- 真机调试：选择视频、上传、进度显示均正常。
- 开发者工具（PC）：`wx.chooseMedia` 返回 `tempFilesLength: 0`，结果中包含 `failedCount`，`uploadVideo` 未被调用。视频文件存在且大小合适，确认是开发者工具对 `wx.chooseMedia` 视频选择支持不完整，不是业务代码、视频文件或云存储问题。
- 处理方式：开发者工具改用「视频地址」手动填写，或使用真机调试；页面已增加 DevTools 专用提示。

## 2026-11-05 - 修复 getArticleDetail 未定义常量导致文章详情全部失败

### 问题场景

真机点击文章后，无论文章是否存在、是否为已发布状态，都提示“文章不存在或已下线”。云函数日志显示：

```text
ReferenceError: PUBLISHED_STATUS_VALUES is not defined
    at exports.main (/var/user/index.js:69:22)
```

`getArticleDetail` 只定义了 `PUBLISHED_STATUS`，但查询条件使用了未定义的 `PUBLISHED_STATUS_VALUES`。异常被外层 `catch` 捕获后返回 `{ success: false, errMsg: 'PUBLISHED_STATUS_VALUES is not defined' }`，客户端没有展示 `errMsg`，统一显示为“文章不存在或已下线”，因此看起来像数据问题。

### 修改方案

- [cloudfunctions/getArticleDetail/index.js](./cloudfunctions/getArticleDetail/index.js) 补充：
  ```js
  const PUBLISHED_STATUS_VALUES = [PUBLISHED_STATUS, String(PUBLISHED_STATUS)]
  ```
  与 `getArticles` 保持一致，兼容数字 `2` 与字符串 `'2'`。
- [pages/article-detail/article-detail.js](./pages/article-detail/article-detail.js) 在云函数明确失败和调用异常时输出 `console.error`，避免真实错误被统一提示掩盖。
- 不改动查询字段、返回结构和发布状态规则。

### 验证结果

- `node --check cloudfunctions/getArticleDetail/index.js` 通过。
- `node --check pages/article-detail/article-detail.js` 通过。
- 已确认 `PUBLISHED_STATUS_VALUES` 在 `getArticleDetail` 中已定义，其他文章云函数没有同类未定义引用。
- 已在微信开发者工具中重新部署 `getArticleDetail`，真机复测文章详情可正常打开，原“文章不存在或已下线”问题消失。
- **仍待验收**：文章草稿/已发布边界（首页、搜索、已知草稿 ID、相关推荐），以及其余 4 个文章云函数（`getArticles`、`searchArticles`、`getTopicDetail`、`getVideoDetail`）的部署版本和真实环境效果。

## 2026-11-03 - 视频管理页新增本地视频/封面上传

### 问题场景

视频发布此前要求先把视频和封面手动上传到云存储，再把 cloud:// 文件 ID 粘贴到 pages/video-management 保存。管理员必须切换到微信开发者工具或云开发控制台完成上传，操作门槛高且容易选错云环境。member-c-video.md 第二阶段要求管理页自动上传，并保持 draft 发布语义。

### 修改方案

- 只改 pages/video-management（.js/.wxml/.wxss），不改 videos 数据模型，不改 saveVideo/getVideos 等云函数。
- 视频：wx.chooseMedia({ mediaType: ['video'] }) 选择（不做时长限制），校验大小不超过 1GB（MAX_VIDEO_SIZE）；wx.cloud.uploadFile 以 success/fail 回调形式调用并返回 UploadTask，通过 task.onProgressUpdate 显示进度（纯 Promise 形式返回的对象没有该方法），成功后自动回填 form.videoUrl，并用选择器返回的时长自动填写 form.duration。
- 封面：wx.chooseMedia({ mediaType: ['image'] }) 选择，校验不超过 20MB（MAX_COVER_SIZE）；上传到 video-covers/ 前缀路径，成功后回填 form.coverImage，用 resolveCloudFileUrls 解析出临时 URL 显示预览图。coverImagePreview 是页面顶层字段，不进入保存 payload。
- 五种状态均有处理：上传中（按钮禁用、视频显示进度条、封面显示 loading）、成功（toast 并回填）、用户取消（静默返回）、失败（console.error + toast）、权限不足（-503002 或 storage permission denied 时 wx.showModal 提示到云开发控制台开启存储上传权限，与话题管理页一致）。
- 上传成功只改表单内容，不自动发布；保存仍按表单 status（默认 draft）走 saveVideo，上传期间点击保存会被拦截并提示。
- 编辑回显：editVideo 对 cloud:// 封面调用 resolveCloudFileUrls 解析预览图。
- 不删除旧文件：换新视频或封面后，旧资源仍保留在云存储中。

### 验证结果

- node --check pages/video-management/video-management.js 通过。
- 开发者工具实测发现：纯 Promise 形式的 wx.cloud.uploadFile 返回对象没有 onProgressUpdate 方法，上传视频时报 TypeError，已改为 success/fail 回调形式获取 UploadTask，进度监听恢复正常。
- 开发者工具实测视频上传成功，进度显示正常。
- 尚未完成：待真机/体验版回归（选择、取消、超限、权限不足、保存后保持 draft、封面预览、旧资源保留、云端与小程序同一环境）。
- 云环境：cloud1-d8gvez9rg8eb96b20，上传文件所在环境必须与小程序当前环境一致。

## 2026-11-03 - 文章发布状态与标签映射改动落地到实际路径

### 问题场景

此前两次 `Add files via upload` 提交把文章发布状态修复和标签映射工具放在 `changed/` 目录及根目录裸文件中，小程序实际读取的路径没有被修改：

- `cloudfunctions/getArticles`、`getArticleDetail`、`searchArticles` 仍未过滤 `status = 2`，草稿仍可能出现在列表、详情和搜索结果中。
- `cloudfunctions/getTopicDetail`、`getVideoDetail` 的相关文章查询仍未过滤草稿。
- `pages/index`、`pages/search`、`pages/article-detail` 仍未使用 `utils/article-tags`，CMS 枚举编号会原样显示。
- 根目录的 `index.js`、`article-detail.js`、`search.js`、`article-tags.js` 不在小程序编译路径中，不会被加载。

### 修改方案

- 将 `changed/` 中的 9 个文件落地到真实路径：
  - `cloudfunctions/getArticleDetail/index.js`、`getArticles/index.js`、`getTopicDetail/index.js`、`getVideoDetail/index.js`、`searchArticles/index.js`
  - `pages/article-detail/article-detail.js`、`pages/index/index.js`、`pages/search/search.js`
  - `utils/article-tags.js`
- 删除 `changed/` 暂存目录和根目录 4 个错误位置的副本。
- 根 `CHANGELOG.md` 保留 `2026-10-31` 的原始变更说明，本次仅补充落地记录。

### 验证结果

- 对 9 个落地文件执行 `node --check`，全部通过。
- 已核对 `getArticles`、`getArticleDetail`、`searchArticles` 均包含 `PUBLISHED_STATUS = 2` 过滤。
- 已核对 `getTopicDetail`、`getVideoDetail` 的相关文章查询过滤 `status` 为 `2`/`'2'`。
- 已核对三个页面正确引用 `utils/article-tags`。
- **尚未完成**：未部署 5 个云函数，也未在微信开发者工具/真实云环境验收草稿不可见、草稿 ID 无法打开详情、草稿不出现在相关推荐。

## 2026-11-02 - 修复首页 Banner 在 tabBar 切回后不刷新、失败不重试

### 问题场景

首页的 `loadBanners()` 只在 `onLoad()` 中触发。首页属于 tabBar 页面，用户切走再切回时仅执行 `onShow()`，因此：

- `index:banners:v2` 缓存超过 10 分钟 TTL 后，本次会话内仍会持续展示旧 Banner；CMS 中已修改或停用的内容不会更新。
- 首次请求失败进入 `HOME_BANNERS` 降级（或保留旧内容）后，没有任何重试入口，只能等待页面实例重建。

### 修改方案

- [pages/index/index.js](./pages/index/index.js) 新增 `maybeRefreshBanners()`，并在 `onLoad()` 和 `onShow()` 中调用：
  - 缓存过期或不存在时请求 `getBanners`；TTL 内不请求。
  - 上次请求失败时，下次 `onShow` 直接重试，不受 TTL 限制。
  - 云端成功返回空列表时按 TTL 节流，避免每次切回首页都请求。
- `loadBanners()` 增加 `_bannerLoading` 同步置位和 `finally` 复位，保证 `onLoad` 与紧随其后的 `onShow` 共用同一次请求，不重复调用云函数。
- 请求失败时记录 `_bannerLoadFailed`，成功后清除；空列表成功时记录 `_bannerEmptyAt`。
- 同步更新 [CLAUDE.md](./CLAUDE.md) 中 Banner 刷新时机和验收说明。

### 验证结果

- `node --check pages/index/index.js` 通过。
- 使用临时 Node 桩（未提交）模拟页面生命周期，以下场景全部通过：
  - `onLoad` + 紧随的 `onShow` 只调用一次 `getBanners`；
  - 缓存 TTL 内切回不请求，超过 10 分钟后 `onShow` 触发刷新；
  - 首次请求失败进入 `fallback`，下次 `onShow` 重试并恢复 `cloud` 状态；
  - 云端返回空列表后 TTL 内不重复请求，过期后重新请求。
- **尚未完成**：未在微信开发者工具/真机连接真实云环境验证 tabBar 切换和真实 CMS 数据更新。

## 2026-11-02 - 补全 CLAUDE.md 的命令、页面、云函数与集合清单

### 问题场景

`CLAUDE.md` 已覆盖 Banner、视频和文章发布链路，但缺少可直接执行的验证命令，导致后续开发者容易误以为仓库存在根目录 `npm test`/`npm run build`。同时前端页面清单遗漏 `account`、`bind-student`、`learning-records`、`points-history`、`redeem-info`、`video`、`video-detail`；云函数清单遗漏学习记录、积分流水、题库管理、话题删除、反馈提交等函数；数据库清单遗漏 `sign_records`、`user_achievements`、`user_backpack`、`feedback_records`、`titles`、`achievements`、`scam_reports` 和学校字典集合。

### 修改方案

- 在 [CLAUDE.md](./CLAUDE.md) 新增“常用命令与验证方式”，说明仓库没有根目录 npm 工程、lint 或自动化测试，并给出 `node --check`、批量语法检查、云函数依赖安装和 Cloudbase CLI 部署命令。
- 补全页面、云函数和数据库集合清单，并标注 `pages/logs/` 未在 `app.json` 注册。
- 新增 `utils/` 公共工具职责说明，记录积分商城功能开关 `pointsMallEnabled: false` 的当前状态。
- 补充登录缓存（5 分钟）、学生绑定提醒（12 小时）和 `aiChat` 只读取 `process.env` 的环境变量说明。

### 验证结果

- 逐项对照 `app.json`、`cloudfunctions/` 目录、各云函数 `package.json`、`utils/` 源码和 `grep` 到的集合名核对清单。
- 本次仅修改文档，未改变运行时代码，无需执行 JavaScript 语法检查。

## 2026-11-02 - 修复 Banner 查询先限量后排序的问题

### 问题场景

`getBanners` 在数据库查询阶段先 `limit(100)` 再在内存排序。启用 Banner 超过 100 条时，排序优先级更高的新记录可能因为未进入前 100 条而无法展示。

### 修改方案

- 调整 [cloudfunctions/getBanners/index.js](./cloudfunctions/getBanners/index.js) 查询顺序：先在数据库按 `sort` 升序、`updatedAt` 倒序、`createdAt` 倒序排序，再执行 `limit(100)`。
- 保留原有本地 `compareBanner` 排序与字段清洗逻辑，避免返回结构变化。

### 验证结果

- 已执行 `node --check cloudfunctions/getBanners/index.js`，语法检查通过。

## 2026-11-02 - 汇总 Banner 合并临时文档

### 问题场景

Banner 分支保留了一份合并期说明，其中包含部署环境、CMS 测试数据、缓存刷新和合并后校验要求。该文件属于一次性过程材料，若直接删除会丢失部分仍有价值的运维约束；同时手册中的 Banner 调用关系仍写成直接查询数据库，与当前实现不一致。

### 修改方案

- 将 Banner 云函数部署环境、测试数据边界、缓存刷新和真实环境验收要求汇总到 [CLAUDE.md](./CLAUDE.md)。
- 将 Banner 成员的部署与验收步骤补充到 [member-b-banner.md](./docs/team-collaboration/archive/member-b-banner.md)。
- 将 [docs/manual/MANUAL_SPECIFICATION.md](./docs/manual/MANUAL_SPECIFICATION.md) 的首页依赖关系修正为调用 `getBanners` 云函数。
- 保留正式文档作为长期依据，合并期说明不再承担长期维护职责。

### 验证结果

- 已逐项对照 `Changelog-b.md`，保留其长期有效的部署、缓存和验收信息。
- 本次仅修改文档和文档中的调用关系说明，未改变运行时代码；无需重新执行 JavaScript 语法检查。
- 已确认 [docs/guides/developer-handoff.md](./docs/guides/developer-handoff.md)、[docs/guides/project-handoff.md](./docs/guides/project-handoff.md) 和四份 `member-*.md` 属于正式交接/协作资料，不纳入临时文档删除范围。

## 2026-11-01 - 视频发布闭环第一阶段验收

### 问题场景

- 视频模块的管理端与用户端链路已存在（[CLAUDE.md](./CLAUDE.md)「视频：已有标准发布链路」），但此前未按 member-c-video.md 第一阶段标准在真实环境完成人工验收。
- 本次需要确认管理员创建/编辑/草稿/发布/下线、用户侧可见性与播放、普通用户权限隔离是否可用。

### 修改方案

- 本次为纯验收，未修改任何页面、云函数或数据模型，无新部署。
- 按 member-c-video.md 第一阶段验收标准和 docs/team-collaboration/acceptance-checklist.md 清单执行（该清单为本地验收记录，不纳入 Git）。
- 媒体资源按现行流程：云开发控制台手动上传云存储 → 将 cloud:// 文件 ID 填入视频管理页。

### 验证结果

已通过（微信开发者工具 + 当前绑定云环境）：

- 管理员创建、编辑视频；标题/视频地址必填校验生效。
- 状态流转 draft → published → offline 正常。
- 草稿与下线视频对普通用户不可见；published 视频在用户列表可见。
- 用户侧封面显示、视频可播放。
- 关联文章、关联话题在详情页展示并可跳转。
- 普通用户调用 saveVideo、getAdminVideoList 返回「无管理权限」。

### 已知问题（非本轮引入）

- 用户视频列表顶部仍显示内置「精选短片」占位卡（无封面、无播放地址），点入详情显示「暂无可播放视频地址」；正式运营前需补真实资源或移除该兜底（utils/defaultVideos.js）。
- getVideos 无分页：已发布视频超过 100 条时更早的视频不会出现在列表。
- 管理页暂无本地文件选择和自动上传能力；自动上传属第二阶段 feature/video-media-upload，本轮不涉及。

### 环境与部署注意事项

- 本轮无代码修改，无需重新部署云函数。
- 本次验收云环境：cloud1-d8gvez9rg8eb96b20；验收所用小程序、云函数、云数据库与云存储均在该环境。
- getVideos、getVideoDetail、getAdminVideoList、saveVideo 四个云函数需保持部署在同一目标云环境。
- 验收所用媒体需与小程序位于同一云环境的云存储，cloud:// 文件 ID 才能解析为临时 URL。

### 后续

- 第一阶段验收已全部通过，可进入第二阶段（管理页自动上传 feature/video-media-upload）。
- 正式运营前处理内置「精选短片」占位卡与 getVideos 分页问题（见「已知问题」）。

## 2026-10-31 - 文章用户侧发布状态边界修复

### 问题场景

CMS 文档约定文章 `status = 1` 草稿、`status = 2` 已发布，但用户侧读取链路此前未统一过滤发布状态：

- `getArticles` 返回的文章列表包含草稿，草稿会出现在首页。
- `getArticleDetail` 仅按文章 ID 读取，已知草稿/下架 ID 也能打开用户详情。
- `searchArticles` 搜索结果包含草稿。
- 文章详情、话题详情、视频详情中的相关文章查询未过滤草稿，草稿可能出现在相关推荐。
- 文章不存在、草稿、下架三种场景的返回结构和用户提示不一致。

### 修改方案

- 三个用户侧云函数统一使用 `PUBLISHED_STATUS = 2` 常量，约定 `status = 1` 草稿、`status = 2` 已发布：
  - `cloudfunctions/getArticles/index.js`：查询条件固定 `status = 2`，列表与总数统计均只统计已发布文章；失败返回统一为 `{ success: false, errMsg }`，不再返回成功形状的 `data`。
  - `cloudfunctions/getArticleDetail/index.js`：文章读取改为按 `{ _id, status = 2 }` 查询，文章不存在、草稿、下架统一返回 `{ success: false, errMsg: '文章不存在或未发布' }`。
  - `cloudfunctions/searchArticles/index.js`：搜索条件使用 `_.and([{ status: 2 }, 关键词或条件])`，搜索结果只包含已发布文章。
- 相关推荐过滤：`getArticleDetail` 的相关文章查询增加 `status = 2`；`getTopicDetail`、`getVideoDetail` 中按 ID 拉取相关文章时同步过滤 `status = 2`，避免草稿出现在相关推荐。
- 详情页用户提示：`pages/article-detail/article-detail.js` 在云函数明确返回失败（文章不存在或未发布）时提示“文章不存在或已下线”，不再落入数据库直读或本地演示兜底；云函数异常（网络/云环境不可用）时保留兜底，且数据库直读兜底仅加载 `status = 2` 的已发布文章。
- 保持 CMS 管理方式不变，未新增小程序文章管理页。

### 验证结果

- `node --check cloudfunctions/getArticles/index.js` 通过。
- `node --check cloudfunctions/getArticleDetail/index.js` 通过。
- `node --check cloudfunctions/searchArticles/index.js` 通过。
- `node --check cloudfunctions/getTopicDetail/index.js`、`node --check cloudfunctions/getVideoDetail/index.js` 通过。
- `node --check pages/article-detail/article-detail.js` 通过。
- 仍需在微信开发者工具中对 `getArticles`、`getArticleDetail`、`searchArticles` 三个云函数执行“上传并部署：云端安装依赖”，并在真实云环境完成草稿不可见、已知草稿 ID 无法打开详情、草稿不出现在相关推荐的验收。

## 2026-10-30 - 首页 Banner 接入 CMS `banners` 集合

### 问题场景

首页轮播图一直是 [pages/index/index.js](./pages/index/index.js) 中写死的 `HOME_BANNERS`（4 条只有文字和渐变的本地数据），`loadBanners()` 只是复制这份本地数组，不会请求云端。

同时 `CMS使用文档.md` 已经设计了 `banners` 集合（`title`、`desc`、`icon`、`image`、`bgColor`、`link`、`sort`、`status`），但仓库里既没有 `getBanners` 云函数，首页也没有任何查询该集合的代码。结果是运营在 CMS 里新增或停用轮播图，首页毫无变化。

### 修改方案

- 新增 [cloudfunctions/getBanners](./cloudfunctions/getBanners/index.js)：
  - 查询 `banners` 集合，只返回 `status === true` 的记录；
  - 按 `sort` 升序，`sort` 相同时按 `updatedAt`/`createdAt` 倒序；
  - 只下发 `title`、`desc`、`icon`、`image`、`bgColor`、`link`、`sort`，不透出管理字段；
  - 集合未创建（`-502005`）按空集合返回 `success: true` + `emptyReason: 'collection_not_exist'`，其他数据库异常返回 `success: false` + `errCode: 'BANNERS_QUERY_FAILED'`，不使用成功形状的静默兜底。
- 重写首页 `loadBanners()`，改为调用 `getBanners`：
  - 复用 [utils/cloud.js](./utils/cloud.js) 的 `resolveCloudFileUrls()` 转换 `cloud://` 图片，HTTPS 地址直接使用；
  - 继续使用 `index:banners:v2` 本地缓存，TTL 10 分钟不变；
  - 云端成功但返回空列表时进入空态并清除旧缓存，不再把旧缓存当作最新结果；
  - 云函数失败且没有可用内容时才回落到 `HOME_BANNERS`，并在轮播下方显示“云端轮播暂不可用”；
  - `cloud://` 解析失败时清空图片，由 `bgColor`/默认渐变兜底。
- `link` 增加白名单校验（`REGISTERED_PAGES`，与 `app.json` 的 38 个页面一致）：未注册路径和站外地址直接丢弃，点击不跳转也不报错；tabBar 页面改用 `wx.switchTab`，避免 `navigateTo` 打开 tab 页失败。
- [pages/index/index.wxml](./pages/index/index.wxml)、[pages/index/index.wxss](./pages/index/index.wxss) 增加“暂无轮播内容”空态和降级提示样式。
- 未改动首页文章加载、文章缓存和本地文章示例逻辑。

### 验证结果

- `node --check cloudfunctions/getBanners/index.js` 通过。
- `node --check pages/index/index.js` 通过。
- 用临时桩环境（`wx-server-sdk` 与 `wx` 均为本地桩，未提交）覆盖以下场景，全部通过：
  - `status=false` 与缺失 `status` 的记录被过滤，`sort` 升序与同 `sort` 的时间倒序正确；
  - 空集合返回 `emptyReason: 'collection_not_exist'`，数据库异常返回 `success: false`；
  - 云端成功时链接白名单、`cloud://` 转临时地址、HTTPS 原样保留、无图片用默认渐变；
  - 云端返回空列表时清除 `index:banners:v2` 并进入空态；
  - 云函数失败时无缓存回落 4 条本地渐变 Banner，有缓存则保留缓存不覆盖；
  - 图片解析失败清空 `image`、点击无链接/未注册链接不跳转、tabBar 链接走 `switchTab`。
- 脚本校验 `REGISTERED_PAGES` 与 `app.json` 的 `pages`、`TAB_BAR_PAGES` 与 `tabBar.list` 完全一致。
- `git diff --check` 通过。
- **尚未完成**：未在微信开发者工具/真机连接真实云环境验收（需先部署 `getBanners` 并准备 `banners` 数据）。

### 部署与环境注意事项

- 必须把 `getBanners` 上传并部署到与小程序相同的云环境，否则首页会一直走本地降级（控制台日志 `loadBanners 失败`）。
- `banners` 集合按 CMS 文档创建；`status` 必须是布尔值 `true`，写成字符串 `"true"` 不会显示。
- `image` 填 `cloud://` 文件 ID 或 HTTPS 地址均可；使用云存储时需确保资源在同一云环境。
- 新增、编辑、启停 Banner 后，验收前需清除 `index:banners:v2` 缓存或等待 10 分钟 TTL。
- 后续在 `app.json` 新增页面时，需要同步 `pages/index/index.js` 的 `REGISTERED_PAGES`，否则 Banner 无法跳转到新页面。

### 文档同步（补正）

Banner 接入完成后，根目录 `CLAUDE.md` 仍有多处描述与代码不一致，本次一并补正：

- 云函数业务域补充 `getBanners`；
- `CMS使用文档` 条目去掉“设计中的 `banners`”表述；
- 修正 `member-d-support-and-acceptance.md` 的实际路径，并明确 `docs/team-collaboration/` 只忽略验收清单、分工文档仍需入库；
- “当前已知架构缺口”中删除“缺少 `getBanners`”，改为记录仍缺少 Banner 管理页、`saveBanner` 和媒体上传能力；
- 首页行为约定补充第 8 条：下拉刷新只刷新文章，不重新请求 Banner。

同时修正 [docs/manual/test-cases/functional/TC-01-home.md](./docs/manual/test-cases/functional/TC-01-home.md) 的 TC-01-003：原预期“链接无效则显示提示”与新实现不符，现实现为未注册链接被丢弃、不跳转不弹提示，仅输出控制台日志。

本次只改文档，不涉及代码行为，因此未单独新增功能条目；语法检查无需重跑。

## 2026-10-29 - 话题封面上传与预览修复

### 已完成

- 话题管理页支持选择本地图片或拍照，并通过 `wx.cloud.uploadFile` 上传到云存储。
- 封面上传路径统一为 `topics/covers/时间戳-随机字符串.扩展名`。
- 将数据库保存用的 `cloud://` 文件 ID 与页面预览用的临时 HTTPS 地址分开：
  - `coverImage`：保存到话题数据中的云文件 ID；
  - `coverImagePreview`：仅用于管理页面显示，不写入数据库。
- 话题列表加载时批量解析云存储封面地址。
- 编辑已有话题时解析并回显封面。
- 新上传封面后立即显示预览。
- 清空封面时同时清除原始文件 ID和页面预览地址。
- 保存话题时排除 `coverImagePreview`，避免把临时字段写入数据库。
- 使用 [utils/cloud.js](./utils/cloud.js) 中的 `resolveCloudFileUrls()` 和缓存机制，将 `cloud://` 文件 ID 转换为临时 URL。
- 对云存储上传权限不足增加明确提示，指导管理员到当前云环境开启小程序端上传权限。

### 本次修复的问题

此前封面即使上传成功，返回的 `cloud://` 文件 ID 也不能稳定直接用于 `<image>` 预览，导致：

- 新上传封面后管理页不显示；
- 话题列表封面不显示；
- 编辑已有话题时封面无法回显。

### 修正记录

在代码复核中发现本次分支初始修改存在两个语法/运行问题，已修正：

- 删除 `getCloudFunctionErrorMessage` 的重复引入；
- 将使用 `await resolveCloudFileUrls()` 的 `editTopic` 改为 `async`；
- 确保编辑表单写入 `coverImagePreview`。

### 存储注意事项

- 每次上传都会在云存储新增一个文件，重新上传不会自动覆盖旧文件。
- 替换或清空封面后，旧文件当前不会自动删除，可能产生未引用的云存储文件。
- 后续如需自动清理，应遵循“先成功保存数据库，再删除旧文件”的顺序，并记录删除失败。

### 当前验证

- `node --check pages\topic-management\topic-management.js` 通过。
- `git diff --check` 通过。
- 仍需在微信开发者工具中验证真实云环境下的上传、列表预览、编辑回显和清空保存。

## 2026-10-26 - 本地文章演示数据提示

### 已完成

- 保留首页和文章详情页的本地示例数据作为开发及云端故障时的兜底。
- 首页使用本地文章兜底时显示“当前为演示数据”。
- 文章详情使用本地 `mockArticles` 时显示“当前为演示文章”。
- 同时增加一次 Toast 提示，明确告知用户云端内容暂时不可用。
- 云端文章恢复成功后自动取消演示状态。
- 在 [CLAUDE.md](./CLAUDE.md) 中明确本地示例不是正式运营内容。

### 解决的问题

此前云函数或云数据库异常时，页面可能直接显示写死的示例文章，用户无法判断这些内容是否来自正式 CMS。现在保留兜底能力，同时明确标识演示状态，避免掩盖云端配置或部署问题。

## 文章内容管理调研结论

### 当前已经打通的链路

文章的正式管理方式是 CMS/云端后台，不是小程序内编辑：

```text
管理员进入 CMS
→ 在 articles 内容集合新建或编辑文章
→ 填写标题、分类、标签、正文、封面和发布时间
→ 正文图片/视频通过富文本编辑器上传
→ 保存为草稿
→ 管理员审核后改为已发布
→ getArticles/getArticleDetail/searchArticles 提供给小程序
```

当前不新增小程序文章管理页、文章编辑页、`saveArticle` 或 `getAdminArticleList`。

### 文章媒体处理

- `coverImage` 保存文章封面资源地址。
- `content` 保存富文本正文以及正文内图片、视频等媒体引用。
- CMS 负责上传媒体；仓库没有文章专用 `uploadMedia` 云函数。
- CMS、`articles` 集合、云存储媒体和小程序必须使用同一个云环境。
- 首页文章首屏有 `index:articles:first-page` 缓存，TTL 为 3 分钟。

### 已知代码缺口

CMS 文档约定：

```text
status = 1：草稿
status = 2：已发布
```

但当前用户侧读取链路尚未统一过滤发布状态：

- `getArticles` 未严格限制 `status=2`；
- `getArticleDetail` 按文章 ID 读取，未校验发布状态；
- `searchArticles` 未严格限制 `status=2`；
- 相关文章查询也需要同步检查。

因此“CMS 操作流程已经打通”和“草稿不可见规则已经由代码保证”是两件不同的事。后续应单独修复并测试列表、搜索、详情和相关推荐。

## Banner 调研结论

### 当前实现

- 首页使用 `pages/index/index.js` 中的 `HOME_BANNERS` 本地固定数据。
- 当前 Banner 主要是标题、描述和渐变背景，不是 CMS 动态数据。
- 首页没有调用 `getBanners`，仓库也没有该云函数。
- WXML 已支持图片、背景色和跳转字段，但实际动态数据链路尚未接通。

### 后续规划（已于 2026-10-30 落地，见本文首条记录）

如进入实现阶段，需要新增并验证：

- `banners` 内容集合和 `getBanners` 云函数；
- 只返回启用状态的 Banner；
- 按 `sort` 排序；
- 解析 `cloud://` 图片地址；
- 首页缓存、空数据和云端失败兜底；
- Banner 跳转路径校验。

以上各项已在 2026-10-30 的 `getBanners` 接入中实现，本节保留为当时的调研结论记录；当前实现事实以本文首条记录和 [CLAUDE.md](./CLAUDE.md) 为准。

## 视频内容调研结论

### 当前已经存在的链路

视频已有基本的管理和用户播放流程：

```text
管理员视频页面
→ saveVideo
→ videos 集合
→ getVideos/getVideoDetail
→ 用户端播放
```

- 用户端只读取 `status = published` 的视频。
- 视频管理页支持新增、编辑和状态管理。
- `saveVideo` 会校验标题和视频地址，发布时写入 `publishedAt`。

### 当前发布方式和限制

- 视频文件目前需要先手动上传到微信云存储。
- 获取 `cloud://` 文件 ID 后，再填入视频管理页面的 `videoUrl`。
- 视频封面同样需要提供资源地址。
- 管理页面目前没有统一的本地视频选择和自动上传按钮。
- `utils/defaultVideos.js` 仍保留没有真实资源的内置演示视频，正式运营前应补充资源或明确其演示状态。

未来可以使用 `wx.chooseMedia` 和 `wx.cloud.uploadFile` 自动上传，但这项工作暂不与当前文章、Banner 工作混合。

## 协作与部署约定

- `main` 是稳定分支，仓库规则要求通过 Pull Request 合并，不能直接 push。
- 每个功能从 `main` 创建独立的 `feature/*`、`fix/*` 或 `docs/*` 分支。
- GitHub PR 的目标仓库应确认是自己的 fork `Kaltsit-is-my-wife/anti-fraud`，而不是上游仓库。
- 代码合并到 GitHub 不等于云函数已经更新；修改云函数后仍需在微信开发者工具中执行“上传并部署：云端安装依赖”。
- `project.config.json` 是共享配置；`project.private.config.json` 可能覆盖同名本地配置，不应随意覆盖其他成员的私有配置。

## 后续优先级

1. 修复文章列表、详情、搜索和相关推荐的 `status` 过滤。
2. 用 CMS 完成一次草稿、发布、图片和视频媒体的真实验收。
3. 确认本地演示兜底不会被误认为正式内容。
4. 实现 Banner CMS 动态读取。
5. 再评估视频管理页的本地文件自动上传和旧媒体清理。

## 2026-10-30 - 整理项目文档目录

### 问题场景

- 大量规划、部署、指南和调研文档直接堆在 `docs/` 根目录，查找成本较高。
- 部分文档仍引用旧的平铺路径，移动后容易产生失效链接。
- 多人协作分工和验收资料属于本地临时资料，不应混入正式项目文档或 Git 提交。

### 修改方案

- 按用途将正式文档整理到：
  - `docs/planning/`：二期规划、需求、任务、验收、数据模型和预算；
  - `docs/operations/`：部署、云环境和数据运维；
  - `docs/guides/`：交接、专项功能和操作指南；
  - `docs/research/`：性能调查和问题分析。
- 将题库导入样例放入 `docs/guides/`。
- 保留 `docs/archive/` 作为历史归档，不改变其用途。
- 将本地协作资料继续放在已忽略的 `docs/team-collaboration/`，不纳入 Git。
- 重写 `docs/README.md` 作为分类导航，更新仓库内文档引用。
- 在 `CLAUDE.md` 增加文档目录选择规则，规定新增或移动文档时必须同步导航和引用。

### 验证结果

- 已确认正式文档按分类移动完成。
- 已确认本地协作资料通过 `.gitignore` 排除。
- 已检查仓库内旧平铺文档路径引用并完成更新。
- `git diff --check` 通过。

## 2026-10-30 - 调整多人协作文档跟踪范围

### 问题场景

- 成员 A、B、C、D 的分工文档已移动到根目录，但原先 `.gitignore` 忽略整个 `docs/team-collaboration/`，文档定位不够清晰。
- 分工说明属于团队共享约定，应能通过 Git 和 PR 同步；验收清单可能记录本地环境和账号，不应提交。

### 修改方案

- 将成员 D 分工文档移到根目录，与其他成员分工文档保持一致。
- 保留根目录四份 `member-*.md` 分工文档并纳入 Git 跟踪。
- 将 `.gitignore` 从忽略整个协作目录收窄为只忽略 `docs/team-collaboration/acceptance-checklist.md`。
- 同步更新 `CLAUDE.md` 和 `docs/README.md`，明确分工文档与本地验收表的不同定位。

### 验证结果

- 已确认四份根目录成员分工文档可被 Git 识别为未跟踪文件，后续可正常 `git add`。
- 已确认本地验收清单仍被 `.gitignore` 忽略。
- `git diff --check` 通过。
