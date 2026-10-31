# 变更记录

本文件记录项目中已经完成的功能调整、问题修复，以及调研阶段确认的实现现状和待办事项。  
详细的架构和长期开发约定优先参考 [CLAUDE.md](./CLAUDE.md)。

## 2026-10-30 - 首页 Banner 接入 CMS `banners` 集合

### 问题场景

首页轮播图一直是 [pages/index/index.js](./pages/index/index.js) 中写死的 `HOME_BANNERS`（4 条只有文字和渐变的本地数据），`loadBanners()` 只是复制这份本地数组，不会请求云端。

同时 `CMS使用文档.md` 已经设计了 `banners` 集合（`title`、`desc`、`icon`、`image`、`bgColor`、`link`、`sort`、`status`），但仓库里既没有 `getBanners` 云函数，首页也没有任何查询该集合的代码。结果是运营在 CMS 里新增或停用轮播图，首页毫无变化。

### 修改方案

- 新增 [cloudfunctions/getBanners](./cloudfunctions/getBanners/index.js)：
  - 查询 `banners` 集合，只返回 `status === true` 的记录；
  - 按 `sort` 升序，`sort` 相同时按 `updatedAt`/`createdAt` 倒序；
  - 只下发 `title`、`desc`、`icon`、`image`、`bgColor`、`link`、`sort`，不透出管理字段；
  - 集合未创建（`-502005`）按空集合返回 `success: true` + `emptyReason: 'collection_not_exist'`，其他数据库异常返回 `success: false` + `errCode: 'BANNERS_QUERY_FAILED'`，不使用成功形状的静默兜底。
- 重写首页 `loadBanners()`，改为调用 `getBanners`：
  - 复用 [utils/cloud.js](./utils/cloud.js) 的 `resolveCloudFileUrls()` 转换 `cloud://` 图片，HTTPS 地址直接使用；
  - 继续使用 `index:banners:v2` 本地缓存，TTL 10 分钟不变；
  - 云端成功但返回空列表时进入空态并清除旧缓存，不再把旧缓存当作最新结果；
  - 云函数失败且没有可用内容时才回落到 `HOME_BANNERS`，并在轮播下方显示“云端轮播暂不可用”；
  - `cloud://` 解析失败时清空图片，由 `bgColor`/默认渐变兜底。
- `link` 增加白名单校验（`REGISTERED_PAGES`，与 `app.json` 的 38 个页面一致）：未注册路径和站外地址直接丢弃，点击不跳转也不报错；tabBar 页面改用 `wx.switchTab`，避免 `navigateTo` 打开 tab 页失败。
- [pages/index/index.wxml](./pages/index/index.wxml)、[pages/index/index.wxss](./pages/index/index.wxss) 增加“暂无轮播内容”空态和降级提示样式。
- 未改动首页文章加载、文章缓存和本地文章示例逻辑。

### 验证结果

- `node --check cloudfunctions/getBanners/index.js` 通过。
- `node --check pages/index/index.js` 通过。
- 用临时桩环境（`wx-server-sdk` 与 `wx` 均为本地桩，未提交）覆盖以下场景，全部通过：
  - `status=false` 与缺失 `status` 的记录被过滤，`sort` 升序与同 `sort` 的时间倒序正确；
  - 空集合返回 `emptyReason: 'collection_not_exist'`，数据库异常返回 `success: false`；
  - 云端成功时链接白名单、`cloud://` 转临时地址、HTTPS 原样保留、无图片用默认渐变；
  - 云端返回空列表时清除 `index:banners:v2` 并进入空态；
  - 云函数失败时无缓存回落 4 条本地渐变 Banner，有缓存则保留缓存不覆盖；
  - 图片解析失败清空 `image`、点击无链接/未注册链接不跳转、tabBar 链接走 `switchTab`。
- 脚本校验 `REGISTERED_PAGES` 与 `app.json` 的 `pages`、`TAB_BAR_PAGES` 与 `tabBar.list` 完全一致。
- `git diff --check` 通过。
- **尚未完成**：未在微信开发者工具/真机连接真实云环境验收（需先部署 `getBanners` 并准备 `banners` 数据）。

### 部署与环境注意事项

- 必须把 `getBanners` 上传并部署到与小程序相同的云环境，否则首页会一直走本地降级（控制台日志 `loadBanners 失败`）。
- `banners` 集合按 CMS 文档创建；`status` 必须是布尔值 `true`，写成字符串 `"true"` 不会显示。
- `image` 填 `cloud://` 文件 ID 或 HTTPS 地址均可；使用云存储时需确保资源在同一云环境。
- 新增、编辑、启停 Banner 后，验收前需清除 `index:banners:v2` 缓存或等待 10 分钟 TTL。
- 后续在 `app.json` 新增页面时，需要同步 `pages/index/index.js` 的 `REGISTERED_PAGES`，否则 Banner 无法跳转到新页面。

### 文档同步（补正）

Banner 接入完成后，根目录 `CLAUDE.md` 仍有多处描述与代码不一致，本次一并补正：

- 云函数业务域补充 `getBanners`；
- `CMS使用文档` 条目去掉“设计中的 `banners`”表述；
- 修正 `member-d-support-and-acceptance.md` 的实际路径，并明确 `docs/team-collaboration/` 只忽略验收清单、分工文档仍需入库；
- “当前已知架构缺口”中删除“缺少 `getBanners`”，改为记录仍缺少 Banner 管理页、`saveBanner` 和媒体上传能力；
- 首页行为约定补充第 8 条：下拉刷新只刷新文章，不重新请求 Banner。

同时修正 [docs/manual/test-cases/functional/TC-01-home.md](./docs/manual/test-cases/functional/TC-01-home.md) 的 TC-01-003：原预期“链接无效则显示提示”与新实现不符，现实现为未注册链接被丢弃、不跳转不弹提示，仅输出控制台日志。

本次只改文档，不涉及代码行为，因此未单独新增功能条目；语法检查无需重跑。

## 2026-10-29 - 话题封面上传与预览修复

### 已完成

- 话题管理页支持选择本地图片或拍照，并通过 `wx.cloud.uploadFile` 上传到云存储。
- 封面上传路径统一为 `topics/covers/时间戳-随机字符串.扩展名`。
- 将数据库保存用的 `cloud://` 文件 ID 与页面预览用的临时 HTTPS 地址分开：
  - `coverImage`：保存到话题数据中的云文件 ID；
  - `coverImagePreview`：仅用于管理页面显示，不写入数据库。
- 话题列表加载时批量解析云存储封面地址。
- 编辑已有话题时解析并回显封面。
- 新上传封面后立即显示预览。
- 清空封面时同时清除原始文件 ID和页面预览地址。
- 保存话题时排除 `coverImagePreview`，避免把临时字段写入数据库。
- 使用 [utils/cloud.js](./utils/cloud.js) 中的 `resolveCloudFileUrls()` 和缓存机制，将 `cloud://` 文件 ID 转换为临时 URL。
- 对云存储上传权限不足增加明确提示，指导管理员到当前云环境开启小程序端上传权限。

### 本次修复的问题

此前封面即使上传成功，返回的 `cloud://` 文件 ID 也不能稳定直接用于 `<image>` 预览，导致：

- 新上传封面后管理页不显示；
- 话题列表封面不显示；
- 编辑已有话题时封面无法回显。

### 修正记录

在代码复核中发现本次分支初始修改存在两个语法/运行问题，已修正：

- 删除 `getCloudFunctionErrorMessage` 的重复引入；
- 将使用 `await resolveCloudFileUrls()` 的 `editTopic` 改为 `async`；
- 确保编辑表单写入 `coverImagePreview`。

### 存储注意事项

- 每次上传都会在云存储新增一个文件，重新上传不会自动覆盖旧文件。
- 替换或清空封面后，旧文件当前不会自动删除，可能产生未引用的云存储文件。
- 后续如需自动清理，应遵循“先成功保存数据库，再删除旧文件”的顺序，并记录删除失败。

### 当前验证

- `node --check pages\topic-management\topic-management.js` 通过。
- `git diff --check` 通过。
- 仍需在微信开发者工具中验证真实云环境下的上传、列表预览、编辑回显和清空保存。

## 2026-10-26 - 本地文章演示数据提示

### 已完成

- 保留首页和文章详情页的本地示例数据作为开发及云端故障时的兜底。
- 首页使用本地文章兜底时显示“当前为演示数据”。
- 文章详情使用本地 `mockArticles` 时显示“当前为演示文章”。
- 同时增加一次 Toast 提示，明确告知用户云端内容暂时不可用。
- 云端文章恢复成功后自动取消演示状态。
- 在 [CLAUDE.md](./CLAUDE.md) 中明确本地示例不是正式运营内容。

### 解决的问题

此前云函数或云数据库异常时，页面可能直接显示写死的示例文章，用户无法判断这些内容是否来自正式 CMS。现在保留兜底能力，同时明确标识演示状态，避免掩盖云端配置或部署问题。

## 文章内容管理调研结论

### 当前已经打通的链路

文章的正式管理方式是 CMS/云端后台，不是小程序内编辑：

```text
管理员进入 CMS
→ 在 articles 内容集合新建或编辑文章
→ 填写标题、分类、标签、正文、封面和发布时间
→ 正文图片/视频通过富文本编辑器上传
→ 保存为草稿
→ 管理员审核后改为已发布
→ getArticles/getArticleDetail/searchArticles 提供给小程序
```

当前不新增小程序文章管理页、文章编辑页、`saveArticle` 或 `getAdminArticleList`。

### 文章媒体处理

- `coverImage` 保存文章封面资源地址。
- `content` 保存富文本正文以及正文内图片、视频等媒体引用。
- CMS 负责上传媒体；仓库没有文章专用 `uploadMedia` 云函数。
- CMS、`articles` 集合、云存储媒体和小程序必须使用同一个云环境。
- 首页文章首屏有 `index:articles:first-page` 缓存，TTL 为 3 分钟。

### 已知代码缺口

CMS 文档约定：

```text
status = 1：草稿
status = 2：已发布
```

但当前用户侧读取链路尚未统一过滤发布状态：

- `getArticles` 未严格限制 `status=2`；
- `getArticleDetail` 按文章 ID 读取，未校验发布状态；
- `searchArticles` 未严格限制 `status=2`；
- 相关文章查询也需要同步检查。

因此“CMS 操作流程已经打通”和“草稿不可见规则已经由代码保证”是两件不同的事。后续应单独修复并测试列表、搜索、详情和相关推荐。

## Banner 调研结论

### 当前实现

- 首页使用 `pages/index/index.js` 中的 `HOME_BANNERS` 本地固定数据。
- 当前 Banner 主要是标题、描述和渐变背景，不是 CMS 动态数据。
- 首页没有调用 `getBanners`，仓库也没有该云函数。
- WXML 已支持图片、背景色和跳转字段，但实际动态数据链路尚未接通。

### 后续规划（已于 2026-10-30 落地，见本文首条记录）

如进入实现阶段，需要新增并验证：

- `banners` 内容集合和 `getBanners` 云函数；
- 只返回启用状态的 Banner；
- 按 `sort` 排序；
- 解析 `cloud://` 图片地址；
- 首页缓存、空数据和云端失败兜底；
- Banner 跳转路径校验。

以上各项已在 2026-10-30 的 `getBanners` 接入中实现，本节保留为当时的调研结论记录；当前实现事实以本文首条记录和 [CLAUDE.md](./CLAUDE.md) 为准。

## 视频内容调研结论

### 当前已经存在的链路

视频已有基本的管理和用户播放流程：

```text
管理员视频页面
→ saveVideo
→ videos 集合
→ getVideos/getVideoDetail
→ 用户端播放
```

- 用户端只读取 `status = published` 的视频。
- 视频管理页支持新增、编辑和状态管理。
- `saveVideo` 会校验标题和视频地址，发布时写入 `publishedAt`。

### 当前发布方式和限制

- 视频文件目前需要先手动上传到微信云存储。
- 获取 `cloud://` 文件 ID 后，再填入视频管理页面的 `videoUrl`。
- 视频封面同样需要提供资源地址。
- 管理页面目前没有统一的本地视频选择和自动上传按钮。
- `utils/defaultVideos.js` 仍保留没有真实资源的内置演示视频，正式运营前应补充资源或明确其演示状态。

未来可以使用 `wx.chooseMedia` 和 `wx.cloud.uploadFile` 自动上传，但这项工作暂不与当前文章、Banner 工作混合。

## 协作与部署约定

- `main` 是稳定分支，仓库规则要求通过 Pull Request 合并，不能直接 push。
- 每个功能从 `main` 创建独立的 `feature/*`、`fix/*` 或 `docs/*` 分支。
- GitHub PR 的目标仓库应确认是自己的 fork `Kaltsit-is-my-wife/anti-fraud`，而不是上游仓库。
- 代码合并到 GitHub 不等于云函数已经更新；修改云函数后仍需在微信开发者工具中执行“上传并部署：云端安装依赖”。
- `project.config.json` 是共享配置；`project.private.config.json` 可能覆盖同名本地配置，不应随意覆盖其他成员的私有配置。

## 后续优先级

1. 修复文章列表、详情、搜索和相关推荐的 `status` 过滤。
2. 用 CMS 完成一次草稿、发布、图片和视频媒体的真实验收。
3. 确认本地演示兜底不会被误认为正式内容。
4. 实现 Banner CMS 动态读取。
5. 再评估视频管理页的本地文件自动上传和旧媒体清理。

## 2026-10-30 - 整理项目文档目录

### 问题场景

- 大量规划、部署、指南和调研文档直接堆在 `docs/` 根目录，查找成本较高。
- 部分文档仍引用旧的平铺路径，移动后容易产生失效链接。
- 多人协作分工和验收资料属于本地临时资料，不应混入正式项目文档或 Git 提交。

### 修改方案

- 按用途将正式文档整理到：
  - `docs/planning/`：二期规划、需求、任务、验收、数据模型和预算；
  - `docs/operations/`：部署、云环境和数据运维；
  - `docs/guides/`：交接、专项功能和操作指南；
  - `docs/research/`：性能调查和问题分析。
- 将题库导入样例放入 `docs/guides/`。
- 保留 `docs/archive/` 作为历史归档，不改变其用途。
- 将本地协作资料继续放在已忽略的 `docs/team-collaboration/`，不纳入 Git。
- 重写 `docs/README.md` 作为分类导航，更新仓库内文档引用。
- 在 `CLAUDE.md` 增加文档目录选择规则，规定新增或移动文档时必须同步导航和引用。

### 验证结果

- 已确认正式文档按分类移动完成。
- 已确认本地协作资料通过 `.gitignore` 排除。
- 已检查仓库内旧平铺文档路径引用并完成更新。
- `git diff --check` 通过。

## 2026-10-30 - 调整多人协作文档跟踪范围

### 问题场景

- 成员 A、B、C、D 的分工文档已移动到根目录，但原先 `.gitignore` 忽略整个 `docs/team-collaboration/`，文档定位不够清晰。
- 分工说明属于团队共享约定，应能通过 Git 和 PR 同步；验收清单可能记录本地环境和账号，不应提交。

### 修改方案

- 将成员 D 分工文档移到根目录，与其他成员分工文档保持一致。
- 保留根目录四份 `member-*.md` 分工文档并纳入 Git 跟踪。
- 将 `.gitignore` 从忽略整个协作目录收窄为只忽略 `docs/team-collaboration/acceptance-checklist.md`。
- 同步更新 `CLAUDE.md` 和 `docs/README.md`，明确分工文档与本地验收表的不同定位。

### 验证结果

- 已确认四份根目录成员分工文档可被 Git 识别为未跟踪文件，后续可正常 `git add`。
- 已确认本地验收清单仍被 `.gitignore` 忽略。
- `git diff --check` 通过。
