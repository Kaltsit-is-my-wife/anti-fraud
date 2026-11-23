# 待测试项目清单

本文件记录已经完成代码改动、但仍需要在微信开发者工具或真实云环境验证的项目。测试完成后勾选并在 `CHANGELOG.md` 或验收记录中补充结果。

> 更新：2026-11-23，相关云函数已部署，PR #10 已合并；本文档剩余项均为待测试/待补测。

状态说明：

- `待测试`：代码已完成，尚未验证
- `阻塞`：验证前不能开放相关能力
- `已延期`：当前数据或环境不满足，后续补测

## 1. 文章评论审核链路

状态：待测试
来源：成员 B 审核中心补丁 + 2026-11-23 云函数补齐
部署状态：`createComment`、`getComments`、`getReviewTasks`、`reviewContent` 已部署（2026-11-23）

验证项：

- [ ] 普通用户发表文章评论后，`comments.status = pending_review`
- [ ] 同时创建 `review_tasks`，`targetType = article_comment`
- [ ] 评论回写 `reviewTaskId`
- [ ] 审核中心能看到文章评论任务
- [ ] `reviewTask` 能看到评论原文、提交人、文章 ID、父评论信息
- [ ] 审核通过后 `comments.status = approved`
- [ ] 通过后 `getComments` 返回该评论，文章详情可见
- [ ] 驳回后 `getComments` 不返回
- [ ] 隐藏后 `getComments` 不返回
- [ ] 帖子评论仍直接 `published`，不需要审核
- [ ] 审核中心风险等级、命中关键词展示没有回退
- [ ] 普通用户直接调用审核函数返回“无审核权限”
- [ ] 回复通知时机：当前提交时立即发送；`IMP-009` 要求改为审核通过后发送

相关文档：

- [审核中心测试手册](../guides/review-center-test.md)
- `docs/planning/improvement-backlog.md` 的 `IMP-009`

## 2. 存储清理 P0 修复

状态：待测试
来源：2026-11-23 代码审查修复
部署状态：`cleanupStorageFiles` 已部署（2026-11-23）；实际删除保持关闭

验证项：

- [ ] 管理页只显示“检查待清理文件”，不显示“执行清理”
- [ ] 未配置 `STORAGE_CLEANUP_ALLOW_REAL_DELETE` 时，`dryRun: false` 返回“引用检查尚未覆盖全部内容，暂不支持实际删除”
- [ ] 普通用户调用返回“无管理权限”
- [ ] operator 调用实际删除被“仅管理员”拦截
- [ ] dry-run 只检查，不修改任务状态
- [ ] 引用查询能跨 100 条分页，超过 100 条引用的文件仍被识别为“仍被引用”
- [ ] 删除视频确认文案为“删除记录并登记旧文件到清理队列”

相关文档：

- [云存储旧文件清理说明](../operations/storage_cleanup.md)
- [视频分页与存储清理测试说明](../guides/video-pagination-storage-cleanup-test.md)

## 3. 存储清理引用扫描补齐

状态：阻塞
来源：`IMP-008 D`

当前 `cleanupStorageFiles` 尚未扫描：

- `topics.contentBlocks[].imageUrl`
- `articles.content` 富文本
- `products` / `notifications` 等其他集合

验证项：

- [ ] 在 dry-run 中补充上述引用后，文件不会被列为候选
- [ ] 补齐前不配置 `STORAGE_CLEANUP_ALLOW_REAL_DELETE`
- [ ] 补齐后仅在测试环境验证实际删除
- [ ] 测试完成后恢复默认关闭

相关文档：

- `docs/operations/storage_cleanup.md`
- `docs/planning/improvement-backlog.md` 的 `IMP-008`

## 4. 视频分页

状态：已延期（数据不足）
来源：`IMP-008 B`

验证项：

- [ ] 准备 21 条以上已发布 `[TEST]` 视频
- [ ] 用户端分页、加载更多、无重复
- [ ] 下拉刷新回到第一页
- [ ] 内置演示视频只出现在第一页
- [ ] 管理端分页、编辑/删除后刷新
- [ ] `videos` 组合索引已创建

相关文档：

- [视频分页与存储清理简易测试](../guides/video-pagination-storage-cleanup-simple-test.md)

## 5. 题库 P0 与迁移

状态：待测试
来源：`IMP-008 C`

验证项：

- [ ] 5 选项题（正确答案 E）可预览、交卷、判分
- [ ] 6 选项题（正确答案 F）可预览、交卷、判分
- [ ] 7 选项题保存/导入被拒绝
- [ ] 草稿/下线题库不能被普通用户抽到
- [ ] 管理员可以预览草稿题库
- [ ] 超过 100 道题时管理列表、统计、抽题完整
- [ ] 历史题 `default_bank` / `bankIds` / `questionId` 已核查
- [ ] 执行 `initQuestionBanks` 后默认题库关联正确
- [ ] 至少一个已发布题库可正常答题

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
