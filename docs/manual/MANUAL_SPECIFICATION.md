# 文档编写规范

## 1. 目的与范围

本文档规定了"反诈卫士"微信小程序用户手册和测试案例的编写规范，确保文档的统一性、完整性和可维护性。

## 2. 用户手册编写规范

### 2.1 文档模板

每个功能模块的用户手册应包含以下章节：

```markdown
# [模块名称] - 用户手册

## 功能概述
简要描述模块的主要功能和用途。

## 入口路径
描述用户如何进入该功能页面。

## 界面说明
### 界面元素
列出页面上的主要UI元素及其功能。

### 操作按钮
列出所有操作按钮及其功能。

## 操作流程
### [操作场景1]
1. 步骤1
2. 步骤2
...

### [操作场景2]
...

## 注意事项
- 重要提示1
- 重要提示2

## 常见问题
**Q: 问题1**
A: 答案1

## 相关功能
链接到相关模块的用户手册。
```

### 2.2 界面截图要求

- 截图尺寸：宽度不超过800px，高度不限
- 截图格式：PNG格式，背景透明
- 标注要求：使用红色箭头和数字标注关键操作点
- 命名规范：`[模块]_[功能]_[序号].png`，如 `quiz_answer_01.png`

### 2.3 术语表

| 术语 | 英文 | 解释 |
|-----|------|-----|
| 积分 | Points | 用户通过活动获得的虚拟货币 |
| 签到 | Check-in | 用户每日登录标记行为 |
| 排行榜积分 | Quiz Points | 答题正确数累计积分 |
| 商城积分 | Mall Points | 用于兑换商品的积分 |
| 成就 | Achievement | 用户达成特定目标解锁的徽章 |
| 称号 | Title | 用户可装备的身份标识 |
| 背包 | Backpack | 存放用户获得的虚拟物品 |
| UID | User ID | 用户唯一标识符，9位数字 |

## 3. 测试案例编写规范

### 3.1 测试案例模板

```markdown
# [模块名称] - 功能测试案例

## 模块信息
- 模块编号：Mxx
- 模块名称：xxx
- 测试负责人：xxx
- 编写日期：yyyy-mm-dd

## 测试案例列表

### TC-[模块编号]-[序号] [测试案例名称]

| 项目 | 内容 |
|-----|-----|
| 测试ID | TC-xx-xxx |
| 测试名称 | xxx |
| 前置条件 | 1. xxx<br>2. xxx |
| 测试步骤 | 1. xxx<br>2. xxx |
| 测试数据 | xxx |
| 预期结果 | xxx |
| 优先级 | P1/P2/P3 |
| 测试类型 | 正常/异常/边界 |
```

### 3.2 优先级定义

| 优先级 | 说明 | 示例 |
|-------|------|-----|
| P1 | 核心功能，必须通过 | 用户登录、答题提交 |
| P2 | 重要功能，影响用户体验 | 积分显示、消息推送 |
| P3 | 辅助功能，可延后修复 | 界面美化、文案调整 |

### 3.3 测试类型定义

| 类型 | 说明 | 示例 |
|-----|------|-----|
| 正常测试 | 正常操作流程验证 | 正确输入提交 |
| 异常测试 | 异常输入或错误处理 | 网络断开、空输入 |
| 边界测试 | 边界值和极限值测试 | 最大字符数、最小值 |

### 3.4 测试结果状态

| 状态 | 说明 |
|-----|------|
| 待测试 | 测试案例尚未执行 |
| 通过 | 测试结果符合预期 |
| 失败 | 测试结果不符合预期 |
| 阻塞 | 因环境或依赖问题无法执行 |
| 跳过 | 本次测试周期跳过 |

## 4. 云函数与页面映射

### 4.1 页面-云函数依赖关系

```
pages/index/index.js
├── loadBanners() → wx.cloud.callFunction('getBanners')
└── loadArticlesFromCloud() → db.collection('articles')

pages/quiz/quiz.js
├── loadQuestions() → getQuizQuestions
└── submit() → submitQuizAttempt

pages/community/community.js
└── loadMore() → getPosts

pages/chat/chat.js
└── sendMessage() → aiChat

pages/user/user.js
├── autoLogin() → login
├── loadUserDataFromCloud() → getUserInfo
├── handleSignIn() → userSignIn
└── loadUserTitles() → getUserTitles
```

### 4.2 完整云函数列表

| 云函数 | 功能 | 调用页面 |
|-------|------|---------|
| login | 用户登录/注册 | user, my |
| getUserInfo | 获取用户信息 | 多个页面 |
| userSignIn | 每日签到 | user, sign-in |
| getQuizQuestions | 获取答题题目 | quiz |
| submitQuizAttempt | 提交答题结果 | quiz |
| getQuizLeaderboard | 获取答题排行榜 | quiz-leaderboard |
| aiChat | AI对话 | chat |
| getPosts | 获取社区帖子 | community |
| getPostDetail | 获取帖子详情 | community-post-detail |
| createPost | 创建帖子 | community-post-create |
| createComment | 创建评论 | 多个 |
| getComments | 获取评论列表 | 多个 |
| followUser | 关注用户 | profile |
| getPublicProfile | 获取公开主页 | profile |
| getArticles | 获取文章列表 | index, search |
| getArticleDetail | 获取文章详情 | article-detail |
| searchArticles | 搜索文章 | search |
| searchUsers | 搜索用户 | search |
| getProducts | 获取商品列表 | points |
| redeemProduct | 兑换商品 | points, redeem-info |
| getExchangeRecords | 获取兑换记录 | points-history |
| getUserBackpack | 获取背包物品 | backpack |
| useBackpackItem | 使用背包物品 | backpack |
| getUserTitles | 获取用户称号 | user, my |
| equipTitle | 装备称号 | title-management |
| getTitles | 获取称号列表 | title-management |
| redeemTitle | 兑换称号 | title-management |
| getNotifications | 获取通知列表 | messages |
| getUnreadCount | 获取未读数 | user |
| markNotificationRead | 标记已读 | messages |
| getLearningRecords | 获取学习记录 | learning-records |
| createScamReport | 创建诈骗反馈 | scam-report |
| bindStudent | 绑定学生信息 | bind-student |
| unbindStudent | 解绑学生信息 | account |
| updateProfileDisplay | 更新展示设置 | achievements, my |
| trackAction | 行为追踪 | 多个 |

## 5. 数据库集合结构参考

详见 `cloudfunctions/database.md`

## 6. 审核流程

1. 文档编写完成后提交至Git仓库
2. 代码评审时同步审核文档更新
3. 文档需与代码版本保持一致

## 7. 版本控制

- 文档版本号与小程序版本号对应
- 每次功能更新需同步更新相关文档
- 使用Git进行版本追踪