# 待测试项目清单

本文件记录已经完成代码改动、但仍需要在微信开发者工具或真实云环境验证的项目。测试完成后勾选并在 `CHANGELOG.md` 或验收记录中补充结果。

> 更新：2026-11-23，相关云函数已部署，PR #10 已合并；本文档剩余项均为待测试/待补测。

状态说明：

- `待测试`：代码已完成，尚未验证
- `阻塞`：验证前不能开放相关能力
- `已延期`：当前数据或环境不满足，后续补测

## 1. 文章/帖子评论审核链路

状态：部分通过（文章评论与话题评论已验证；帖子评论本轮跳过；普通用户越权待测）
来源：成员 B 审核中心补丁 + 2026-11-23 云函数补齐 + 帖子评论审核改造
部署状态：`createComment`、`getReviewTasks`、`reviewContent` 已部署（2026-11-23 21:59–22:02）

验证项：

- [x] 普通用户发表文章评论后，`comments.status = pending_review`
- [x] 同时创建 `review_tasks`，`targetType = article_comment`
- [x] 评论回写 `reviewTaskId`
- [x] 审核中心能看到文章评论任务
- [x] `reviewTask` 能看到评论原文、提交人、文章 ID、父评论信息
- [x] 审核通过后 `comments.status = approved`
- [x] 通过后 `getComments` 返回该评论，文章详情可见
- [x] 驳回后 `getComments` 不返回
- [x] 隐藏后 `getComments` 不返回
- [ ] 帖子评论审核链路（本轮跳过：`createPost` 已停用、`posts` 集合不存在；`post_comment` 代码已部署，需构造测试帖后补测）
- [x] 回复通知仅在审核通过后发送（文章评论已验证：通过后 1 条，驳回 0 条；帖子评论本轮跳过）
- [x] 审核中心风险等级、命中关键词展示没有回退（话题评论命中「微信」，显示中风险）
- [ ] 普通用户直接调用审核函数返回“无审核权限”（无 OPENID 直调已验证；普通账号待测）

验证记录（2026-11-23，环境 `cloud1-d8gvez9rg8eb96b20`）：

- 评论 `04f2d8196b043ed20047c91a6ae749d7`（文章 `7cc5dc476af8665800a27639572b2c63`）：创建后 `pending_review`；审核任务 `04f2d8196b043ed20047c91b5714e662` 为 `article_comment`，评论 `reviewTaskId` 已回写。
- 审核通过后，评论与审核任务均变为 `approved`，`reviewedBy / reviewerUid / reviewedAt` 同步写入；文章详情页可见。
- 提交账号 `Lucas`（uid `906141632`）当前为 `isAdmin: true`、`roles: []`。`createComment` 对文章评论没有管理员旁路，普通用户路径相同，但“普通用户”口径仍建议用 `isAdmin: false` 账号复测一次。
- 驳回评论 `40f4bc076b04443201e7e191311a63c6`：`status = rejected`；审核任务 `40f4bc076b04443201e7e1927be584dd` 同步为 `rejected`。
- 隐藏评论 `40f4bc076b04443901e7e1bb013f0e35`：`status = hidden`；审核任务 `40f4bc076b04443901e7e1bc58c65656` 同步为 `hidden`。
- `getComments` 可见集查询（`approved` + `published`）不包含上述驳回/隐藏评论。
- 2026-11-23 产品决策：社区帖子评论（`targetType: post`）改为需要审核。`createComment`、`getReviewTasks`、`reviewContent` 和审核中心页面代码已修改；此前新增的“帖子评论”测试实际落在 `topic_comment`（话题「个人信息保护专题」），未覆盖 `targetType: post`。
- 三个函数已部署（2026-11-23 21:59–22:02）：`getReviewTasks`、`reviewContent` 由用户上传，`createComment` 由 Claude 补传并核对 `CodeInfo` / `ModTime`；审核中心页面仍需重新编译。
- 社区发帖入口已停用（`createPost` 返回“暂不支持公开发帖”），当前环境 `posts` 集合不存在；`post_comment` 路径需构造测试帖或直接调用 `createComment` 才能验证，正常用户界面无法覆盖。
- 文章回复评论 `40f4bc076b04480401e8e321561b724e`（父评论「妈妈」、`replyToUid = 676183682`）：审核通过后评论与任务均为 `approved`；`notifications` 只新增 1 条，`payload.commentId` 指向该评论，通知 `createdAt` 与审核 `reviewedAt` 一致，证明是审核通过时发送。
- 驳回回复 `57d2a7aa6b0448c800a4dcc9483e31e7`（`测试评论-驳回`）：`status = rejected`；`notifications` 未新增，未向被回复者发送通知。
- 话题评论 `d5063e8e6b0448270039d1cb32ecafc9`（`微信-测试`）：审核任务 `keywordHitLevel = medium`、`keywordHits = ["微信"]`，审核中心显示中风险；通过后评论状态为 `approved`。
- 无 OPENID 直调 `getReviewTasks` / `reviewContent` 已返回“无审核权限”，`createComment` 返回“用户不存在”；三个函数已加空值守卫并部署（2026-11-23）。普通登录用户越权仍需用 `isAdmin: false`、`roles: []` 账号复测。见 `IMP-010`。

相关文档：

- [审核中心测试手册](../guides/review-center-test.md)
- `docs/planning/improvement-backlog.md` 的 `IMP-009`

## 2. 存储清理 P0 修复

状态：部分通过（UI、`dryRun:false` 拦截、dry-run 不改状态、删除文案通过；普通用户/operator 待测；100+ 引用功能测试延期）
来源：2026-11-23 代码审查修复
部署状态：`cleanupStorageFiles` 已部署（2026-11-23）；实际删除保持关闭

验证项：

- [x] 管理页只显示“检查待清理文件”，不显示“执行清理”
- [x] 未配置 `STORAGE_CLEANUP_ALLOW_REAL_DELETE` 时，`dryRun: false` 返回“引用检查尚未覆盖全部内容，暂不支持实际删除”
- [ ] 普通用户调用返回“无管理权限”
- [ ] operator 调用实际删除被“仅管理员”拦截
- [x] dry-run 只检查，不修改任务状态
- [ ] 引用查询能跨 100 条分页，超过 100 条引用的文件仍被识别为“仍被引用”（代码审查通过，功能测试延期）
- [x] 删除视频确认文案为“删除记录并登记旧文件到清理队列”

验证记录（2026-11-23，环境 `cloud1-d8gvez9rg8eb96b20`）：

- 管理页：`STORAGE_CLEANUP_DELETE_UI_ENABLED = false`，只渲染“检查待清理文件”，不渲染“执行清理”；删除视频确认文案包含“删除数据库记录”和“登记到云存储清理队列”（用户已在模拟器确认）。
- `dryRun: false`：用户在模拟器 Console 调用 `cleanupStorageFiles({ dryRun: false })`，返回“引用检查尚未覆盖全部内容，暂不支持实际删除”；未配置 `STORAGE_CLEANUP_ALLOW_REAL_DELETE`，未删除任何文件。
- dry-run 不修改任务：临时插入任务 `d5063e8e6b044ae50039e4d968ab7bcb`（fake `cloud://` fileId、`status: pending`、`eligibleAt` 为过去时间），调用 `cleanupStorageFiles({ dryRun: true })`：`scanned = 1`、`candidateCount = 1`、`referencedCount = 0`；任务仍为 `pending`，无 `checkedAt` / `deletedAt`，`updatedAt` 未变。测试后已删除该任务。
- 普通用户 / operator 权限：待用对应账号复测。
- 100+ 引用分页：代码审查通过（100 条分批、上限 10000、截断或查询失败时全部按已引用处理）；功能测试延期，需构造 101 条引用数据。

相关文档：

- [云存储旧文件清理说明](../operations/storage_cleanup.md)
- [视频分页与存储清理测试说明](../guides/video-pagination-storage-cleanup-test.md)

## 3. 存储清理引用扫描补齐

状态：代码完成，dry-run 已验证；实际删除仍关闭，待测试环境验证后开放
来源：`IMP-008 D`

`cleanupStorageFiles` 现已覆盖：

- `topics.contentBlocks[].imageUrl`
- `articles.content` 富文本
- `articles.videoUrl`、`posts.coverImage`
- `products` / `feedback_records` / `quiz_questions` 的图片字段
- `notifications.payload`
- `titles.icon` / `achievements.icon`

验证项：

- [x] 在 dry-run 中补充上述引用后，文件不会被列为候选
- [x] 补齐前不配置 `STORAGE_CLEANUP_ALLOW_REAL_DELETE`
- [ ] 补齐后仅在测试环境验证实际删除
- [x] 测试完成后恢复默认关闭（本轮未开启实际删除）

验证记录（2026-11-23，环境 `cloud1-d8gvez9rg8eb96b20`）：

- 构造 3 条测试队列：话题正文配图文件、文章富文本文件、无引用文件。话题文档写入 `contentBlocks[].imageUrl`，文章文档写入 `content` HTML 中的 `cloud://` 文件 ID。
- 调用 `cleanupStorageFiles({ dryRun: true })`：`scanned = 3`、`candidateCount = 1`、`referencedCount = 2`，唯一候选为无引用文件；话题配图和文章富文本中的文件均被识别为“仍被引用”。
- 三个任务保持 `pending`，无 `checkedAt` / `deletedAt`，`updatedAt` 未变；测试用的 topic / article / task 已删除。
- 实际删除仍关闭：未配置 `STORAGE_CLEANUP_ALLOW_REAL_DELETE`，未执行 `dryRun: false` 的真实删除。

相关文档：

- `docs/operations/storage_cleanup.md`
- `docs/planning/improvement-backlog.md` 的 `IMP-008`

## 4. 视频分页

状态：部分通过（API 分页、组合索引、`getVideos` 旧版修复已验证；21 条 UI 测试和管理端分页待补测）
来源：`IMP-008 B`

验证项：

- [ ] 准备 21 条以上已发布 `[TEST]` 视频（当前仅 3 条已发布，UI 测试跳过）
- [x] 用户端分页、加载更多、无重复（cloud function 用 `pageSize:1` 验证 3 页；21 条 UI 待补测）
- [ ] 下拉刷新回到第一页（代码审查通过，UI 待补测）
- [x] 内置演示视频只出现在第一页（代码审查：`mergeBuiltinVideos` 仅在 `nextPage === 1` 时合并）
- [ ] 管理端分页、编辑/删除后刷新（代码审查通过；需管理员账号和更多数据补测）
- [x] `videos` 组合索引已创建
- [x] `getVideos` 云端旧版已修复，返回 `page` / `pageSize` / `hasMore`

验证记录（2026-11-23，环境 `cloud1-d8gvez9rg8eb96b20`）：

- `videos` 当前共 4 条：3 条 `published`、1 条 `offline`，不足以做 21 条 UI 分页测试。
- 修复前云端 `getVideos` 仍是旧版：`pageSize:1` 连续调用返回同一条视频，响应没有 `page` / `pageSize` / `hasMore`。
- 补传 `getVideos` 后，`pageSize:1` 验证：第 1/2/3/4 页分别为「戒赌小视频」/「111」/「6」/空，`hasMore` 为 `true` / `true` / `false` / `false`，无重复。
- 已创建 `videos` 组合索引 `status_1_sort_1_publishedAt_-1` 和 `sort_1_updatedAt_-1`，索引列表已确认。
- `getAdminVideoList`、`saveVideo`、`deleteVideo` 已补空 OPENID 守卫；MCP 直调 `getAdminVideoList` / `saveVideo` 返回“无管理权限”。

后续视频待办（2026-11-23 记录，本次不处理）：

- 核查 `getVideoDetail` 及视频模块其他云函数是否已部署到当前版本（`getVideos` 曾为旧版）。
- 用户端 21 条视频 UI 分页、下拉刷新、内置视频首屏展示待补测。
- 管理端分页、编辑/删除后刷新待补测。
- `utils/defaultVideos.js` 内置演示视频仍缺真实资源。
- PC 端视频/封面上传链路未实现。

相关文档：

- [视频分页与存储清理简易测试](../guides/video-pagination-storage-cleanup-simple-test.md)

## 5. 题库 P0 与迁移

状态：部分通过（草稿隔离、题库函数版本、5/6 选项抽题、默认 10 题、历史题清理、initQuestionBanks 已验证；答题交卷、7 选项拒绝、管理员预览、100+ 题待补测）
来源：`IMP-008 C`

验证项：

- [ ] 5 选项题（正确答案 E）可预览、交卷、判分（抽题/选项已验证；交卷判分待 UI）
- [ ] 6 选项题（正确答案 F）可预览、交卷、判分（抽题/选项已验证；交卷判分待 UI）
- [ ] 7 选项题保存/导入被拒绝（代码已部署；管理员 UI/Console 待复测）
- [x] 草稿/下线题库不能被普通用户抽到
- [ ] 管理员可以预览草稿题库（无 OPENID 守卫已验证；管理员 UI 预览待测）
- [ ] 超过 100 道题时管理列表、统计、抽题完整（当前已发布题库 17 道启用题；代码使用分批拉取，功能测试延期）
- [x] 历史题 `default_bank` / `bankIds` / `questionId` 已核查（4 道历史测试/异常题已软禁用）
- [x] 执行 `initQuestionBanks` 后默认题库关联正确（`linked = 0`，题库已存在）
- [ ] 至少一个已发布题库可正常答题（17 道启用题、默认 10 题；交卷待 UI）

验证记录（2026-11-23，环境 `cloud1-d8gvez9rg8eb96b20`）：

- 云端题库函数普遍是旧版：`getQuizQuestions` 没有已发布校验，草稿题库可直接抽到 10 道题。已重新部署 `getQuizQuestions`、`submitQuizAttempt`、`saveQuizQuestion`、`getQuestionBanks`、`getQuizQuestionList`、`getAdminQuestionBankList`、`saveQuestionBank`、`deleteQuestionBank`、`deleteQuizQuestion`、`updateQuestionBankRelation`、`importQuizQuestions`、`initQuestionBanks`。
- 草稿题库 `04f2d8196b01c26a0030aa216d2a3e71` 无 `preview` 抽题 → “题库不存在或未发布”；无 OPENID `preview` → “无管理权限，不能预览题库”。
- 公开题库列表 → `大学生反诈基础题库`，`questionCount = 4`。
- 已发布题库抽题返回 4 道有效题，包含 6 选项 E（`选E`）和 6 选项 F；临时插入 5 选项 E 测试题后抽到 `count = 5`，测试题已删除。
- `submitQuizAttempt` 无 OPENID → “用户不存在”；`getQuizQuestionList` / `getAdminQuestionBankList` 无 OPENID → “无管理权限”。
- 历史异常题 `9a378bfc6b01c31f023b12026ef00670`：缺少 `questionId`、`bankIds`、`bankId`，会被抽题过滤；建议软禁用（`isActive: false`）。修改已有题被权限分类器拦截，待用户确认。
- `saveQuizQuestion` / `importQuizQuestions` 的 7 选项校验已随当前版本部署；需管理员 UI/Console 复测。
- 题库填充：新增 16 道反诈题（含 1 道 5 选项 E、3 道 6 选项 F），已发布题库启用题从 4 道变为 17 道；`defaultQuestionCount` 已改为 10。
- 历史题清理：软禁用 4 道题（`9a378bfc...` 缺 `questionId` / `bankIds`；`76dc6f...a219` 答案错误；`40af8c...953d` 选项/答案错误；`40f4bc...92b0` 为“选E”测试题）。
- `initQuestionBanks` 返回 `linked = 0`，`getQuestionBanks` 返回 `questionCount = 17`、`defaultQuestionCount = 10`。

相关文档：

- [题库 P0 修复简易测试](../guides/question-bank-p0-simple-test.md)
- `docs/planning/improvement-backlog.md` 的 `IMP-008`

## 6. 题库管理 UI 回归

状态：待测试
来源：2026-11-20 页面改动

验证项：

- [ ] 题库管理页各输入框 placeholder 正常显示，输入后消失
- [ ] 题目编辑页正确答案选择器随选项数量变化 A–F
- [ ] 难度选择器显示 1–5
- [ ] 选项固定 2–6 行，可添加/删除
- [ ] 删除当前正确选项后答案索引正确收敛
- [ ] 7 个选项无法添加或保存

相关文档：

- [docs/guides/question-bank-p0-simple-test.md](../guides/question-bank-p0-simple-test.md)

## 7. 合并与部署收尾

状态：部分完成

- [x] 提交本轮云函数改动
- [x] 部署 `createComment`、`getComments`、`getReviewTasks`、`reviewContent`
- [x] 部署 `cleanupStorageFiles`（保持实际删除关闭）
- [x] PR #10 合并到 `main`
- [ ] 重新编译小程序并做体验版回归
- [ ] 合并后由 D 按本清单补验收
