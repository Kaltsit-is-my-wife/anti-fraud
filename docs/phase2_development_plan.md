# 二期开发计划

适用项目：`反诈卫士` 微信小程序

二期定位：在现有资讯、AI、答题、社区、积分体系基础上，进入“内容升级 + 互动重构 + 审核治理 + 运营工具”阶段。

本期不再继续沿用当前“用户自由发帖 + 静态题库 + 纯文字文章”的模式，而是围绕内容生产、内容审核和学习体验做结构性升级。

配套文档：

- `docs/phase2_requirements.md`：需求确认、任务拆分与验收依据
- `ARCHITECTURE.md`：当前系统结构

---

## 1. 二期确认目标

二期已确认的核心目标共有 5 项：

1. 资讯内容升级为图文并茂
   文章不再只支持纯文字，需要支持插入图片，提升可读性和传播效果。
2. 社区重构为“热点话题引导讨论”
   不再采用当前自由发帖模式，由运营/管理端定时发布反诈热点话题，用户围绕话题参与讨论。
3. 建立内容审核机制
   用户发布的评论、留言、讨论内容必须经过关键词审核，并增加人工审核，防止不当言论或违规内容外显。
4. 新增视频播放能力
   在小程序中播放反诈骗视频，形成“文章 + 视频 + 讨论 + 答题”的学习闭环。
5. 建立简单题库管理系统
   题库不能继续依赖手工 JSON 或直接进答题页，需要支持运营/管理侧创建题库、添加题目、维护题目。

---

## 2. 二期产品方向调整

二期和当前版本相比，有两个明显变化：

### 2.1 内容形态变化

- 文章：从纯文字升级为富内容文章
- 社区：从“用户自由发帖”改为“官方发话题，用户跟帖讨论”
- 学习：新增视频内容
- 答题：从固定入口答题改为“题库可维护、内容可配置”

### 2.2 治理要求提高

- 用户内容不能直接外显
- 必须有关键词审核
- 必须有人工审核入口
- 必须有内容状态流转和审核记录

也就是说，二期不是单纯加几个页面，而是把产品从“功能集合”推进成“可运营、可管理、可审核”的学习型平台。

---

## 3. 功能拆解

## 3.1 图文资讯系统

### 目标

让反诈骗文章支持图文混排，而不是只显示一大段文字。

### 需求说明

- 文章正文支持插入图片
- 支持文章封面图、正文图片、图片说明
- 后续可扩展为“段落 + 图片 + 引导卡片 + 视频卡片”的内容块模式
- 前端详情页需要适配图文渲染

### 推荐实现方式

为避免后续再次返工，正文不建议继续使用单个长字符串字段，建议改为“内容块”结构。

推荐字段：

```js
{
  _id: 'article_xxx',
  title: '标题',
  coverImage: '封面图',
  summary: '摘要',
  category: '分类',
  tag: '标签',
  contentBlocks: [
    { type: 'paragraph', text: '正文段落' },
    { type: 'image', imageUrl: 'xxx', caption: '图片说明' },
    { type: 'paragraph', text: '第二段文字' }
  ],
  status: 'published',
  createdAt: Date,
  updatedAt: Date
}
```

### 前端改动

- 重构 `pages/article-detail/article-detail`
- 增加图文内容渲染组件
- 保留对旧纯文本文章的兼容逻辑

### 后台/运营侧改动

- 增加文章编辑能力
- 支持上传正文图片
- 支持排序和预览

---

## 3.2 引导式社区话题系统

### 目标

把当前社区从“用户自由发帖”改成“官方话题引导 + 用户参与讨论”的模式。

### 新模式说明

- 由管理侧定期发布热点反诈话题
- 用户不能再直接创建公开帖子
- 用户进入某个热点话题后，在话题下发表评论、回复、讨论
- 话题本身可以带背景图、引导文案、参考资料、推荐文章或视频

### 数据结构建议

新增 `topics` 集合：

```js
{
  _id: 'topic_xxx',
  title: '本周热点反诈话题',
  summary: '引导语',
  coverImage: '封面图',
  contentBlocks: [
    { type: 'paragraph', text: '话题背景' },
    { type: 'article_link', articleId: 'article_xxx' },
    { type: 'video_link', videoId: 'video_xxx' }
  ],
  startAt: Date,
  endAt: Date,
  status: 'published',
  sort: 1,
  createdAt: Date,
  updatedAt: Date
}
```

原 `posts` 的定位在二期会被弱化或逐步下线，讨论内容统一沉淀到 `topic_comments` 或复用 `comments` 集合。

### 页面建议

- `pages/community/community`
  改为“热点话题列表”
- `pages/topic-detail/topic-detail`
  新增“话题详情 + 评论讨论区”

### 交互要求

- 当前热点优先展示
- 支持进行中 / 已结束 / 推荐话题分类
- 话题详情页可展示：
  - 引导文案
  - 配图
  - 相关文章
  - 相关视频
  - 评论讨论区

---

## 3.3 内容审核机制

### 目标

确保用户发布的讨论内容不会直接裸奔到前台。

### 审核要求

所有用户发布内容至少包括以下两层：

1. 关键词审核
   命中敏感词、辱骂词、广告词、联系方式、引流词时，直接拦截或进入待人工审核。
2. 人工审核
   对用户讨论内容进行人工复核，防止漏判或误判。

### 审核范围

- 话题评论
- 评论回复
- 反馈内容
- 诈骗举报补充说明
- 后续若保留用户发帖，也必须进入同一审核链路

### 状态设计

建议所有用户内容统一采用以下状态：

- `pending_review`
- `approved`
- `rejected`
- `hidden`

### 数据结构建议

新增 `review_tasks` 集合：

```js
{
  _id: 'review_xxx',
  targetType: 'topic_comment',
  targetId: 'comment_xxx',
  contentText: '用户提交内容',
  keywordHits: ['联系方式', '引流词'],
  autoReviewResult: 'blocked',
  reviewStatus: 'pending_review',
  reviewReason: '',
  reviewedBy: '',
  reviewedAt: null,
  createdAt: Date
}
```

### 审核策略建议

第一版建议采用“轻量可落地”方案：

- 维护一个敏感词库 `sensitive_words`
- 云函数提交前先做正则/关键词检测
- 命中高风险词：直接拒绝提交
- 命中中风险词：进入人工审核
- 未命中：也可选择直接通过，或抽样进入人工审核

### 页面/管理侧

新增简单审核页面：

- `pages/admin/review-center/review-center`

用于：

- 查看待审核列表
- 审核通过
- 审核驳回
- 查看命中关键词

---

## 3.4 视频播放功能

### 目标

在小程序里提供反诈骗视频学习能力。

### 需求说明

- 支持视频列表页
- 支持视频详情页播放
- 支持封面、标题、简介、分类、时长等信息
- 可关联文章、话题、答题

### 数据结构建议

新增 `videos` 集合：

```js
{
  _id: 'video_xxx',
  title: '反诈案例视频',
  summary: '视频简介',
  coverImage: '封面图',
  videoUrl: '视频地址',
  duration: 180,
  category: '案例解析',
  relatedArticleIds: [],
  relatedTopicIds: [],
  status: 'published',
  sort: 1,
  createdAt: Date,
  updatedAt: Date
}
```

### 页面建议

- `pages/video/video`
  视频列表页
- `pages/video-detail/video-detail`
  视频播放页

### 使用场景

- 首页增加“视频学习”入口
- 热点话题详情页可关联视频
- 文章详情页可推荐相关视频

### 后续可扩展

- 学习进度记录
- 看完视频奖励积分
- 视频学习后推荐答题

---

## 3.5 题库管理系统

### 目标

让题库可以被创建、维护、发布，而不是继续手工改 JSON 文件。

### 当前问题

- 当前用户一进入就是答题，运营层不够友好
- 题目创建、修改、上下架缺少管理入口
- 题库内容不能灵活分组和更新

### 二期改造要求

- 管理侧可以创建题库
- 管理侧可以添加题目、编辑题目、删除题目
- 支持题库发布与停用
- 支持题目分类、难度、标签
- 用户端进入答题前，先看到题库入口或题库说明页

### 推荐结构

新增 `question_banks` 集合：

```js
{
  _id: 'bank_xxx',
  title: '大学生反诈基础题库',
  summary: '适合新用户入门',
  coverImage: '封面图',
  questionCount: 50,
  status: 'published',
  sort: 1,
  createdAt: Date,
  updatedAt: Date
}
```

题目表 `quiz_questions` 增加：

```js
{
  _id: 'q001',
  bankId: 'bank_xxx',
  question: '题干',
  options: ['A', 'B', 'C', 'D'],
  answerIndex: 1,
  explanation: '解析',
  difficulty: 2,
  tags: ['刷单', '返利'],
  status: 'active',
  createdAt: Date,
  updatedAt: Date
}
```

### 页面建议

用户侧：

- `pages/quiz-home/quiz-home`
  题库入口页
- `pages/quiz/quiz`
  具体答题页

管理侧：

- `pages/admin/question-bank-management/question-bank-management`
- `pages/admin/question-editor/question-editor`

### 基础管理能力

- 创建题库
- 编辑题库
- 添加题目
- 编辑题目
- 上下架题目
- 按题库抽题

---

## 4. 二期新增页面建议

### 用户侧页面

- `pages/topic-detail/topic-detail`
- `pages/video/video`
- `pages/video-detail/video-detail`
- `pages/quiz-home/quiz-home`

### 管理侧页面

- `pages/admin/article-editor/article-editor`
- `pages/admin/topic-management/topic-management`
- `pages/admin/review-center/review-center`
- `pages/admin/video-management/video-management`
- `pages/admin/question-bank-management/question-bank-management`
- `pages/admin/question-editor/question-editor`

说明：

如果二期不打算单独做后台系统，可以先在当前小程序内加一组“管理员页面”，通过角色字段控制可见性。

---

## 5. 二期云函数建议

### 内容相关

- `getArticleDetail`
  支持返回富文本内容块
- `saveArticle`
  保存图文文章
- `uploadMedia`
  上传文章图片/视频封面

### 话题相关

- `getTopics`
- `getTopicDetail`
- `createTopic`
- `updateTopic`

### 评论与审核相关

- `submitTopicComment`
- `reviewContent`
- `getReviewTasks`
- `updateSensitiveWords`

### 视频相关

- `getVideos`
- `getVideoDetail`
- `saveVideo`

### 题库相关

- `getQuestionBanks`
- `saveQuestionBank`
- `saveQuizQuestion`
- `getQuizQuestionList`
- `publishQuestionBank`

---

## 6. 版本拆分建议

### Phase 2.1：内容升级版

目标：

- 完成图文文章能力
- 完成视频播放基础能力
- 完成话题模型设计

范围：

- 文章内容块结构
- 图文渲染
- 视频列表/详情播放
- 社区首页改为话题列表

### Phase 2.2：互动与审核版

目标：

- 完成引导式社区讨论
- 完成关键词审核与人工审核

范围：

- 话题详情页
- 讨论区
- 敏感词审核
- 审核中心
- 评论状态流转

### Phase 2.3：题库运营版

目标：

- 完成题库管理和题目管理
- 重构用户端答题入口

范围：

- 题库列表页
- 题库管理页
- 题目编辑页
- 题库发布与抽题逻辑

---

## 7. 排期建议

如果按 8 周规划，建议如下：

### 第 1-2 周

- 设计文章内容块结构
- 设计话题结构
- 设计视频结构
- 设计题库与题目结构
- 明确审核状态流转

### 第 3-4 周

- 完成图文文章详情渲染
- 完成视频列表与播放页
- 完成话题列表与话题详情页基础框架

### 第 5-6 周

- 完成评论讨论区
- 完成关键词审核
- 完成人工审核中心

### 第 7 周

- 完成题库管理页
- 完成题目新增/编辑/发布
- 完成用户答题入口重构

### 第 8 周

- 联调
- 回归测试
- 审核流程测试
- 上线前收口

---

## 8. 验收标准

二期验收至少要满足以下条件：

### 资讯

- 文章支持图文混排
- 运营可上传并配置图片

### 社区

- 社区首页展示官方话题
- 用户可以围绕话题评论讨论
- 用户不能绕开话题直接公开发帖

### 审核

- 用户内容提交前经过关键词审核
- 管理侧可进行人工审核
- 审核结果可追踪

### 视频

- 用户可正常播放反诈视频
- 视频可从首页或话题页进入

### 题库

- 管理侧可创建题库
- 管理侧可新增题目
- 用户先进入题库页，再进入答题页

---

## 9. 二期优先级建议

- `P0`
  图文文章、引导式社区、审核机制
- `P1`
  视频播放、题库管理
- `P2`
  推荐联动、学习进度、数据看板

---

## 10. 建议的下一步动作

二期开始前建议马上做 3 件事：

1. 先定数据结构
   尤其是文章内容块、话题结构、审核状态、题库结构。
2. 先定管理侧范围
   管理页面是直接做在现有小程序里，还是后续单独拆后台。
3. 先定审核规则
   哪些词直接拒绝，哪些词进入人工审核，哪些内容允许直接展示。

结论：

二期的核心不是“多做几个页面”，而是把内容能力、互动方式和审核体系一起重做。只要这 5 个需求做对，项目就会从当前的功能型小程序，真正进入内容运营型产品阶段。
