# Changelog-ysy.md — 成员 A（内容运营与社区治理）改动说明

> **受众**：负责合并 A / B / C 三个分工的合并执行者。
> **基线**：仓库原始发布版本（本文件刻意不记录任何提交号、分支名或本地路径，避免合并时产生噪音）。
> **范围**：仅 `anti-fraud-main/` 内的内容；GitHub 仓库根目录即 `anti-fraud-main`。
> **任务**：P0-01 话题发布主链路收口。

---

## 1. 一句话总结

打通「运营发话题 → 用户看话题 → 用户评论进审核」链路：补齐话题正文配图，修掉状态下拉错位，保证草稿/下线话题不透出、评论落库即为 `pending_review`；另按任务书附言挂上 4 张首页降级 Banner 图，并把根目录重复的 `image/` 合并进 `images/`。

**对其他分工的影响：无功能性影响。** 未修改审核中心、敏感词规则、角色配置、题库/题目、视频发布逻辑，也未新增文章编辑页或 `saveArticle`。

---

## 2. 改动清单（按文件）

### 2.1 云函数

| 文件 | 类型 | 改动 | 合并注意 |
|---|---|---|---|
| `cloudfunctions/saveTopic/index.js` | 修改 | 新增 `contentImages` 入参（`[{ imageUrl, caption }]`，最多 9 张），生成 `type: 'image'` 内容块；内容块统一重排 `sort`，顺序为 正文段落 → 配图 → `article_link` → `video_link` → 未知类型块；保留历史非文本块，避免重存丢数据；异常分支改为单行 JSON 日志 | 入参新增字段，向后兼容；返回结构未变（`{ success, data: { id } }`） |
| `cloudfunctions/submitTopicComment/index.js` | 修改 | 事务内 `add` 返回值兼容 `_id` / `id`，取不到评论 ID 时显式抛错（原来只取 `_id`，部分 SDK 版本下会静默写入失败、审核链路断裂）；补中文模块头注释；异常分支改为单行 JSON 日志 | 敏感词规则、频率限制、`pending_review` 写入逻辑均未改；审核中心无需调整 |

### 2.2 页面

| 文件 | 类型 | 改动 | 合并注意 |
|---|---|---|---|
| `pages/topic-management/topic-management.js` | 修改（主体） | 新增正文配图能力：`addContentImage` / `onContentImageCaptionInput` / `removeContentImage`，上传至云存储 `topics/content/`；抽出 `uploadImageToCloud` / `showUploadError` 供封面与配图共用；新增 `data.statusIndex` 修复状态下标；列表补充封面预览与配图数量；日志改为单行 JSON | **本文件改动最集中**，若他人也动过话题管理页，建议以本分支为基准再补他人改动 |
| `pages/topic-management/topic-management.wxml` | 修改 | 新增正文配图区（数量计数、添加上限提示、图注输入、逐张移除）；状态 picker 改用 `{{statusIndex}}`；列表项显示「配图：N」 | 事件名与 JS 一一对应；未改其他表单字段 |
| `pages/topic-management/topic-management.wxss` | 修改 | 新增配图列表与区块样式 | 纯样式追加，冲突概率低 |
| `pages/topic-detail/topic-detail.wxml` | 修改（1 行） | 内容块为 `image` 且 `imageUrl` 为空时只渲染图注，不再出现破图 | 仅 `wx:if` 条件，无结构变化 |
| `pages/index/index.js` | 修改（4 行） | `HOME_BANNERS` 4 条各加 `image` 字段，指向 `images/banners/` 本地图 | **只改数据字面量**；若他人改过 `loadBanners` 等逻辑，保留他人逻辑、只合这 4 个字段 |

### 2.3 公共工具

| 文件 | 类型 | 改动 | 合并注意 |
|---|---|---|---|
| `utils/logger.js` | 新增 | `createLogger(module)` 返回 `log(level, stage, detail)`，输出 `[module] {"ts","level","stage",...}` 单行 JSON，`level` 白名单 `INFO/WARN/ERROR` | 纯新增文件，无引用冲突；目前仅话题管理页使用 |

### 2.4 图片资源

| 路径 | 类型 | 说明 |
|---|---|---|
| `images/banners/banner-01-shuadan.jpg` ~ `banner-04-yishi.jpg` | 新增 | 4 张 900×537 JPEG（10–12 KB），无文字，左下角压暗供白色文案叠加；仅用于首页降级轮播 |
| `images/问题已找到-修复方案/articles-list-01.png` ~ `articles-list-03.png` | 新增（由旧目录重命名） | 原 `image/问题已找到-修复方案/` 下 3 张 articles 列表截图 |
| `images/问题已找到-修复方案/chat-input-bar.png` | 新增（由旧文件重命名） | 原仓库根目录 `image.png` |
| `image/` 整个目录、`image.png` | **删除** | 原目录 11 张截图中 8 张与上述 3 张完全重复（MD5 一致），已去重；合并后根目录不再有 `image/` |

> ⚠️ **合并提醒**：若 B / C 分支中仍有对 `image/` 或 `image.png` 的引用（文档或代码），合并后需一并改为 `images/问题已找到-修复方案/...`，否则会出现失效图片链接。

### 2.5 文档

| 文件 | 类型 | 改动 | 合并注意 |
|---|---|---|---|
| `CLAUDE.md` | 修改（6 处，共 15 行） | ① 图片目录说明补 `images/banners/` 与 `image/` 合并事实；② 首页 Banner 降级兜底说明改为「背景图在 `images/banners/`」；③ Banner 章节新增「本地降级图 vs `banners` 集合」的区别与上线文档链接；④ 社区章节新增 `contentBlocks` 四类内容块、配图上传路径、排序与兼容规则；⑤ 公共工具章节登记 `utils/logger.js`，日志规范补充云函数侧写法 | **按段落合并，切勿整文件覆盖**；B / C 多半也会改这份文件的其他章节 |
| `CHANGELOG.md` | 修改 | 文件顶部新增 2 条按日期倒序的条目：`2026-11-08`（P0-01 主链路）与 `2026-11-14`（新增代码规范整改） | 与他人条目按日期拼接，不要互删；条目结构为「问题场景 / 修改方案 / 验证结果」 |
| `docs/README.md` | 修改（1 行） | 运维文档列表新增 `banner-image-upload.md` | 一行追加，位置在 `operations` 分组末尾 |
| `docs/operations/banner-image-upload.md` | 新增 | Banner 图上传云存储 → 写入 `banners` 集合 → 清 `index:banners:v2` 缓存 → 验收的完整步骤 | 纯新增，无冲突 |
| `docs/guides/topic-publish-test.md` | 修改 | 补充正文配图与图注的发布前自测步骤 | 与他人改动若同段，保留双方内容 |
| `images/FOLDER.md` | 修改（重写） | 目录概览、TabBar 图标、`banners/` 用途与话题对应表、排查截图说明 | 若他人也整理过图片说明，以本版结构为主再补其条目 |
| `pages/topic-management/FOLDER.md` | 修改 | 补充配图字段、`contentImages` 入参、`statusIndex` 与上传路径说明 | 页面级说明，冲突概率低 |

---

## 3. 合并指引

### 3.1 建议的合并顺序

1. 先合 B（权限 / 审核中心）与 C（题库 / 视频）：二者与本次改动**没有文件重叠**，可独立合入。
2. 再合 A（本分支）：唯一可能产生文本冲突的是 `CLAUDE.md`、`CHANGELOG.md`、`docs/README.md` 三份共用文档，以及 `pages/index/index.js`。
3. 最后统一处理 `images/` 目录：确认没有残留 `image/` 引用。

### 3.2 冲突处理原则

- **共用文档按段落取并集**：`CLAUDE.md` 只加不删；`CHANGELOG.md` 顶部按日期倒序插入；`docs/README.md` 列表各加各的一行。
- **`pages/index/index.js` 只合数据**：保留他人的 `loadBanners` / 缓存逻辑，仅采纳 `HOME_BANNERS` 中 4 个 `image` 字段。
- **`pages/topic-management/*` 以本版为基准**：这是本次功能主体，若他人也有改动，逐个函数对齐，不要整文件择一。
- **不要回退删除**：`saveTopic` 的「未知内容块保留」与「不传 `contentImages` 时沿用库内配图」是防止历史数据丢失的保护，勿在合并时简化掉。

### 3.3 明确未触碰的文件（用于排除误判）

`pages/community/*`、`pages/review-center/*`、`pages/admin-center/*`、`pages/question-bank-management/*`、`pages/question-editor/*`、`pages/video-management/*`、`pages/article-detail/*`、`cloudfunctions/reviewContent/*`、`cloudfunctions/getTopics/*`、`cloudfunctions/getTopicDetail/*`、`cloudfunctions/getTopicComments/*`、`cloudfunctions/getAdminTopicList/*`、`cloudfunctions/getVideos/*`、`cloudfunctions/saveVideo/*`、`cloudfunctions/login/*`、`cloudfunctions/followUser/*`、`cloudfunctions/trackAction/*`、`app.json`、`project.config.json`。

---

## 4. 数据与接口契约

### 4.1 `topics.contentBlocks`

内容块数组，本次正式启用 `image` 类型（该类型与 `topic-detail` 的渲染分支原本已存在，此前无写入入口）：

```text
{ id, type: 'image', imageUrl: 'cloud://...', caption: '图注（可空）', sort: 3 }
```

- 顺序：正文 `text` 段落 → `image` → `article_link` → `video_link` → 其他未知类型。
- `sort` 从 1 连续重排，前端按 `sort` 渲染。

### 4.2 `saveTopic` 入参

```text
{ id?: string, payload: { title, summary, contentText, contentImages?, coverImage, status, sort, startAt, endAt, relatedArticleIds, relatedVideoIds } }
```

- `contentImages` 为可选：**不传** = 沿用库内已有配图（兼容旧调用方）；**传空数组** = 清空配图；超过 9 张按前 9 张截断。
- 返回结构未变：`{ success, data: { id } }` / `{ success: false, errMsg }`。

### 4.3 `submitTopicComment`

- 入参、审核状态取值（`pending_review` / `approved` / `rejected` / `hidden`）、`review_tasks` 写入结构均未变。
- 仅增强：事务内 `add` 返回值兼容 `_id` / `id`，取不到 ID 时抛错，避免「返回成功但评论没写进去」。

### 4.4 数据迁移

**不需要**。历史话题的 `contentBlocks` 原样保留；旧版调用方不传 `contentImages` 时配图不会被清空。

---

## 5. 合并后功能自查（手把手，约 15 分钟）

这一步的目的不是「部署」，而是**用 operator 账号把 A 的功能亲手走一遍**，看合并有没有把能力挤掉。全程在小程序界面里点，不需要读代码；每一步都写了「应该看到什么」和「不对说明丢了什么」。

### 5.0 开始前，先准备三件事

1. **一个 operator 账号。** 你已经有一个调试用的管理员账号就直接用它。没有的话：云开发控制台 → 数据库 → `users` 集合 → 找到 `_openid` 与你当前登录微信一致的那条记录 → 把 `roles` 改成 `["operator"]`（或把 `isAdmin` 设为 `true`）→ 保存。改完**退出小程序再重新进入**（进入时会重新拉 `getUserInfo` 并刷新本地缓存），否则界面上还是旧权限。
2. **确认两个云函数是当前代码。** 在开发者工具里对 `cloudfunctions/saveTopic`、`cloudfunctions/submitTopicComment` 各做一次「上传并部署：云端安装依赖」。跳过这步，后面「配图保存」和「评论落库」会失败，容易被误判成合并丢了功能。
3. **准备真机。** 开发者工具 + 手机真机预览各开一份。选图上传（封面、正文配图）在开发者工具里常返回空 `tempFiles`，**配图相关的步骤请以真机为准**。

### 5.1 进入话题管理页

- 操作：底部 Tab 进「我的」→ 页面里找到「管理中心」→ 点第一项「📌 话题管理（创建、编辑和发布热点话题）」。
- 应该看到：顶部是话题表单（标题 / 摘要 / 话题正文 / 封面图 URL / 状态 / 排序值 / 开始日期 / 结束日期 / 关联文章 ID / 关联视频 ID），下方是「话题列表」。
- 如果不对：
  - 看不到「管理中心」入口，或点进去提示「无管理权限」→ 账号角色没生效，回 5.0 第 1 条。
  - 进了管理中心但列表里没有「话题管理」→ `pages/admin-center` 的入口数组被他人改动覆盖了。

### 5.2 新建一个带配图的草稿（测「创建 + 配图 + 图注」）

1. 标题填 `合并检查-01`，摘要随便写一句。
2. 话题正文写两段文字，中间空一行（用来验证段落顺序）。
3. 封面图可以不传；要传就点「选择图片」，传完输入框里会出现 `cloud://` 开头的地址。
4. 滚到「正文配图（0/9）」，点「+ 添加配图」→ 选一张图。应该出现：缩略图 + 「图注（可选）」输入框 + 「移除」按钮，计数变成 `1/9`。
5. 在图注里填 `合并检查图注`，再添加 2 张（共 3 张，计数 `3/9`）。
6. 状态先保持 `draft`，点「保存」。

**应该看到**：提示保存成功；下方「话题列表」顶部出现这条，meta 一行显示 `状态：draft · 排序：0 · 配图：3`。

**不对说明**：计数不跟着变 → 配图区块的 `{{contentImages.length}}/{{maxContentImages}}` 被覆盖；列表没有「配图：3」→ `imageCount` 字段没接上；点添加配图报「存储权限」→ 云开发控制台 → 存储 → 权限设置里放开小程序端上传（封面在 `topics/covers/`、配图在 `topics/content/`）。

### 5.3 编辑这条草稿（测「回显 + 状态不错位」）

- 操作：点列表里这条话题（或点「编辑」）。
- 应该看到：标题、正文、3 张配图及图注 `合并检查图注` 全部回填，状态选择器显示 `draft`。
- 接着把状态选择器改成 `published`（**这是本次修复的重点**），先别保存，确认选择器上显示的是 `published`；再点「保存」。
- 应该看到：列表里这条的状态变成 `published`。**再次点进编辑，选择器仍停在 `published`，不会自己跳回 `draft`。**
- 不对说明：一进编辑页选择器就跳回 `draft`，或保存后状态回退 → 文章 2.2 中 `data.statusIndex` 的修复被覆盖（WXML 里又出现了 `statusOptions.indexOf(...)` 这类方法调用，小程序模板不支持）。

### 5.4 用户端能不能看到（测「只展示已发布」与详情渲染）

1. 底部 Tab 进「社区」，刷新话题列表，找到 `合并检查-01`，点进详情。
2. **应该看到**：渲染顺序是 正文两段 → 3 张配图（每张下方有图注）→ 关联文章 → 关联视频；图片完整展开、没有破图、没有空白占位。
3. 回到管理中心，把这条改成 `offline` 保存 → 再回社区列表刷新：**它应该消失**；直接用旧入口进详情也应该看不到内容。
4. 最后改回 `published` 保存，供下一步用。
- 不对说明：草稿/下线话题仍出现在用户端 → 不是 A 的改动，检查 B 侧的 `getTopics` / `getTopicDetail` 过滤是否被改动；详情里配图位置出现空白块 → `topic-detail` 里「`imageUrl` 为空时只渲染图注」的分支被覆盖。

### 5.5 提交一条评论（测「评论落库即待审」）

- 操作：在 `合并检查-01` 详情页最底部输入框输入 `合并检查-评论A`，点右侧「发送」。
- **应该看到**：提示提交成功；但讨论区**不出现**这条评论，页面上的提示仍然是「评论提交后会先进入审核，审核通过后显示在讨论区。」
- 不对说明：提交直接报错 → 先确认 `submitTopicComment` 已部署（5.0 第 2 条）；提交后评论立刻显示在讨论区 → 审核状态被写成了 `approved`，属严重回退。

### 5.6 审核通过（测「审核链路打通」）

1. 操作：「我的」→「管理中心」→「🛡️ 审核中心」→ 停在「待审核」标签页。
2. **应该看到**：列表里有一条类型显示「话题评论」、内容为 `合并检查-评论A` 的任务；卡片上有状态、敏感词命中（未命中）、提交时间。
3. 点这条下面的「通过」按钮。
4. **应该看到**：该条从「待审核」消失；切到「已通过」标签能看到它；回到话题详情下拉刷新，`合并检查-评论A` 出现在讨论区。
- 不对说明：**审核中心里根本没有这条任务**，但第 5.5 步却提示提交成功 → 正是本次修的问题（事务里 `add` 只认 `_id`，某些 SDK 返回 `id` 导致评论写入后审核任务/回写断链），检查 `submitTopicComment` 的 `_id`/`id` 兼容逻辑有没有在合并时被简化掉。若通过后前台仍不显示评论，则去看 `getTopicComments`（非 A 改动）是否只返回 `approved`。

### 5.7 驳回与隐藏（测「不通过就不展示」）

1. 再在详情页发一条 `合并检查-评论B` → 审核中心「待审核」→ 在「审核说明」框输入 `合并检查-驳回`（**驳回和隐藏必须填说明，最多 200 字**）→ 点「驳回」。
2. 再发一条 `合并检查-评论C` → 待审核 → 填说明 → 点「隐藏」。
3. **应该看到**：两条分别出现在「已驳回」「已隐藏」标签页；回到话题详情刷新，讨论区**都不出现**这两条。
- 补充（可选，测回复）：对已通过的 `合并检查-评论A` 点「回复」，输入 `合并检查-回复` 发送，走一遍 5.6 的通过流程后，讨论区应显示「回复 昵称：」前缀的嵌套回复。

### 5.8 现象对照表（哪一步不对，就查对应改动）

| 你看到的现象 | 对应丢失的改动 | 怎么处理 |
|---|---|---|
| 没有「管理中心」入口 / 提示「无管理权限」 | 角色未生效，或 `utils/permission.js` 未合入 | 确认 `users.roles` 含 `operator`；退出重进小程序刷新缓存 |
| 管理中心里没有「话题管理」 | `pages/admin-center` 入口数组被覆盖 | 以本版为基准补回该条目 |
| 表单里没有「正文配图」区块 | `topic-management.wxml` 配图区被覆盖 | 补回区块，事件名必须是 `addContentImage` / `onContentImageCaptionInput` / `removeContentImage` |
| 点「添加配图」无反应或报错 | `topic-management.js` 对应方法或 `uploadImageToCloud` 缺失 | 逐个函数对齐，不要整文件择一 |
| 保存成功但配图变成 0 张 | `saveTopic` 未部署，或 `contentImages → image` 块的分支被删 | 重新部署云函数；确认未传 `contentImages` 时沿用库内配图 |
| 编辑已发布话题，状态自动跳回 `draft` | `statusIndex` 修复被覆盖 | 改用 `data.statusIndex`，别在 WXML 里调 `indexOf` |
| 详情页配图位置空白/破图 | `topic-detail` 的 `imageUrl` 空值分支被覆盖 | 保留「为空只渲染图注」的 `wx:if` |
| 评论提示成功，审核中心却没有任务 | `submitTopicComment` 的 `_id`/`id` 兼容修复丢失 | 对照事务内 `add` 返回值处理逻辑，重新部署 |
| 通过后前台仍看不到评论 | 非 A 改动：`getTopicComments` 的 `approved` 过滤/缓存 | 交给 B 侧核对，不要在本分支改 |
| 首页轮播图空白 | `index.js` 的 `HOME_BANNERS.image` 或 `images/banners/` 4 张图丢失 | 只补 4 个 `image` 字段与图片文件，别动他人的 `loadBanners` 逻辑 |

**判定标准**：5.1–5.7 全部符合预期，即可认为 A 的功能在合并中没有丢失；若只有最后一行「首页轮播」异常，不影响 P0-01 主链路，补图即可。

---

## 6. 测试报告（成员 A 交付物与验收标准）

**测试结论：P0-01 的 5 项交付物与 6 项验收标准全部通过。** 验证方式为「云函数主链路离线模拟（以内存数据库替身加载真实云函数）+ 微信开发者工具编译与真机调试」，未使用线上生产数据。

### 6.1 交付物核对

| # | 交付物 | 结果 | 验证方式 |
|---|---|---|---|
| 1 | 运营可以创建、编辑、发布、下线话题 | ✅ 通过 | `operator` 账号在话题管理页完成新建 → 编辑 → 发布 → 下线全流程；草稿保存后再编辑，状态回显正确 |
| 2 | 用户端只展示已发布话题 | ✅ 通过 | 草稿与 `offline` 话题在 `getTopics` 列表中不返回；`getTopicDetail` 对非发布状态返回不可见 |
| 3 | 话题详情展示背景说明、配图、关联文章和关联视频 | ✅ 通过 | 详情按「正文段落 → 配图（含图注）→ 关联文章 → 关联视频」渲染；配图 `cloud://` 正确解析，长图 `widthFix` 完整展开、无破图 |
| 4 | 用户可以发表评论和回复 | ✅ 通过 | 普通用户提交评论成功；回复记录 `parentId` / `replyToUid` 正确落库 |
| 5 | 评论提交后进入待审核状态 | ✅ 通过 | `comments` 记录新建时 `status = pending_review`，同时生成对应 `review_tasks`，且评论回写 `reviewTaskId` |

### 6.2 验收标准核对

| # | 验收标准 | 结果 | 验证方式 |
|---|---|---|---|
| 1 | 草稿和下线话题不出现在用户端 | ✅ 通过 | 列表与详情两个入口分别验证：草稿、`offline` 均不可见 |
| 2 | 已发布话题可以进入详情 | ✅ 通过 | 发布后列表可见，点击进入详情返回完整内容块与配图 |
| 3 | 普通用户可以提交评论 | ✅ 通过 | 普通用户（无 `operator`/`reviewer` 角色）在详情页提交评论成功 |
| 4 | 评论提交后状态为 `pending_review` | ✅ 通过 | 云开发控制台 `comments` 集合中该记录 `status` 显示 `pending_review` |
| 5 | 审核通过后评论才在前台可见 | ✅ 通过 | 审核前讨论区不显示该评论；`reviewer` 通过后刷新详情可见 |
| 6 | 审核驳回或隐藏后评论不展示 | ✅ 通过 | 驳回后讨论区不再出现；隐藏状态同样不返回 |

### 6.3 关联功能自查（不属于 P0-01 验收项，但受本次改动影响）

| 项 | 结果 | 说明 |
|---|---|---|
| 配图数量上限 | ✅ 通过 | 前端拦截第 10 张并提示；`saveTopic` 侧同样按 9 张截断，双层保护 |
| 旧版调用兼容 | ✅ 通过 | 不传 `contentImages` 的调用保存后，库内已有配图保持不变 |
| 非文本内容块保留 | ✅ 通过 | `article_link` / `video_link` 及未知类型块在重新保存后不丢失，`sort` 连续 |
| 状态下拉回显 | ✅ 通过 | 编辑已发布话题时选择器停留在 `published`，不再跳回 `draft` |
| 首页降级轮播 | ✅ 通过 | `getBanners` 不可用时显示 4 张本地图，文案叠加清晰，同时给出降级提示 |
| 图片目录合并 | ✅ 通过 | 根目录仅保留 `images/`；`images/问题已找到-修复方案/` 保留 4 张去重后截图 |

### 6.4 已知限制（不作为阻塞项）

- 微信开发者工具对 `wx.chooseMedia` 的支持不完整，选图/上传需以真机结果为准；开发者工具中若返回空 `tempFiles`，改用真机重试。
- Banner 本地图仅用于降级展示；正式首页仍以 `banners` 集合为准，需运营按 `docs/operations/banner-image-upload.md` 上线。
- 全仓仍有部分历史代码使用散文式 `console` 日志，本次仅规范了本分工改动的文件，未做全仓改造。
