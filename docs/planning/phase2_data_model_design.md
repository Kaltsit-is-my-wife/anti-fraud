# 二期数据模型设计稿

文档名称：`反诈卫士二期数据模型设计稿`

适用项目：`反诈卫士` 微信小程序

用途：给二期开发提供统一的数据模型口径，作为数据库落地前的设计草案。

关联文档：

- `docs/planning/phase2_requirements.md`
- `docs/planning/phase2_cloud_function_task_list.md`
- `cloudfunctions/database.md`

说明：

- 本文档是二期设计稿，不替代最终数据库实施文档
- 重点是统一字段命名、集合职责和迁移策略
- 若历史字段与本文档不一致，以“兼容读取、逐步统一写入”为原则

---

## 1. 设计原则

### 1.1 集合职责清晰

- 内容数据与审核数据分离
- 公共展示数据与敏感数据分离
- 管理状态与用户展示状态分离

### 1.2 字段命名统一

二期建议统一以下时间和状态口径：

- 发布时间统一为 `publishedAt`
- 创建时间统一为 `createdAt`
- 更新时间统一为 `updatedAt`
- 浏览量统一为 `viewCount`
- 状态统一为 `status`

兼容说明：

- 历史文章可能仍存在 `timestamp`、`publishTime`、`views`
- 二期新写入数据建议统一按 `publishedAt`、`viewCount`
- 查询层需要兼容旧字段，写入层逐步收敛为新字段

### 1.3 审核前台隔离

- 用户提交内容默认不直接进入前台展示
- 审核任务记录与原始内容记录分开存储
- 前台默认只读取 `approved` 状态内容

### 1.4 最小迁移原则

- 尽量复用现有 `comments`、`users`、`quiz_questions` 等集合
- 对已有数据以补字段和兼容读取为主
- 避免一次性大迁移导致主链路不可用

---

## 2. 角色与权限模型

### 2.1 `users` 增补字段

建议在 `users` 集合增加以下字段：

```javascript
{
  roles: [],              // 例如 ['operator', 'reviewer']
  isAdmin: false,         // 兼容快速判断
  adminUpdatedAt: null
}
```

角色建议值：

- `operator`
- `reviewer`

说明：

- 普通用户 `roles` 为空数组
- 运营和审核可由同一账号同时持有两个角色
- 角色字段仅存于 `users`，不得同步到 `public_profiles`

---

## 3. 内容模型

## 3.1 `articles` 改造

用途：

- 存储资讯文章
- 支持图文混排
- 支持草稿与发布状态

建议结构：

```javascript
{
  _id: "auto",
  title: "文章标题",
  summary: "文章摘要",
  coverImage: "封面图URL",
  category: "分类",
  tag: "标签",
  tagType: "标签样式",

  contentBlocks: [
    {
      id: "blk_001",
      type: "text",
      text: "正文段落",
      sort: 1
    },
    {
      id: "blk_002",
      type: "image",
      imageUrl: "https://...",
      caption: "图片说明",
      sort: 2
    }
  ],

  content: "旧版纯文本正文，兼容保留",

  status: "draft",        // draft | published | offline
  publishedAt: Date,
  createdAt: Date,
  updatedAt: Date,
  viewCount: 0,
  authorUid: "管理员UID",
  authorName: "管理员名称"
}
```

建议索引：

- `status`
- `category`
- `publishedAt` 降序

兼容策略：

- 读取时兼容旧 `content`
- 读取时兼容旧 `views` / `timestamp`
- 新增或编辑文章后按新字段口径回写

---

## 3.2 `topics` 新增

用途：

- 存储官方热点话题
- 驱动二期社区首页与详情页

建议结构：

```javascript
{
  _id: "auto",
  title: "话题标题",
  summary: "引导摘要",
  coverImage: "封面图URL",

  contentBlocks: [
    {
      id: "blk_001",
      type: "text",
      text: "话题背景说明",
      sort: 1
    },
    {
      id: "blk_002",
      type: "image",
      imageUrl: "https://...",
      caption: "配图说明",
      sort: 2
    }
  ],

  relatedArticleIds: [],
  relatedVideoIds: [],

  status: "draft",        // draft | published | offline
  publishedAt: Date,
  sort: 0,
  commentCount: 0,
  createdAt: Date,
  updatedAt: Date,
  createdByUid: "管理员UID",
  updatedByUid: "管理员UID"
}
```

建议索引：

- `status`
- `publishedAt` 降序
- `sort`

---

## 3.3 `videos` 新增

用途：

- 存储可在小程序播放的视频内容

建议结构：

```javascript
{
  _id: "auto",
  title: "视频标题",
  summary: "视频简介",
  coverImage: "封面图URL",
  videoUrl: "https://...",
  durationSec: 180,
  category: "分类",

  relatedArticleIds: [],
  relatedTopicIds: [],
  relatedBankIds: [],

  status: "draft",        // draft | published | offline
  publishedAt: Date,
  createdAt: Date,
  updatedAt: Date,
  createdByUid: "管理员UID",
  updatedByUid: "管理员UID",
  viewCount: 0
}
```

建议索引：

- `status`
- `category`
- `publishedAt` 降序

---

## 4. 互动与审核模型

## 4.1 `comments` 改造

现有项目已经有 `comments` 集合，二期建议继续复用，不新增 `topic_comments`。

新增口径：

- `targetType` 增加 `topic`
- 评论与回复统一走审核状态

建议结构：

```javascript
{
  _id: "auto",
  targetType: "topic",    // article | post | topic
  targetId: "目标ID",

  parentId: null,         // 一级评论为空
  rootId: null,           // 回复链的根评论

  authorUid: "用户UID",
  authorNickName: "昵称快照",
  authorAvatarUrl: "头像快照",

  content: "评论内容",

  status: "pending_review",   // pending_review | approved | rejected | hidden
  reviewTaskId: "审核任务ID",
  matchedKeywordIds: [],

  createdAt: Date,
  updatedAt: Date
}
```

建议索引：

- `targetType + targetId`
- `status`
- `createdAt` 降序
- `parentId`

---

## 4.2 `review_tasks` 新增

用途：

- 记录自动审核与人工审核过程
- 作为审核中心主数据源

建议结构：

```javascript
{
  _id: "auto",
  sourceType: "topic_comment",    // topic_comment | feedback | scam_report
  sourceCollection: "comments",
  sourceId: "原始记录ID",

  submitterUid: "提交用户UID",
  submitterNickName: "提交用户昵称快照",

  contentSnapshot: "提交时的文本快照",
  matchedKeywords: [
    {
      keywordId: "rule_001",
      word: "示例词",
      riskLevel: "medium"
    }
  ],

  autoResult: "pending_review",   // blocked | pending_review
  status: "pending_review",       // pending_review | approved | rejected | hidden

  reviewerUid: "",
  reviewerRemark: "",
  reviewedAt: null,

  createdAt: Date,
  updatedAt: Date
}
```

建议索引：

- `status`
- `sourceType`
- `submitterUid`
- `createdAt` 降序

说明：

- 命中高风险词且直接拦截的内容，也建议落一条审核任务或审核日志，便于追踪
- 若不希望被拦截内容进入正式 `review_tasks`，可改为写入单独审计日志集合

---

## 4.3 `review_keyword_rules` 新增

用途：

- 存储高风险词和中风险词规则

建议结构：

```javascript
{
  _id: "auto",
  word: "联系方式",
  riskLevel: "high",      // high | medium
  category: "导流",
  enabled: true,
  createdAt: Date,
  updatedAt: Date,
  createdByUid: "管理员UID",
  updatedByUid: "管理员UID"
}
```

建议索引：

- `word`
- `riskLevel`
- `enabled`

---

## 4.4 `feedback_records` 新增

用途：

- 承载帮助与反馈页面提交的意见反馈

建议结构：

```javascript
{
  _id: "auto",
  reporterUid: "用户UID",
  reporterNickName: "昵称快照",
  contactInfo: "联系方式",
  content: "反馈内容",

  status: "pending_review",   // pending_review | approved | rejected | hidden
  reviewTaskId: "审核任务ID",

  createdAt: Date,
  updatedAt: Date
}
```

建议索引：

- `reporterUid`
- `status`
- `createdAt` 降序

---

## 4.5 `scam_reports` 改造

现有 `scam_reports` 可保留，但建议增加审核相关字段。

建议新增字段：

```javascript
{
  status: "pending_review",
  reviewTaskId: "审核任务ID",
  updatedAt: Date
}
```

说明：

- 诈骗举报不一定公开展示，但其补充说明属于用户文本输入，仍应进入审核链路
- 后续如需要“举报公开案例池”，可直接复用该状态字段

---

## 5. 题库模型

## 5.1 `question_banks` 新增

用途：

- 承载题库列表、题库配置和发布状态

建议结构：

```javascript
{
  _id: "auto",
  name: "题库名称",
  summary: "题库简介",
  coverImage: "封面图URL",

  questionCount: 0,
  questionLimit: 10,      // 默认单次题量
  sort: 0,

  status: "draft",        // draft | published | offline
  publishedAt: Date,
  createdAt: Date,
  updatedAt: Date,
  createdByUid: "管理员UID",
  updatedByUid: "管理员UID"
}
```

建议索引：

- `status`
- `sort`
- `publishedAt` 降序

---

## 5.2 `quiz_questions` 改造

二期建议在现有题目结构上增加题库归属。

建议结构：

```javascript
{
  _id: "auto",
  questionId: "q001",
  bankId: "题库ID",

  question: "题干",
  options: ["A", "B", "C", "D"],
  answerIndex: 0,
  explanation: "解析",
  difficulty: 1,
  tags: [],

  status: "active",       // active | inactive
  createdAt: Date,
  updatedAt: Date
}
```

建议索引：

- `bankId`
- `status`
- `difficulty`

迁移建议：

- 为现有所有题目补默认 `bankId`
- 若当前只有一套题库，可先创建默认题库并回填

---

## 5.3 `quiz_attempts` 改造

建议补充题库维度，便于后续统计。

建议新增字段：

```javascript
{
  bankId: "题库ID",
  bankName: "题库名称快照"
}
```

---

## 6. 旧社区数据处理建议

### 6.1 `posts`

- 二期不删除现有 `posts`
- 不再作为社区首页主数据源
- 若需要保留历史内容，可继续只读展示

### 6.2 `comments`

- 继续复用
- 原 `post`、`article` 评论不强制迁移
- 新增 `topic` 作为二期主链路

---

## 7. 权限建议

### 7.1 用户侧集合

- `articles`：用户侧只读已发布内容
- `topics`：用户侧只读已发布内容
- `videos`：用户侧只读已发布内容
- `question_banks`：用户侧只读已发布内容

### 7.2 敏感集合

- `users`
- `review_tasks`
- `review_keyword_rules`
- `feedback_records`

这些集合必须通过云函数访问，不能开放前端直接读写。

### 7.3 半敏感集合

- `comments`
- `scam_reports`

这些集合建议也统一走云函数，避免前端直接写入绕过审核。

---

## 8. 数据迁移建议

### 8.1 文章迁移

1. 保留旧 `content`
2. 新文章开始写 `contentBlocks`
3. 详情页读取时优先读 `contentBlocks`
4. 旧文章逐步按需补齐

### 8.2 题库迁移

1. 新建默认题库
2. 将现有题目批量回填 `bankId`
3. 抽题逻辑切换为按 `bankId`

### 8.3 社区迁移

1. 社区首页切到 `topics`
2. 关闭普通用户新建公开帖子
3. `posts` 仅保留历史兼容或内部归档

### 8.4 审核迁移

1. 评论先接入审核状态
2. 反馈和举报再接入审核任务
3. 前台查询默认只读 `approved`

---

## 9. 当前建议定稿项

若没有新的产品决议，建议在二期开工前先定以下口径：

1. 二期标准字段统一使用 `publishedAt`、`viewCount`、`status`
2. 二期评论统一复用 `comments`，不新建 `topic_comments`
3. 二期增加 `feedback_records`，不再让反馈页停留在本地假提交
4. 二期管理员角色直接放在 `users.roles`
5. 审核词规则单独使用 `review_keyword_rules`

