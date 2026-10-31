# Changelog-b：member-b（首页 Banner 接入 CMS `banners`）合并说明

> 读者对象：负责把 a / b / c 三份改动合并到主干的执行者（agent 或人）。
> 仓库根目录即本文件所在的 `anti-fraud-main/`，文中所有路径均相对该目录。
> 本文只记录 member-b 的改动、三方合并时的冲突点与处理规则；业务背景见 `CHANGELOG.md` 与 `CLAUDE.md`。

## 0. 元信息

| 项 | 值 |
|---|---|
| 改动前状态 | 主干 10.30 初始版（首页轮播仍为本地写死的数据） |
| 改动规模 | 9 个文件，+458 / −51（不含本文档） |
| 涉及范围 | 首页轮播：1 个新增云函数 + 首页脚本/模板/样式 + 相关文档 |
| 文档性质 | 合并期临时说明，合并完成后可直接删除 |

## 1. 合并前先读（结论速览）

1. 功能面只动了**首页轮播**：新增 1 个只读云函数 `getBanners`，改写首页 `loadBanners()`。**没有**改文章、视频、答题、社区、用户等任何其它业务链路。
2. 与 a、c 真正会冲突的共享文件只有 4 个：`pages/index/index.js`、`CHANGELOG.md`、`CLAUDE.md`、`cloudfunctions/FOLDER.md`。
3. `app.json`、`project.config.json`、`utils/cloud.js`、`utils/cache.js` 以及 `getBanners` 以外的所有云函数，**本次零改动**。合并时不要顺带动它们。
4. 合并 `pages/index/index.js` 要**按区块取舍**，不要整文件选一边：文章相关方法只是被行号推后，语义未变；Banner 相关方法全取 b 版本。
5. `CHANGELOG.md` 是三方必然同时改的顶部区域，合并时**全部保留**，按日期倒序排列；不要因为"同一天"删掉他人条目。
6. 若 a 或 c 在 `app.json` 里新增页面，必须同步 `pages/index/index.js` 的 `REGISTERED_PAGES`（校验脚本见第 6 节），否则 Banner 无法跳转到该新页面。
7. 本次改动**不含**任何数据库导出、云函数配置或密钥；云环境操作由项目负责人手工完成，见第 9 节。

## 2. 改动清单与冲突风险

| 文件 | 改动类型 | 冲突风险 | 一句话说明 |
|---|---|---|---|
| `cloudfunctions/getBanners/index.js` | 新增（120 行） | 低 | 新目录；除非他人也建同名函数 |
| `cloudfunctions/getBanners/package.json` | 新增 | 低 | 仅依赖 `wx-server-sdk` |
| `pages/index/index.js` | 改写（458 → 612 行） | **高** | 顶部常量区、`data`、`loadBanners` / `onBannerTap` 两个方法整体重写 |
| `pages/index/index.wxml` | 局部（+16/−1） | 中 | 仅轮播块：加 `wx:if`、降级提示、空态 |
| `pages/index/index.wxss` | 追加（+40） | 低 | 只在 `.banner-slider` 后插入，未改既有样式 |
| `CLAUDE.md` | 6 处（+39/−32） | 中 | 业务域清单、`banners` 描述、Banner 章节整体重写、文档清单、目录表、缺口段 |
| `CHANGELOG.md` | 顶部新增条目 + 1 处补注 | **高** | 三方都会在同一位置插入 |
| `cloudfunctions/FOLDER.md` | 追加 1 行 | 中 | 按字母序插在 `getArticles` 与 `getSchools` 之间 |
| `docs/manual/test-cases/functional/TC-01-home.md` | 改 1 个表格单元 | 低 | 仅 TC-01-003 的"预期结果" |
| `Changelog-b.md` | 新增 | 无 | 本文档 |

## 3. 逐文件明细

### 3.1 新增云函数 `cloudfunctions/getBanners/`

用户侧只读函数，入参为空（`exports.main` 不读 `event`，可安全传 `{}`）。

| 场景 | 返回 |
|---|---|
| 正常 / 空列表 | `{ success: true, data: { list, total, emptyReason } }` |
| 集合未创建（`errCode === -502005`） | `{ success: true, data: { list: [], total: 0, emptyReason: 'collection_not_exist' } }` |
| 有集合但无启用记录 | `success: true`，`emptyReason: 'no_enabled_banner'` |
| 其它数据库异常 | `{ success: false, errCode: 'BANNERS_QUERY_FAILED', errMsg: '轮播图加载失败' }` |

行为约束（合并时不要"优化"掉）：

- `where({ status: true })` + JS 侧 `banner.status === true` 二次校验，**严格等于 `true`** 才下发，字符串 `"true"` 视为禁用。
- `sort` 升序；`sort` 相同时按 `updatedAt`/`createdAt` 倒序。
- 只下发 `_id`、`title`、`desc`、`icon`、`image`、`bgColor`、`link`、`sort`，不透出 CMS 管理字段。
- `limit(100)`：首页轮播不需要分页。
- 数据库故障**不返回** `success: true` 的空列表（避免首页误判为"运营没配"）。

### 3.2 `pages/index/index.js`（最需要小心）

改动前 458 行 → 改动后 612 行。区块对照如下，合并时按区块定位：

| 区块 | 改动前 | 改动后 | 改动 |
|---|---|---|---|
| `require` | 2–3 | 2–3 | `utils/cache` 多引入 `removeCacheData` |
| `DEFAULT_BANNER_BG` | — | 10 | 新增默认渐变常量 |
| `REGISTERED_PAGES` | — | 13–53 | 新增，38 条，与 `app.json` 的 `pages` 一一对应 |
| `TAB_BAR_PAGES` | — | 55–61 | 新增，5 条，与 `tabBar.list` 一致 |
| `HOME_BANNERS` | 10–76 | 63–88 | **内容一字未改**，只是位置后移；定位从"正式数据"降为"降级数据" |
| `normalizeBannerLink()` | — | 133–153 | 新增：路径白名单校验，未命中丢弃并 `console.warn` |
| `normalizeBanner()` | — | 155–170 | 新增：字段 trim、空 `bgColor` 用默认渐变 |
| `data.defaultBanners` | 83 | 已删除 | 换成 `bannerMode`（175–176：`cloud`/`cache`/`fallback`/`empty`） |
| `onLoad()` | 190–201 | 283–294 | 逻辑未变（缓存命中判断方式相同） |
| `restoreCachedBanners()` | 209–216 | 302–309 | 命中缓存时多写 `bannerMode: 'cache'` |
| `loadBanners()` | 424–442 | 517–553 | **整体重写**：改为 `wx.cloud.callFunction({ name: 'getBanners' })` |
| `prepareBanners()` | — | 555–571 | 新增：清洗 + `resolveCloudFileUrls()` |
| `applyLocalBanners()` | — | 573–580 | 新增：降级到 `HOME_BANNERS` |
| `onBannerTap()` | 444–457 | 582–611 | **整体重写**：白名单 + tabBar 走 `wx.switchTab` |

`loadBanners()` 的四个分支（合并后必须完整保留）：

1. 调用成功且有数据 → `bannerMode: 'cloud'` + 写 `index:banners:v2` 缓存。
2. 调用成功但列表为空 → `bannerMode: 'empty'`、`removeCacheData()` 清缓存、**不回落到 `HOME_BANNERS`**。
3. 调用失败且页面已有内容（缓存或已渲染）→ 直接 `return`，不覆盖。
4. 调用失败且页面完全没内容 → `applyLocalBanners()`，`bannerMode: 'fallback'`。

**冲突处理规则**：若 a 或 c 也改了该文件，冲突大概率出现在顶部常量区和文件末尾方法区（`goVideoList` 之后）。按以下优先级解决：

- 顶部三块常量（`REGISTERED_PAGES`、`TAB_BAR_PAGES`、`HOME_BANNERS`）取 b 版本；若他人新增了页面，在 `REGISTERED_PAGES` 里补上对应路径。
- `loadBanners` / `prepareBanners` / `applyLocalBanners` / `onBannerTap` 取 b 版本。
- 文章相关方法（`loadArticlesFromCloud`、`restoreCachedArticles`、`loadMoreArticles`、`selectCategory`、`viewArticle`、`formatRelativeTime`、`normalizeArticle` 等）取**改动那一方**的版本，b 未改语义。
- 不要重新引入 `data.defaultBanners`：它已被 `bannerMode` 取代，`defaultBanners` 在仓库中已无引用（可用 `grep -rn "defaultBanners" pages utils` 确认为空）。

### 3.3 `pages/index/index.wxml`

只改轮播块（改动后 27–70 行）：

- 外层 `view.banner-slider` 加 `wx:if="{{banners.length > 0}}"`，避免无数据时出现空白块。
- swiper 内追加 `wx:if="{{bannerMode === 'fallback'}}"` 的 `.banner-hint` 提示。
- 新增同级 `wx:elif="{{bannerMode === 'empty'}}"` 的 `.banner-empty` 空态（虚线框 + "暂无轮播内容"）。

`swiper-item` 的字段绑定（`item.image` / `item.bgColor` / `item.icon` / `item.title` / `item.desc`）未改协议。

### 3.4 `pages/index/index.wxss`

仅在 `.banner-slider` 规则之后插入 40 行：`.banner-hint`、`.banner-empty`、`.banner-empty-icon`、`.banner-empty-title`、`.banner-empty-text`。未修改任何既有选择器，理论上不会与 a/c 冲突；若确有冲突，两边新增样式全部保留即可。

### 3.5 `CLAUDE.md`（6 个 hunk，逐个说明）

`CLAUDE.md` 是项目唯一权威文档，合并时**不要整体选一边**，逐 hunk 处理：

| 位置（改动后行号） | 改动 | 合并时注意 |
|---|---|---|
| 91 | 云函数业务域清单新增 `- 首页展示：getBanners（只读启用的轮播图）` | 若 a/c 也在该清单加行，**保留双方的分类行**，不要合并成一行 |
| 125 | `banners` 集合描述由"设计中的、前端尚未接通"改为"由 CMS 维护，用户侧经 getBanners 只读启用记录" | 若 a/c 也改了这行，以"已接入"的事实为准 |
| 210–265 | "首页 Banner"章节整体重写：标题改为"CMS 动态读取 + 本地降级"，加入链路图、`getBanners` 契约表、`banners` 字段表、8 条首页行为约定、部署项 | 该章节**整段取 b 版本**；原"Banner CMS 接入规划（尚未实现）"十步清单已删除，属有意删除，不要恢复 |
| 422 | `CMS使用文档` 条目去掉"设计中的 banners" | 与 a 的文章 CMS 描述无交集 |
| 428 | member 分工文档拆成"根目录三个 + `docs/team-collaboration/member-d`" | 纯路径修正，取 b 版 |
| 444 | 目录表 `docs/team-collaboration/` 一行由"仅本地使用"改为"验收清单被忽略，分工文档需入库" | 同上 |
| 450 | 已知架构缺口：删掉"缺少 getBanners"，改为"仍缺 Banner 管理页、saveBanner、媒体上传" | 若 a/c 也往"当前已知架构缺口"列表加条目，**条目全部保留**，只替换 Banner 那一条 |

另：244–252 是新增的"首页行为约定"8 条，其中第 7 条"新增页面必须同步 `REGISTERED_PAGES` 与 `app.json`"是给后续所有成员的硬约束，不要删。

### 3.6 `CHANGELOG.md`（最可能冲突）

- 第 6–66 行：新增条目 `## 2026-10-30 - 首页 Banner 接入 CMS banners 集合`，四段式（问题场景 / 修改方案 / 验证结果 / 部署与环境注意事项），末尾附"文档同步（补正）"小节。
- 第 181、192 行：给旧的"Banner 调研结论 → 后续规划"补注"已于 2026-10-30 落地"，保留原调研内容不删。

合并规则：

1. 三方条目全部保留，顺序按日期倒序（最新在上）；同日条目并列即可，不必强行排序。
2. 文件里已存在同日期的更早条目（`2026-10-30 - 整理项目文档目录`、`2026-10-30 - 调整多人协作文档跟踪范围`），说明本项目**允许同日多条**，不要合并成一条。
3. 只在冲突块里删"重复的标题行"，不要删他人正文。

### 3.7 `cloudfunctions/FOLDER.md`

第 9 行插入 `- getBanners/ - 获取首页轮播图云函数（只读启用记录，按 sort 升序）`，位置在 `getArticles/` 与 `getSchools/` 之间（字母序）。若 a/c 也往此文件加行，按字母序合并即可。

### 3.8 `docs/manual/test-cases/functional/TC-01-home.md`

仅第 49 行 TC-01-003 的"预期结果"：由"若链接无效则显示提示"改为三条——有效内部链接跳转（tabBar 页为切换 tab）、未配置链接时无反应不报错、未注册链接被丢弃且不弹提示（控制台有忽略日志）。这是**为对齐实现而修测试用例**，不是改实现；不要反向把实现改回去弹 toast。

## 4. 建议的合并顺序

1. 先合 a（文章发布状态）与 c（视频发布链路）：两者主要改云函数，与 `getBanners` 目录不重叠。
2. 再合 b（首页 Banner）：此时 `pages/index/index.js` 与 `CHANGELOG.md` 的冲突只有 b 一方在动，冲突面最小。
3. 每合完一份改动就跑一次第 6 节的检查，避免错误累积到最后难以定位。
4. 收尾时统一处理第 8 节的遗留问题，不要夹在本次合并里顺手改（会扩大回归面）。

若必须按 b → a → c 的顺序合，注意合入 b 之后 `pages/index/index.js` 行号已整体后移约 154 行，a/c 的冲突标记会落在错误位置，逐块比对而不是按行号。

## 5. 合并后必须保留的行为（别被"简化"掉）

| # | 行为 | 去掉会怎样 |
|---|---|---|
| 1 | `status` 严格等于 `true` 才下发 | 草稿/下架 Banner 会泄漏到线上 |
| 2 | 云端成功但空列表 → 清缓存 + 空态 | 旧 Banner 会一直"诈尸"展示 |
| 3 | 云端失败时已有内容不覆盖 | 网络抖动会把线上轮播刷成 4 张渐变占位 |
| 4 | `cloud://` 解析失败清空 `image` | 页面出现破图 |
| 5 | `link` 必须命中 `REGISTERED_PAGES` | 点击后跳转失败、报错弹窗 |
| 6 | tabBar 页面用 `wx.switchTab` | `navigateTo` 打开 tab 页直接失败 |
| 7 | 未注册链接静默丢弃 + `console.warn` | TC-01-003 的预期会不成立 |

## 6. 合并后验证命令

在仓库根目录（即 `anti-fraud-main/`）下执行：

```bash
node --check cloudfunctions/getBanners/index.js
node --check pages/index/index.js
```

白名单一致性校验（不需要任何依赖）：

```bash
node -e "
const fs=require('fs');
const app=JSON.parse(fs.readFileSync('app.json','utf8').replace(/^\uFEFF/,''));
const src=fs.readFileSync('pages/index/index.js','utf8');
const block=src.slice(src.indexOf('const REGISTERED_PAGES'),src.indexOf('const TAB_BAR_PAGES'));
const listed=[...block.matchAll(/'\/(pages\/[^']+)'/g)].map(m=>m[1]);
console.log('app.json:',app.pages.length,'whitelist:',listed.length);
console.log('缺:',app.pages.filter(p=>!listed.includes(p)));
console.log('多:',listed.filter(p=>!app.pages.includes(p)));
"
```

预期输出：数量相等、`缺: []`、`多: []`。若有差异，说明合并时新增/删除了页面而未同步白名单，补上即可。

再跑一次 `git diff --check` 确认没有空白字符问题。

## 7. 本次未触碰（合并时无需为 b 处理）

- `app.json`、`project.config.json`、`sitemap.json`
- `utils/cloud.js`、`utils/cache.js`、`utils/util.js`（只按既有 API 调用，未改实现）
- `getBanners` 之外的 76 个云函数
- 首页文章相关逻辑与本地示例文章数据（`allArticles` 等）
- `README.md`、`ARCHITECTURE.md`、`docs/README.md`（本次**刻意未新增正式文档、未登记导航**，理由见第 10 节）

## 8. 已知遗留问题（不属 b 范围，供合并后统一处理）

以下问题在审计时已确认存在，但超出 member-b 的分工边界，本次未改，留给合并后统一处理：

| 问题 | 影响 | 建议 |
|---|---|---|
| `sitemap.json` 被 `.gitignore` 的 `sitemap*.json` 排除、未入库，但 `app.json` 的 `sitemapLocation` 指向它 | 新克隆仓库缺文件，编译告警 | 要么把 `sitemap.json` 加入版本库，要么删掉 `sitemapLocation` |
| `pages/logs/` 未被 `app.json` 注册 | 脚手架残留，5 个无用文件 | 删除或注册 |
| `login`、`initQuizQuestions`、`equipTitle` 仍把 `_id` 写进 `set()` 的 data | 有触发"不能更新 id 的值"的风险 | 单独分支修，改前先查调用链 |
| `cloudfunctions/aiChat/index_ocr.js` 混在部署目录 | 会被一起打包 | 移到 `lib/` 或删除 |
| 全项目约 204 处 `console.log` | 线上日志噪音 | 按需清理，非必须 |
| `docs/manual/MANUAL_SPECIFICATION.md:131` 仍写 `loadBanners() → db.collection('banners')` | 文档与实现不符（实际走云函数） | 顺手改成 `callFunction('getBanners')` |

## 9. 项目负责人手工完成的云端改动（备注：此部分内容与本地文件修改无关）

以下操作在微信开发者工具 / 云开发控制台完成，**不在仓库的任何提交中**，合并代码不会带上它们，换环境部署时必须重做：

- **上传云函数 `getBanners`**：已部署到与小程序相同的云环境。
- **数据库新增集合 `banners`**：内含 3 条测试记录（覆盖启用 + `cloud://` 图、启用 + `https://` 图、禁用三类场景）。

合并 / 上线前请注意：

1. `getBanners` 未部署时，首页会一直走本地降级并在控制台打印 `[index] loadBanners 失败`，属预期现象，不是代码缺陷。
2. `banners` 集合里的 3 条是**测试数据**，正式上线前应替换为真实运营内容；`status` 必须是布尔 `true`，`sort` 必须是数字。
3. 每次改完 `banners` 数据，验收前需清除 `index:banners:v2` 缓存（开发者工具"清缓存 → 清除全部缓存"）或等待 10 分钟 TTL；下拉刷新不会重新请求 Banner。

## 10. 关于文档登记的说明

本文档没有在 `CLAUDE.md` / `docs/README.md` 中登记：那两个文件是三方共同的冲突热点，为一份合并期临时材料再动它们不划算。合并完成后可直接删除本文件；若要长期保留，再在文档导航中补一行。
