# v3 版本更新总结（已完成代码实现）

更新时间：2026-02-25

## 1. 主要新增功能

### 1.1 趣味答题（题库/抽题/判分/积分/排行榜）
- 新增题库集合 `quiz_questions`，提供 50 道反诈选择题（种子数据：`docs/archive/v3/quiz_questions_seed.json`；云函数内置同款种子）。
- 新增答题页面 `pages/quiz/quiz`：
  - 每次随机抽取 10 题（云函数 `getQuizQuestions`）
  - 交卷后服务端判分并返回解析（云函数 `submitQuizAttempt`）
- 新增排行榜页面 `pages/quiz-leaderboard/quiz-leaderboard`（云函数 `getQuizLeaderboard`）。
- 积分规则（严格按你确认的方案）：
  - 排行榜积分：累计答对题数（`quizPoints`）
  - 商城积分奖励：每答对 1 题 +1 分；每日上限 30（按北京时间 UTC+8 重置）

### 1.2 答题称号与成就
- 扩展 `initAchievements` / `initTitles`：新增答题类成就与称号（幂等补齐缺失项，不再因集合已有数据而跳过）。
- 扩展 `getUserInfo`：加入答题统计字段（quiz相关）用于成就同步授予。

### 1.3 社区板块（发帖/看帖/详情）
- TabBar 扩展为 4 个 Tab：首页 / 社区 / AI助手 / 我的。
- 新增社区页面：
  - `pages/community/community`（帖子流）
  - `pages/community-post-create/community-post-create`（发帖）
  - `pages/community-post-detail/community-post-detail`（帖子详情 + 评论）
- 后端新增：`posts` 集合与云函数 `createPost/getPosts/getPostDetail`。

### 1.4 评论区（资讯/帖子通用）与回复
- 文章详情页新增评论区：`pages/article-detail/article-detail`（评论/回复/头像进主页）。
- 评论后端新增：`comments` 集合与云函数 `createComment/getComments`，支持回复（parentId/replyToUid）。

### 1.5 个人主页（查看他人）
- 新增 `pages/profile/profile`，展示：
  - 头像、昵称、UID
  - 称号（展示位）
  - 成就展示位（用户可配置）
  - 答题积分（quizPoints）
  - 粉丝/关注数量（public_profiles）
- 后端新增：`public_profiles` 集合与云函数 `getPublicProfile/updateProfileDisplay`。

### 1.6 关注系统与站内消息
- 新增关注关系：`follows` 集合与云函数 `followUser`。
- 新增站内通知：`notifications` 集合与云函数 `getNotifications/markNotificationRead/getUnreadCount`。
- 触发逻辑：
  - 被关注用户发帖：粉丝收到 `new_post` 通知（createPost 内写入）
  - 评论回复：被回复者收到 `reply` 通知（createComment 内写入）
- “我的”页右上角新增通知入口（铃铛）+ 未读数，进入 `pages/messages/messages`。

### 1.7 搜索（资讯 + 用户）
- 新增 `pages/search/search`：
  - 资讯搜索：`searchArticles`
  - 用户搜索：`searchUsers`
- 首页搜索框升级为跳转全局搜索页（支持同时搜索资讯与用户）。

### 1.8 诈骗反馈入口（含96110提示）
- 新增 `pages/scam-report/scam-report` + 云函数 `createScamReport` + 集合 `scam_reports`。
- 提交成功后弹窗提示拨打 96110，并支持一键拨号。

### 1.9 积分商城增强（新增话费/流量 + 修复扣分逻辑）
- `initProducts` 改为幂等写入，并统一 products 主键：`_id == id`（避免兑换时“商品不存在”）。
- `redeemProduct` 修复扣积分/扣库存逻辑：使用原子条件更新（points>=cost、stock>0）并带补偿回滚，防止积分扣成负数/库存超卖。
- 新增商品：话费充值卡/流量卡（仅记录+扣积分+人工发放）
  - 后端：支持 `redeemInfo`（手机号/运营商/备注），记录状态 `pending_fulfillment`
  - 前端：新增 `pages/redeem-info/redeem-info` 录入兑换信息并提交

## 2. 新增/调整数据库集合

新增集合：
- `public_profiles`
- `quiz_questions`
- `quiz_attempts`
- `posts`
- `comments`
- `follows`
- `notifications`
- `scam_reports`

users 新增字段（v3）：
- `displayAchievementIds`
- `quizRewardDailyDate` / `quizRewardDailyAwarded`
- `quizPoints` / `quizTotalAttempts` / `quizTotalCorrect` / `quizMaxCorrect` / `lastQuizAt`

## 3. 新增云函数清单（v3）

- 答题：`initQuizQuestions` `getQuizQuestions` `submitQuizAttempt` `getQuizLeaderboard`
- 社区：`createPost` `getPosts` `getPostDetail`
- 评论：`createComment` `getComments`
- 关注：`followUser`
- 消息：`getNotifications` `markNotificationRead` `getUnreadCount`
- 搜索：`searchArticles` `searchUsers`
- 主页：`getPublicProfile` `updateProfileDisplay`
- 反馈：`createScamReport`

并改造：
- `login`：同步 `public_profiles` + 老用户v3字段兜底
- `equipTitle`：同步 public_profiles 的展示称号
- `initProducts/getProducts/redeemProduct`：适配 v3 主键与兑换流程
- `getUserInfo`：增加答题统计字段用于成就同步

## 4. 初始化/部署建议（上线前）

1) 创建 v3 新增集合（见 `cloudfunctions/database.md` 的 v3 部分）
2) 部署 v3 新增云函数（README 已更新部署清单）
3) 执行一次初始化：
   - `initQuizQuestions`：初始化题库
   - `initProducts`：写入/更新商品（确保 `_id==id`）
   - `initAchievements` / `initTitles`：补齐新增的答题成就与称号

## 5. 已同步更新的文档

- `docs/archive/v3/v3_update_plan.md`
- `docs/archive/v3/v3_implementation_guide.md`
- `cloudfunctions/database.md`
- `README.md`
- 各阶段相关目录说明文档与页面/云函数头部说明

