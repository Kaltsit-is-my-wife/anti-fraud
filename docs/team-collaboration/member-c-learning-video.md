# 成员 C：学习内容与视频收口（吴礼回）

## 你的定位

你负责题库、题目和视频三条学习内容链路，让运营可以在管理端维护内容，并保证用户侧只看到已发布内容。

## 当前主任务：P1 题库、题目和视频闭环

### 题库与题目

页面：

- `pages/question-bank-management`
- `pages/question-editor`
- `pages/quiz-home`
- `pages/quiz`

云函数：

- `getAdminQuestionBankList`
- `saveQuestionBank`
- `getQuestionBanks`
- `getQuizQuestionList`
- `saveQuizQuestion`
- `deleteQuizQuestion`
- `updateQuestionBankRelation`
- `getQuizQuestions`
- `submitQuizAttempt`

交付物：

- 管理员可以创建、编辑、发布、下线题库
- 管理员可以新增、编辑、停用题目
- 题目可以绑定到指定题库
- 用户可以从题库入口进入并完成答题
- 交卷后答案、选项和解析正确
- 草稿/下线题库和题目不出现在用户侧

验收标准：

- 至少准备 2 个题库，其中 1 个为 `published`
- 用户侧可以看到已发布题库
- 草稿/下线题库不出现在 `quiz-home`
- 题目停用后不出现在管理列表和用户抽题结果中
- 交卷结果中的答案索引和解析正确
- 普通用户不能调用题库/题目管理函数

## 题库当前状态（2026-11-17）

- 5/6 选项题：**已处理**。选项统一支持 2–6 个（A–F），`answerIndex` 范围 0–5；`submitQuizAttempt` 会按每道题的实际选项数再次校验。
- 草稿/下线题库隔离：**已处理**。`getQuizQuestions` / `submitQuizAttempt` 要求题库 `status === 'published'`，草稿/下线题库只允许管理员通过 `preview` 预览。
- 100 条查询上限：**已处理**。管理列表、统计、发布校验、用户抽题、查重、删除题库检查和初始化关联都改为分批拉取。
- 仍未处理：至少 2 个题库的验收数据、停用题是否在管理列表展示的口径、题库字段级规范文档、真实环境验收记录。

### 视频

页面：

- `pages/video-management`
- `pages/video`
- `pages/video-detail`

云函数：

- `getAdminVideoList`
- `saveVideo`
- `deleteVideo`
- `getVideos`
- `getVideoDetail`

交付物：

- 管理员可以创建、编辑、发布、下线视频
- 非已发布视频可以删除数据库记录
- 用户侧只展示已发布视频
- 封面、视频地址、关联文章和关联话题正常
- `deleteVideo` 只删除 `videos` 文档，不删除云存储文件

验收标准：

- `draft` / `offline` 视频不出现在用户侧
- `published` 视频在用户列表可见、封面显示、视频可播放
- 关联文章和关联话题可以跳转
- `published` 视频不能直接删除，必须先下线
- 普通用户/审核员调用 `saveVideo` / `deleteVideo` / `getAdminVideoList` 返回“无管理权限”
- `deleteVideo` 调用后不立即删除云存储文件：文件进入 `storage_cleanup_tasks`，由 `cleanupStorageFiles` 在宽限期后按清理策略处理

## 视频遗留问题与当前状态

- `getVideos` 没有分页：**已处理（2026-11-15）**。`getVideos` / `getAdminVideoList` 已支持 `page` / `pageSize` 和 `hasMore`，用户页支持下拉刷新、触底加载，管理页支持触底/“加载更多”按钮。
- `utils/defaultVideos.js` 内置占位视频缺少真实资源：**仍未处理**，正式运营前要补资源或移除兜底。
- 微信开发者工具对 `wx.chooseMedia` 视频选择支持不完整：**仍未处理**。真机可上传，PC 端仍需手动填写地址；电脑到云端的独立上传链路当前暂缓。
- 云存储旧文件不会自动清理：**已处理（2026-11-15）**。`saveVideo` / `deleteVideo` 把旧 `cloud://` 文件登记到 `storage_cleanup_tasks`，`cleanupStorageFiles` 在默认 7 天宽限期后、确认无引用时清理；详见 [云存储旧文件清理说明](../operations/storage_cleanup.md)。

## 依赖与协作

- 权限基线由 B 负责；你需要用 `operator` / `isAdmin` 账号验证管理页
- 视频用户侧播放依赖 `utils/cloud.js` 的 `cloud://` 解析
- 题库入口和答题页改动前，先确认现有 `quiz-home` / `quiz` 的数据字段
- 每个 PR 交给 D 审查后再合并

## 不要做什么

- 不改 A 的话题管理和社区业务
- 不改 B 的审核中心和角色配置
- 不在小程序端直接删除云存储文件
- 不把上传成功直接等同于发布
- 不把计划中的分页、自动清理写成已完成能力

## 团队分工导航

- [成员 A：内容运营与社区治理](./member-a-content-community.md)
- [成员 B：权限、审核与平台能力](./member-b-permission-review.md)
- [成员 D：审查、验收与弱代码编辑](./member-d-review-acceptance.md)
- [历史分工归档](./archive/README.md)

## 参考文档

- [视频分页与存储清理测试说明](../guides/video-pagination-storage-cleanup-test.md)
- [视频分页与存储清理简易测试（大白话版）](../guides/video-pagination-storage-cleanup-simple-test.md)
- [二期管理端执行优先级](../archive/phase2-planning/phase2_admin_execution_priority.md)
- [二期任务拆分](../archive/phase2-planning/phase2_task_split.md)
- [二期验收清单](../archive/phase2-planning/phase2_acceptance_checklist.md)
- [本地验收工作表](./acceptance-checklist.md)

## 组长寄语

主要是规范确认下题库的接口，还有视频上架流程的优化。题库方面，这个小程序是怎么管理题目和题库的，知道我们的题目数据是如何组织起来的，才方便后续去别的地方扒拉题目然后丢到我们这里的，总之就是确认下标准。然后是视频的上传流程，我测试下来手机上能上传视频，但是电脑上没找到啥好用的途径来上传视频，直接用微信开发助手似乎不可行，现不确定是我电脑的问题还是大家都是这样的。