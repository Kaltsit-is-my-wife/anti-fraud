# 成员 B：权限、审核与平台能力

## 你的定位

你负责让管理端“能用、能管、能审、能授权”。你当前的主线是审核中心闭环和权限/云环境基线，之后再做敏感词规则和角色配置。

## 当前主任务一：P0-02 审核中心闭环

目标：评论、反馈、举报进入审核中心，审核员可以处理，并正确回写源数据状态。

### 页面

- `pages/review-center`
- `pages/admin-center`
- `pages/settings`

### 云函数

- `getReviewTasks`
- `reviewContent`

### 交付物

- 审核员可以查看待审核评论、反馈和举报
- 可以查看原始内容、提交人和命中信息
- 可以执行通过、驳回、隐藏
- 审核结果回写 `comments`、`feedback_records`、`scam_reports`
- 记录审核人、审核时间和备注

### 验收标准

- 待审核内容可以进入审核中心
- 通过后用户侧可见
- 驳回或隐藏后用户侧不可见
- 审核操作后源数据状态正确
- `reviewer` 只能审核，不能进入视频/话题/题库管理
- 普通用户调用审核函数返回“无审核权限”

## 当前主任务二：P0-03 权限与云环境基线

目标：所有管理/审核页面和云函数在同一环境、同一权限口径下工作。

### 交付物

- 管理/审核云函数统一部署到当前目标云环境
- `users` 集合配置至少一组 `operator` 和一组 `reviewer` 测试账号
- 权限矩阵可验证：
  - `isAdmin === true`：管理 + 审核
  - `roles` 包含 `operator`：管理 + 审核（当前代码允许）
  - `roles` 包含 `reviewer`：只能审核
  - 普通用户：无管理/审核权限
- 直接调用管理/审核云函数的越权测试通过

### 验收标准

- 普通用户不显示管理入口
- `operator` 可以进入管理中心和对应管理页
- `reviewer` 只能进入审核中心
- 未登录用户有明确处理
- 绕过前端直接调用管理函数会返回“无管理权限”或“无审核权限”
- 各云函数部署环境与小程序、数据库、云存储一致

## 后续任务：P2 治理与体验

- 敏感词规则管理：新增最小管理入口，补 `getReviewRules` / `saveReviewRules`
- 角色配置：决定继续手改数据库，还是新增最小角色配置页
- 管理端空态、错误态、无权限提示
- 明确 `operator` 是否允许审核，避免发布与审核职责混在一起

## 依赖与协作

- 与 A 先约定评论状态字段：`pending_review`、`approved`、`rejected`、`hidden`
- A 负责评论提交和用户侧展示，你负责审核回写
- 权限基线要先于 A/C 的管理页验收完成
- 每个 PR 交给 D 审查后再合并
- 角色配置目前没有管理页面，只能手改 `users` 文档；如需新增页面，先和 D 确认验收范围

## 不要做什么

- 不改 A 的话题管理、社区和话题详情业务
- 不改 C 的题库、题目和视频发布逻辑
- 不把角色配置直接写死在前端
- 不用前端隐藏代替云函数权限校验

## 团队分工导航

- [成员 A：内容运营与社区治理](./member-a-content-community.md)
- [成员 C：学习内容与视频收口](./member-c-learning-video.md)
- [成员 D：审查、验收与弱代码编辑](./member-d-review-acceptance.md)
- [历史分工归档](./archive/README.md)

## 参考文档

- [二期管理端执行优先级](../planning/phase2_admin_execution_priority.md)
- [二期任务拆分](../planning/phase2_task_split.md)
- [二期验收清单](../planning/phase2_acceptance_checklist.md)
- [本地验收工作表](./acceptance-checklist.md)
