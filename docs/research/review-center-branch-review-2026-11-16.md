# 成员 B 审核中心分支调研

- 日期：2026-11-16
- 分支：`member-b`
- 提交：`4f115ec Add files via upload`
- 基线：`a324bff`
- 结论：**当前分支不能直接合并上线。改动未进入真实运行路径，文章评论审核链路缺少核心实现。**

## 1. 文件位置错误

提交把 6 个文件放在仓库根目录：

| 根目录文件 | 实际归属 | 当前影响 |
|---|---|---|
| `article-detail.js` | `pages/article-detail/article-detail.js` | 小程序不编译，改动无效 |
| `community-post-detail.js` | `pages/community-post-detail/community-post-detail.js` | 小程序不编译，改动无效 |
| `index.js` | `cloudfunctions/getReviewTasks/index.js` | 云函数不部署，改动无效 |
| `review-center.js` | `pages/review-center/review-center.js` | 小程序不编译，改动无效 |
| `review-center.wxml` | `pages/review-center/review-center.wxml` | 小程序不编译，改动无效 |
| `胡璟旭_测试手册.md` | `docs/guides/` 或 `docs/team-collaboration/` | 根目录临时文档，位置不规范 |

根目录文件中的 `../../utils/...` 等相对路径在根目录无法解析，确认不会进入运行链路。

## 2. 文章评论审核链路缺失

| 文件 | 当前代码 | 问题 |
|---|---|---|
| `cloudfunctions/createComment/index.js` | 评论写入 `status: 'published'` | 评论直接发布，不进入审核 |
| `cloudfunctions/getComments/index.js` | 只查询 `status: 'published'` | 即使改成待审核，前台也查不到已通过评论 |
| `cloudfunctions/reviewContent/index.js` | 只支持 `topic_comment`、`feedback`、`scam_report` | 没有 `article_comment`，审核无法回写 |
| 根目录 `index.js` | 给 `getReviewTasks` 增加 `article_comment` 查询 | 没有任务来源，属于空支持 |

根目录 `index.js` 只改查询，不创建 `review_tasks`，所以文章评论仍然不会出现在审核中心。

## 3. 旧版本补丁覆盖风险

根目录 `review-center.js`、`review-center.wxml`、`index.js` 基于旧版本：

- 有 `article_comment` 支持
- 缺少当前版本已有的 `keywordHits`、`keywordHitLevel`、风险等级和命中关键词展示

如果整文件覆盖真实路径，会回退现有审核中心的关键词风险展示。必须手工合并，不能直接替换。

## 4. 测试手册与代码不一致

`胡璟旭_测试手册.md` 描述：

```text
createComment 写入 pending_review
事务创建 review_tasks
reviewContent 回写 comments.status
```

当前分支没有这些代码。手册中的路径 `C:\Users\p'c\Desktop\anti-fraud-main` 也说明它是对着另一份本地代码写的，不能直接作为本分支验收依据。

## 5. 提交可维护性问题

- 提交信息为 `Add files via upload`，无法看出改动范围
- 文件未按 `pages/`、`cloudfunctions/`、`docs/` 组织
- 没有 `CHANGELOG.md` 记录
- 没有部署说明和文件路径映射
- 测试手册停留在根目录

## 6. 最小修复清单

1. 页面补丁落到真实路径：
   - `article-detail.js` → `pages/article-detail/article-detail.js`
   - `community-post-detail.js` → `pages/community-post-detail/community-post-detail.js`
2. `review-center.js` / `review-center.wxml` 只合入 `article_comment` 相关改动，保留现有风险等级展示。
3. 根目录 `index.js` 的 `article_comment` 逻辑合并进 `cloudfunctions/getReviewTasks/index.js`，保留 `keywordHits` / `keywordHitLevel`。
4. 修改 `createComment`：
   - 评论写入 `status: 'pending_review'`
   - 事务创建 `review_tasks`
   - 回写 `reviewTaskId`
5. 修改 `getComments`：只返回 `approved` 和历史 `published`。
6. 修改 `reviewContent`：增加 `article_comment → comments` 状态回写。
7. 测试手册移到 `docs/guides/review-center-test.md` 或 `docs/team-collaboration/`。

## 7. 验收标准

- 普通用户发表文章评论和回复后，`comments.status = pending_review`
- 同时生成 `review_tasks`，并回写 `reviewTaskId`
- 审核中心能看到文章评论任务
- 通过/驳回/隐藏后 `comments.status` 正确回写
- 用户侧只显示 `approved` 和历史 `published`
- 审核中心现有风险等级、命中关键词展示不回退
- 普通用户直接调用审核函数返回“无审核权限”
