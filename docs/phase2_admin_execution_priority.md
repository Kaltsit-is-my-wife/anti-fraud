# 二期管理端执行优先级（非图文）

文档名称：`反诈卫士二期管理端执行优先级（非图文）`

适用项目：`反诈卫士` 微信小程序

用途：在“图文文章继续由 CMS 管理”的前提下，明确小程序内轻量管理端后续工作的优先级、执行范围和验收口径。

关联文档：

- `docs/phase2_backlog.md`
- `docs/phase2_task_split.md`
- `docs/phase2_acceptance_checklist.md`
- `docs/phase2_page_task_list.md`
- `docs/phase2_cloud_function_task_list.md`
- `CMS使用文档.md`

---

## 1. 范围与结论

- 图文文章管理不在本文范围，统一由 CMS 承担。
- 本文仅覆盖小程序内轻量管理端的以下模块：
  - 话题管理
  - 审核中心
  - 视频管理
  - 题库管理
  - 题目管理
  - 权限与部署基线
- 当前管理端已经不是“从 0 到 1 缺页面”的状态，而是“页面和接口已基本到位，下一步要做部署、权限、联调和验收收口”的状态。

当前建议执行顺序：

1. 先收口话题发布主链路
2. 再打通审核中心闭环
3. 同步完成权限与云环境基线
4. 再补题库和题目运营链路
5. 最后收口视频管理和规则管理

---

## 2. 当前已具备能力

| 模块 | 当前状态 | 备注 |
|---|---|---|
| 管理中心 | 已有轻量入口页 | 用于汇总跳转，不是独立后台系统 |
| 话题管理 | 已有列表、内联编辑、保存能力 | 需联调 `community` 和 `topic-detail` |
| 审核中心 | 已有任务列表和通过/驳回/隐藏操作 | 需验证回写源数据状态 |
| 视频管理 | 已有列表、内联编辑、保存能力 | 需联调 `video` 和 `video-detail` |
| 题库管理 | 已有列表、内联编辑、保存能力 | 需联调 `quiz-home` |
| 题目管理 | 已有按题库查看、新增、编辑、停用能力 | 需联调 `quiz` 抽题链路 |
| 权限判断 | 前端入口已按 `isAdmin` / `roles` 控制 | 角色配置仍依赖数据库手动维护 |
| 云函数权限校验 | 管理和审核函数已有后端权限判断 | 需统一部署到当前云环境 |

---

## 3. 优先级总览

| ID | 优先级 | 工作流 | 当前判断 |
|---|---|---|---|
| ADM-P0-01 | `P0` | 话题发布主链路收口 | 社区主流程，必须先通 |
| ADM-P0-02 | `P0` | 审核中心闭环 | 评论、反馈、举报都会依赖 |
| ADM-P0-03 | `P0` | 权限与云环境基线 | 不先收口会持续出现“函数不存在”或“无权限”问题 |
| ADM-P1-01 | `P1` | 题库管理可运营化 | 页面已在，需补联调和发布链路 |
| ADM-P1-02 | `P1` | 题目管理可维护化 | 已有增改停用雏形，需补按题库稳定运行 |
| ADM-P1-03 | `P1` | 视频管理联调收口 | 能保存，但要验证用户侧完整可见 |
| ADM-P2-01 | `P2` | 敏感词规则管理 | 当前规则有数据模型，无管理入口 |
| ADM-P2-02 | `P2` | 管理端体验与角色配置 | 属于效率提升，不阻塞主链路 |

---

## 4. 执行清单

| ID | 工作项 | 页面 | 云函数 | 部署 / 数据 | 验收 |
|---|---|---|---|---|---|
| `ADM-P0-01` | 话题发布主链路收口 | `pages/topic-management/topic-management`<br>`pages/community/community`<br>`pages/topic-detail/topic-detail` | `getAdminTopicList`<br>`saveTopic`<br>`getTopics`<br>`getTopicDetail`<br>`getTopicComments`<br>`submitTopicComment` | 将 6 个云函数部署到当前小程序绑定云环境；确认 `topics`、`comments`、`review_tasks` 集合可用；准备一个 `operator` 角色测试账号 | 管理员创建并发布话题后，社区页能看到；点击可进入详情页；普通用户可提交评论；评论进入 `pending_review`；审核通过后评论在用户侧可见 |
| `ADM-P0-02` | 审核中心闭环 | `pages/review-center/review-center`<br>`pages/settings/settings`<br>`pages/topic-detail/topic-detail`<br>`pages/feedback/feedback`<br>`pages/scam-report/scam-report` | `getReviewTasks`<br>`reviewContent`<br>`submitTopicComment`<br>`submitFeedback`<br>`createScamReport` | 将审核查询、审核处理和内容提交相关函数部署到同一云环境；准备 `reviewer` 或 `operator` 角色账号；按需初始化 `review_keyword_rules` | 待审核内容可进入审核中心；审核员可执行通过/驳回/隐藏；操作后 `comments`、`feedback_records`、`scam_reports` 中对应记录状态被正确回写；用户侧只展示应展示的数据 |
| `ADM-P0-03` | 权限与云环境基线 | `pages/settings/settings`<br>`pages/admin-center/admin-center`<br>`pages/review-center/review-center`<br>`pages/topic-management/topic-management`<br>`pages/video-management/video-management`<br>`pages/question-bank-management/question-bank-management`<br>`pages/question-editor/question-editor` | `getAdminTopicList`<br>`saveTopic`<br>`getAdminVideoList`<br>`saveVideo`<br>`getAdminQuestionBankList`<br>`saveQuestionBank`<br>`getQuizQuestionList`<br>`saveQuizQuestion`<br>`deleteQuizQuestion`<br>`getReviewTasks`<br>`reviewContent` | 锁定当前开发者工具绑定的云环境；统一部署全部管理 / 审核云函数；在 `users` 集合中配置一组 `operator` 账号和一组 `reviewer` 账号；保留普通用户账号做对照测试 | 普通用户不显示管理入口；`operator` 可看到管理中心；`reviewer` 可看到审核中心；无权限用户即使绕过前端直接调用管理云函数，也会返回“无管理权限”或“无审核权限” |
| `ADM-P1-01` | 题库管理可运营化 | `pages/question-bank-management/question-bank-management`<br>`pages/quiz-home/quiz-home`<br>`pages/quiz/quiz` | `getAdminQuestionBankList`<br>`saveQuestionBank`<br>`getQuestionBanks`<br>`getQuizQuestions`<br>`submitQuizAttempt` | 部署题库管理和题库读取相关函数；确认 `question_banks`、`quiz_questions` 集合可用；至少准备 2 个题库，其中 1 个为 `published` | 管理员创建并发布题库后，用户侧 `quiz-home` 可看到；草稿 / 下线题库不出现在用户侧；点击题库可正常进入答题页并完成交卷 |
| `ADM-P1-02` | 题目管理可维护化 | `pages/question-editor/question-editor`<br>`pages/quiz/quiz` | `getQuizQuestionList`<br>`saveQuizQuestion`<br>`deleteQuizQuestion`<br>`getQuizQuestions` | 部署题目管理与抽题相关函数；按题库准备测试题目；核对 `questionId`、选项、答案索引、解析字段数据质量 | 管理员可新增、编辑、停用题目；题目可绑定到指定题库；停用题目不会再出现在管理列表和用户抽题结果中；题目答案和解析在交卷结果中表现正确 |
| `ADM-P1-03` | 视频管理联调收口 | `pages/video-management/video-management`<br>`pages/video/video`<br>`pages/video-detail/video-detail` | `getAdminVideoList`<br>`saveVideo`<br>`getVideos`<br>`getVideoDetail` | 部署视频管理和用户侧读取函数；确认 `videos` 集合可用；校验 `coverImage`、`videoUrl` 支持 HTTPS 或 `cloud://` 路径；至少准备 1 条 `published` 视频 | 管理员发布视频后，用户侧列表页可看到；点击可进入详情页；封面与视频地址可正确解析；草稿 / 下线视频不出现在用户侧 |
| `ADM-P2-01` | 敏感词规则管理 | 规划新增 `pages/review-rule-management/review-rule-management` | 规划新增 `getReviewRules`<br>`saveReviewRules`<br>现有提交函数继续复用 `submitTopicComment`、`submitFeedback`、`createScamReport` | 新增并维护 `review_keyword_rules` 集合；定义高风险 / 中风险词和启停字段；补管理页或最小管理接口 | 管理员可维护敏感词规则；新规则能影响后续评论、反馈、举报提交流程；默认规则和自定义规则的命中结果一致可解释 |
| `ADM-P2-02` | 管理端体验与角色配置 | `pages/admin-center/admin-center`<br>`pages/settings/settings`<br>按需要新增角色配置页 | 现阶段可继续复用 `getUserInfo`；如新增角色配置页，再补对应管理函数 | 明确 `users.roles` 取值口径：`operator`、`reviewer`；决定继续手改数据库还是新增最小角色配置能力；补管理端空态、错误态、无权限说明 | 管理入口无死链；权限提示清晰；至少有一份可执行的角色配置说明；后续新人接手时无需反向读代码推断角色规则 |

---

## 5. 建议推进批次

### 批次 1：必须先完成

- `ADM-P0-01` 话题发布主链路收口
- `ADM-P0-02` 审核中心闭环
- `ADM-P0-03` 权限与云环境基线

目标：

- 先把“运营发话题、用户看话题、用户评论、审核处理评论”这一条核心业务链跑通

### 批次 2：紧随其后

- `ADM-P1-01` 题库管理可运营化
- `ADM-P1-02` 题目管理可维护化

目标：

- 让答题内容不再依赖手工改库或开发介入

### 批次 3：收口与补强

- `ADM-P1-03` 视频管理联调收口
- `ADM-P2-01` 敏感词规则管理
- `ADM-P2-02` 管理端体验与角色配置

目标：

- 提升运营可维护性，减少后续频繁找开发手工处理

---

## 6. 当前不建议扩项

- 不在小程序内重做图文文章管理，继续使用 CMS
- 不优先拆独立 `topic-editor`、`video-editor`、`question-bank-editor` 页面，当前内联编辑先收口可用性
- 不优先建设独立 Web 后台，先把小程序内轻量管理端做稳
- 不优先追加大规模 UI 重构，先以可维护、可部署、可验收为准
