# 待改进项 Backlog

本文件记录当前阶段发现的产品、体验、技术债、安全和运维改进项。它不是已完成变更记录；已完成项写入根目录 `CHANGELOG.md`。

历史二期规划文档已归档到 [docs/archive/phase2-planning/](../archive/phase2-planning/)，仅用于追溯，不作为当前开发依据。

## 使用说明

每条改进项至少包含以下字段：

```text
- 状态：TODO / DOING / DONE / HOLD
- 优先级：P0 / P1 / P2
- 类型：产品 / 技术债 / 体验 / 安全 / 运维
- 来源：验收 / 代码审查 / 线上反馈 / 规划
- 负责人：
- 问题：
- 期望结果：
- 验收标准：
- 建议开工时机：（可选，用于需要等待其他模块稳定的条目）
- 关联文档/PR：
```

约定：

- 编号使用 `IMP-001`、`IMP-002` 递增，后续在 PR、验收记录和 `CLAUDE.md` 中引用编号。
- 完成后把状态改为 `DONE`，不要直接删除条目；实际修改仍写入 `CHANGELOG.md`。
- 需要先调研、比较方案的条目，可以同时在 `docs/research/` 建调研记录，并在这里链接。
- 长期架构缺口可以在 `CLAUDE.md` 的「当前已知架构缺口」写一句结论，并链接到对应 `IMP-xxx`。

## 条目

### IMP-001 话题开始/结束日期改为日期轮盘选择

- 状态：TODO
- 优先级：P2
- 类型：体验
- 来源：用户反馈 / 话题管理验收
- 负责人：待分配
- 问题：
  - `pages/topic-management/topic-management.wxml` 中开始日期、结束日期是普通 `input`，用户需要手动输入 `YYYY-MM-DD`。
  - 手动输入容易格式错误，保存时才发现日期不合法；移动端输入体验差。
- 期望结果：
  - 点击日期字段唤起微信日期选择器（年-月-日轮盘）。
  - 选择后写入 `form.startAt` / `form.endAt`，格式保持 `YYYY-MM-DD`。
  - 支持清空日期；开始日期晚于结束日期时阻止保存并提示。
  - 编辑已有话题时正确回显日期。
- 建议方案：
  - 使用 `picker mode="date"`，绑定 `startAt` / `endAt` 的 change 事件。
  - 保留现有保存校验，日期仍按字符串 `YYYY-MM-DD` 传给 `saveTopic`。
- 验收标准：
  - 点击开始/结束日期不再需要键盘输入。
  - 选择日期后表单正确显示，保存后 `topics.startAt` / `topics.endAt` 正确。
  - 开始日期晚于结束日期时无法保存，并有明确提示。
  - 编辑已有话题时日期回显正确。
- 关联文档/PR：
  - `pages/topic-management/topic-management.wxml`
  - `pages/topic-management/topic-management.js`

### IMP-002 话题关联文章/视频改为可视化选择

- 状态：TODO
- 优先级：P1
- 类型：体验 / 数据正确性
- 来源：用户反馈 / 话题管理验收
- 负责人：待分配
- 问题：
  - `pages/topic-management/topic-management.wxml` 中关联文章、关联视频是 `textarea`，要求手动输入或粘贴文档 `_id`，逗号分隔。
  - 运营很难知道 ID 对应哪篇内容，容易填错、重复或关联到已下线内容；编辑时只能看到一串 ID。
- 期望结果：
  - 增加「选择关联文章」「选择关联视频」入口，打开选择面板。
  - 面板展示已发布文章的标题、分类/标签、封面（可选），支持按标题搜索。
  - 视频面板展示已发布视频的标题、封面、分类，支持搜索。
  - 支持多选；已选内容以标题/卡片形式展示，可单独移除。
  - 保存时仍写入 `relatedArticleIds` / `relatedVideoIds`，数据契约不变。
  - 编辑已有话题时，将已有 ID 解析为标题展示；已删除或不可见的 ID 明确标记为失效，允许移除。
- 建议方案：
  - 优先做一个可复用的内容选择弹层/组件，供话题管理和视频管理共用。
  - 文章数据用 `getArticles`（已发布、支持 `keyword`）；视频数据用 `getVideos`（已发布）。
  - 只允许关联用户侧可见的已发布内容；如果需要关联草稿，需单独确认权限和展示规则。
  - `getVideos` 当前没有完整分页，选择面板需要搜索或分页，避免只看到前 50 条。
- 验收标准：
  - 不再需要手动输入文章/视频 ID。
  - 选择后保存，`topics.relatedArticleIds` / `relatedVideoIds` 正确。
  - 编辑时能看到对应标题，而不是裸 ID。
  - 失效 ID 有提示且可移除，不会造成死链。
  - 只展示允许关联的已发布内容。
- 关联文档/PR：
  - `pages/topic-management/topic-management.wxml`
  - `pages/topic-management/topic-management.js`
  - `cloudfunctions/getArticles`
  - `cloudfunctions/getVideos`

### IMP-003 视频关联文章/话题改为可视化选择

- 状态：TODO
- 优先级：P1
- 类型：体验 / 数据正确性
- 来源：用户反馈 / 视频管理验收
- 负责人：待分配
- 问题：
  - `pages/video-management/video-management.wxml` 中关联文章、关联话题是 `textarea`，依赖手动输入或粘贴 ID。
  - 运营无法直观确认关联内容，容易填错或关联到已下线内容；编辑时只显示 ID 文本。
- 期望结果：
  - 增加「选择关联文章」「选择关联话题」入口。
  - 文章面板展示已发布文章标题、分类/标签，支持搜索。
  - 话题面板展示已发布话题标题、摘要、封面，支持搜索。
  - 支持多选、移除；保存时写入 `relatedArticleIds` / `relatedTopicIds`，数据契约不变。
  - 编辑时把已有 ID 解析为标题；失效 ID 标记并允许移除。
- 建议方案：
  - 与 IMP-002 共用同一个内容选择组件，只切换数据类型和展示字段。
  - 文章用 `getArticles`，话题用 `getTopics`；只允许关联已发布内容。
  - 如后续需要关联草稿内容，需明确管理端权限和用户侧展示规则。
- 验收标准：
  - 不再需要手动输入文章/话题 ID。
  - 选择后保存，`videos.relatedArticleIds` / `relatedTopicIds` 正确。
  - 编辑时显示标题而不是裸 ID。
  - 失效 ID 有提示且可移除，不会造成死链。
  - 只展示允许关联的已发布内容。
- 关联文档/PR：
  - `pages/video-management/video-management.wxml`
  - `pages/video-management/video-management.js`
  - `cloudfunctions/getArticles`
  - `cloudfunctions/getTopics`

### IMP-004 审核中心回复类任务展示父评论原文

- 状态：TODO
- 优先级：P1
- 类型：审核 / 体验
- 来源：审核流程验收
- 负责人：待分配
- 问题：
  - 回复类审核任务目前只带 `parentId`，审核中心界面只显示「父评论ID」。
  - 审核员看不到被回复的那条已发布评论的原文、作者和当前状态，无法判断回复是否断章取义或上下文是否违规。
- 期望结果：
  - 回复任务卡片展示父评论摘要或原文、作者昵称和当前状态。
  - 父评论已删除或不可见时，明确显示「原评论已删除/不可见」，而不是只显示裸 ID。
  - 必要时提供进入原话题/原评论的入口。
- 建议方案：
  - 在 `getReviewTasks` 收集任务里的 `parentId`，批量查询 `comments`，补充 `parentContent`、`parentAuthorNickName`、`parentStatus` 到 `sourceMeta`。
  - 避免逐条查询造成 N+1；只下发审核判断所需字段，不额外暴露手机号、学号等敏感信息。
  - `pages/review-center` 增加父评论展示区，保留现有父评论 ID 作为辅助信息。
- 验收标准：
  - 回复类任务能看到父评论原文或摘要、作者和状态。
  - 父评论缺失时显示明确占位，不出现空区块或报错。
  - 审核通过/驳回/隐藏后，父评论展示状态与实际数据一致。
  - 不新增敏感字段泄露。
- 关联文档/PR：
  - `cloudfunctions/getReviewTasks`
  - `pages/review-center/review-center.js`
  - `pages/review-center/review-center.wxml`
  - `cloudfunctions/getTopicComments`

### IMP-005 列表页面补充下拉刷新

- 状态：TODO
- 优先级：P2
- 类型：体验
- 来源：用户反馈
- 负责人：待分配
- 问题：
  - 目前只有 `pages/index` 和 `pages/learning-records` 的 JS 实现了 `onPullDownRefresh`，只有 `pages/backpack` 和 `pages/learning-records` 的 JSON 开启了 `enablePullDownRefresh`。
  - 绝大多数列表页只能通过切页或重新进入刷新，内容更新后用户无法主动拉取最新数据。
- 期望结果：
  - 主要列表页支持下拉刷新，刷新完成后正确停止动画。
  - 刷新失败有提示，不清空已有内容。
  - 表单页、聊天页等不适合下拉刷新的页面不强行添加。
- 建议方案：
  - 页面 JSON 增加 `"enablePullDownRefresh": true`。
  - 页面 JS 增加 `onPullDownRefresh`，复用现有 `load...` 方法，`finally` 中调用 `wx.stopPullDownRefresh()`。
  - 避免与 `onShow` 自动刷新产生重复请求；必要时加 `isRefreshing` 或请求去重。
  - 建议覆盖：首页、社区、话题详情、视频列表、答题排行榜、消息、积分记录、学习记录、审核中心、管理端列表。
- 验收标准：
  - 下拉后触发一次刷新，动画正常结束。
  - 成功时数据和空态正确，失败时保留旧数据并有提示。
  - 不出现重复请求或刷新后页面闪烁。
  - 不适合刷新的页面保持原状。
- 关联文档/PR：
  - `pages/*/*.json`
  - `pages/*/*.js`
  - `app.json`

### IMP-006 小程序 UI 统一设计与改版

- 状态：HOLD
- 优先级：P2
- 类型：体验 / 设计
- 来源：规划 / 用户反馈
- 负责人：待分配
- 问题：
  - 页面在多个阶段逐步开发，颜色、字号、间距、卡片、按钮、表单、空态和错误提示不统一。
  - 缺少统一的设计 token 和可复用组件，后续每加一个页面都容易继续分叉。
- 期望结果：
  - 形成统一的设计语言：颜色、字体层级、间距、圆角、阴影、按钮、卡片、表单、标签、空态、错误态和加载态。
  - 高频用户页和主要管理页使用统一的组件和交互反馈。
  - 改版不改变现有业务逻辑、数据结构和权限边界。
- 建议方案：
  - 先做设计审计和 token 定义，再抽组件库（按钮、卡片、表单、空态、弹层、列表项等）。
  - 按页面分批迁移：先高频用户页（首页、社区、答题、视频、我的），再管理页（话题、审核、视频、题库）。
  - 与功能开发分开排期，避免一边改 UI 一边改数据模型和状态流转。
- 建议开工时机：
  - **不要现在开工。**
  - 至少等 P0 的「话题发布主链路 + 审核中心闭环 + 权限与云环境基线」完成并验收。
  - 至少等 P1 的「题库管理 + 题目管理 + 视频管理收口」完成并验收。
  - 同时完成文章、Banner、登录/绑定、积分/答题等现有主链路的回归，确认页面结构和数据契约不再大改。
  - 满足以上条件后，先做设计审计和组件库，再逐页迁移；改版期间尽量冻结新页面结构。
- 验收标准：
  - 有可执行的设计规范和 token 清单。
  - 目标页面使用统一组件，视觉和交互一致。
  - 改版后核心功能、权限和状态流转无回归。
  - 空态、错误态、加载态、长文本和不同机型下表现正常。
- 关联文档/PR：
  - `app.wxss`
  - `pages/*/*.wxss`
  - 规划新增的 `components/` 组件目录

### IMP-007 话题管理「上传封面 / 添加配图」布局不协调

- 状态：TODO
- 优先级：P2
- 类型：体验 / UI
- 来源：用户反馈 / 话题管理验收
- 负责人：待分配
- 问题：
  - 「上传封面」按钮位于封面输入框下方，使用大号胶囊按钮。
  - 「添加配图」按钮位于正文配图区块的标题行，同样是大号胶囊按钮。
  - 两个按钮分属“封面图”和“正文配图”两个不同区块，但视觉上像同一层级的两个主操作，层级不清晰，按钮宽度、对齐和间距也不统一。
  - 当前现状截图：

    ![话题管理上传按钮现状](../assets/improvement-backlog/IMP-007-topic-upload-buttons.png)
- 期望结果：
  - 将“封面图”和“正文配图”拆成两个清晰的表单区块，各自有明确的区块标题和说明。
  - 两个区块的按钮样式、尺寸、对齐方式保持一致，但不要让人误以为是同一组操作。
  - 「上传封面」与封面输入框、预览图放在一起；「添加配图」与配图数量、配图列表放在一起。
  - 保持现有上传、重新上传、清空封面、添加配图、图注、移除功能不变。
- 建议方案：
  - 在 WXML 中增加 `form-section` / `section-head` 结构，分别包裹封面区和正文配图区。
  - 统一使用 `mini-btn` 样式，固定高度和圆角；封面按钮右对齐，配图按钮与数量标签同一行。
  - 正文配图为空时，可以把「添加配图」做成虚线添加卡片，与已有配图列表区分。
  - 仅调整布局和样式，不改上传逻辑、字段名和保存结构。
- 验收标准：
  - 封面区和正文配图区在视觉上明确分开。
  - 两个按钮样式一致但不形成误导性的同级主操作。
  - 不同机型下按钮不溢出、不换行错位。
  - 上传封面、重新上传、清空封面、添加配图、图注、移除均正常。
- 关联文档/PR：
  - `pages/topic-management/topic-management.wxml`
  - `pages/topic-management/topic-management.wxss`
  - 现状截图：`docs/assets/improvement-backlog/IMP-007-topic-upload-buttons.png`

### IMP-008 PR11 合并前待验证清单（存储清理 P0 修复 + 分页/题库）

- 状态：TODO
- 优先级：P0
- 类型：验证
- 来源：代码审查 / PR #11 收尾
- 负责人：待分配
- 问题：
  - 2026-11-23 已修复存储清理的三个 P0 问题（引用查询分批、实际删除默认关闭、删除确认文案），但尚未在真实数据上验证。
  - PR #11 的视频分页、题库 P0、存储清理整体仍有未完成的真实验收项。
- 待验证项：

  A. 存储清理 P0 修复（本次改动，先验证）

  - [ ] 重新部署 `cleanupStorageFiles`（不配置 `STORAGE_CLEANUP_ALLOW_REAL_DELETE`）。
  - [ ] 管理页只显示“检查待清理文件”，不显示“执行清理”。
  - [ ] 管理员/operator 调用 `cleanupStorageFiles({ dryRun: false })` 返回“引用检查尚未覆盖全部内容，暂不支持实际删除”。
  - [ ] 普通用户调用返回“无管理权限”；operator 先被“仅管理员”拦截。
  - [ ] dry-run 只检查不删除，任务保持 `pending`。
  - [ ] 引用查询能跨 100 条分页，超过 100 条引用的文件仍被识别为“仍被引用”，不出现在候选列表。
  - [ ] 删除视频确认文案为“删除记录并登记旧文件到清理队列”，不再写“文件会保留”。

  B. 视频分页（暂按通过，补数据后补测）

  - [ ] 准备 21 条以上已发布 `[TEST]` 视频。
  - [ ] 用户端分页、加载更多、无重复、下拉刷新、内置视频只出现在第一页。
  - [ ] 管理端分页、编辑/删除后刷新。
  - [ ] 确认 `videos` 组合索引已创建。

  C. 题库 P0 真实数据回归

  - [ ] 5/6 选项题答题判分正确（`submitQuizAttempt` 已重新部署）。
  - [ ] 草稿/下线题库不被普通用户抽到；管理员可预览。
  - [ ] 超过 100 道题时管理列表、统计、抽题仍完整。
  - [ ] 核查历史题 `default_bank` / `bankIds` / `questionId`，执行 `initQuestionBanks` 后默认题库关联正确。
  - [ ] 至少一个已发布题库可正常答题。

  D. 存储清理引用扫描补齐（后续，阻塞实际删除）

  - [ ] `topics.contentBlocks[].imageUrl`
  - [ ] `articles.content` 富文本
  - [ ] `products` / `notifications` 等其他集合
  - 补齐后先在测试环境配置 `STORAGE_CLEANUP_ALLOW_REAL_DELETE=true` 验证实际删除，再考虑正式环境开放。

- 期望结果：上述 A、B、C 项通过，D 项补齐后，PR #11 才可安全合并并开放实际删除。
- 验收标准：按 `docs/guides/video-pagination-storage-cleanup-*-test.md` 和 `docs/guides/question-bank-p0-simple-test.md` 逐项勾选。
- 关联文档/PR：
  - PR #11
  - `cloudfunctions/cleanupStorageFiles/index.js`
  - `pages/video-management/video-management.js`
  - `docs/operations/storage_cleanup.md`

### IMP-009 文章评论回复通知延后到审核通过

- 状态：TODO
- 优先级：P1
- 类型：审核 / 体验
- 来源：代码审查 / 文章评论审核补齐
- 负责人：待分配
- 问题：
  - `createComment` 对文章评论在提交时立即发送回复通知，即使评论仍处于 `pending_review`。
  - 评论被驳回或隐藏后，被回复者仍会收到一条指向不可见评论的通知。
- 期望结果：
  - 文章评论只在审核通过后发送回复通知；待审核、驳回、隐藏都不发送。
  - 帖子评论保持立即通知，不受影响。
  - 同一条评论只通知一次，重复审核或重复调用不重复发送。
- 建议方案：
  - `createComment` 对文章评论不在提交时写 `notifications`，把 `replyToUid`、`parentId`、`targetId` 保存在评论或审核任务上。
  - `reviewContent` 在审核通过时创建通知；驳回/隐藏不创建。
  - 通知 payload 保留 `commentId`，用于去重和排查。
- 验收标准：
  - 待审核/驳回/隐藏的文章评论不产生通知。
  - 审核通过后产生且只产生一条通知。
  - 帖子评论仍立即通知。
  - 通知点击后能进入正确的文章详情。
- 关联文档/PR：
  - `cloudfunctions/createComment/index.js`
  - `cloudfunctions/reviewContent/index.js`
  - `notifications` 集合
  - [docs/guides/review-center-test.md](../guides/review-center-test.md)
