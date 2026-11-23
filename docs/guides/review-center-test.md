---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 1751f38ae547d18f85ce0c2c31c5c702_79938b17e03611f19919525400638852
    ReservedCode1: 9J4YL4FfkLa+unvWmtGIlAVx0vAyURBcBGmLNcgaoNy+KVHAcNKTnTErasF3GRwhHY5zM4iRusLaUNZDEmYBUu8bJqvVL4DeGu5nzH0g1rP0Dsp0ltXBua3sr/6uh+GyaM6YFeJPs0TJrpSi5e/4UK1BasEsaKu4gGtyzDMaZacmcjVwxDEL5n5Qwj4=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 1751f38ae547d18f85ce0c2c31c5c702_79938b17e03611f19919525400638852
    ReservedCode2: 9J4YL4FfkLa+unvWmtGIlAVx0vAyURBcBGmLNcgaoNy+KVHAcNKTnTErasF3GRwhHY5zM4iRusLaUNZDEmYBUu8bJqvVL4DeGu5nzH0g1rP0Dsp0ltXBua3sr/6uh+GyaM6YFeJPs0TJrpSi5e/4UK1BasEsaKu4gGtyzDMaZacmcjVwxDEL5n5Qwj4=
---

AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 1751f38ae547d18f85ce0c2c31c5c702_33c66b10e03311f18c5752540024e231
    ReservedCode1: vyaF98WBYn6Zhwwu3J2zY93kLO3jBFuqY/3HVOSULcdRZZN7oaXDrVEKuNCOyAs1E5HoGse6LAFFHALY9lKC007FN5jYsB3g3wNg55Gng1lA/Z0qFDQRW6P/6SvrUuLtbWYDgvhSW7c8FGdR3NGe/qHhJwN3DZvdVrciatSo6G0kIsAwNbuAbW/JSXQ=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 1751f38ae547d18f85ce0c2c31c5c702_33c66b10e03311f18c5752540024e231
    ReservedCode2: vyaF98WBYn6Zhwwu3J2zY93kLO3jBFuqY/3HVOSULcdRZZN7oaXDrVEKuNCOyAs1E5HoGse6LAFFHALY9lKC007FN5jYsB3g3wNg55Gng1lA/Z0qFDQRW6P/6SvrUuLtbWYDgvhSW7c8FGdR3NGe/qHhJwN3DZvdVrciatSo6G0kIsAwNbuAbW/JSXQ=
---

# 测试手册：P0-02 审核中心闭环（精简版）

- 项目：反诈卫士（当前仓库）
- 任务：成员B —— P0-02 审核中心闭环 + P0-03 权限与云环境基线
- 日期：2026-11-14
- 适用：代码合并 / 验收人员

---

> 注意：当前仓库尚未落地 `createComment` / `getComments` / `reviewContent` 的文章评论审核改动。本手册描述的是验收目标，不能当作已实现状态。

## 一、任务范围

将文章评论接入既有审核中心闭环：评论/反馈/举报统一进审核中心，审核通过/驳回/隐藏后回写源集合；核查权限口径与云环境基线。敏感词检测不属于 P0-02，相关代码已回退删除。

---

## 二、关键功能点

| # | 功能点 | 说明 |
|---|--------|------|
| 1 | 评论/反馈/举报进审核中心 | `createComment` 评论落库 `pending_review` 并事务创建 `review_tasks`；话题评论（submitTopicComment）、反馈（submitFeedback）、举报（createScamReport）审核链路此前已具备 |
| 2 | 通过/驳回/隐藏回写 | `reviewContent` 按 targetType 映射回写 `comments / feedback_records / scam_reports` 的 `status`，并记录审核人/时间/备注；已处理任务防重复 |
| 3 | 用户侧可见性 | `getComments` 过滤 `approved` + 历史 `published`；待审核/驳回/隐藏不可见 |
| 4 | 权限矩阵 | 管理+审核：isAdmin / operator；仅审核：reviewer；无权限：普通用户、未登录 |
| 5 | P0-03 环境基线 | 全部云函数 `cloud.init = DYNAMIC_CURRENT_ENV`；管理函数含 `hasAdminAccess`，审核函数含 `hasReviewPermission`；页面入口按角色显示 |

**状态口径**：`pending_review / approved / rejected / hidden` 四状态，源集合 `comments` 用 `status` 字段。

---

## 三、核心测试步骤

### 1. 文章评论进入审核中心
- 普通用户发表文章评论 → 云开发控制台核对：`comments.status = pending_review`、`reviewTaskId` 非空；`review_tasks` 新增 `targetType: article_comment` 任务（含提交人/原文）。
- 文章下**回复**（parentId 非空）同样创建审核任务进入待审核列表。

### 2. 审核操作与回写
- 审核员（reviewer）进入"我的 → 审核中心"：待审核列表展示类型/原文/提交人/时间；反馈任务含联系方式，举报任务含涉诈账号/渠道等信息。
- 对任务点"通过/驳回/隐藏"（驳回/隐藏未填说明会被拦截）：处理后核对源集合 `status = approved/rejected/hidden`，且 `reviewedBy / reviewerUid / reviewedAt / reviewReason` 与 `review_tasks` 同步更新；重复操作提示"审核任务已处理"。

### 3. 用户侧可见性
- 审核通过后普通用户刷新详情页可见；待审核/驳回/隐藏不可见；历史 `published` 旧评论继续显示。

### 4. 权限与越权校验
- 普通用户直接调用 `getReviewTasks` / `reviewContent` → 返回 `{ success:false, errMsg:'无审核权限' }`，不返回任务数据。
- 页面入口：普通用户无审核中心入口；reviewer 仅审核中心；operator / isAdmin 有管理+审核入口。

### 5. 评论提交提示
- 文章/帖子详情页提交评论成功 → Toast "评论已提交，审核通过后显示"（与话题评论链路一致）。

---

## 四、测试账号配置

| 账号 | `users` 集合配置 |
|------|------------------|
| 普通用户 | `roles: []`，`isAdmin: false` |
| 审核员 | `roles: ["reviewer"]` |
| 运营 | `roles: ["operator"]`（或 `isAdmin: true`） |

角色配置无管理页面，需在云开发控制台手改 `users` 文档 `roles` 字段。

---

## 五、部署注意

1. 改动云函数后必须"上传并部署：云端安装依赖"：`createComment`、`getComments`、`getReviewTasks`、`reviewContent`（验收链路另含 `submitTopicComment`、`submitFeedback`、`createScamReport`）。
2. 页面文件（review-center / article-detail / community-post-detail）随小程序代码包上传即可，无需部署云函数。
3. 线上现象与代码不符时，先确认云端已部署新版本——回复评论"妈妈"未进待审列表即为此类根因（本地四环节代码均正确，云端未部署导致）。

---

## 六、验收核对项

1. 待审核评论/反馈/举报可进入审核中心，展示提交人与原始内容。
2. 通过/驳回/隐藏正确回写源集合，并记录审核人/时间/备注。
3. 审核通过后用户侧可见，驳回/隐藏不可见，历史 published 兼容。
4. 越权调用被拒绝；页面入口按角色显示（reviewer 仅审核，operator/isAdmin 管理+审核）。
*（内容由AI生成，仅供参考）*
