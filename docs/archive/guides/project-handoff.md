# 反诈卫士项目交接文档

> 版本：交接版 1.0　> 更新时间：2026-10-10
>
> 本文面向接手项目的开发、运营和管理员。原项目负责人交接后不再参与日常开发维护；后续以代码和本文档为准。

## 1. 项目概况

“反诈卫士”是面向大学生的微信小程序，使用微信小程序原生框架和微信云开发，提供反诈资讯、AI 助手、答题、社区、签到积分、成就称号、视频、反馈和后台管理能力。

- 前端：`pages/` 下的 WXML、WXSS、JavaScript、JSON
- 公共代码：`utils/`
- 云函数：`cloudfunctions/`
- 静态资源：`images/`
- 设计及运维文档：`docs/`、根目录 Markdown 文件
- 小程序入口：`app.js`、`app.json`、`app.wxss`

## 2. 接手前必备账号和权限

接手人需要向项目移交方确认以下权限。代码仓库本身不包含这些信息：

1. 微信公众平台/微信开发者工具账号，以及小程序 AppID 所属主体。
2. 微信云开发环境的环境 ID、云开发控制台权限和数据库读写权限。
3. 云函数部署权限。
4. 通义千问账号、API Key 和模型配置权限。
5. Git 仓库地址、默认分支、发布分支和提交规范。
6. 线上管理员账号、测试账号和测试数据说明。

API Key 的线上真实配置在微信云开发控制台的云函数环境变量中维护。接手人应进入对应云环境，打开 `aiChat` 云函数的配置，检查并更新：

- `QWEN_API_KEY`：通义千问 API Key
- `QWEN_MODEL`：模型名，当前默认值为 `qwen-vl-plus`

代码通过 `process.env.QWEN_API_KEY` 和 `process.env.QWEN_MODEL` 读取这些变量。仓库中的 `cloudfunctions/aiChat/config.json` 只用于记录云函数配置结构或部署辅助信息，不能把真实 Key 写进去；当前文件中的 Key 为空是正常的。修改云端环境变量后，需要重新部署/发布 `aiChat` 云函数，并用体验版实际发送一条文本和图片消息验证。

## 3. 本地启动

1. 安装微信开发者工具。
2. 用开发者工具打开本项目目录。
3. 检查 `project.config.json` 中的 `appid`，确保与接手的小程序一致。
4. 确认云开发环境已经开通，并使用项目绑定的默认环境。
5. 编译运行首页，检查首页、社区、答题、AI 助手和个人中心。

`app.js` 会在启动时执行 `wx.cloud.init({ traceUser: true })`，随后调用 `login` 云函数建立本地会话。

## 4. 主要用户功能

| 功能 | 页面入口 | 主要云函数 |
|---|---|---|
| 首页/资讯 | `pages/index`、`pages/article-detail`、`pages/search` | `getArticles`、`getArticleDetail`、`searchArticles` |
| AI 助手 | `pages/chat` | `aiChat`、`trackAction` |
| 社区 | `pages/community`、`pages/community-post-*`、`pages/topic-detail` | `getPosts`、`createPost`、`getComments`、`createComment`、`followUser` |
| 答题 | `pages/quiz-home`、`pages/quiz`、`pages/quiz-leaderboard` | `getQuizQuestions`、`submitQuizAttempt`、`getQuizLeaderboard` |
| 签到/积分 | `pages/sign-in`、`pages/points`、`pages/points-history` | `userSignIn`、`getPointsRecords` |
| 个人资料 | `pages/user`、`pages/profile`、`pages/account` | `getUserInfo`、`updateProfileDisplay`、`bindStudent` |
| 视频 | `pages/video`、`pages/video-detail` | `getVideos`、`getVideoDetail` |
| 诈骗反馈 | `pages/scam-report`、`pages/feedback` | `createScamReport`、`submitFeedback` |

## 5. 管理端功能

管理页面包括：

- `pages/admin-center`
- `pages/question-bank-management`
- `pages/question-editor`
- `pages/topic-management`
- `pages/video-management`
- `pages/review-center`
- `pages/title-management`

管理权限由项目中的权限判断和云函数校验共同控制。新增管理入口时，必须同时检查前端权限、云函数权限和数据库权限，不能只隐藏页面按钮。

## 6. 云函数维护

`cloudfunctions/` 当前包含用户、资讯、社区、题库、审核、商城、视频、初始化和数据迁移等云函数。部署时在微信开发者工具中，对变更过的函数选择：

> 上传并部署：云端安装依赖

首次接手建议按以下顺序验证：

1. `login`
2. `getUserInfo`
3. `getArticles`
4. `getQuizQuestions` 和 `submitQuizAttempt`
5. `aiChat`
6. `createPost`、`createComment`
7. `userSignIn`
8. 管理端题库、话题和审核流程

不要把数据迁移函数、批量修复函数当作普通接口重复执行。以下函数执行前应先备份数据库并阅读函数源码：`clearUserData`、`fixUserData`、`migrateUserUID`、`fixArticleCategories`、`convertArticleCategories`、`fixAllCategory`、`init*`、`importQuizQuestions`。

## 7. 数据库核心集合

核心集合及用途如下：

- `users`：私有用户资料、绑定信息、积分、签到和答题统计。
- `public_profiles`：公开昵称、头像、排行榜和关注计数。
- `articles`：反诈文章。
- `quiz_questions`：题库题目。
- `quiz_attempts`：答题记录。
- `posts`、`comments`、`topics`：社区内容。
- `follows`：关注关系。
- `notifications`：站内消息。
- `points_records`：积分流水。
- `videos`：视频内容。
- `review_tasks`：人工审核任务。
- `products`、`exchange_records`、`user_backpack`：积分商城和背包。

完整字段和索引以 [cloudfunctions/database.md](../cloudfunctions/database.md) 为准。涉及用户隐私的数据只允许在云函数内读取，不能直接暴露给前端。

## 8. 重要业务规则

- 用户 UID 为 9 位数字，公开资料使用 `public_profiles`，私密资料使用 `users`。
- 答题排行榜积分是累计答对题数；商城答题奖励每日上限 30 分，按北京时间计算。
- 学号绑定涉及学生信息，修改绑定逻辑前要同步检查隐私和权限。
- 云数据库使用 `doc(id).set({ data: {...} })` 时，数据对象不要包含 `_id`；需要指定文档 ID 时使用 `doc(id)`。
- 社区、反馈、审核内容都属于用户生成内容，发布、展示、删除和审核必须同时考虑权限和状态。

## 9. 已知问题和接手后的优先事项

1. 部分云函数仍在 `set()` 的 `data` 中显式写入 `_id`，可能触发“不能更新 id 的值”。优先检查 `followUser`、`equipTitle`、`login`、`initQuizQuestions`、`userSignIn` 等函数，并在云端回归验证。
2. AI Key 不在代码仓库中维护。必须到微信云开发控制台的 `aiChat` 云函数环境变量中配置 `QWEN_API_KEY`；修改后重新部署云函数，否则 AI 助手会提示未配置。
3. 当前 Git 工作区存在较多未提交修改和新增文件。接手时先确认哪些是正式版本，建立一个可回滚的基线提交。
4. 云开发控制台中的集合、索引、权限和云函数版本必须与代码版本对应；只更新前端代码不能保证线上功能正常。

## 10. 发布前检查清单

- [ ] AppID、云环境和生产环境配置正确。
- [ ] `aiChat` 云函数的 `QWEN_API_KEY` 已在微信云开发环境变量中配置，未写入仓库。
- [ ] 修改环境变量后已重新部署 `aiChat` 云函数，并完成文本/图片消息测试。
- [ ] 变更过的云函数已“云端安装依赖”部署。
- [ ] 数据库集合、索引和权限已核对。
- [ ] 普通用户能够登录、浏览文章、答题、签到、发帖和使用 AI。
- [ ] 未授权用户无法访问管理页面和管理云函数。
- [ ] 题库提交、积分发放和每日上限验证通过。
- [ ] 用户隐私字段未出现在公开资料和前端日志中。
- [ ] 真机测试过图片上传、视频播放、支付/兑换（如启用）和网络失败提示。
- [ ] 在微信开发者工具中上传体验版，完成核心流程回归后再提交审核。

## 11. 故障排查顺序

1. 先查看微信开发者工具控制台和云函数日志。
2. 确认调用的云函数名称与目录名称完全一致。
3. 确认云函数已部署到当前云环境，而不是只修改了本地文件。
4. 确认数据库集合存在、权限允许、字段类型符合预期。
5. 检查登录态、`openid`、UID 和用户是否完成学生绑定。
6. AI 功能报错时，检查 `QWEN_API_KEY`、模型名、网络请求和供应商额度。
7. 数据问题先导出备份，再运行迁移或修复函数。

## 12. 文档和代码维护约定

- 每个源文件顶部保留模块说明；修改所属功能时同步更新相关文档。
- 新增云函数时补充用途、入参、返回值、权限和部署说明。
- 重要数据库字段变更必须同步更新 `cloudfunctions/database.md`。
- 生产修复先在体验版验证，再提交正式版本。
- 每次发布记录日期、代码提交、云函数版本和数据库变更。

## 13. 建议的首次接手动作

1. 备份数据库和当前代码。
2. 建立 Git 基线提交并记录当前线上版本。
3. 配置并验证云环境、AI 环境变量和管理员账号。
4. 修复 `_id` 写入问题后部署相关云函数。
5. 按发布前检查清单完成一轮体验版回归。
6. 将后续问题、数据修复和发布记录写入 `docs/`，保持交接文档持续更新。
