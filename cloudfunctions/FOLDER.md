# 云函数目录 (v3)

## 文件概览

- `aiChat/` - AI对话云函数，提供智能问答服务
- `bindStudent/` - 学生信息绑定云函数
- `getArticleDetail/` - 获取文章详情云函数
- `getArticles/` - 获取文章列表云函数
- `getBanners/` - 获取首页轮播图云函数（只读启用记录，按 sort 升序）
- `getSchools/` - 获取学校信息云函数
- `login/` - 用户登录云函数
- `userSignIn/` - 用户签到云函数
- `getTitles/` - 获取称号列表云函数 (v1.1新增)
- `redeemTitle/` - 积分兑换称号云函数 (v1.1新增)
- `equipTitle/` - 佩戴/卸下称号云函数 (v1.1新增)
- `trackAction/` - 追踪用户行为云函数 (v1.1新增)
- `getUserTitles/` - 获取用户称号信息云函数 (v1.1新增)
- `initTitles/` - 初始化称号数据云函数 (v1.1新增)
- `initQuizQuestions/` - 初始化趣味答题题库云函数 (v3新增)
- `getQuizQuestions/` - 随机抽取答题题目云函数 (v3新增)
- `submitQuizAttempt/` - 提交答题并判分/发放积分云函数 (v3新增)
- `getQuizLeaderboard/` - 获取答题排行榜云函数 (v3新增)
- `createPost/` - 创建社区帖子云函数 (v3新增)
- `getPosts/` - 获取社区帖子列表云函数 (v3新增)
- `getPostDetail/` - 获取社区帖子详情云函数 (v3新增)
- `createComment/` - 创建评论/回复云函数 (v3新增)
- `getComments/` - 获取评论列表云函数 (v3新增)
- `followUser/` - 关注/取消关注云函数 (v3新增)
- `getNotifications/` - 获取站内通知列表云函数 (v3新增)
- `markNotificationRead/` - 标记通知已读云函数 (v3新增)
- `getUnreadCount/` - 获取未读通知数量云函数 (v3新增)
- `searchArticles/` - 搜索资讯云函数 (v3新增)
- `searchUsers/` - 搜索用户云函数 (v3新增)
- `createScamReport/` - 提交诈骗反馈云函数 (v3新增)
- `getPublicProfile/` - 获取用户公共主页资料云函数 (v3新增)
- `updateProfileDisplay/` - 更新主页展示成就云函数 (v3新增)

## 功能说明

云函数目录包含小程序的后端服务逻辑，处理用户认证、数据操作、业务逻辑等。v3版本新增了趣味答题（题库/判分/排行榜/每日奖励）、社区、评论、关注与站内消息、搜索、诈骗反馈、公共主页等能力，并对积分商城兑换逻辑进行了修复与增强。所有云函数使用微信云开发服务，提供稳定可靠的后端支持。

## 重要说明

**每当所属的代码发生变化时，必须对相应的文档进行更新操作！**
