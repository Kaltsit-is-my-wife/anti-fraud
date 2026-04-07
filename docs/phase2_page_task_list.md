# 二期页面任务清单

文档名称：`反诈卫士二期页面任务清单`

适用项目：`反诈卫士` 微信小程序

用途：将二期需求拆成页面级工作项，供前端、管理端和测试对齐实现范围。

关联文档：

- `docs/phase2_requirements.md`
- `docs/phase2_backlog.md`
- `docs/phase2_task_split.md`

---

## 1. 使用说明

本文档按以下维度组织：

- 用户侧页面
- 管理侧页面
- 路由与遗留页面处理

说明：

- 页面路径为建议命名，若实现阶段有更合适的结构，可调整
- 若某些“列表页 + 编辑页”最终合并为单页实现，也视为满足需求
- 本文档关注页面职责，不替代接口设计和数据模型设计

---

## 2. 用户侧页面

| 任务ID | 页面路径 | 类型 | 优先级 | 页面目标 | 关键内容 | 主要依赖 |
|---|---|---|---|---|---|---|
| PG-01 | `pages/index/index` | 改造 | P1 | 调整首页内容入口 | 保留资讯主入口；增加视频入口；必要时增加热点话题露出位 | `getArticles`、`getVideos`、`getTopics` |
| PG-02 | `pages/article-detail/article-detail` | 改造 | P0 | 支持图文文章详情展示 | 兼容旧文章；按 `contentBlocks` 顺序渲染；图片自适应；失败占位 | `getArticleDetail` |
| PG-03 | `pages/community/community` | 改造 | P0 | 社区首页切换为官方话题列表 | 替换自由帖子流；展示话题封面、摘要、状态与发布时间 | `getTopics` |
| PG-04 | `pages/topic-detail/topic-detail` | 新增 | P0 | 承载单个话题详情和讨论区 | 展示背景说明、图文内容、相关文章、相关视频、评论区 | `getTopicDetail`、`getTopicComments` |
| PG-05 | `pages/topic-detail/topic-detail` 讨论区模块 | 新增 | P0 | 话题评论和回复交互 | 评论输入、回复、审核提示、仅展示已通过内容 | `submitTopicComment`、`getTopicComments` |
| PG-06 | `pages/video/video` | 新增 | P1 | 视频列表页 | 展示封面、标题、简介、分类、时长；支持跳转详情 | `getVideos` |
| PG-07 | `pages/video-detail/video-detail` | 新增 | P1 | 视频详情与播放页 | 视频播放、简介展示、关联话题 / 文章跳转 | `getVideoDetail` |
| PG-08 | `pages/quiz-home/quiz-home` | 新增 | P1 | 题库入口页 | 展示已发布题库列表；展示题量、简介、封面；进入答题 | `getQuestionBanks` |
| PG-09 | `pages/quiz/quiz` | 改造 | P1 | 支持按题库答题 | 接收 `bankId`；只从指定题库抽题；保留原答题结果展示 | `getQuizQuestions`、`submitQuizAttempt` |
| PG-10 | `pages/feedback/feedback` | 改造 | P1 | 正式接入反馈提交流程 | 反馈提交、审核中提示、提交成功态 | `submitFeedback` |
| PG-11 | `pages/scam-report/scam-report` | 改造 | P1 | 举报说明接入审核链路 | 提交时走关键词与人工审核；保留 96110 提示 | `createScamReport` |

---

## 3. 管理侧页面

| 任务ID | 页面路径 | 类型 | 优先级 | 页面目标 | 关键内容 | 主要依赖 |
|---|---|---|---|---|---|---|
| AP-01 | `pages/admin/dashboard/dashboard` | 新增 | P1 | 管理入口页 | 按角色展示文章、话题、视频、审核、题库入口 | 登录态、角色信息 |
| AP-02 | `pages/admin/article-management/article-management` | 新增 | P0 | 图文文章管理列表 | 草稿 / 已发布 / 已下线列表；创建入口；编辑入口 | `getAdminArticleList` |
| AP-03 | `pages/admin/article-editor/article-editor` | 新增 | P0 | 图文文章编辑页 | 编辑标题、摘要、封面、内容块；内容块排序；预览；保存 | `saveArticle`、`uploadMedia` |
| AP-04 | `pages/admin/topic-management/topic-management` | 新增 | P0 | 话题管理列表 | 话题列表、状态筛选、创建与编辑入口 | `getAdminTopicList` |
| AP-05 | `pages/admin/topic-editor/topic-editor` | 新增 | P0 | 话题编辑页 | 编辑标题、摘要、封面、背景说明、配图、关联文章、关联视频、状态 | `saveTopic`、`uploadMedia` |
| AP-06 | `pages/admin/review-center/review-center` | 新增 | P0 | 审核中心 | 查看待审核任务；按状态筛选；通过 / 驳回 / 隐藏处理 | `getReviewTasks`、`reviewContent` |
| AP-07 | `pages/admin/video-management/video-management` | 新增 | P1 | 视频管理列表 | 视频列表、状态切换、创建与编辑入口 | `getAdminVideoList` |
| AP-08 | `pages/admin/video-editor/video-editor` | 新增 | P1 | 视频编辑页 | 编辑标题、简介、封面、地址、分类、时长、关联内容、状态 | `saveVideo`、`uploadMedia` |
| AP-09 | `pages/admin/question-bank-management/question-bank-management` | 新增 | P1 | 题库管理列表 | 题库列表、状态管理、题目数量查看、进入题目管理 | `getAdminQuestionBankList` |
| AP-10 | `pages/admin/question-bank-editor/question-bank-editor` | 新增 | P1 | 题库编辑页 | 编辑名称、简介、封面、排序、发布状态、默认题量 | `saveQuestionBank`、`uploadMedia` |
| AP-11 | `pages/admin/question-editor/question-editor` | 新增 | P1 | 题目管理页 | 题目列表、筛选、创建、编辑、删除、答案与解析维护 | `getQuizQuestionList`、`saveQuizQuestion`、`deleteQuizQuestion` |
| AP-12 | `pages/admin/review-rule-management/review-rule-management` | 新增 | P2 | 敏感词维护页 | 查看高风险 / 中风险词；增删改；启停规则 | `getReviewRules`、`saveReviewRules` |

---

## 4. 路由与遗留页面处理

| 任务ID | 页面路径 | 类型 | 优先级 | 处理要求 |
|---|---|---|---|---|
| LG-01 | `pages/community-post-create/community-post-create` | 下线 / 封禁 | P0 | 普通用户不可继续公开发帖；保留页面时必须加权限拦截或跳转 |
| LG-02 | `pages/community-post-detail/community-post-detail` | 弱化 / 归档 | P1 | 不再作为社区主链路；如保留仅用于历史数据查看，不再新增内容 |
| LG-03 | `pages/community/community` 原帖子流模块 | 移除 | P0 | 彻底移出首页主内容区域，避免与官方话题模式并存 |
| LG-04 | `app.json` 路由注册 | 改造 | P0 | 新增页面全部注册；管理端页面按权限控制，不对普通用户暴露入口 |

---

## 5. 页面实现约束

### 5.1 用户侧约束

- 评论提交后若进入审核，应明确提示“内容审核中”
- 图片、封面、视频列表都需要空态和加载失败态
- 旧文章仍需兼容展示
- 未发布话题、视频、题库不得在用户端显示

### 5.2 管理侧约束

- 管理入口必须受角色权限控制
- 列表页需要基本筛选能力，至少支持按状态查看
- 编辑页需要保存成功、保存失败、未保存离开提醒
- 媒体上传统一走同一套上传能力

### 5.3 交互建议

- 图文编辑页优先保证可用性，不必追求复杂富文本体验
- 题目编辑先支持单题表单，后续再考虑批量导入
- 审核中心优先保证“看得清、改得动”，不必一次做到复杂工作台

---

## 6. 页面交付建议顺序

### 第一批

- PG-02 图文文章详情页
- PG-03 社区话题列表页
- PG-04 话题详情页
- AP-02 文章管理列表
- AP-03 文章编辑页
- AP-04 话题管理列表
- AP-05 话题编辑页
- LG-01 / LG-03 旧社区入口收口

### 第二批

- PG-05 讨论区模块
- AP-06 审核中心
- AP-12 敏感词维护页
- PG-10 反馈页接入
- PG-11 举报页接入审核链路

### 第三批

- PG-06 视频列表页
- PG-07 视频详情页
- AP-07 视频管理列表
- AP-08 视频编辑页
- PG-01 首页入口调整

### 第四批

- PG-08 题库入口页
- PG-09 答题页改造
- AP-09 题库管理页
- AP-10 题库编辑页
- AP-11 题目管理页

---

## 7. 测试关注点

- 图文文章在不同机型下的图片展示是否稳定
- 社区是否仍存在公开发帖入口绕过
- 评论、反馈、举报提交后是否正确显示审核中状态
- 视频播放页是否可正常播放并返回
- 按题库答题时是否存在跨题库抽题

