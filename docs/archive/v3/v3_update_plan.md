# v3 版本迭代更新方案（可落地实施）

适用项目：`反诈卫士`（微信小程序 + 云开发）

目标：在现有“资讯/AI问答/积分/成就/称号”基础上，引入“趣味答题、社区、评论与回复、个人主页、关注与消息、搜索、诈骗反馈”等能力，并补齐积分商城兑换的正确性与可运营能力。

---

## 0. 关键结论（先定规则，避免返工）

为保证隐私与权限可控，v3 推荐引入“公共资料表”，避免直接对外开放 `users`（其中含学号等敏感字段，云开发不支持字段级读权限）。

- 私有用户表（已有）：`users`（仅自己可读写/或仅云函数读写）
- 公共资料表（新增）：`public_profiles`（公开只读字段：昵称、头像、称号展示、成就展示、答题积分等）

答题积分与商城积分分离（已确认），减少刷题影响兑换与运营成本：
- 商城积分：`users.points`（已有，用于积分商城）
- 答题积分：`public_profiles.quizPoints`（新增，用于排行榜对比与答题称号/成就）

---

## 1. 功能拆解与页面/云函数落点（对应你的 8 项需求）

### 1) 资讯页新增「反诈知识趣味答题」入口 + 趣味答题模块（含题库/排行榜/称号/成就）

前端改动：
- `pages/index/index.wxml`：在“🔥 最新资讯”上方增加「趣味答题」入口卡片（跳转 `pages/quiz/quiz`）
- 新增页面：
  - `pages/quiz/quiz`：抽题、答题、交卷、展示解析、得分
  - `pages/quiz-leaderboard/quiz-leaderboard`：排行榜（按答题积分）
  - `pages/quiz-achievements/quiz-achievements`（可选）：专门展示答题成就/称号入口（也可复用现有 `pages/achievements` 与 `pages/title-management`）

云数据库（新增集合）：
- `quiz_questions`：题库（维护 50+ 题）
- `quiz_attempts`：答题记录（每次答题一条，保存题目快照/答案/得分）

云函数（新增）：
- `initQuizQuestions`：初始化题库（将种子 50 题写入 `quiz_questions`）
- `getQuizQuestions`：随机抽取 10 题（**不下发正确答案**）
- `submitQuizAttempt`：提交答案、服务端判分、累加答题积分、发放称号/成就、返回解析
- `getQuizLeaderboard`：返回排行榜（只返回公共字段）

称号/成就（扩展现有体系）：
- 扩展 `cloudfunctions/initAchievements`：新增答题类成就（例：首次答题、累计答对 N 题、单次满分等）
- 扩展 `cloudfunctions/initTitles`：新增答题类称号（例：答题新手/达人/王者等）
- 扩展 `cloudfunctions/getUserInfo`：把答题统计纳入成就同步（见第 6 节）

题库种子：
- 见：`docs/archive/v3/quiz_questions_seed.json`（50 道选择题）

积分/奖励规则（已确认，可配置化）：
- 每次答题抽 10 题；服务端判分得到 `correctCount`
- 排行榜积分（答题积分）：`public_profiles.quizPoints += correctCount`（累计答对题数作为排行榜积分）
- 商城积分奖励：每答对 1 题奖励 `users.points +1`
  - 每日上限 30 分（同一用户每天最多从答题获得 30 商城积分）
  - 超出上限仍可继续答题与累计排行榜积分，但不再发放商城积分
- 每日上限的“日期边界”建议统一按北京时间（UTC+8）计算，保持与现有签到/学习统计口径一致
- 可选加分（后续可做）：单次满分额外排行榜加成/称号（建议优先做成就，不直接给大量商城积分）

实现要点（避免刷分与对账困难）：
- `submitQuizAttempt` 里计算当日剩余可奖励额度 `remain = 30 - awardedToday`
- 发放商城积分 `award = min(correctCount, max(remain, 0))`
- 记录发放明细到 `points_records`（reason=`Quiz reward`，relatedId=attemptId），便于审计
- `awardedToday` 的计算建议两种方案二选一：
  - A（轻量，推荐 v3）：在 `users` 增加 `quizRewardDailyDate` + `quizRewardDailyAwarded` 两字段
  - B（更规范）：按当天 `points_records` 聚合统计（数据量上来后成本更高）

排行榜规则：
- 以 `public_profiles.quizPoints` 倒序
- 同分按 `updatedAt` 或 `lastQuizAt` 先后排序（避免频繁抖动）

---

### 2) 积分商城新增「流量卡/话费充值卡」+ 修复积分扣除逻辑

现状风险（需修复）：
- `cloudfunctions/redeemProduct/index.js` 当前用 `.doc(productId)` 取商品，但 `initProducts` 用 `.add()` 自动生成 `_id`，前端传的是 `product.id`（如 `gift_1`）。这会导致“商品不存在/扣积分异常”等问题。

修复方案（推荐）：
- 统一商品主键：令 `products` 的 `_id == id`（例如 `_id: 'gift_1'`）
  - 改 `cloudfunctions/initProducts`：用 `doc(product.id).set({data: product})` 写入（可重复执行时做覆盖/跳过）
  - 改 `cloudfunctions/getProducts`：返回时补齐 `_id` 与 `id` 一致，前端继续用 `id`
  - 改 `cloudfunctions/redeemProduct`：继续按 `.doc(productId)` 取（此时一致）
- 兑换扣减必须事务化：
  - 用 `db.runTransaction` 同时校验库存/积分/限购 → 扣积分 → 减库存 → 写兑换记录 → 写积分流水
  - 防并发超卖/积分变负

新增商品（建议放到 `virtual`，走“记录+人工发放”最稳）：
- 流量卡（10 元/20 元/50 元等）
- 话费充值卡（10 元/30 元/50 元等）

兑换信息收集（已确认：仅实现记录 + 扣积分，不实现实际充值）：
- 兑换时弹窗收集：手机号、运营商（移动/联通/电信）、面额/类型确认、备注（可选）
- 写入 `exchange_records.redeemInfo`，并将记录状态设为 `pending_fulfillment`（待人工发放）
- 仍需完成：扣积分、扣库存、写积分流水（`points_records`）——均在事务内完成

前端实现建议：
- 新增 `pages/redeem-info/redeem-info` 页面用于填写手机号/运营商等信息，再调用 `redeemProduct` 完成兑换

---

### 3) 检查“我的界面”称号展示逻辑：用户可自行选择展示已获得的成就

现状：
- 当前称号展示基于 `users.equippedTitles`（最多 3 个），属于“可选择展示称号”
- 但“成就展示”没有用户自选展示位（你提出的新增需求）

落地方案：
- `users` 新增字段（仅自己可写）：
  - `displayAchievementIds: []`（用户选择要展示的成就 ID，建议最多 6 个）
- `public_profiles` 增加公开字段：
  - `displayAchievementIds: []`
  - `displayTitleIds: []`（可选；也可直接用现有 equippedTitles）
- 新增或复用页面：
  - 在 `pages/achievements/achievements` 增加“设为展示/取消展示”按钮
  - 或新增 `pages/profile-settings/profile-settings` 管理“主页展示内容”
- 云函数新增：
  - `updateProfileDisplay`：更新展示的成就/称号（同步写入 `users` + `public_profiles`）

---

### 4) 增加社区板块：用户自由发布帖子（内容监管后续）

前端：
- 已确认：加入底部 `tabBar`（变为 4 个 Tab：首页/社区/AI助手/我的）
- 新增页面：
  - `pages/community/community`：帖子流
  - `pages/community-post-create/community-post-create`：发帖
  - `pages/community-post-detail/community-post-detail`：帖子详情（含评论）

数据库（新增）：
- `posts`
  - `_id`
  - `authorUid`
  - `content`
  - `images: []`（可选）
  - `createdAt`, `updatedAt`
  - `commentCount`, `likeCount`（可选）
  - `status: 'published' | 'hidden'`（后续内容治理用）

云函数（新增）：
- `createPost`：创建帖子（写入 posts）
- `getPosts`：列表分页
- `getPostDetail`：详情

关注联动（需求 6）：`createPost` 成功后，给作者的粉丝写入通知（见第 6 节）

---

### 5) 资讯下方添加评论区：可评论/回复；点头像进个人主页

评论建议用统一表，支持“文章评论”和“帖子评论”：

数据库（新增）：
- `comments`
  - `_id`
  - `targetType: 'article' | 'post'`
  - `targetId: string`
  - `authorUid`
  - `content`
  - `parentId: string | null`（为空表示一级评论；不为空表示回复某条评论）
  - `replyToUid: string | null`（回复对象）
  - `createdAt`, `updatedAt`
  - `status: 'published' | 'hidden'`（后续治理）

前端：
- 改 `pages/article-detail/article-detail.wxml`：
  - 在底部操作栏上方增加评论列表 + 评论输入框
  - 评论项头像点击：跳转 `pages/profile/profile?uid=xxxx`
- 帖子详情页同样复用评论组件

云函数（新增）：
- `getComments`：按 targetType/targetId 拉取一级评论 + 最近回复（或简单拉平后前端组装）
- `createComment`：创建评论/回复（写入 comments；更新目标 commentCount）

个人主页（你要求“需要新建”）：
- 新增 `pages/profile/profile`（查看他人）
  - 展示：用户名、头像、称号（展示位）、成就（展示位）、答题积分、（可选）商城积分
  - 展示按钮：关注/取消关注
  - 展示作者发帖列表（可选）

---

### 6) 关注系统 + 发帖通知 + 消息页面

数据库（新增）：
- `follows`
  - `_id`
  - `followerUid`
  - `followeeUid`
  - `createdAt`
  - 索引：`(followerUid, followeeUid)` 唯一；`followeeUid` 普通索引

- `notifications`
  - `_id`
  - `toUid`
  - `fromUid`
  - `type: 'new_post' | 'reply' | 'comment' | ...`
  - `payload: { postId?, articleId?, commentId?, previewText? }`
  - `isRead: boolean`
  - `createdAt`
  - 索引：`toUid + createdAt(desc)`；`toUid + isRead`

云函数（新增）：
- `followUser` / `unfollowUser`
- `getNotifications`：分页拉取消息
- `markNotificationRead` / `markAllRead`
- `getUnreadCount`：用于角标/红点

通知触发点：
- `createPost`：作者发帖 → 查 `follows` 的 followerUid 列表 → 批量写 `notifications`
- `createComment`：回复别人 → 给被回复者发通知（type=`reply`）

前端：
- 新增 `pages/messages/messages`：消息列表
- 已确认：站内消息即可；在页面右上角添加“站内通知入口”
  - 推荐落点：`pages/user/user` 顶部 header 右侧铃铛图标（主入口）
  - 可选增强：`pages/index/index` 顶部也放一个，便于高频访问

说明（已确认）：
- v3 先做“站内消息”；若需要“微信订阅消息”推送，需要额外：订阅消息模板、用户授权流程、合规文本与运营配置（建议 v3.1 做）

---

### 7) 搜索功能：可搜索资讯与用户

前端：
- 新增 `pages/search/search`：搜索页（tab：资讯/用户/社区可选）
- `pages/index/index.wxml` 的搜索栏 `bindconfirm` 改为跳转到全局搜索页（保留本地筛选亦可）

后端：
- `searchArticles`：对 `articles` 用 `db.RegExp({regexp: keyword, options: 'i'})` 查 title/tag/summary
- `searchUsers`：对 `public_profiles` 查 nickName/uid

规模注意：
- RegExp 搜索对大数据不友好；当文章数量上千后，建议接入“云开发·全文检索/搜索服务”（另起一期）

---

### 8) 增加诈骗反馈入口：提交诈骗行为，成功后提示拨打 96110

前端：
- 新增 `pages/scam-report/scam-report`
  - 字段：诈骗类型、发生时间、渠道（电话/短信/社交/网页/APP）、对方账号/链接、描述、截图（可选）
  - 提交成功：弹窗提示“如正在遭遇诈骗请立即拨打 96110”，并提供一键拨号按钮（`wx.makePhoneCall`）

数据库（新增）：
- `scam_reports`
  - `_id`
  - `reporterUid`
  - `type`
  - `channel`
  - `scamAccount`
  - `scamLink`
  - `content`
  - `images: []`
  - `createdAt`

云函数（新增）：
- `createScamReport`

入口建议：
- `pages/index/index.wxml`：顶部区域新增“诈骗反馈”快捷入口
- 或 `pages/feedback/feedback` 新增第三个 Tab：“诈骗反馈”

---

## 2. 新增/调整数据结构（Schema）

### 2.1 public_profiles（新增，公共资料）

建议 `_id = uid`（便于通过 uid 直接 doc 查询）

```js
{
  _id: "uid",              // 例如 "123456789"
  uid: "123456789",
  nickName: "昵称",
  avatarUrl: "头像",

  // 展示相关（可公开）
  equippedTitleIds: [],    // 展示的称号（最多3）
  displayAchievementIds: [], // 展示的成就（最多6）

  // 答题相关
  quizPoints: 0,
  quizTotalAttempts: 0,
  quizTotalCorrect: 0,
  quizMaxCorrect: 0,
  lastQuizAt: Date,

  // 社交相关
  followerCount: 0,
  followingCount: 0,

  createdAt: Date,
  updatedAt: Date
}
```

索引：
- `quizPoints(desc)`（排行榜）
- `nickName`（搜索）

### 2.2 quiz_questions（新增）

```js
{
  _id: "q001",
  questionId: "q001",
  question: "题干",
  options: ["A...", "B...", "C...", "D..."],
  answerIndex: 2,          // 仅服务端判分使用；下发题目时不返回
  explanation: "解析",
  difficulty: 1-5,
  tags: ["刷单", "验证码"],
  isActive: true,
  createdAt: Date,
  updatedAt: Date
}
```

### 2.3 quiz_attempts（新增）

```js
{
  _id: "auto",
  uid: "123456789",
  attemptId: "auto or uuid",
  questionIds: ["q001", ...],    // 10 题
  answers: [0, 2, 1, ...],       // 用户答案
  correctCount: 7,
  earnedQuizPoints: 70,
  createdAt: Date
}
```

### 2.4 posts / comments / follows / notifications / scam_reports

见第 1 节各功能处定义；统一约定：
- 所有集合默认包含 `createdAt`/`updatedAt`
- 所有面向公共展示的内容均存储 `uid`，不要直接暴露 `_openid`

---

## 3. 云函数清单（v3 新增/改造）

新增：
- `initQuizQuestions`
- `getQuizQuestions`
- `submitQuizAttempt`
- `getQuizLeaderboard`
- `createPost` / `getPosts` / `getPostDetail`
- `createComment` / `getComments`
- `followUser` / `unfollowUser`
- `getNotifications` / `markNotificationRead` / `getUnreadCount`
- `searchArticles` / `searchUsers`
- `createScamReport`
- `updateProfileDisplay`
- `getPublicProfile`（通过 uid 返回 public_profiles + 展示成就/称号详情）

改造（强烈建议）：
- `redeemProduct`：改为事务 + 商品主键修复
- `initProducts`：写入时 `_id=id`
- `login`：登录/更新昵称头像后，同步 `public_profiles`
- `equipTitle`：佩戴/卸下后，同步 `public_profiles.equippedTitleIds`
- `getUserInfo`：把答题统计纳入成就计算（或单独在 `submitQuizAttempt` 发放成就/称号）

---

## 4. 前端路由与入口建议

新增页面建议加入 `app.json` pages 列表：
- `pages/quiz/quiz`
- `pages/quiz-leaderboard/quiz-leaderboard`
- `pages/community/community`
- `pages/community-post-create/community-post-create`
- `pages/community-post-detail/community-post-detail`
- `pages/profile/profile`
- `pages/messages/messages`
- `pages/search/search`
- `pages/scam-report/scam-report`

入口建议：
- 首页 `pages/index/index`：趣味答题 + 诈骗反馈 + 搜索
- “我的” `pages/user/user`：消息入口 + 我关注的人/关注我的（可选）
- 文章详情 `pages/article-detail/article-detail`：评论区 + 头像进入个人主页

TabBar（已确认新增“社区”Tab）：
- `tabBar.list` 调整为：`首页(pages/index/index)` / `社区(pages/community/community)` / `AI助手(pages/chat/chat)` / `我的(pages/user/user)`
- 注意：修改 tabBar 后，原 `pages/user/user` 仍可保留为“我的”，但 `app.json` 里原先 `pages/user/user` 的 pagePath 是 `pages/user/user`（保持不变）

---

## 5. 权限与安全（云数据库规则建议）

原则：
- `users` 仅本人可读写（含学号/手机号等敏感字段）
- 公共展示一律走 `public_profiles`（只包含安全字段）
- 帖子/评论/排行榜：可读；写必须本人；后续加审核字段

推荐：
- `public_profiles`：read true；write 仅云函数（或 doc.uid == auth.uid 的严格控制）
- `posts/comments/notifications/follows/scam_reports`：写入建议统一走云函数，数据库写权限尽量收紧

---

## 6. 答题称号与成就（建议清单）

成就（新增到 `achievements`）示例：
- `quiz_1`：首次答题
- `quiz_attempt_10`：累计答题 10 次
- `quiz_correct_50`：累计答对 50 题
- `quiz_perfect_1`：单次 10/10 满分
- `quiz_points_500`：答题积分达到 500

称号（新增到 `titles`）示例：
- `quiz_rookie`：答题新手（完成 10 次答题）
- `quiz_expert`：答题达人（累计答对 100 题）
- `quiz_master`：反诈答题王者（答题积分 1000）

发放逻辑两种选一：
1) 复用现有 `getUserInfo` 成就同步：把答题统计字段加入 stats，然后自动授予成就/称号
2) 在 `submitQuizAttempt` 里直接判断并写入 `users.achievements/users.titles`（更实时，但与既有成就体系并行，需谨慎避免重复）

---

## 7. 版本里程碑（建议按 3 个迭代交付）

v3.0（可上线 MVP）：
- 趣味答题（题库/抽题/判分/答题积分）+ 排行榜
- 资讯评论（评论/回复/个人主页只读）
- 社区（发帖/看帖）+ 站内消息（发帖通知）
- 诈骗反馈入口（提交 + 96110 提示）

v3.1（体验增强）：
- 关注列表/粉丝列表
- 搜索页（资讯+用户）
- 成就展示位/主页展示配置完善

v3.2（治理与运营）：
- 内容审核/屏蔽/举报
- 订阅消息推送（关注人发帖提醒）
- 搜索升级（全文检索）

---

## 8. 已确认决策（据此进入详细开发拆解）

1) 社区板块：加入底部 `tabBar`（4 个 Tab）
2) 流量卡/话费卡：只做“兑换记录 + 积分扣除 + 人工发放”，不做自动充值
3) 答题积分：作为排行榜积分；同时按“每答对 1 题奖励 1 商城积分、每日上限 30”发放
4) 通知：站内消息即可，并在页面右上角添加通知入口
