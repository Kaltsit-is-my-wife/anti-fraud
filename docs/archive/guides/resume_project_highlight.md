# 简历项目提炼

## 项目定位

这个项目不适合包装成“技术突破型”项目。

更合适的定位是：

- 一个业务链路完整的工程实现项目
- 重点在系统设计、数据建模、状态流转和前后端协同

## 推荐亮点

最值得突出的亮点是：

**设计并实现了面向内容平台的轻量审核与治理闭环，打通“用户提交 - 关键词检测 - 人工审核 - 状态回写 - 前台展示”的完整流程。**

## 为什么是这个亮点

- 不是单纯做页面，而是完整业务链路
- 涉及数据模型设计，例如 `comments`、`review_tasks`
- 涉及状态流转，例如 `pending_review`、`approved`、`rejected`、`hidden`
- 涉及角色与权限控制，例如 `operator`、`reviewer`
- 涉及前后端联动，用户侧、审核侧、管理侧都要配合

这个点比“接了一个大模型接口”更像计算机项目，也更容易在面试里展开讲清楚。

## 代码落点

- 评论提交流程：[cloudfunctions/submitTopicComment/index.js](/C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/submitTopicComment/index.js)
- 审核处理流程：[cloudfunctions/reviewContent/index.js](/C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/reviewContent/index.js)
- 审核任务查询：[cloudfunctions/getReviewTasks/index.js](/C:/Users/冯宗林/WeChatProjects/miniprogram-14/cloudfunctions/getReviewTasks/index.js)
- 话题详情页评论入口：[pages/topic-detail/topic-detail.js](/C:/Users/冯宗林/WeChatProjects/miniprogram-14/pages/topic-detail/topic-detail.js)
- 审核中心页面：[pages/review-center/review-center.js](/C:/Users/冯宗林/WeChatProjects/miniprogram-14/pages/review-center/review-center.js)
- 权限控制：[utils/permission.js](/C:/Users/冯宗林/WeChatProjects/miniprogram-14/utils/permission.js)

## 简历写法

推荐写法：

- 独立完成小程序前后端主要开发，覆盖登录认证、资讯、答题、社区等核心业务。
- 设计并实现内容审核闭环，完成 `comments`、`review_tasks` 等数据模型及评论提交、关键词检测、人工审核、状态回写等服务端功能开发，打通“用户提交 - 审核处理 - 前台展示”流程。
- 开发话题、题库、题目、审核中心等管理模块，支持内容发布、题库维护与权限控制。

## 面试表达

如果老师追问“你的项目亮点是什么”，可以直接回答：

**这个项目最大的亮点不是算法创新，而是我把内容平台里比较完整的一条治理链路做出来了，包括评论数据建模、审核任务建模、状态流转、权限控制，以及用户侧和审核侧的前后端联动。**
