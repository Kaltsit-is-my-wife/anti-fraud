# v3 实施型更新文档（任务清单 + 数据结构 + 接口约定 + 验收标准）

本文在 `docs/archive/v3/v3_update_plan.md` 的基础上，进一步把 v3 拆成“可直接开干”的实现说明，默认你已确认：
- 社区加入 `tabBar`（4 个 Tab）
- 流量卡/话费卡只做“兑换记录 + 扣积分 + 人工发放”，不做自动充值
- 答题积分：`quizPoints` 用于排行榜；答题奖励商城积分：每答对 1 题 +1、每日上限 30（按北京时间 UTC+8 重置）
- 站内消息即可，右上角提供通知入口

---

## 1. 开发顺序（推荐）

按依赖关系拆分，避免互相阻塞：

1) 数据层与公共资料（`public_profiles`）打底
2) 趣味答题（题库/抽题/判分/奖励/排行榜）
3) 关注 + 消息（通知写入、消息页、未读数）
4) 社区（发帖/列表/详情）
5) 评论系统（文章评论 + 帖子评论 + 回复 + 头像进主页）
6) 搜索（资讯/用户）
7) 诈骗反馈（表单 + 96110 弹窗/拨号）
8) 积分商城：商品主键统一 + 兑换事务化 + 新增“流量卡/话费卡”
9) “我的主页展示”：用户选择展示成就（同步到 public_profiles）

---

## 2. 数据库新增/调整（Schema + 索引）

### 2.1 users（调整字段；私有表）

新增字段（建议）：

```js
{
  // 答题每日奖励（商城积分）限额控制
  quizRewardDailyDate: "YYYY-MM-DD",   // 按北京时间
  quizRewardDailyAwarded: 0,           // 今日已发放的商城积分（0~30）

  // 主页展示（用户自己选）
  displayAchievementIds: []            // 最多 6 个 achievementId
}
```

说明：
- `users` 含学号/手机号等敏感字段，不对外公开读取；对外展示统一走 `public_profiles`
- 日限额字段写在 `users`，避免需要每天聚合 `points_records`

---

### 2.2 public_profiles（新增；公共资料）

建议 `_id == uid`，便于 `doc(uid)` 查询：

```js
{
  _id: "123456789",
  uid: "123456789",
  nickName: "xxx",
  avatarUrl: "cloud://...",

  equippedTitleIds: [],          // 展示称号（<=3）
  displayAchievementIds: [],     // 展示成就（<=6）

  quizPoints: 0,                 // 排行榜积分（累计答对题数）
  quizTotalAttempts: 0,
  quizTotalCorrect: 0,
  quizMaxCorrect: 0,
  lastQuizAt: Date,

  followerCount: 0,
  followingCount: 0,

  createdAt: Date,
  updatedAt: Date
}
```

索引建议：
- `quizPoints`（降序）
- `nickName`（用于搜索；RegExp）

---

### 2.3 趣味答题

`quiz_questions`：

```js
{
  _id: "q001",
  questionId: "q001",
  question: "题干",
  options: ["A...", "B...", "C...", "D..."],
  answerIndex: 2,        // 不下发给前端
  explanation: "解析",   // 交卷后可下发
  difficulty: 1-5,
  tags: [],
  isActive: true,
  createdAt: Date,
  updatedAt: Date
}
```

`quiz_attempts`：

```js
{
  _id: "auto",
  uid: "123456789",
  questionIds: ["q001"...],  // 10题
  answers: [0,2,1...],       // 0~3
  correctCount: 7,

  earnedQuizPoints: 7,       // = correctCount
  earnedMallPoints: 7,       // = min(correctCount, 当日剩余额度)

  createdAt: Date
}
```

索引建议：
- `quiz_attempts.uid + createdAt(desc)`

---

### 2.4 社区 + 评论（统一评论表）

`posts`：
- `authorUid`, `content`, `images`, `status`, `createdAt`, `commentCount`

`comments`（统一）：
- `targetType: 'article'|'post'`
- `targetId`
- `authorUid`
- `content`
- `parentId`（一级为空；回复则为被回复评论 id）
- `replyToUid`
- `status`, `createdAt`

索引建议：
- `posts.createdAt(desc)`
- `comments.targetType + targetId + createdAt(asc)`

---

### 2.5 关注 + 消息

`follows`（关注关系）：
- `(followerUid, followeeUid)` 唯一
- `followeeUid` 普通索引（查粉丝）

`notifications`（站内消息）：
- `toUid`, `fromUid`, `type`, `payload`, `isRead`, `createdAt`
- 索引：`toUid + createdAt(desc)`，`toUid + isRead`

---

### 2.6 搜索

不新增表，使用：
- `articles`（现有）
- `public_profiles`（新增）

---

### 2.7 诈骗反馈

`scam_reports`：
- `reporterUid`, `type`, `channel`, `scamAccount`, `scamLink`, `content`, `images`, `createdAt`

---

### 2.8 积分商城（修复主键 + 新商品）

关键修复：
- 让 `products` 的 `_id == product.id`（例如 `gift_1`），否则 `redeemProduct` 按 doc 查询会失配
- `redeemProduct` 必须事务化，避免并发超卖/积分变负

新增商品（建议 category=`virtual`，并新增字段）：

```js
{
  id: "tel_10",
  name: "10元话费充值",
  category: "virtual",
  productType: "mobile_topup",
  points: 1200,
  stock: 100,
  fulfillment: "manual",           // 人工发放
  requireRedeemInfo: true          // 兑换时需填手机号/运营商
}
```

`exchange_records` 增加：
- `status: 'pending_fulfillment'|'completed'|'rejected'`
- `redeemInfo: { phone, carrier, note }`

---

## 3. 云函数接口约定（输入/输出）

说明：以下云函数命名为建议，你可按现有风格放在 `cloudfunctions/*` 下。

### 3.1 公共资料

`getPublicProfile`
- input：`{ uid }`
- output：
  - `profile`（public_profiles）
  - `titles`（展示称号详情：按 equippedTitleIds 查询 titles）
  - `achievements`（展示成就详情：按 displayAchievementIds 查询 achievements）
  - `isFollowing`（当前用户是否关注该 uid）

`updateProfileDisplay`
- input：`{ displayAchievementIds: [] }`（最多6）
- 行为：写 `users.displayAchievementIds`，并同步 `public_profiles.displayAchievementIds`

---

### 3.2 趣味答题

`initQuizQuestions`
- 行为：将 `docs/archive/v3/quiz_questions_seed.json` 写入 `quiz_questions`（建议 doc(_id).set）

`getQuizQuestions`
- input：`{ count: 10 }`
- output：`{ questions: [{questionId, question, options, difficulty, tags}] }`
- 约束：不返回 `answerIndex/explanation`

`submitQuizAttempt`
- input：
```js
{
  questionIds: ["q001"...],
  answers: [0,1,2...]
}
```
- output（示例）：
```js
{
  correctCount: 7,
  earnedQuizPoints: 7,
  earnedMallPoints: 7,
  dailyAwarded: 18,          // 今日已发放商城积分（更新后）
  dailyCap: 30,
  results: [
    { questionId: "q001", correct: true, correctIndex: 2, explanation: "..." }
  ]
}
```

实现约束（强制）：
- 必须服务端判分：按 `quiz_questions.answerIndex` 对比
- 必须按北京时间计算“今日日期”，并执行 30 上限逻辑
- 奖励商城积分写入 `points_records`（type=`earn`，reason=`Quiz reward`）
- 排行榜积分写入 `public_profiles.quizPoints`（inc correctCount）
- 写入 `quiz_attempts` 作为可追溯记录

---

### 3.3 排行榜

`getQuizLeaderboard`
- input：`{ limit: 50 }`
- output：`{ list: [{ uid, nickName, avatarUrl, quizPoints, rank }] }`

---

### 3.4 关注与消息

`followUser` / `unfollowUser`
- input：`{ uid }`（被关注者）
- 行为：写 `follows`；同步 `public_profiles.followerCount/followingCount`（inc/dec）

`getNotifications`
- input：`{ pageSize, cursor }`
- output：`{ list, nextCursor }`

`getUnreadCount`
- output：`{ unread: number }`

`markNotificationRead`
- input：`{ notificationId }`

触发点（写通知）：
- `createPost`：给所有粉丝写 `type='new_post'`
- `createComment`（回复）：给被回复者写 `type='reply'`

---

### 3.5 社区

`createPost`
- input：`{ content, images: [] }`
- output：`{ postId }`

`getPosts`
- input：`{ pageSize, cursor }`

`getPostDetail`
- input：`{ postId }`

---

### 3.6 评论

`getComments`
- input：`{ targetType, targetId, pageSize, cursor }`

`createComment`
- input：`{ targetType, targetId, content, parentId?, replyToUid? }`

---

### 3.7 搜索

`searchArticles`
- input：`{ keyword, limit }`（title/tag/summary）

`searchUsers`
- input：`{ keyword, limit }`（nickName/uid）

---

### 3.8 诈骗反馈

`createScamReport`
- input：表单字段
- output：`{ reportId }`

---

### 3.9 积分商城修复

`initProducts`（改造）
- 写入：`db.collection('products').doc(product.id).set({data: product})`

`redeemProduct`（改造）
- 必须使用事务：
  - 读 user/product + 校验
  - 扣积分、扣库存
  - 写 `exchange_records`（含 `redeemInfo`、status=`pending_fulfillment` 用于充值类）
  - 写 `points_records`（spend）

---

## 4. 前端页面改动清单（路由/入口/关键交互）

### 4.1 TabBar（4 个）

改 `app.json`：
- 首页：`pages/index/index`
- 社区：`pages/community/community`
- AI助手：`pages/chat/chat`
- 我的：`pages/user/user`

注意：
- Tab 页必须在 `pages` 顶层声明
- 现有 `pages/user/user` 是“我的”，保留

---

### 4.2 右上角站内通知入口

落点建议：`pages/user/user` 顶部 header 右侧
- 点击跳转：`/pages/messages/messages`
- 展示未读红点：调用 `getUnreadCount`

---

### 4.3 趣味答题入口（首页）

`pages/index/index.wxml`
- 新增入口卡片：跳转 `/pages/quiz/quiz`

`pages/quiz/quiz`
- onLoad：调用 `getQuizQuestions` 获取 10 题
- 选择答案：本地记录
- 交卷：调用 `submitQuizAttempt`
- 结果页：展示对错、正确选项与解析；展示本次获得：
  - `earnedQuizPoints`（排行榜积分）
  - `earnedMallPoints`（商城积分）与 `dailyAwarded/30`
- 入口按钮：查看排行榜 `/pages/quiz-leaderboard/quiz-leaderboard`

---

### 4.4 资讯评论区（文章详情）

改 `pages/article-detail/article-detail.wxml`
- 在底部操作栏上方增加：
  - 评论列表（一级+回复）
  - 输入框（评论/回复）
- 评论项头像/昵称点击：`/pages/profile/profile?uid=xxx`

---

### 4.5 社区（发帖/详情/评论）

`pages/community/community`
- 帖子流（分页）
- “发帖”按钮：跳转 `pages/community-post-create/community-post-create`

`pages/community-post-create/community-post-create`
- 发布成功后返回列表并刷新

`pages/community-post-detail/community-post-detail`
- 展示帖子正文
- 复用评论组件（targetType=`post`）

---

### 4.6 个人主页（查看他人）

`pages/profile/profile`
- onLoad(uid)：调用 `getPublicProfile`
- 展示：头像/昵称/称号（equippedTitleIds 对应 titles）/成就展示位/答题积分 quizPoints
- 关注按钮：follow/unfollow

---

### 4.7 搜索

`pages/search/search`
- tab：资讯/用户（v3 必做），社区可后续加
- 资讯：调用 `searchArticles`
- 用户：调用 `searchUsers`，点击进入 `pages/profile/profile`

首页搜索栏可改为跳转搜索页（或保留本地筛选逻辑并加“更多搜索”入口）。

---

### 4.8 诈骗反馈

`pages/scam-report/scam-report`
- 提交成功后：
  - `wx.showModal` 提示拨打 96110
  - confirm 时 `wx.makePhoneCall({ phoneNumber: '96110' })`

入口建议：首页增加快捷入口；或反馈页增加 Tab/按钮。

---

## 5. 验收标准（Checklist）

### 5.1 趣味答题
- 随机抽题每次 10 道，不下发正确答案
- 交卷后服务端判分，返回对错与解析
- `quizPoints`（排行榜积分）按答对题数累计
- 商城积分奖励：每答对 +1；同一用户每日最多 +30（北京时间）且可在结果页看到“今日已获得/30”
- 排行榜可显示 Top50，排序正确

### 5.2 社区/评论/主页
- 社区可发帖、列表可见、详情可见
- 文章详情有评论区：可评论、可回复
- 点击头像进入个人主页，能看到称号/成就展示位/答题积分

### 5.3 关注与消息
- 在个人主页可关注/取关
- 关注者发布帖子后，粉丝在消息页可收到“新帖子通知”
- 消息页支持未读/已读；右上角入口可见红点/未读数

### 5.4 搜索
- 可搜索资讯（标题/标签/摘要至少其一）
- 可搜索用户（昵称/UID），并跳转个人主页

### 5.5 诈骗反馈
- 可提交诈骗反馈，入库成功
- 成功后弹窗提示拨打 96110，并可一键拨号

### 5.6 积分商城
- 兑换商品不会出现“商品不存在”（主键一致）
- 并发下不会超卖/不会出现积分扣成负数（事务）
- 新增“流量卡/话费卡”商品可兑换，且会生成 `pending_fulfillment` 记录并保存手机号/运营商

---

## 6. 上线前数据初始化/迁移

必须执行：
1) 初始化题库：部署 `initQuizQuestions` 并执行一次
2) 商品初始化修复：改造 `initProducts` 后执行一次（确保 `_id == id`）
3) public_profiles 迁移：
   - 推荐方式：在 `login` 云函数里“确保 public_profiles 存在并同步昵称头像/称号展示位”
   - 对历史用户：可增加一次性云函数 `migratePublicProfiles`（遍历 users 写入 public_profiles）

