# 项目架构

本文档描述 `反诈卫士` 当前代码架构、模块边界与数据分层。

不讨论详细产品规划；规划请看 [二期开发计划](C:/Users/冯宗林/WeChatProjects/miniprogram-14/docs/phase2_development_plan.md)。

---

## 1. 系统概览

当前项目由 4 层组成：

1. 微信小程序前端
2. 云函数业务层
3. 云数据库数据层
4. 外部能力集成层

```text
Mini Program Pages
  -> Cloud Functions
    -> Cloud Database
    -> External Services (Qwen / Cloud Storage)
```

---

## 2. 前端层

前端采用微信小程序原生框架，页面主要分为 5 类。

### 2.1 内容层

- `pages/index`
  首页资讯流、分类筛选、搜索入口
- `pages/article-detail`
  文章详情、评论区、相关推荐

### 2.2 学习层

- `pages/quiz`
  趣味答题
- `pages/quiz-leaderboard`
  答题排行榜
- `pages/learning`
  学习记录相关入口

### 2.3 社区层

- `pages/community`
  当前社区帖子流
- `pages/community-post-create`
  发帖页
- `pages/community-post-detail`
  帖子详情与讨论
- `pages/messages`
  站内消息
- `pages/profile`
  个人主页

### 2.4 用户层

- `pages/user`
  个人中心主入口
- `pages/my`
  我的资料页
- `pages/sign-in`
  签到页
- `pages/achievements`
  成就页
- `pages/title-management`
  称号管理
- `pages/points`
  积分商城
- `pages/backpack`
  背包

### 2.5 系统辅助层

- `pages/chat`
  AI 助手
- `pages/search`
  搜索
- `pages/scam-report`
  诈骗反馈
- `pages/settings`
  设置
- `pages/about`
  关于
- `pages/feedback`
  帮助/反馈

---

## 3. 云函数层

云函数按业务域拆分，而不是做成单体后端。

### 3.1 用户与账户

- `login`
- `getUserInfo`
- `bindStudent`
- `unbindStudent`
- `getSchools`
- `clearUserData`

### 3.2 行为与奖励

- `userSignIn`
- `trackAction`
- `getTitles`
- `getUserTitles`
- `equipTitle`
- `redeemTitle`

### 3.3 内容与资讯

- `getArticles`
- `getArticleDetail`
- `searchArticles`
- `updateArticleCategories`
- `updateArticleTags`

### 3.4 AI

- `aiChat`

### 3.5 答题

- `initQuizQuestions`
- `getQuizQuestions`
- `submitQuizAttempt`
- `getQuizLeaderboard`

### 3.6 社区与社交

- `createPost`
- `getPosts`
- `getPostDetail`
- `createComment`
- `getComments`
- `followUser`
- `getNotifications`
- `markNotificationRead`
- `getUnreadCount`
- `getPublicProfile`
- `updateProfileDisplay`
- `searchUsers`

### 3.7 商城与兑换

- `getProducts`
- `initProducts`
- `redeemProduct`
- `getExchangeRecords`
- `getUserBackpack`
- `useBackpackItem`

### 3.8 风险反馈

- `createScamReport`

---

## 4. 数据层

当前数据分为“私有用户数据”和“公共展示数据”两类。

### 4.1 私有数据

这些集合包含敏感或仅本人可见数据：

- `users`
- `points_records`
- `read_records`
- `exchange_records`
- `quiz_attempts`
- `bind_logs`

### 4.2 公共或半公共数据

这些集合主要用于内容展示、排行榜、社区互动：

- `articles`
- `banners`
- `public_profiles`
- `quiz_questions`
- `posts`
- `comments`
- `follows`
- `notifications`
- `scam_reports`
- `products`

### 4.3 分层原则

- `users` 存敏感用户信息，不直接对外展示
- `public_profiles` 存可公开资料，用于主页、排行、社交展示
- 内容展示尽量走云函数，不鼓励前端直接写数据库

---

## 5. 当前核心数据流

### 5.1 用户登录

`pages/user` / `app.js`
-> `login`
-> `users`
-> 同步本地缓存与 `public_profiles`

### 5.2 文章阅读

`pages/index`
-> `pages/article-detail`
-> `getArticleDetail`
-> `articles` / `read_records`
-> `trackAction`
-> 更新积分、阅读次数、成就相关状态

### 5.3 AI 对话

`pages/chat`
-> `aiChat`
-> Qwen
-> `trackAction`
-> 本地缓存对话记录

### 5.4 趣味答题

`pages/quiz`
-> `getQuizQuestions`
-> 用户答题
-> `submitQuizAttempt`
-> `quiz_attempts` / `users` / `public_profiles` / `points_records`

### 5.5 社区互动

`pages/community`
-> `getPosts`
-> `pages/community-post-detail`
-> `getComments`
-> `createComment`
-> `notifications`

---

## 6. 外部集成

### 6.1 AI

- 通义千问多模态模型
- 配置来源：`cloudfunctions/aiChat/config.json` 或云函数环境变量

### 6.2 微信云开发能力

- 云数据库
- 云存储
- 云函数

---

## 7. 当前架构约束

当前代码虽然已较完整，但仍有几个明确约束：

- 仍存在历史阶段遗留的本地降级逻辑
- 个别页面仍有较重的页面脚本逻辑，复用不足
- 一些旧的业务模型仍保留着 v3 时代的实现习惯
- 二期中社区、内容、审核、题库管理会继续重构

---

## 8. 二期演进方向

二期不会推翻整个项目，而是在当前架构上重点调整 5 条线：

1. 文章从纯文本升级为图文内容块
2. 社区从自由发帖升级为官方话题引导讨论
3. 用户内容接入关键词审核与人工审核
4. 新增视频内容层
5. 新增题库与题目管理能力

详细规划见：

- [二期开发计划](C:/Users/冯宗林/WeChatProjects/miniprogram-14/docs/phase2_development_plan.md)

---

## 9. 当前文档边界

- `README.md`
  负责项目总览、启动方式、文档导航
- `ARCHITECTURE.md`
  负责当前技术结构与模块边界
- `docs/phase2_development_plan.md`
  负责未来版本规划
- `docs/archive/`
  负责历史版本归档
