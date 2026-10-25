# 反诈卫士项目记忆文档

本文件是本项目面向 AI 编码助手和后续开发者的**唯一优先参考记忆文档**。
如果本文件与 `AGENTS.md`、`ARCHITECTURE.md` 或其他历史说明冲突，以当前代码和本文件为准；修改架构、内容发布流程、目录职责或关键约束时，应优先更新本文件。

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

## 架构分层

### 前端页面

- 内容：`pages/index`、`pages/article-detail`、`pages/search`
- 学习：`pages/quiz`、`pages/quiz-home`、`pages/quiz-leaderboard`、`pages/learning`
- 社区：`pages/community`、`pages/topic-detail`、`pages/community-post-*`、`pages/messages`、`pages/profile`
- 用户：`pages/user`、`pages/my`、`pages/sign-in`、`pages/achievements`、`pages/title-management`、`pages/points`、`pages/backpack`
- AI 与辅助：`pages/chat`、`pages/scam-report`、`pages/settings`、`pages/about`、`pages/feedback`
- 管理端：`pages/admin-center`、`pages/topic-management`、`pages/review-center`、`pages/video-management`、`pages/question-bank-management`、`pages/question-editor`

通常每个页面包含 `.js`、`.wxml`、`.wxss`、`.json`。修改页面结构时，同时检查事件名、数据字段和导航路径。

### 云函数业务域

- 用户：`login`、`getUserInfo`、`bindStudent`、`unbindStudent`、`getSchools`、`clearUserData`
- 行为与奖励：`userSignIn`、`trackAction`、`getTitles`、`getUserTitles`、`equipTitle`、`redeemTitle`
- 文章：`getArticles`、`getArticleDetail`、`searchArticles`、`updateArticleCategories`、`updateArticleTags`
- AI：`aiChat`
- 答题：`initQuizQuestions`、`getQuizQuestions`、`submitQuizAttempt`、`getQuizLeaderboard`
- 社区与社交：`getTopics`、`getTopicDetail`、`getTopicComments`、`submitTopicComment`、`createPost`、`getPosts`、`getPostDetail`、`createComment`、`getComments`、`followUser`、`getNotifications`、`markNotificationRead`、`getUnreadCount`、`getPublicProfile`、`updateProfileDisplay`、`searchUsers`
- 视频：`getVideos`、`getVideoDetail`、`getAdminVideoList`、`saveVideo`
- 管理与审核：`getAdminTopicList`、`saveTopic`、`getReviewTasks`、`reviewContent`、题库/题目管理函数
- 商城：`getProducts`、`initProducts`、`redeemProduct`、`getExchangeRecords`、`getUserBackpack`、`useBackpackItem`
- 风险反馈：`createScamReport`

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

### 公共或内容数据

- `articles`：反诈资讯/文章
- `banners`：CMS 设计中的首页轮播图集合，当前前端尚未接通
- `videos`：视频内容
- `topics`：官方社区话题
- `posts`、`comments`、`follows`、`notifications`：社区互动
- `public_profiles`：可公开展示的资料
- `quiz_questions`、`question_banks`：题库和题目
- `products`：积分商城商品
- `review_tasks`、`review_keyword_rules`：审核相关数据

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

### 首页 Banner：当前不是 CMS 动态读取

首页 [pages/index/index.js](./pages/index/index.js) 中的 `HOME_BANNERS` 是 4 条本地固定数据，当前只有标题、描述和渐变背景，没有真实图片或跳转链接。`loadBanners()` 只复制 `defaultBanners`，不会调用云函数。

虽然 [pages/index/index.wxml](./pages/index/index.wxml) 已支持 `item.image`，`utils/cloud.js` 也能把 `cloud://` 转成临时 URL，但仓库中目前没有 `getBanners` 云函数，也没有首页查询 `banners` 集合的代码。因此：

```text
当前实际：HOME_BANNERS → 本地缓存 → 首页
文档设计：CMS banners 集合 → getBanners（当前不存在）→ 首页
```

CMS 文档中的 `banners` 字段设计可作为后续接入协议：

| 字段 | 说明 |
|---|---|
| `title` | 主标题 |
| `desc` | 描述 |
| `icon` | 可选图标或 Emoji |
| `image` | 图片 URL 或 `cloud://` 文件 ID |
| `bgColor` | 无图片时的纯色/渐变背景 |
| `link` | 小程序内部页面路径 |
| `sort` | 数字越小越靠前 |
| `status` | `true` 才显示 |

当前替换 Banner 的最快方式是修改 `HOME_BANNERS` 并使用 `/images/...` 本地图片；长期方案是新增 `getBanners`，查询 `status: true` 的记录、按 `sort` 排序、用 `resolveCloudFileUrls()` 解析图片并继续使用已有缓存。接入 CMS 前不要误以为仅创建 `banners` 集合就会生效。

#### Banner CMS 接入规划（尚未实现）

后续接入 Banner 动态管理时，按以下边界实现，不把 CMS 设计误认为当前能力：

1. 在 `cloudfunctions/getBanners` 新增用户侧只读云函数。
2. 查询 `banners` 集合，仅返回 `status: true` 的记录。
3. 按 `sort` 升序排列；排序相同时按更新时间或创建时间倒序。
4. 返回 `title`、`desc`、`icon`、`image`、`bgColor`、`link`、`sort` 等展示字段。
5. 首页 `pages/index/index.js` 的 `loadBanners()` 改为调用 `getBanners`，不再只依赖 `HOME_BANNERS`。
6. 对 `image` 中的 `cloud://` 文件 ID 调用 `resolveCloudFileUrls()`；HTTPS 地址直接使用。
7. 保留本地渐变 Banner 作为接口失败时的明确降级方案，但不能覆盖成功返回的空列表；空列表应有可识别的空态或运营提示。
8. 继续使用 `index:banners:v2` 本地缓存，建议 TTL 为 10 分钟；新增、编辑、启停 Banner 后，验收时清理缓存或等待 TTL。
9. `link` 只允许跳转到已注册的小程序页面路径，并测试无链接、无图片、图片失效三种情况。
10. 接入完成后，至少验证：草稿/禁用 Banner 不可见、排序正确、图片可显示、点击跳转正确、云函数失败时首页仍可用。

Banner 规划所需的代码和部署项：

```text
新增：cloudfunctions/getBanners/index.js
修改：pages/index/index.js
复用：utils/cloud.js、utils/cache.js
部署：getBanners 云函数
数据：banners 集合及 CMS 字段
```

当前没有 Banner 管理页面、`saveBanner` 云函数或媒体上传函数；在上述能力补齐前，运营人员不能仅通过 CMS 修改就让首页生效。

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
- `utils/defaultVideos.js` 中保留了一个 `coverImage`、`videoUrl` 为空的内置演示视频。云端列表为空时用户侧会合并显示它，详情页会显示“暂无可播放视频地址”。正式发布前应给它补真实资源，或移除该内置兜底。
- `getVideos`、`getVideoDetail`、`getAdminVideoList`、`saveVideo` 必须部署到同一个目标云环境；普通用户不能调用管理函数。
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
API Key 只能配置在云函数环境变量 `QWEN_API_KEY`；`QWEN_MODEL` 当前默认 `qwen-vl-plus`。修改环境变量后要重新部署 `aiChat`。

## 云函数、数据库和部署规则

1. 修改前先建立可回滚基线，不直接删除历史函数、集合或数据。
2. 只部署实际修改过的云函数，并确认目标云环境。
3. 数据迁移和初始化函数运行前备份数据、记录操作者/参数/结果，优先使用试运行参数。
4. 高风险函数包括：`clearUserData`、`fixUserData`、`migrateUserUID`、`fixArticleCategories`、`convertArticleCategories`、`fixAllCategory`、`initAchievements`、`initProducts`、`initTitles`、`initQuizQuestions`、`importQuizQuestions`。
5. 发布前清理开发者工具缓存并重新编译；前端发布后仍需单独部署对应云函数。
6. 检查函数名、入参、返回字段、集合是否存在、状态字段、分页参数和必要索引。

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
- `CMS使用文档.md`、`CMS使用文档-简洁版.md`：CMS 操作手册，尤其是 `articles` 和设计中的 `banners` 字段说明。
- `docs/developer-handoff.md`：较详细的交接与回归清单；修改关键流程后应同步检查。
- `docs/phase2_*`：二期计划、验收和任务拆分，不代表全部功能都已实现。
- `docs/archive/`：历史归档，不作为当前实现依据。

## 当前已知架构缺口

- Banner CMS 方案已有文档和页面字段设计，但缺少 `getBanners` 云函数及首页动态读取链路。
- 文章管理继续依赖 CMS；首页和详情仍保留本地示例兜底，正式发布前需确认不会掩盖云端配置错误。
- 视频管理和读取链路已存在，但没有统一媒体上传能力，且保留空资源内置视频。
- 部分历史云函数可能仍存在旧版写入 `_id`、本地降级或重复业务逻辑，修改时先检查调用链和数据影响。
- 二期方向包括图文文章、官方话题、内容审核、视频、题库管理；计划文档中的“规划新增”不能视为已部署能力。
