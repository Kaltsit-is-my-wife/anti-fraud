# 成员 A：内容运营与社区治理

## 你的定位

你负责“运营发内容、用户看内容、用户参与讨论”这条内容主链路。当前阶段不做小程序内文章编辑，文章继续由 CMS 维护。

## 当前主任务：P0-01 话题发布主链路收口

目标：运营创建并发布话题 → 用户端看到话题 → 用户进入详情并评论 → 评论进入待审核。

### 页面

- `pages/topic-management`：话题创建、编辑、发布、下线
- `pages/community`：社区首页展示已发布话题
- `pages/topic-detail`：话题详情、关联文章/视频、评论与回复

### 云函数

- `getAdminTopicList`
- `saveTopic`
- `getTopics`
- `getTopicDetail`
- `getTopicComments`
- `submitTopicComment`

### 交付物

- 运营可以创建、编辑、发布、下线话题
- 用户端只展示已发布话题
- 话题详情可以展示背景说明、配图、关联文章和关联视频
- 用户可以发表评论和回复
- 评论提交后进入待审核状态

### 验收标准

- 草稿和下线话题不出现在用户端
- 已发布话题可以进入详情
- 普通用户可以提交评论
- 评论提交后状态为 `pending_review`
- 审核通过后评论才在前台可见
- 审核驳回或隐藏后评论不展示

## 依赖与协作

- 与 B 先约定评论状态字段：`pending_review`、`approved`、`rejected`、`hidden`
- 评论进入审核中心后，由 B 负责审核回写；你负责确认用户侧展示正确
- 每个 PR 交给 D 审查后再合并
- 权限基线由 B 负责，你负责在话题管理页使用正确的 `operator` / `isAdmin` 账号验收

## 不要做什么

- 不新增小程序内文章编辑页、`saveArticle` 或文章后台
- 不改 B 的审核中心、敏感词规则和角色配置
- 不改 C 的题库、题目和视频发布逻辑
- 不把规划中的“图文内容块”当成已实现能力

## 团队分工导航

- [成员 B：权限、审核与平台能力](./member-b-permission-review.md)
- [成员 C：学习内容与视频收口](./member-c-learning-video.md)
- [成员 D：审查、验收与弱代码编辑](./member-d-review-acceptance.md)
- [历史分工归档](./archive/README.md)

## 参考文档

- [二期管理端执行优先级](../planning/phase2_admin_execution_priority.md)
- [二期 Backlog](../planning/phase2_backlog.md)
- [二期任务拆分](../planning/phase2_task_split.md)
- [本地验收工作表](./acceptance-checklist.md)
