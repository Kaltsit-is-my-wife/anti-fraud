# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# 反诈卫士项目记忆文档

本文件是本项目面向 AI 编码助手和后续开发者的**唯一优先参考记忆文档**。
如果本文件与 `AGENTS.md`、`ARCHITECTURE.md` 或其他历史说明冲突，以当前代码和本文件为准；修改架构、内容发布流程、目录职责或关键约束时，应优先更新本文件。

## 变更记录要求

根目录的 [CHANGELOG.md](./CHANGELOG.md) 是项目功能变更和问题修复的追踪记录，不是可选的发布说明。每次修改问题或新增功能时，都必须同步在 `CHANGELOG.md` 中留痕；纯格式调整或不改变行为的微小排版修改可以不单独记录。

每条变更记录至少应包含：

1. **问题场景**：说明用户如何遇到问题、当前行为是什么，以及影响范围。
2. **修改方案**：说明修改了哪些文件或模块、采用什么处理方式，以及重要的兼容或数据处理规则。
3. **验证结果**：记录执行过的语法检查、测试、构建、微信开发者工具验证或仍待完成的人工验证。

新增功能也必须说明原先缺少的能力、具体实现方案和验证方式；如果只是调研或规划，应明确标记为“当前已实现”“已知问题”或“后续规划”，不能把规划写成已完成能力。涉及云函数、数据库、CMS、云存储或部署的变更，还应记录必要的发布/部署步骤和环境注意事项。

推荐记录结构：

```markdown
## YYYY-MM-DD - 变更标题

### 问题场景
- ...

### 修改方案
- ...

### 验证结果
- ...
```

完成代码修改前，应先确认对应的 `CHANGELOG.md` 条目会随同代码变更提交；代码审查时也要检查功能修改和变更记录是否保持一致。

## 项目概览

**反诈卫士**是面向大学生的微信小程序，使用微信原生小程序框架、微信云开发和通义千问（Qwen）。

```text
微信小程序前端
  pages/ + utils/ + images/
          ↓ wx.cloud.callFunction
微信云函数（每个 cloudfunctions/<name> 独立部署）
          ↓
微信云数据库 / 云存储 / Qwen 外部模型
```

项目没有根目录 npm 工程。前端由微信开发者工具编译；云函数目录分别安装依赖、分别上传部署。

## 技术栈与关键入口

- 前端：WXML、WXSS、JavaScript，原生微信小程序框架
- 后端：`cloudfunctions/<name>/index.js`，Node.js 云函数
- 数据：微信云数据库
- 文件：微信云存储，前端通过 `cloud://` 文件 ID 或 HTTPS 地址使用
- AI：`cloudfunctions/aiChat` 调用 Qwen；密钥必须放在云函数环境变量，不得放到前端
- 启动入口：[app.js](./app.js)、[app.json](./app.json)、[app.wxss](./app.wxss)
- 页面目录：[pages/](./pages/)
- 公共工具：[utils/](./utils/)
- 云函数目录：[cloudfunctions/](./cloudfunctions/)
- 图片和 TabBar 图标：[images/](./images/)

项目使用微信云开发默认环境：

```javascript
wx.cloud.init({
  traceUser: true
})
```

`project.config.json` 中的 AppID 和开发者工具当前绑定的云环境必须与目标环境一致。修改或新增云函数后，必须在微信开发者工具中选择“上传并部署：云端安装依赖”。

## 常用命令与验证方式

仓库**没有根目录 npm 工程，也没有 lint、单元测试或自动化构建脚本**。不要假设 `npm test`、`npm run build` 可用；验证以语法检查、开发者工具编译和真机/体验版回归为准。

```bash
# 单文件 JavaScript 语法检查（改动的每个 .js 都至少跑一次）
node --check pages/index/index.js
node --check cloudfunctions/getBanners/index.js

# 批量检查当前改动涉及的 JS 文件（Git Bash）
git diff --name-only -- '*.js' | xargs -r -n1 node --check

# 云函数依赖（仅本地调试或排查依赖时需要；部署用云端安装依赖）
cd cloudfunctions/aiChat && npm install

# 可选的命令行部署方式（需先安装并登录 Cloudbase CLI）
npm install -g @cloudbase/cli
cloudbase login
cloudbase functions:deploy getBanners
```

每个 `cloudfunctions/<name>/` 都有独立 `package.json`，依赖主要为 `wx-server-sdk`（多数为 `~2.6.3`，少数为 `latest`）。前端由微信开发者工具编译，不存在可用的 CLI 构建命令。发布前至少完成：语法检查 → 开发者工具编译并查看控制台 → 部署改动过的云函数 → 普通用户/管理员/审核员账号回归。

## 调试日志规范

根目录 `logs/` 用于临时诊断记录，不是生产日志目录；`pages/logs/` 是未在 `app.json` 注册的历史页面，与 `logs/` 无关。完整格式和脱敏要求见 [logs/README.md](./logs/README.md)。

- 文件命名：`logs/YYYY-MM-DD-<topic>.md`，一次问题一个文件。
- Console 日志统一为一行 JSON：`[module] {"ts":"...","level":"INFO","stage":"模块:动作",...}`。
- 级别：`INFO` 正常阶段、`WARN` 可疑/取消/超限/心跳、`ERROR` 明确失败。
- 记录文件至少包含：日期、分支/提交、环境、复现步骤、预期/实际、关键日志、结论与下一步。
- 不记录 `openid`、手机号、学号、姓名、密钥、token；示例数据使用占位值。
- 小程序运行时不能直接写仓库文件；排查时把 Console 输出复制到 `logs/` 记录文件。
- 客户端直传云存储（如 `wx.cloud.uploadFile`）不会产生云函数日志，需要在客户端 Console 排查。
- 问题解决后删除临时日志；有长期价值的结论整理到 `docs/research/`。

## 架构分层

### 前端页面

- 内容：`pages/index`、`pages/article-detail`、`pages/search`
- 视频：`pages/video`、`pages/video-detail`
- 学习：`pages/quiz`、`pages/quiz-home`、`pages/quiz-leaderboard`、`pages/learning`、`pages/learning-records`
- 社区：`pages/community`、`pages/topic-detail`、`pages/community-post-*`、`pages/messages`、`pages/profile`
- 用户：`pages/user`、`pages/my`、`pages/account`、`pages/bind-student`、`pages/sign-in`、`pages/achievements`、`pages/title-management`、`pages/points`、`pages/points-history`、`pages/backpack`、`pages/redeem-info`
- AI 与辅助：`pages/chat`、`pages/scam-report`、`pages/settings`、`pages/about`、`pages/feedback`
- 管理端：`pages/admin-center`、`pages/topic-management`、`pages/review-center`、`pages/video-management`、`pages/question-bank-management`、`pages/question-editor`

通常每个页面包含 `.js`、`.wxml`、`.wxss`、`.json`。修改页面结构时，同时检查事件名、数据字段和导航路径。`pages/logs/` 目录存在但**未在 `app.json` 注册**，属于历史遗留，不要把它当作可跳转页面。

### 公共工具（`utils/`）

- `cloud.js`：`resolveCloudFileUrls()` 把 `cloud://` 文件 ID 批量换成临时 URL（结果缓存 30 分钟）；`getCloudFunctionErrorMessage()` 把未部署等错误转成可读提示。
- `cache.js`：基于 `wx.setStorageSync` 的 TTL 缓存，键统一加 `perf_cache:` 前缀，提供 `readCacheData/writeCacheData/removeCacheData/shouldRefresh`。
- `permission.js`：前端权限快照（`isAdmin`、`roles` 中的 `operator`/`reviewer`），只用于隐藏入口和页面跳转，**不是安全边界**；管理云函数仍须自行校验。
- `feature.js`：功能开关。当前 `pointsMallEnabled: false`，`pages/user`、`pages/my`、`pages/points` 会隐藏或拦截积分商城入口并显示 `POINTS_MALL_NOTICE`；商城云函数仍保留。
- `defaultVideos.js`：视频列表为空时合并展示的内置演示视频，详见视频章节。
- `util.js`：通用格式化/工具函数。

### 云函数业务域

- 用户：`login`、`getUserInfo`、`bindStudent`、`unbindStudent`、`getSchools`、`clearUserData`、`getLearningRecords`、`getPointsRecords`
- 行为与奖励：`userSignIn`、`trackAction`、`getTitles`、`getUserTitles`、`equipTitle`、`redeemTitle`
- 文章：`getArticles`、`getArticleDetail`、`searchArticles`、`updateArticleCategories`、`updateArticleTags`
- 首页展示：`getBanners`（只读启用的轮播图）
- AI：`aiChat`
- 答题与题库：`initQuizQuestions`、`getQuizQuestions`、`getQuizQuestionList`、`submitQuizAttempt`、`getQuizLeaderboard`、`getQuestionBanks`、`getAdminQuestionBankList`、`initQuestionBanks`、`saveQuestionBank`、`deleteQuestionBank`、`saveQuizQuestion`、`deleteQuizQuestion`、`updateQuestionBankRelation`
- 社区与社交：`getTopics`、`getTopicDetail`、`getTopicComments`、`submitTopicComment`、`createPost`、`getPosts`、`getPostDetail`、`createComment`、`getComments`、`followUser`、`getNotifications`、`markNotificationRead`、`getUnreadCount`、`getPublicProfile`、`updateProfileDisplay`、`searchUsers`
- 视频：`getVideos`、`getVideoDetail`、`getAdminVideoList`、`saveVideo`、`deleteVideo`
- 管理与审核：`getAdminTopicList`、`saveTopic`、`initTopics`、`deleteTopic`、`getReviewTasks`、`reviewContent`
- 商城：`getProducts`、`initProducts`、`redeemProduct`、`getExchangeRecords`、`getUserBackpack`、`useBackpackItem`（前端入口受 `utils/feature.js` 的 `pointsMallEnabled` 控制，当前关闭）
- 风险与反馈：`createScamReport`、`submitFeedback`
- 一次性维护/迁移：`checkArticleCategories`、`fixArticleCategories`、`convertArticleCategories`、`fixAllCategory`、`fixUserData`、`migrateUserUID`；这些不是日常业务链路，运行前必须备份并确认目标环境。

前端调用约定：

```javascript
const res = await wx.cloud.callFunction({
  name: '函数目录名',
  data: {}
})
```

通常返回 `{ success: true, data: {} }` 或 `{ success: false, errMsg: '...' }`。修改返回结构时，必须同步检查全部调用页面。

## 数据库集合与数据边界

### 私有或敏感数据

- `users`：学号、姓名、手机号、权限、积分等敏感信息
- `points_records`：积分流水
- `read_records`：阅读记录
- `exchange_records`：兑换记录
- `quiz_attempts`：答题记录
- `bind_logs`：绑定记录
- `sign_records`：签到记录
- `user_achievements`：用户已解锁成就
- `user_backpack`：用户背包物品
- `feedback_records`：用户反馈内容，含联系方式，仅供审核/管理读取

### 公共或内容数据

- `articles`：反诈资讯/文章
- `banners`：首页轮播图集合，由 CMS 维护，用户侧经 `getBanners` 只读启用记录
- `videos`：视频内容
- `topics`：官方社区话题
- `posts`、`comments`、`follows`、`notifications`：社区互动
- `public_profiles`：可公开展示的资料
- `quiz_questions`、`question_banks`：题库和题目
- `products`：积分商城商品
- `titles`、`achievements`：称号与成就定义
- `scam_reports`：用户诈骗风险反馈，含审核状态
- `review_tasks`、`review_keyword_rules`：审核任务与关键词规则
- `schools`、`majors`、`colleges`：学生绑定用的学校/专业/学院字典

`users` 不应直接向公众展示；公开资料写入 `public_profiles`。内容展示和管理操作优先走云函数，不要让前端直接依赖数据库内部对象结构。

### 数据写入约束

- `add({ data })` 用于新增文档。
- 指定文档 ID 时使用 `doc(id).set({ data })` 或 `doc(id).update({ data })`。
- `set()`/`update()` 的 data 中禁止再次写入 `_id`，否则可能出现“不能更新 id 的值”。
- 涉及积分时同时检查 `users`、`points_records` 和每日奖励字段。
- 内容状态必须与审核记录保持一致；用户侧只读取允许展示的状态。

## 内容发布现状与流程

### 首页文章：云端为主，本地示例兜底

首页 [pages/index/index.js](./pages/index/index.js) 的 `loadArticlesFromCloud()` 调用 `getArticles`。
`getArticles` 查询 `articles` 集合，支持：

- `category` 分类筛选
- `page`、`pageSize` 分页
- `keyword` 标题搜索
- 按 `timestamp` 倒序

首页还会把首屏文章缓存到本地，缓存键为 `index:articles:first-page`，TTL 为 3 分钟。

如果云函数失败且首页没有可用文章，才会调用 `loadLocalArticles()`，使用 `index.js` 内 `allArticles` 中写死的示例文章。文章详情页也保留 `loadMockArticle()` 作为云函数和数据库均失败时的历史本地备份。因此：

```text
正常：CMS/云端 articles 集合 → getArticles/getArticleDetail → 首页/详情
失败兜底：pages/index/index.js 的 allArticles
        pages/article-detail/article-detail.js 的 mockArticles
```

文章内容管理不在当前小程序管理端内完成，项目约定继续使用 CMS/云端 `articles` 集合。本地示例数据作为开发和云端故障时的演示兜底保留；首页或详情页使用兜底时会显示“当前为演示数据/演示文章”提示，不应将其视为正式内容。

当前产品决策：文章继续由管理者通过 CMS/云端后台创建、编辑、上传和设置发布状态；暂不新增小程序内文章管理页、文章编辑页、`saveArticle` 或 `getAdminArticleList`。

CMS 文章媒体链路由 CMS 负责：封面图使用 `coverImage` 图片字段上传，正文图片/视频使用 `content` 富文本编辑器上传，CMS 将资源地址写入 `articles` 文档；小程序只读取并通过 `rich-text` 展示，不负责文章资源上传。

#### 文章发布状态的代码现状

CMS 文档约定 `status=1` 为草稿、`status=2` 为已发布，并写明只有已发布文章对用户可见。但当前用户侧代码尚未执行这个约束：

| 用户入口 | 当前实现 | 是否过滤已发布状态 |
|---|---|---|
| 首页列表 | `getArticles` 查询 `articles` | 否 |
| 文章详情 | `getArticleDetail` 按 `_id` 查询 `articles` | 否 |
| 文章搜索 | `searchArticles` 查询 `articles` | 否 |

因此，CMS 中将文章设置为草稿目前不能由云函数层可靠保证其对用户不可见；这属于待修复的代码缺口，不是当前产品管理方式的改变。后续修复时必须统一 CMS 实际使用的状态值，并同时覆盖列表、详情、搜索和相关推荐查询。

文章发布前还要确认 CMS、文章 `articles` 集合、封面/正文媒体所在云环境与小程序一致。仓库没有文章专用 `uploadMedia` 云函数；媒体上传依赖 CMS 自带能力。`cloudfunctions/database.md` 中的旧文章字段模型仍存在，字段名与 CMS/当前代码的 `timestamp`、`views`、`status` 不完全一致，新增或迁移数据时以实际 CMS 模型和调用方为准。

#### 文章调研结论与管理者标准流程

文章内容的主发布链路已经打通，不需要新增小程序内上传功能。当前工作的重点是让管理者熟悉 CMS 的内容模型、富文本媒体上传和发布状态操作：

```text
管理者进入 CMS
→ 在 articles 内容集合新建或编辑文章
→ 填写标题、分类、标签、正文、封面和发布时间
→ 正文图片/视频通过富文本编辑器上传
→ 先保存为草稿并检查内容和媒体
→ 审核通过后改为已发布
→ getArticles/getArticleDetail/searchArticles 提供给小程序展示
```

每次正式发布前应至少检查：

1. CMS 选择的云环境与小程序、`articles` 集合及媒体资源所在环境一致。
2. `content` 使用富文本字段，正文图片/视频能够在 CMS 预览或正常打开。
3. `coverImage`、`timestamp`、分类和标签已填写，媒体地址没有失效。
4. 审核前保持草稿状态，审核通过后再切换为已发布。
5. 发布后通过首页刷新、文章详情和搜索分别验收；首页文章首屏存在 3 分钟缓存。

因此，“文章上传流程没有打通”的准确表述是不成立的：文章和媒体的 CMS 管理链路已经存在，尚需管理者掌握标准操作；但用户侧云函数尚未严格执行草稿不可见规则，发布状态过滤仍是独立的待修复项。

### 首页 Banner：CMS 动态读取 + 本地降级

首页 Banner 已接入 CMS，`HOME_BANNERS` 只作为云函数不可用时的降级数据，不再是对外展示的正式来源。

```text
正常链路：CMS banners 集合 → getBanners（status:true，按 sort 升序）
        → pages/index/index.js 的 loadBanners()
        → resolveCloudFileUrls() 解析 cloud://
        → 首页 swiper，并写入本地缓存 index:banners:v2（TTL 10 分钟）
失败兜底：pages/index/index.js 的 HOME_BANNERS（4 条本地渐变）+ 降级提示
```

`getBanners`（[cloudfunctions/getBanners](./cloudfunctions/getBanners/index.js)）的契约：

| 场景 | 返回 |
|---|---|
| 正常/空列表 | `{ success: true, data: { list, total, emptyReason } }` |
| 集合未创建（`-502005`） | `{ success: true, data: { list: [], total: 0, emptyReason: 'collection_not_exist' } }` |
| 无启用记录 | `success: true`，`emptyReason: 'no_enabled_banner'` |
| 其他数据库异常 | `{ success: false, errCode: 'BANNERS_QUERY_FAILED', errMsg: '轮播图加载失败' }` |

CMS 文档中的 `banners` 字段即下发的展示字段：

| 字段 | 说明 |
|---|---|
| `title` | 主标题，为空的记录会被首页丢弃 |
| `desc` | 描述 |
| `icon` | 可选图标或 Emoji |
| `image` | 图片 URL 或 `cloud://` 文件 ID |
| `bgColor` | 无图片时的纯色/渐变背景 |
| `link` | 小程序内部页面路径 |
| `sort` | 数字越小越靠前 |
| `status` | `true` 才显示 |

首页行为约定：

1. 只有 `status === true` 的记录可见，草稿/禁用 Banner 不会下发。
2. `sort` 升序；`sort` 相同时按 `updatedAt`/`createdAt` 倒序。
3. 云端成功但返回空列表时，首页进入“暂无轮播内容”空态，并清除 `index:banners:v2`，不会继续展示旧缓存。
4. 云函数失败时，若已有缓存或已在展示云端 Banner 则保留现状；只有完全没有内容时才切换到 `HOME_BANNERS`，并在轮播下方显示“云端轮播暂不可用”提示。失败状态会被记录，下次 `onShow` 自动重试。
5. `cloud://` 解析失败会清空图片，由 `bgColor`/默认渐变兜底，不会出现破图。
6. `link` 必须命中 [pages/index/index.js](./pages/index/index.js) 中 `REGISTERED_PAGES` 白名单（与 `app.json` 的 `pages` 一一对应）；tabBar 页面走 `wx.switchTab`，其余走 `wx.navigateTo`；未注册路径和站外地址会被丢弃，点击不跳转也不报错。
7. 新增页面后必须同步 `REGISTERED_PAGES` 与 `app.json`。
8. `onLoad` 和每次 `onShow` 都会调用 `maybeRefreshBanners()`：缓存超过 10 分钟 TTL 时刷新，上次请求失败时直接重试；`onLoad` 与紧随其后的 `onShow` 由 `_bannerLoading` 去重，只发一次请求。云端成功返回空列表后按 TTL 节流，避免每次切回都请求。
9. 下拉刷新只刷新文章首屏，不重新请求 Banner；改完 `banners` 数据后，切回首页会按 TTL 自动刷新，也可清除缓存立即验证。

Banner 发布与验收补充：

1. `getBanners` 必须上传并部署到与小程序相同的云环境；未部署时首页回落到 `HOME_BANNERS`，控制台会记录 `loadBanners 失败`。
2. `banners` 集合中的 `status` 必须是布尔值 `true`，`sort` 必须是数字；字符串 `"true"` 不会展示。
3. Banner 使用云存储图片时，`image` 的 `cloud://` 文件 ID 与小程序、云函数必须属于同一云环境。
4. CMS 数据变更后，验收前应清除 `index:banners:v2` 缓存或等待 10 分钟 TTL 后切回首页触发 `onShow` 刷新；首页下拉刷新不会重新请求 Banner。
5. 测试数据只能用于验收，正式发布前必须替换为真实运营内容，并分别验证启用、禁用、排序、图片解析、空列表、网络失败和内部链接跳转。

Banner 相关代码与部署项：

```text
新增：cloudfunctions/getBanners
修改：pages/index/index.js、pages/index/index.wxml、pages/index/index.wxss
复用：utils/cloud.js、utils/cache.js
部署：getBanners 云函数（必须与小程序同一云环境）
数据：banners 集合及 CMS 字段
```

当前仍没有 Banner 管理页面、`saveBanner` 云函数或 Banner 媒体上传函数；运营直接通过 CMS 维护 `banners`，修改后可能需要清理 `index:banners:v2` 缓存或等待 10 分钟 TTL。

### 视频：已有标准发布链路

视频不是纯占位功能，已经有用户端和管理端完整骨架：

```text
operator 管理员
  → pages/video-management
  → getAdminVideoList（读取全部视频）
  → saveVideo（新增/编辑 videos）
  → status=published
  → getVideos（用户侧只读已发布视频）
  → pages/video
  → getVideoDetail
  → pages/video-detail / <video>
```

#### 管理端发布步骤

1. 使用 `isAdmin: true` 或 `roles` 包含 `operator` 的账号进入管理中心。
2. 打开 `pages/video-management`。
3. 填写标题、简介、封面图、视频地址、时长、分类和排序。
4. `coverImage`、`videoUrl` 可填 HTTPS 地址或 `cloud://` 文件 ID。
5. 状态先保存为 `draft`，确认资源可用后改为 `published`；`offline` 用于下架。
6. 保存时 `saveVideo` 会校验标题和视频地址；发布时写入 `publishedAt`。
7. 用户侧 `getVideos` 只查询 `status: 'published'`，按 `sort` 升序、发布时间倒序截取最多 50 条。
8. 用户点击后由 `getVideoDetail` 再次要求 `status: 'published'`，并解析关联文章、已发布话题。
9. 草稿/已下线视频可在管理页删除记录：`deleteVideo` 校验 `isAdmin`/`operator`，只删除 `videos` 文档，不删除云存储文件；已发布视频必须先改为 `offline`。

视频字段：

```text
title                 必填
summary               简介
coverImage            封面图，HTTPS 或 cloud://
videoUrl              必填，HTTPS 或 cloud://
duration              秒数
category              分类
status                draft / published / offline
sort                  排序值
relatedArticleIds     关联 articles 文档 ID 数组
relatedTopicIds       关联 topics 文档 ID 数组
publishedAt           发布时自动写入
createdAt/updatedAt   云函数维护
```

注意事项：

- 当前没有统一的媒体上传云函数；视频和封面需要先上传到云存储，再把地址填入管理页，或使用可访问的 HTTPS 地址。
- 视频管理页已支持本地视频/封面上传：`wx.chooseMedia` 选择文件，`wx.cloud.uploadFile` 直传云存储并回填表单，上传成功不改变 `draft` 状态。微信开发者工具对 `wx.chooseMedia` 的视频选择支持不完整，可能返回空 `tempFiles`（带 `failedCount`）；本地上传请用真机验证，开发者工具中可手动填写视频地址。
- `utils/defaultVideos.js` 中保留了一个 `coverImage`、`videoUrl` 为空的内置演示视频。云端列表为空时用户侧会合并显示它，详情页会显示“暂无可播放视频地址”。正式发布前应给它补真实资源，或移除该内置兜底。
- `getVideos`、`getVideoDetail`、`getAdminVideoList`、`saveVideo`、`deleteVideo` 必须部署到同一个目标云环境；普通用户不能调用管理函数。
- `deleteVideo` 仅删除 `videos` 数据库记录，不删除 `videoUrl` / `coverImage` 指向的云存储文件；已发布视频返回“已发布视频不能删除，请先下线”。
- 发布回归必须验证：列表可见、封面可见、视频可播放、草稿/下线不可见、关联文章/话题可跳转。

#### 视频发布讨论记录与后续规划（当前暂不改动）

本次确认的现行发布方式保持不变：

```text
本地视频和封面文件
  → 手动上传到当前目标云环境的云存储
  → 获取 videoUrl / coverImage 的 cloud:// 文件 ID
  → 在 pages/video-management 中填写资源地址
  → saveVideo 写入 videos 集合
  → 先用 draft 验证，再改为 published
  → getVideos / getVideoDetail 返回给用户端
  → utils/cloud.js 将 cloud:// 转为临时 URL
  → pages/video-detail 使用 <video> 播放
```

当前视频管理页只提供资源地址输入框，不提供本地文件选择和上传按钮；当前仓库也没有 `uploadMedia`、`uploadVideo` 或统一媒体上传云函数。因此暂不调整视频板块，发布视频时必须先通过微信开发者工具或云开发控制台上传视频和封面，再将 `cloud://` File ID 粘贴到管理页。

后续如果需要降低运营门槛，可以在不改变 `videos` 数据模型和 `saveVideo` 发布状态规则的前提下，优先增加管理页上传能力：

1. 管理页使用 `wx.chooseMedia` 选择视频，使用图片选择能力选择封面。
2. 前端使用 `wx.cloud.uploadFile` 分别上传视频和封面，取得两个 `fileID`。
3. 将 `fileID` 自动写入 `videoUrl` 和 `coverImage`，再调用现有 `saveVideo`。
4. 保留 `draft → published` 的审核/验证流程，不允许上传成功直接等同于正式发布。
5. 上传失败、格式不支持、文件过大和云环境不一致时必须显式提示。
6. 发布前继续验证普通用户列表可见、封面可见、视频可播放、草稿/下线不可见。

该升级方案目前只是后续规划，不应在没有明确需求和资源限制评估前修改现有视频发布代码。

## 权限与管理端

前端通过 `utils/permission.js` 隐藏无权限入口，但这不是安全边界。管理云函数还会读取当前 `users` 用户：

- `isAdmin === true`：管理员
- `roles` 包含 `operator`：可执行管理操作
- `roles` 包含 `reviewer`：可执行审核操作

新增或修改管理接口时，至少测试普通用户、管理员、未登录用户三种身份。管理端目前是小程序内轻量入口，不是独立后台系统。

## 登录、积分和核心业务流

### 登录

`app.js:onLaunch` → `login` → `users` → `public_profiles` → 本地缓存。
未绑定学生信息时，按时间间隔提示进入 `bind-student`。

- `ensureLogin()` 缓存登录结果 **5 分钟**，并用 `loginPromise` 合并并发调用；需要最新用户信息时传 `{ force: true }`。
- 登录态（`userInfo`、`openid`）写入 `wx.setStorageSync`，启动时由 `restoreLocalSession()` 先恢复，再由云端刷新。
- 未绑定学生信息的提醒最多每 **12 小时**一次，记录在 `last_bind_remind_at`。

### 文章

`pages/index` → `getArticles` → `articles`；
`pages/article-detail` → `getArticleDetail` → 阅读记录/浏览量/相关内容/互动。

### 社区

`pages/community` → `getTopics` → `topics`；
话题详情、评论和审核分别使用 `getTopicDetail`、`getTopicComments`、`submitTopicComment`、`reviewContent`。

### 答题与积分

`getQuizQuestions` → 用户答题 → `submitQuizAttempt` → `quiz_attempts`、`users`、`public_profiles`、`points_records`。

- `quizPoints` 是累计答对题数，用于排行榜。
- 答题商城每日奖励上限为 30 分。
- 每日日期按北京时间计算。

### AI

`pages/chat` → `aiChat` → Qwen → 本地对话缓存和 `trackAction`。
API Key 只能配置在云函数环境变量 `QWEN_API_KEY`；`QWEN_MODEL` 当前默认 `qwen-vl-plus`。代码读取的是 `process.env`，`cloudfunctions/aiChat/config.json` 的 `envVariables` 只是部署配置，仓库中的 Key 必须留空。修改环境变量后要重新部署 `aiChat`；该函数还有 `index_ocr.js` 历史实现，当前入口以 `package.json` 的 `main`/`index.js` 为准。

## 云函数、数据库和部署规则

1. 修改前先建立可回滚基线，不直接删除历史函数、集合或数据。
2. 只部署实际修改过的云函数，并确认目标云环境。
3. 数据迁移和初始化函数运行前备份数据、记录操作者/参数/结果，优先使用试运行参数。
4. 高风险函数包括：`clearUserData`、`fixUserData`、`migrateUserUID`、`fixArticleCategories`、`convertArticleCategories`、`fixAllCategory`、`initAchievements`、`initProducts`、`initTitles`、`initQuizQuestions`、`importQuizQuestions`。
5. 发布前清理开发者工具缓存并重新编译；前端发布后仍需单独部署对应云函数。
6. 检查函数名、入参、返回字段、集合是否存在、状态字段、分页参数和必要索引。
7. 云函数与 CMS 数据的真实环境验收必须记录部署环境、测试数据范围和仍未完成的人工验证，不能把本地桩测试写成已完成的线上验收。

前端发布流程：

1. 用微信开发者工具打开仓库根目录。
2. 检查 AppID、基础库和云环境。
3. 编译并检查控制台。
4. 对修改过的云函数执行“上传并部署：云端安装依赖”。
5. 使用普通用户、管理员/审核员测试账号进行体验版回归。
6. 通过体验版验证后再提交审核。

## 代码风格和修改约束

- 源文件通常保留中文模块头注释；功能变化时同步更新相关文档。
- 沿用现有字段命名、返回格式、缓存工具和权限工具，不重复实现。
- 页面错误要显式提示或记录，不用静默成功返回掩盖部署/数据问题。
- 修改页面结构时检查 WXML 事件、页面路径和 `app.json` 注册。
- 修改云函数返回结构时检查所有调用方。
- 不在仓库提交真实密钥、生产凭据或敏感用户数据。
- 代码变更完成后至少运行 JavaScript 语法检查，并根据改动范围执行相关回归。

## 文档边界

- `CLAUDE.md`：唯一优先的项目记忆、当前实现事实、架构约束和发布流程。
- `README.md`：项目简介、快速开始和文档入口；不重复维护详细架构。
- `ARCHITECTURE.md`：历史/独立架构说明，若与代码或本文件冲突，以本文件为准。
- `AGENTS.md`：历史的通用代理说明，新增规则应先写入本文件。
- `docs/README.md`：文档目录导航和分类规则。
- `CMS使用文档.md`、`CMS使用文档-简洁版.md`：CMS 操作手册，尤其是 `articles` 与 `banners` 的字段说明。
- `docs/guides/developer-handoff.md`：较详细的交接与回归清单；修改关键流程后应同步检查。
- `docs/planning/`：二期计划、需求、任务、验收、数据模型和预算；不代表全部功能都已实现。
- `docs/operations/`：云函数部署、快速部署、数据维护和运维说明。
- `docs/guides/`：开发者交接、AI、题库、话题等可执行专项指南。
- `docs/research/`：性能调查和问题分析材料。
- 根目录 `member-a-article-cms.md`、`member-b-banner.md`、`member-c-video.md` 与 `docs/team-collaboration/member-d-support-and-acceptance.md`：当前多人协作分工文档，属于正式协作约定，应纳入 Git 跟踪。
- `docs/team-collaboration/acceptance-checklist.md`：本地验收工作表，包含环境和账号记录，已被 `.gitignore` 忽略，不纳入 Git。
- `docs/archive/`：历史归档，不作为当前实现依据。

### 文档目录使用规则

新增或移动文档时，先按用途选择目录，不要把文件直接堆在 `docs/` 根目录：

| 目录 | 放置内容 | 判断标准 |
|---|---|---|
| `docs/planning/` | 产品规划、需求、Backlog、任务拆分、阶段验收、预算 | 描述未来建设或阶段计划 |
| `docs/operations/` | 部署、云环境、数据维护、发布运维 | 需要执行部署或运维操作 |
| `docs/guides/` | 开发交接、模块操作、专项功能指南、导入样例 | 能按步骤执行的当前工作说明 |
| `docs/research/` | 性能调查、问题分析、技术调研 | 记录分析过程、证据和候选方案 |
| `docs/archive/` | 已结束版本或历史方案 | 只用于追溯，不作为当前实现依据 |
| 根目录 `member-*.md` | 多人协作分工和责任边界 | 正式协作约定，应纳入 Git |
| `docs/team-collaboration/` | 本地验收记录和协作资料 | 默认仅本地使用；验收清单被忽略，`member-d-support-and-acceptance.md` 等分工文档需入库 |

`docs/README.md` 是分类入口。移动文件后必须同步更新其中的链接，以及仓库内引用该文件的相对路径；新增正式文档也要在导航中登记。根目录 `CLAUDE.md` 只记录当前实现事实和长期约束，不复制整篇操作手册。

## 当前已知架构缺口

- Banner 已支持 CMS 读取（`getBanners` + 首页 `loadBanners`），但仍没有小程序内 Banner 管理页、`saveBanner` 云函数和 Banner 媒体上传能力，运营只能通过 CMS 维护数据。
- 文章管理继续依赖 CMS；首页和详情仍保留本地示例兜底，正式发布前需确认不会掩盖云端配置错误。
- 视频管理和读取链路已存在，但没有统一媒体上传能力，且保留空资源内置视频。
- 部分历史云函数可能仍存在旧版写入 `_id`、本地降级或重复业务逻辑，修改时先检查调用链和数据影响。
- 二期方向包括图文文章、官方话题、内容审核、视频、题库管理；计划文档中的“规划新增”不能视为已部署能力。
