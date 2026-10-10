# 小程序性能排查说明

日期：2026-04-11

范围：基于当前工作区代码做静态排查，未做真机耗时采样，也未修改本轮业务逻辑。

## 结论摘要

当前小程序的“慢”主要不是单一页面渲染问题，而是以下两类问题叠加：

1. 高频页面和动作背后挂了过重的云函数。
2. 部分云函数在每次调用时都做了集合探测、成就同步、统计写入和大量日志输出。

如果只看剩余风险，最值得优先排查的不是前端样式层，而是：

- `getUserInfo`
- `trackAction`
- `getArticleDetail`
- `getArticles`
- `getTopics`
- `login`

其中前 3 个最像真正的主瓶颈。

## 启动与常驻页面链路

当前常见访问链路大致如下：

- 小程序启动会走 [`app.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/app.js#L63) 的 `ensureLogin`
- 首页会走 [`pages/index/index.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/pages/index/index.js#L231) 的 `loadArticlesFromCloud` 和 [`pages/index/index.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/pages/index/index.js#L411) 的 `loadBanners`
- 社区页会走 [`pages/community/community.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/pages/community/community.js#L46) 的 `refresh`
- 用户页会走 [`pages/user/user.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/pages/user/user.js#L70) 的 `refreshPageData`
- 文章详情会同时走 [`pages/article-detail/article-detail.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/pages/article-detail/article-detail.js#L28)、[`pages/article-detail/article-detail.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/pages/article-detail/article-detail.js#L29)、[`pages/article-detail/article-detail.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/pages/article-detail/article-detail.js#L30)

也就是说，用户感知到的“慢”，很多时候是一个页面背后串了 2 到 4 个云请求，而其中单个云请求本身又很重。

## 重点瓶颈

### 1. `getUserInfo` 负担过重

文件：[`cloudfunctions/getUserInfo/index.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/getUserInfo/index.js#L120)

它不是一个单纯“读用户资料”的接口，而是一个“读资料 + 同步成就 + 可能写库”的接口。

关键问题：

- 每次调用都会先做集合探测：[`ensureCollection`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/getUserInfo/index.js#L16)
- 每次调用都可能检查并初始化成就数据：[`ensureAchievementsData`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/getUserInfo/index.js#L34)
- 每次调用都会进入 [`syncAchievements`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/getUserInfo/index.js#L120)
- `syncAchievements` 内部会查：
  - `achievements`
  - `user_achievements`
  - `titles`
- `syncAchievements` 内部还可能写：
  - `user_achievements`
  - `users`
  - `points_records`

这意味着：

- 用户页打开时，如果打 `getUserInfo`，它不是轻读，而是重同步。
- 文章详情页读完文章后又会再打一次 `getUserInfo`，会把详情页拖慢。
- 任何只是想拿头像、积分、连续签到天数的地方，都被迫承担成就同步成本。

判断：这是当前最像“全局慢源头”的云函数之一。

### 2. `trackAction` 同步链路太重

文件：[`cloudfunctions/trackAction/index.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/trackAction/index.js#L11)

`trackAction` 被用于“读文章”和“聊天”后的行为统计与奖励发放，但它当前做得太重。

关键问题：

- 每次调用都执行多个 `ensureCollection`：[`trackAction/index.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/trackAction/index.js#L111)
- 每次调用都可能触发 [`ensureAchievementsData`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/trackAction/index.js#L32)
- 会查询用户：[`trackAction/index.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/trackAction/index.js#L96)
- 会查询同类型成就：[`trackAction/index.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/trackAction/index.js#L178)
- 更重的是，它会对每个匹配成就逐个查 `user_achievements.count()`：[`trackAction/index.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/trackAction/index.js#L207)
- 然后再写 `user_achievements`、`points_records`、`users`

额外问题：

- 日志极多，从入参到每一步查询都在 `console.log`

影响路径：

- `aiChat` 在生成回复后会调用 `trackAction`
- `getArticleDetail` 在记录阅读后也会调用 `trackAction`

这意味着：

- 聊天页“AI 回答慢”不一定全是模型慢，也可能是回答后面的奖励统计拖尾
- 文章详情页“打开慢”不只是文章查询，还包括阅读记录和成就统计

判断：这是当前最像“动作后卡顿源头”的云函数。

### 3. `getArticleDetail` 不是单纯读详情

文件：[`cloudfunctions/getArticleDetail/index.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/getArticleDetail/index.js#L41)

它当前包含以下工作：

- 集合探测：[`ensureCollection`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/getArticleDetail/index.js#L24)
- 读取文章详情
- 更新文章浏览量
- 查用户
- 查是否首次阅读：`read_records.count()`
- 写入阅读记录
- 调 `trackAction`
- 再查一遍相关文章

这会导致一次文章详情请求背后串多个数据库操作，而且其中一部分还是写操作。

更重的是前端这里：

- 页面打开时同时执行 [`loadArticle`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/pages/article-detail/article-detail.js#L34)
- 同时执行本地兜底的 [`loadRelatedArticles`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/pages/article-detail/article-detail.js#L313)
- 同时执行 [`loadComments`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/pages/article-detail/article-detail.js#L332)
- 文章请求成功后又会再执行 [`syncUserInfoFromCloud`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/pages/article-detail/article-detail.js#L270)

结果是详情页入口非常容易出现“请求堆叠”。

判断：这是详情页卡顿的主原因。

### 4. `getArticles` 有额外调试成本

文件：[`cloudfunctions/getArticles/index.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/getArticles/index.js#L24)

主要问题：

- 每次列表请求都会先执行一次 `count()`：[`getArticles/index.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/getArticles/index.js#L63)
- 再执行一次分页列表查询：[`getArticles/index.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/getArticles/index.js#L102)
- 如果分类查不到内容，还会额外拉最多 100 篇文章做调试分析：[`getArticles/index.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/getArticles/index.js#L69)
- 大量 `console.log` 输出请求参数、字节码、结果样例

影响：

- 首页首屏和分类切换的每次请求都要付出“双查询 + 大量日志”的成本。
- 当分类名不匹配时，会进入明显更重的调试分支。

判断：这是首页资讯列表慢的主要后端原因，但优先级低于 `getUserInfo` 和 `trackAction`。

### 5. `getTopics` 先全量拉，再内存排序

文件：[`cloudfunctions/getTopics/index.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/getTopics/index.js#L54)

主要问题：

- 先查全部已发布话题：[`getTopics/index.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/getTopics/index.js#L57)
- 再在函数内 `sort()`：[`getTopics/index.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/getTopics/index.js#L62)
- 再 `slice()`：[`getTopics/index.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/getTopics/index.js#L70)

这在数据量小的时候问题不明显，但话题越多越浪费。

影响：

- 社区页会随着 `topics` 集合增长越来越慢。
- 目前查询没有把排序和截断尽量下推到数据库侧。

判断：这是中期会越来越明显的问题。

### 6. `login` 每次登录都可能带额外写操作

文件：[`cloudfunctions/login/index.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/login/index.js#L101)

主要问题：

- 新用户注册路径会写 `users`
- 老用户如果昵称或头像变化会写 `users`
- 无论如何，最后都可能执行 [`syncPublicProfile`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/login/index.js#L67)
- `syncPublicProfile` 会先 `get`，再 `set`
- `syncPublicProfile` 里还会先做 `public_profiles` 集合探测：[`login/index.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/login/index.js#L69)

如果 `login` 被高频调用，它就不再是一个轻量认证接口，而是一个带同步副作用的接口。

影响：

- 启动阶段会感觉“第一下慢”
- 用户页如果复用 `login` 更新头像/昵称，也会带上额外同步成本

判断：不是最重，但它位于启动链路，所以体感权重高。

### 7. `getUserTitles` 和 `getUnreadCount` 也偏重

文件：

- [`cloudfunctions/getUserTitles/index.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/getUserTitles/index.js#L15)
- [`cloudfunctions/getUnreadCount/index.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/getUnreadCount/index.js#L16)

主要问题：

- 两者都先查 `users`
- `getUserTitles` 会再查 `titles`，而且拥有称号和佩戴称号分两次查询
- `getUnreadCount` 每次都先做集合探测，再 `count()`

单看不算最慢，但如果用户页同时触发多条请求，它们会把总体等待时间继续拉长。

## 不是主因，但会放大体感的点

### 1. 大量日志输出

尤其明显的文件：

- [`cloudfunctions/getArticles/index.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/getArticles/index.js#L32)
- [`cloudfunctions/trackAction/index.js`](C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/trackAction/index.js#L67)

这些日志在开发期有帮助，但在高频云函数里会明显放大执行时间和日志噪音。

### 2. 集合存在性检查放在业务热路径

多个函数都有类似模式：

- `getUserInfo`
- `getArticleDetail`
- `trackAction`
- `getUnreadCount`
- `login`
- `getTopics`

集合探测更适合迁移脚本、初始化脚本或冷路径，而不适合每次请求都跑。

### 3. 成就/积分同步设计耦合太紧

现在“获取资料”“阅读文章”“聊天一次”都可能同步触发：

- 成就判断
- 成就写库
- 积分记录写库
- 用户聚合字段更新

这种设计的好处是逻辑集中，但代价就是所有高频动作都背上了额外写放大。

## 优先级建议

### P0：最先排

- `getUserInfo`
- `trackAction`
- `getArticleDetail`

原因：这三个函数最容易直接影响用户首次进入用户页、文章详情页、聊天后的等待感。

### P1：第二批

- `getArticles`
- `login`

原因：它们影响首页和启动体感，但相对可控，且已经可以通过前端缓存缓和一部分。

### P2：第三批

- `getTopics`
- `getUserTitles`
- `getUnreadCount`

原因：目前量级可能还没到最痛点，但随着数据增长会变差。

## 建议的后续排查方式

这一轮只是静态排查。下一轮如果要继续，建议按下面顺序做实测：

1. 给 `login`、`getUserInfo`、`getArticles`、`getTopics`、`getArticleDetail`、`trackAction` 加阶段耗时日志。
2. 在开发者工具和云开发控制台分别看：
   - 平均耗时
   - P95 耗时
   - 调用次数
   - 错误率
3. 优先确认是不是 `getUserInfo` 和 `trackAction` 明显偏慢。
4. 再决定是拆轻接口，还是把成就/积分发放改成异步。

## 当前判断

如果只用一句话总结当前代码状态：

当前小程序的主要性能问题，在于“高频页面请求命中了带同步副作用的重云函数”，而不是纯前端渲染本身。

也就是说，后续真正能明显提速的方向，应该是把：

- 资料读取
- 行为统计
- 成就同步
- 积分写库

这几件事从同一条热路径里拆开。
