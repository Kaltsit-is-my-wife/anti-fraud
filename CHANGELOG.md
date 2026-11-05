# 变更记录

本文件记录项目中已经完成的功能调整、问题修复，以及调研阶段确认的实现现状和待办事项。  
详细的架构和长期开发约定优先参考 [CLAUDE.md](./CLAUDE.md)。

## 2026-11-05 - 增加视频上传诊断日志与临时日志规范

### 问题场景

视频管理页上传视频时没有进度、没有成功或失败回调，页面停留在上传状态。视频使用 `wx.cloud.uploadFile` 直传云存储，不经过云函数，因此云函数日志没有记录，无法判断问题发生在选择文件、创建上传任务、上传进度还是回调阶段。

### 修改方案

- [pages/video-management/video-management.js](./pages/video-management/video-management.js) 增加统一 `[video-upload]` 前缀的 JSON 诊断日志，覆盖：
  - 选择视频/封面的开始、结果、取消、超限、失败
  - 上传任务创建、进度、10 秒心跳、成功/失败回调、同步异常
  - `saveVideo` 保存开始、成功、失败
- 新增 [logs/README.md](./logs/README.md)，规定临时日志目录、命名、Console 格式、记录文件模板和脱敏要求。
- 新增 [logs/2026-11-05-video-upload.md](./logs/2026-11-05-video-upload.md)，记录本次视频上传排查的观测点和待填日志。
- [CLAUDE.md](./CLAUDE.md) 增加“调试日志规范”，说明 `logs/` 与 `pages/logs/` 的区别、日志格式和生命周期。
- 增加开发者工具平台判断：当 `wx.chooseMedia` 返回空 `tempFiles` 时，DevTools 提示改用真机或手动填写视频地址；真机仍保留通用失败提示。
- 诊断完成后恢复视频按钮的 `disabled="{{uploadingVideo}}"`。

### 验证结果

- `node --check pages/video-management/video-management.js` 通过。
- 真机调试：选择视频、上传、进度显示均正常。
- 开发者工具（PC）：`wx.chooseMedia` 返回 `tempFilesLength: 0`，结果中包含 `failedCount`，`uploadVideo` 未被调用。视频文件存在且大小合适，确认是开发者工具对 `wx.chooseMedia` 视频选择支持不完整，不是业务代码、视频文件或云存储问题。
- 处理方式：开发者工具改用「视频地址」手动填写，或使用真机调试；页面已增加 DevTools 专用提示。

## 2026-11-05 - 修复 getArticleDetail 未定义常量导致文章详情全部失败

### 问题场景

真机点击文章后，无论文章是否存在、是否为已发布状态，都提示“文章不存在或已下线”。云函数日志显示：

```text
ReferenceError: PUBLISHED_STATUS_VALUES is not defined
    at exports.main (/var/user/index.js:69:22)
```

`getArticleDetail` 只定义了 `PUBLISHED_STATUS`，但查询条件使用了未定义的 `PUBLISHED_STATUS_VALUES`。异常被外层 `catch` 捕获后返回 `{ success: false, errMsg: 'PUBLISHED_STATUS_VALUES is not defined' }`，客户端没有展示 `errMsg`，统一显示为“文章不存在或已下线”，因此看起来像数据问题。

### 修改方案

- [cloudfunctions/getArticleDetail/index.js](./cloudfunctions/getArticleDetail/index.js) 补充：
  ```js
  const PUBLISHED_STATUS_VALUES = [PUBLISHED_STATUS, String(PUBLISHED_STATUS)]
  ```
  与 `getArticles` 保持一致，兼容数字 `2` 与字符串 `'2'`。
- [pages/article-detail/article-detail.js](./pages/article-detail/article-detail.js) 在云函数明确失败和调用异常时输出 `console.error`，避免真实错误被统一提示掩盖。
- 不改动查询字段、返回结构和发布状态规则。

### 验证结果

- `node --check cloudfunctions/getArticleDetail/index.js` 通过。
- `node --check pages/article-detail/article-detail.js` 通过。
- 已确认 `PUBLISHED_STATUS_VALUES` 在 `getArticleDetail` 中已定义，其他文章云函数没有同类未定义引用。
- 已在微信开发者工具中重新部署 `getArticleDetail`，真机复测文章详情可正常打开，原“文章不存在或已下线”问题消失。
- **仍待验收**：文章草稿/已发布边界（首页、搜索、已知草稿 ID、相关推荐），以及其余 4 个文章云函数（`getArticles`、`searchArticles`、`getTopicDetail`、`getVideoDetail`）的部署版本和真实环境效果。

## 2026-11-03 - 视频管理页新增本地视频/封面上传

### 问题场景

视频发布此前要求先把视频和封面手动上传到云存储，再把 cloud:// 文件 ID 粘贴到 pages/video-management 保存。管理员必须切换到微信开发者工具或云开发控制台完成上传，操作门槛高且容易选错云环境。member-c-video.md 第二阶段要求管理页自动上传，并保持 draft 发布语义。

### 修改方案

- 只改 pages/video-management（.js/.wxml/.wxss），不改 videos 数据模型，不改 saveVideo/getVideos 等云函数。
- 视频：wx.chooseMedia({ mediaType: ['video'] }) 选择（不做时长限制），校验大小不超过 1GB（MAX_VIDEO_SIZE）；wx.cloud.uploadFile 以 success/fail 回调形式调用并返回 UploadTask，通过 task.onProgressUpdate 显示进度（纯 Promise 形式返回的对象没有该方法），成功后自动回填 form.videoUrl，并用选择器返回的时长自动填写 form.duration。
- 封面：wx.chooseMedia({ mediaType: ['image'] }) 选择，校验不超过 20MB（MAX_COVER_SIZE）；上传到 video-covers/ 前缀路径，成功后回填 form.coverImage，用 resolveCloudFileUrls 解析出临时 URL 显示预览图。coverImagePreview 是页面顶层字段，不进入保存 payload。
- 五种状态均有处理：上传中（按钮禁用、视频显示进度条、封面显示 loading）、成功（toast 并回填）、用户取消（静默返回）、失败（console.error + toast）、权限不足（-503002 或 storage permission denied 时 wx.showModal 提示到云开发控制台开启存储上传权限，与话题管理页一致）。
- 上传成功只改表单内容，不自动发布；保存仍按表单 status（默认 draft）走 saveVideo，上传期间点击保存会被拦截并提示。
- 编辑回显：editVideo 对 cloud:// 封面调用 resolveCloudFileUrls 解析预览图。
- 不删除旧文件：换新视频或封面后，旧资源仍保留在云存储中。

### 验证结果

- node --check pages/video-management/video-management.js 通过。
- 开发者工具实测发现：纯 Promise 形式的 wx.cloud.uploadFile 返回对象没有 onProgressUpdate 方法，上传视频时报 TypeError，已改为 success/fail 回调形式获取 UploadTask，进度监听恢复正常。
- 开发者工具实测视频上传成功，进度显示正常。
- 尚未完成：待真机/体验版回归（选择、取消、超限、权限不足、保存后保持 draft、封面预览、旧资源保留、云端与小程序同一环境）。
- 云环境：cloud1-d8gvez9rg8eb96b20，上传文件所在环境必须与小程序当前环境一致。

## 2026-11-03 - 文章发布状态与标签映射改动落地到实际路径

### 问题场景

此前两次 `Add files via upload` 提交把文章发布状态修复和标签映射工具放在 `changed/` 目录及根目录裸文件中，小程序实际读取的路径没有被修改：

- `cloudfunctions/getArticles`、`getArticleDetail`、`searchArticles` 仍未过滤 `status = 2`，草稿仍可能出现在列表、详情和搜索结果中。
- `cloudfunctions/getTopicDetail`、`getVideoDetail` 的相关文章查询仍未过滤草稿。
- `pages/index`、`pages/search`、`pages/article-detail` 仍未使用 `utils/article-tags`，CMS 枚举编号会原样显示。
- 根目录的 `index.js`、`article-detail.js`、`search.js`、`article-tags.js` 不在小程序编译路径中，不会被加载。

### 修改方案

- 将 `changed/` 中的 9 个文件落地到真实路径：
  - `cloudfunctions/getArticleDetail/index.js`、`getArticles/index.js`、`getTopicDetail/index.js`、`getVideoDetail/index.js`、`searchArticles/index.js`
  - `pages/article-detail/article-detail.js`、`pages/index/index.js`、`pages/search/search.js`
  - `utils/article-tags.js`
- 删除 `changed/` 暂存目录和根目录 4 个错误位置的副本。
- 根 `CHANGELOG.md` 保留 `2026-10-31` 的原始变更说明，本次仅补充落地记录。

### 验证结果

- 对 9 个落地文件执行 `node --check`，全部通过。
- 已核对 `getArticles`、`getArticleDetail`、`searchArticles` 均包含 `PUBLISHED_STATUS = 2` 过滤。
- 已核对 `getTopicDetail`、`getVideoDetail` 的相关文章查询过滤 `status` 为 `2`/`'2'`。
- 已核对三个页面正确引用 `utils/article-tags`。
- **尚未完成**：未部署 5 个云函数，也未在微信开发者工具/真实云环境验收草稿不可见、草稿 ID 无法打开详情、草稿不出现在相关推荐。

## 2026-11-02 - 修复首页 Banner 在 tabBar 切回后不刷新、失败不重试

### 问题场景

首页的 `loadBanners()` 只在 `onLoad()` 中触发。首页属于 tabBar 页面，用户切走再切回时仅执行 `onShow()`，因此：

- `index:banners:v2` 缓存超过 10 分钟 TTL 后，本次会话内仍会持续展示旧 Banner；CMS 中已修改或停用的内容不会更新。
- 首次请求失败进入 `HOME_BANNERS` 降级（或保留旧内容）后，没有任何重试入口，只能等待页面实例重建。

### 修改方案

- [pages/index/index.js](./pages/index/index.js) 新增 `maybeRefreshBanners()`，并在 `onLoad()` 和 `onShow()` 中调用：
  - 缓存过期或不存在时请求 `getBanners`；TTL 内不请求。
  - 上次请求失败时，下次 `onShow` 直接重试，不受 TTL 限制。
  - 云端成功返回空列表时按 TTL 节流，避免每次切回首页都请求。
- `loadBanners()` 增加 `_bannerLoading` 同步置位和 `finally` 复位，保证 `onLoad` 与紧随其后的 `onShow` 共用同一次请求，不重复调用云函数。
- 请求失败时记录 `_bannerLoadFailed`，成功后清除；空列表成功时记录 `_bannerEmptyAt`。
- 同步更新 [CLAUDE.md](./CLAUDE.md) 中 Banner 刷新时机和验收说明。

### 验证结果

- `node --check pages/index/index.js` 通过。
- 使用临时 Node 桩（未提交）模拟页面生命周期，以下场景全部通过：
  - `onLoad` + 紧随的 `onShow` 只调用一次 `getBanners`；
  - 缓存 TTL 内切回不请求，超过 10 分钟后 `onShow` 触发刷新；
  - 首次请求失败进入 `fallback`，下次 `onShow` 重试并恢复 `cloud` 状态；
  - 云端返回空列表后 TTL 内不重复请求，过期后重新请求。
- **尚未完成**：未在微信开发者工具/真机连接真实云环境验证 tabBar 切换和真实 CMS 数据更新。

## 2026-11-02 - 补全 CLAUDE.md 的命令、页面、云函数与集合清单

### 问题场景

`CLAUDE.md` 已覆盖 Banner、视频和文章发布链路，但缺少可直接执行的验证命令，导致后续开发者容易误以为仓库存在根目录 `npm test`/`npm run build`。同时前端页面清单遗漏 `account`、`bind-student`、`learning-records`、`points-history`、`redeem-info`、`video`、`video-detail`；云函数清单遗漏学习记录、积分流水、题库管理、话题删除、反馈提交等函数；数据库清单遗漏 `sign_records`、`user_achievements`、`user_backpack`、`feedback_records`、`titles`、`achievements`、`scam_reports` 和学校字典集合。

### 修改方案

- 在 [CLAUDE.md](./CLAUDE.md) 新增“常用命令与验证方式”，说明仓库没有根目录 npm 工程、lint 或自动化测试，并给出 `node --check`、批量语法检查、云函数依赖安装和 Cloudbase CLI 部署命令。
- 补全页面、云函数和数据库集合清单，并标注 `pages/logs/` 未在 `app.json` 注册。
- 新增 `utils/` 公共工具职责说明，记录积分商城功能开关 `pointsMallEnabled: false` 的当前状态。
- 补充登录缓存（5 分钟）、学生绑定提醒（12 小时）和 `aiChat` 只读取 `process.env` 的环境变量说明。

### 验证结果

- 逐项对照 `app.json`、`cloudfunctions/` 目录、各云函数 `package.json`、`utils/` 源码和 `grep` 到的集合名核对清单。
- 本次仅修改文档，未改变运行时代码，无需执行 JavaScript 语法检查。

## 2026-11-02 - 修复 Banner 查询先限量后排序的问题

### 问题场景

`getBanners` 在数据库查询阶段先 `limit(100)` 再在内存排序。启用 Banner 超过 100 条时，排序优先级更高的新记录可能因为未进入前 100 条而无法展示。

### 修改方案

- 调整 [cloudfunctions/getBanners/index.js](./cloudfunctions/getBanners/index.js) 查询顺序：先在数据库按 `sort` 升序、`updatedAt` 倒序、`createdAt` 倒序排序，再执行 `limit(100)`。
- 保留原有本地 `compareBanner` 排序与字段清洗逻辑，避免返回结构变化。

### 验证结果

- 已执行 `node --check cloudfunctions/getBanners/index.js`，语法检查通过。

## 2026-11-02 - 汇总 Banner 合并临时文档

### 问题场景

Banner 分支保留了一份合并期说明，其中包含部署环境、CMS 测试数据、缓存刷新和合并后校验要求。该文件属于一次性过程材料，若直接删除会丢失部分仍有价值的运维约束；同时手册中的 Banner 调用关系仍写成直接查询数据库，与当前实现不一致。

### 修改方案

- 将 Banner 云函数部署环境、测试数据边界、缓存刷新和真实环境验收要求汇总到 [CLAUDE.md](./CLAUDE.md)。
- 将 Banner 成员的部署与验收步骤补充到 [member-b-banner.md](./member-b-banner.md)。
- 将 [docs/manual/MANUAL_SPECIFICATION.md](./docs/manual/MANUAL_SPECIFICATION.md) 的首页依赖关系修正为调用 `getBanners` 云函数。
- 保留正式文档作为长期依据，合并期说明不再承担长期维护职责。

### 验证结果

- 已逐项对照 `Changelog-b.md`，保留其长期有效的部署、缓存和验收信息。
- 本次仅修改文档和文档中的调用关系说明，未改变运行时代码；无需重新执行 JavaScript 语法检查。
- 已确认 [docs/guides/developer-handoff.md](./docs/guides/developer-handoff.md)、[docs/guides/project-handoff.md](./docs/guides/project-handoff.md) 和四份 `member-*.md` 属于正式交接/协作资料，不纳入临时文档删除范围。

## 2026-11-01 - 视频发布闭环第一阶段验收

### 问题场景

- 视频模块的管理端与用户端链路已存在（[CLAUDE.md](./CLAUDE.md)「视频：已有标准发布链路」），但此前未按 member-c-video.md 第一阶段标准在真实环境完成人工验收。
- 本次需要确认管理员创建/编辑/草稿/发布/下线、用户侧可见性与播放、普通用户权限隔离是否可用。

### 修改方案

- 本次为纯验收，未修改任何页面、云函数或数据模型，无新部署。
- 按 member-c-video.md 第一阶段验收标准和 docs/team-collaboration/acceptance-checklist.md 清单执行（该清单为本地验收记录，不纳入 Git）。
- 媒体资源按现行流程：云开发控制台手动上传云存储 → 将 cloud:// 文件 ID 填入视频管理页。

### 验证结果

已通过（微信开发者工具 + 当前绑定云环境）：

- 管理员创建、编辑视频；标题/视频地址必填校验生效。
- 状态流转 draft → published → offline 正常。
- 草稿与下线视频对普通用户不可见；published 视频在用户列表可见。
- 用户侧封面显示、视频可播放。
- 关联文章、关联话题在详情页展示并可跳转。
- 普通用户调用 saveVideo、getAdminVideoList 返回「无管理权限」。

### 已知问题（非本轮引入）

- 用户视频列表顶部仍显示内置「精选短片」占位卡（无封面、无播放地址），点入详情显示「暂无可播放视频地址」；正式运营前需补真实资源或移除该兜底（utils/defaultVideos.js）。
- getVideos 无分页：已发布视频超过 100 条时更早的视频不会出现在列表。
- 管理页暂无本地文件选择和自动上传能力；自动上传属第二阶段 feature/video-media-upload，本轮不涉及。

### 环境与部署注意事项

- 本轮无代码修改，无需重新部署云函数。
- 本次验收云环境：cloud1-d8gvez9rg8eb96b20；验收所用小程序、云函数、云数据库与云存储均在该环境。
- getVideos、getVideoDetail、getAdminVideoList、saveVideo 四个云函数需保持部署在同一目标云环境。
- 验收所用媒体需与小程序位于同一云环境的云存储，cloud:// 文件 ID 才能解析为临时 URL。

### 后续

- 第一阶段验收已全部通过，可进入第二阶段（管理页自动上传 feature/video-media-upload）。
- 正式运营前处理内置「精选短片」占位卡与 getVideos 分页问题（见「已知问题」）。

## 2026-10-31 - 文章用户侧发布状态边界修复

### 问题场景

CMS 文档约定文章 `status = 1` 草稿、`status = 2` 已发布，但用户侧读取链路此前未统一过滤发布状态：

- `getArticles` 返回的文章列表包含草稿，草稿会出现在首页。
- `getArticleDetail` 仅按文章 ID 读取，已知草稿/下架 ID 也能打开用户详情。
- `searchArticles` 搜索结果包含草稿。
- 文章详情、话题详情、视频详情中的相关文章查询未过滤草稿，草稿可能出现在相关推荐。
- 文章不存在、草稿、下架三种场景的返回结构和用户提示不一致。

### 修改方案

- 三个用户侧云函数统一使用 `PUBLISHED_STATUS = 2` 常量，约定 `status = 1` 草稿、`status = 2` 已发布：
  - `cloudfunctions/getArticles/index.js`：查询条件固定 `status = 2`，列表与总数统计均只统计已发布文章；失败返回统一为 `{ success: false, errMsg }`，不再返回成功形状的 `data`。
  - `cloudfunctions/getArticleDetail/index.js`：文章读取改为按 `{ _id, status = 2 }` 查询，文章不存在、草稿、下架统一返回 `{ success: false, errMsg: '文章不存在或未发布' }`。
  - `cloudfunctions/searchArticles/index.js`：搜索条件使用 `_.and([{ status: 2 }, 关键词或条件])`，搜索结果只包含已发布文章。
- 相关推荐过滤：`getArticleDetail` 的相关文章查询增加 `status = 2`；`getTopicDetail`、`getVideoDetail` 中按 ID 拉取相关文章时同步过滤 `status = 2`，避免草稿出现在相关推荐。
- 详情页用户提示：`pages/article-detail/article-detail.js` 在云函数明确返回失败（文章不存在或未发布）时提示“文章不存在或已下线”，不再落入数据库直读或本地演示兜底；云函数异常（网络/云环境不可用）时保留兜底，且数据库直读兜底仅加载 `status = 2` 的已发布文章。
- 保持 CMS 管理方式不变，未新增小程序文章管理页。

### 验证结果

- `node --check cloudfunctions/getArticles/index.js` 通过。
- `node --check cloudfunctions/getArticleDetail/index.js` 通过。
- `node --check cloudfunctions/searchArticles/index.js` 通过。
- `node --check cloudfunctions/getTopicDetail/index.js`、`node --check cloudfunctions/getVideoDetail/index.js` 通过。
- `node --check pages/article-detail/article-detail.js` 通过。
- 仍需在微信开发者工具中对 `getArticles`、`getArticleDetail`、`searchArticles` 三个云函数执行“上传并部署：云端安装依赖”，并在真实云环境完成草稿不可见、已知草稿 ID 无法打开详情、草稿不出现在相关推荐的验收。

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
