# Agent 交接文档

- 更新日期：2026-11-23
- 仓库：反诈卫士微信小程序
- 当前分支：`main`
- 当前主线：`86a8c20 Merge pull request #10 from Kaltsit-is-my-wife/member-b`
- 远端状态：`main` 与 `origin/main` 同步，无开放 PR

## 1. 接手前先看

按顺序阅读：

1. [CLAUDE.md](../../CLAUDE.md)：当前实现事实、架构约束和发布流程，优先级最高
2. [README.md](../../README.md)：项目简介和文档入口
3. [docs/planning/pending-tests.md](../planning/pending-tests.md)：尚未完成的测试清单
4. [docs/planning/improvement-backlog.md](../planning/improvement-backlog.md)：待改进项 `IMP-001` ~ `IMP-009`
5. [docs/team-collaboration/](../team-collaboration/)：当前 A/B/C/D 分工

## 2. 用户约束

- **不要自动 commit**：只有用户在当前对话中明确要求提交时，才执行 `git commit`。
- **任何情况下不要 push**，包括 `git push --tags`、强制推送。
- 修改代码前先看 `git status`，不要覆盖用户或其他 agent 未提交的改动。
- 不要开启云存储实际删除，详见第 4 节。

## 3. 当前已完成

近期已合入 `main`：

- PR #9：A 的话题发布主链路
  - 正文配图 `contentImages`、图注、排序
  - 状态下拉修复
  - 评论事务与审核任务修复
  - Banner 本地降级图、`image/` 合并到 `images/`
- PR #11：C 的学习内容与视频收口
  - 视频分页
  - `cleanupStorageFiles` 与 `storage_cleanup_tasks`
  - 题库 P0：5/6 选项、发布状态隔离、分批查询
  - 题库转换工具、CloudBase 文档、测试文档
- PR #10：B 的文章评论审核
  - `createComment` 文章评论写 `pending_review`
  - 事务创建 `review_tasks`、回写 `reviewTaskId`
  - `getComments` 返回 `approved` + 历史 `published`
  - `getReviewTasks` / `reviewContent` 支持 `article_comment`
  - 审核中心展示文章评论

当前没有根目录裸文件，页面和云函数都在真实路径。

## 4. 当前风险与限制

### 存储清理实际删除默认关闭

`cleanupStorageFiles` 已支持引用检查和 `dryRun`，但引用扫描尚未覆盖：

- `topics.contentBlocks[].imageUrl`
- `articles.content` 富文本
- `products` / `notifications` 等其他集合

因此：

- 不要配置 `STORAGE_CLEANUP_ALLOW_REAL_DELETE=true`
- 管理页只保留 dry-run，不恢复“执行清理”入口
- 引用扫描补齐前，禁止在正式环境执行 `dryRun: false`

### 文章评论审核已通过，帖子评论链路跳过

- 文章评论 1–9 项已在真实环境验证（2026-11-23）：`pending_review`、`review_tasks`、`reviewTaskId`、通过/驳回/隐藏与 `getComments` 可见性。
- 回复通知已验证：待审核时不发通知，审核通过后只发 1 条，驳回/隐藏不发送。
- 话题评论风险展示已验证：命中「微信」时 `keywordHitLevel = medium`，审核中心显示中风险。
- 帖子评论审核改造代码已部署（`createComment`、`getReviewTasks`、`reviewContent`），但社区发帖入口 `createPost` 已停用且 `posts` 集合不存在，本轮跳过真实数据验证。
- 仍待验证：普通用户直接调用审核函数返回“无审核权限”；审核中心页面需重新编译。

### IMP-009 回复通知时序

文章评论已验证审核通过后发送、驳回不发送；帖子评论链路本轮跳过。见 `IMP-009`。

### 云函数 OPENID 守卫

`getReviewTasks`、`reviewContent`、`createComment` 已加空 OPENID 守卫：无 OPENID 直调分别返回“无审核权限”/“用户不存在”。其余读取当前用户的函数待审计，见 `IMP-010`。

### 其他待测

- 视频分页：需要 21 条以上已发布视频后补测
- 题库 P0：需要核对 `default_bank` / `bankIds` / `questionId` 并执行 `initQuestionBanks`
- 题库管理 UI：placeholder、答案/难度选择器、2–6 选项固定行
- 存储清理 P0：管理页 UI、`dryRun: false` 拦截、dry-run 不改任务状态、删除确认文案已通过；普通用户 / operator 权限待测；100+ 引用分页功能测试延期

完整清单见 [pending-tests.md](../planning/pending-tests.md)。

## 5. 架构速查

```text
pages/ + utils/ + images/
  → wx.cloud.callFunction
cloudfunctions/<name>/index.js
  → 云数据库 / 云存储 / Qwen
```

- 前端：原生微信小程序，无根目录 npm 工程
- 云函数：每个目录独立 `package.json`，独立部署
- 云环境：小程序、云函数、数据库、云存储必须一致
- 内容状态：文章 `status=1` 草稿 / `status=2` 已发布；评论 `pending_review` / `approved` / `rejected` / `hidden`

## 6. 常用验证命令

```bash
node --check pages/index/index.js
node --check cloudfunctions/createComment/index.js
git diff --name-only -- '*.js' | xargs -r -n1 node --check
git diff --check
```

云函数部署：微信开发者工具 → 右键云函数目录 → “上传并部署：云端安装依赖”。

## 7. 建议接手顺序

1. 运行 `git status`、`git log --oneline -5`，确认当前状态
2. 阅读 `pending-tests.md`，选一项开始验证
3. 涉及云函数时先确认目标环境，再部署
4. 测试结果写入 `pending-tests.md` 或 `CHANGELOG.md`
5. 修复后同步更新 `CHANGELOG.md`；架构或长期约束变化更新 `CLAUDE.md`
6. 不要自动 commit / push

## 8. 分工文档

- [成员 A：内容运营与社区治理](../team-collaboration/member-a-content-community.md)
- [成员 B：权限、审核与平台能力](../team-collaboration/member-b-permission-review.md)
- [成员 C：学习内容与视频收口](../team-collaboration/member-c-learning-video.md)
- [成员 D：审查、验收与弱代码编辑](../team-collaboration/member-d-review-acceptance.md)
