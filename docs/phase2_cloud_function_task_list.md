# 二期云函数任务清单

文档名称：`反诈卫士二期云函数任务清单`

适用项目：`反诈卫士` 微信小程序

用途：将二期需求拆成云函数与服务端工作项，供后端、云函数开发和测试对齐。

关联文档：

- `docs/phase2_requirements.md`
- `docs/phase2_backlog.md`
- `docs/phase2_data_model_design.md`

---

## 1. 使用说明

本文档聚焦“云函数职责”，不展开页面交互。

任务类型说明：

- `新增`
- `改造`
- `复用`

实现原则：

- 管理端与审核端接口必须做角色校验
- 用户侧接口默认只返回可公开展示数据
- 审核逻辑优先做成可复用服务端模块，避免在多个云函数中重复复制

---

## 2. 账号与公共能力

| 任务ID | 云函数 / 模块 | 类型 | 优先级 | 主要职责 | 关键说明 |
|---|---|---|---|---|---|
| CF-COM-01 | `login` | 改造 | P0 | 返回用户基础信息和角色字段 | 需要支持管理员 / 审核员角色识别 |
| CF-COM-02 | `getUserInfo` | 改造 | P1 | 返回用户资料与角色能力 | 管理端页面进入前可用于权限确认 |
| CF-COM-03 | `uploadMedia` | 新增 | P0 | 统一上传图片和封面资源 | 文章图、话题封面、视频封面、题库封面统一走该能力 |
| CF-COM-04 | 角色校验模块 | 新增 | P0 | 提供管理端 / 审核端通用权限校验 | 建议做成云函数共享模块，不单独对前端暴露 |
| CF-COM-05 | 文本审核模块 | 新增 | P0 | 统一执行高风险 / 中风险词匹配 | 由评论、反馈、举报等提交函数复用 |

---

## 3. 图文资讯相关

| 任务ID | 云函数 / 模块 | 类型 | 优先级 | 主要职责 | 关键说明 |
|---|---|---|---|---|---|
| CF-ART-01 | `getArticles` | 改造 | P0 | 返回文章列表 | 用户端仅返回已发布文章；增加封面、摘要、状态过滤口径 |
| CF-ART-02 | `getArticleDetail` | 改造 | P0 | 返回文章详情 | 兼容旧 `content`；优先返回 `contentBlocks` |
| CF-ART-03 | `saveArticle` | 新增 | P0 | 新增 / 编辑文章 | 支持草稿、发布、下线；只允许管理员调用 |
| CF-ART-04 | `getAdminArticleList` | 新增 | P0 | 管理端文章列表查询 | 支持按状态、时间查询 |

---

## 4. 话题与社区相关

| 任务ID | 云函数 / 模块 | 类型 | 优先级 | 主要职责 | 关键说明 |
|---|---|---|---|---|---|
| CF-TOP-01 | `getTopics` | 新增 | P0 | 获取官方话题列表 | 仅返回 `published` 话题 |
| CF-TOP-02 | `getTopicDetail` | 新增 | P0 | 获取话题详情 | 返回话题正文、关联文章、关联视频、基础统计 |
| CF-TOP-03 | `saveTopic` | 新增 | P0 | 创建 / 编辑话题 | 支持 `draft`、`published`、`offline` |
| CF-TOP-04 | `getAdminTopicList` | 新增 | P0 | 管理端查询全部话题 | 支持按状态、关键词、时间筛选 |
| CF-TOP-05 | `submitTopicComment` | 新增 | P0 | 提交话题评论 / 回复 | 提交时必须走文本审核模块 |
| CF-TOP-06 | `getTopicComments` | 新增 | P0 | 获取话题评论列表 | 用户端只返回 `approved`；支持一级评论与回复 |
| CF-TOP-07 | `createPost` | 改造 / 下线 | P0 | 收口旧自由发帖能力 | 普通用户不可继续调用公开发帖链路 |
| CF-TOP-08 | `getPosts` | 改造 / 弱化 | P1 | 历史帖子兼容查询 | 不再作为社区首页数据源 |

---

## 5. 审核与用户提交内容

| 任务ID | 云函数 / 模块 | 类型 | 优先级 | 主要职责 | 关键说明 |
|---|---|---|---|---|---|
| CF-REV-01 | `getReviewTasks` | 新增 | P0 | 获取审核任务列表 | 支持按状态、业务类型筛选 |
| CF-REV-02 | `reviewContent` | 新增 | P0 | 审核通过 / 驳回 / 隐藏 | 审核结果需回写原始内容和审核任务 |
| CF-REV-03 | `getReviewRules` | 新增 | P1 | 获取敏感词规则 | 仅审核管理员可调用 |
| CF-REV-04 | `saveReviewRules` | 新增 | P1 | 新增 / 编辑 / 启停敏感词规则 | 支持高风险与中风险等级 |
| CF-REV-05 | `submitFeedback` | 新增 | P1 | 提交用户反馈 | 反馈内容进入审核链路；当前 `pages/feedback` 需要正式接入 |
| CF-REV-06 | `createScamReport` | 改造 | P1 | 举报内容接入审核链路 | 对补充说明做关键词审核并生成审核任务 |
| CF-REV-07 | `createComment` | 改造 | P1 | 若保留通用评论能力则增加审核状态支持 | 若后续统一评论模型，可复用该函数或并入 `submitTopicComment` |

---

## 6. 视频内容相关

| 任务ID | 云函数 / 模块 | 类型 | 优先级 | 主要职责 | 关键说明 |
|---|---|---|---|---|---|
| CF-VID-01 | `getVideos` | 新增 | P1 | 获取视频列表 | 用户端仅返回已发布视频 |
| CF-VID-02 | `getVideoDetail` | 新增 | P1 | 获取视频详情 | 返回可播放地址、简介、关联内容 |
| CF-VID-03 | `saveVideo` | 新增 | P1 | 创建 / 编辑视频 | 管理员调用；支持状态管理 |
| CF-VID-04 | `getAdminVideoList` | 新增 | P1 | 管理端查询视频列表 | 支持状态和分类筛选 |

---

## 7. 题库与答题相关

| 任务ID | 云函数 / 模块 | 类型 | 优先级 | 主要职责 | 关键说明 |
|---|---|---|---|---|---|
| CF-QUIZ-01 | `getQuestionBanks` | 新增 | P1 | 获取题库列表 | 用户端仅返回已发布题库 |
| CF-QUIZ-02 | `saveQuestionBank` | 新增 | P1 | 创建 / 编辑题库 | 支持发布 / 停用和题量配置 |
| CF-QUIZ-03 | `getAdminQuestionBankList` | 新增 | P1 | 管理端查询题库列表 | 支持状态和关键词筛选 |
| CF-QUIZ-04 | `saveQuizQuestion` | 新增 | P1 | 创建 / 编辑题目 | 题目必须绑定 `bankId` |
| CF-QUIZ-05 | `deleteQuizQuestion` | 新增 | P1 | 删除题目 | 逻辑删除优先，避免误删历史数据 |
| CF-QUIZ-06 | `getQuizQuestionList` | 新增 | P1 | 管理端查询题目列表 | 支持按题库、标签、难度筛选 |
| CF-QUIZ-07 | `getQuizQuestions` | 改造 | P1 | 按题库抽题 | 支持传入 `bankId`；只返回指定题库题目 |
| CF-QUIZ-08 | `submitQuizAttempt` | 改造 | P1 | 记录答题结果 | 记录 `bankId`，便于后续统计题库学习效果 |

---

## 8. 推荐的输入输出口径

### 8.1 管理端保存类函数

建议统一采用以下风格：

- 输入：
  - `id`
  - `payload`
  - `action`
- 输出：
  - `success`
  - `data`
  - `errMsg`

### 8.2 列表类函数

建议统一支持：

- `page`
- `pageSize`
- `status`
- `keyword`

输出统一包含：

- `list`
- `total`
- `page`
- `pageSize`

### 8.3 审核类函数

审核处理建议统一输入：

- `taskId`
- `action`
- `remark`

其中 `action` 仅允许：

- `approve`
- `reject`
- `hide`

---

## 9. 推荐开发顺序

### 第一批

- `uploadMedia`
- `login` / `getUserInfo` 角色改造
- `getArticleDetail`
- `saveArticle`
- `getAdminArticleList`
- `getTopics`
- `getTopicDetail`
- `saveTopic`
- `getAdminTopicList`
- `createPost` 收口

### 第二批

- 文本审核模块
- `submitTopicComment`
- `getTopicComments`
- `getReviewTasks`
- `reviewContent`
- `submitFeedback`
- `createScamReport` 改造

### 第三批

- `getVideos`
- `getVideoDetail`
- `saveVideo`
- `getAdminVideoList`

### 第四批

- `getQuestionBanks`
- `saveQuestionBank`
- `getAdminQuestionBankList`
- `saveQuizQuestion`
- `deleteQuizQuestion`
- `getQuizQuestionList`
- `getQuizQuestions` 改造
- `submitQuizAttempt` 改造

---

## 10. 风险点

- 若角色模型不先定，管理端和审核端接口会反复返工
- 若文本审核模块不统一，评论、反馈、举报三条链路会出现规则不一致
- 若题库与题目管理只做保存不做列表查询，管理端无法真正落地
- 若旧 `createPost` 不在服务端封住，仅隐藏前端入口仍然可能被绕过

