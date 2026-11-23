# 云存储旧文件清理说明

- 适用项目：反诈卫士微信小程序
- 适用模块：视频管理
- 更新时间：2026-11-15

## 1. 为什么需要清理

视频和封面通过 `wx.cloud.uploadFile` 直传云存储。以下场景会产生不再被任何业务记录引用的旧文件：

- 管理员替换视频地址或封面后，旧文件仍保留在云存储
- 管理员删除草稿/已下线视频记录后，原视频和封面仍保留在云存储
- 上传成功但最终没有保存到 `videos` 集合的临时文件

这些文件不会自动过期，会持续占用云存储容量并产生费用。

## 2. 当前实现

```text
saveVideo（替换视频/封面）
deleteVideo（删除视频记录）
        ↓ 只登记，不删除
storage_cleanup_tasks（status=pending，eligibleAt=现在+7天）
        ↓
cleanupStorageFiles（dry-run / 实际删除）
        ↓ 先检查引用，再调用 cloud.deleteFile
微信云存储
```

关键约束：

- 小程序端不调用 `wx.cloud.deleteFile`，所有删除动作只在云函数中执行。
- `deleteVideo` 仍然只删除 `videos` 集合文档，不直接删除云存储文件。
- 旧文件先进入待清理队列，默认保留 7 天，给误操作、审核和缓存留出回退窗口。
- 小程序端调用默认 `dryRun: true`，只检查不删除；必须显式传 `dryRun: false` 才执行删除。定时触发器/云控制台默认也是 dry-run，只有配置环境变量 `STORAGE_CLEANUP_AUTO_DELETE=true` 后才默认执行实际删除。

## 3. 清理任务集合

集合名：`storage_cleanup_tasks`

该集合只供云函数读写，不应开放给小程序端直接查询或修改；建议在云开发控制台把集合权限设置为仅管理端可读写。

| 字段 | 说明 |
|---|---|
| `fileId` | `cloud://` 文件 ID |
| `fileType` | `video` / `cover` / `unknown` |
| `sourceCollection` | 来源集合，当前为 `videos` |
| `sourceField` | 来源字段，`videoUrl` / `coverImage` |
| `sourceId` | 来源视频文档 `_id` |
| `reason` | `replaced` / `record_deleted` |
| `status` | `pending` / `deleted` / `skipped_referenced` / `skipped_invalid` / `missing` / `failed` |
| `attempts` | 删除失败重试次数 |
| `eligibleAt` | 可执行清理的最早时间 |
| `lastError` | 最近一次失败原因 |
| `createdAt` / `updatedAt` / `checkedAt` / `deletedAt` | 时间戳 |

`saveVideo` 和 `deleteVideo` 在登记前会检查同一 `fileId` 是否已有 `pending` 任务，避免重复入队。

## 4. 引用检查范围

`cleanupStorageFiles` 删除前会检查以下集合和字段：

| 集合 | 字段 |
|---|---|
| `videos` | `videoUrl`、`coverImage` |
| `articles` | `coverImage` |
| `topics` | `coverImage` |
| `question_banks` | `coverImage` |
| `banners` | `image` |
| `users` | `avatarUrl` |
| `public_profiles` | `avatarUrl` |
| `posts` | `images`（数组） |
| `scam_reports` | `images`（数组） |

任一文件仍被上述字段引用时，任务标记为 `skipped_referenced`，不会删除。

安全规则：

- 任一引用查询失败（非“集合不存在”）时，本批次全部文件按“仍被引用”处理。
- 引用查询按 100 条分批拉取；累计超过 10000 条时视为无法确认，全部按“仍被引用”处理。
- 只处理 `cloud://` 文件 ID，HTTPS 外链不会删除。
- 删除失败最多重试 3 次，每次间隔 1 天；超过后标记 `failed`，需要人工处理。

## 5. 权限

`cleanupStorageFiles` 的调用身份分两种：

| 调用方式 | 规则 |
|---|---|
| 小程序端调用（有 OPENID） | `operator` / `isAdmin` 可以 dry-run；只有 `isAdmin` 且配置 `STORAGE_CLEANUP_ALLOW_REAL_DELETE=true` 时才可能执行 `dryRun: false` |
| 云开发控制台 / 定时触发器（无 OPENID） | 允许直接运行，属于运维入口；实际删除同样需要 `STORAGE_CLEANUP_ALLOW_REAL_DELETE=true` |

普通用户调用返回“无管理权限”。

> 当前引用检查尚未覆盖话题正文配图、文章富文本等字段，`STORAGE_CLEANUP_ALLOW_REAL_DELETE` 默认保持 `false`，实际删除默认关闭。

## 6. 在管理页使用

`pages/video-management` 底部新增“存储清理”面板：

1. `admin` / `operator` 点击“检查待清理文件”。
2. 页面调用 `cleanupStorageFiles({ dryRun: true, limit: 20 })`，显示待清理数量、仍被引用数量和前几个文件 ID。
3. 当前版本只开放检查，不显示“执行清理”按钮。
4. 引用检查补齐并配置 `STORAGE_CLEANUP_ALLOW_REAL_DELETE=true` 后，才可以恢复实际删除入口。

## 7. 在云开发控制台使用

云函数测试参数：

```json
{
  "dryRun": true,
  "limit": 20
}
```

确认无误后改成：

```json
{
  "dryRun": false,
  "limit": 20
}
```

但当前版本即使传 `dryRun: false`，只要没有配置 `STORAGE_CLEANUP_ALLOW_REAL_DELETE=true`，也会返回“引用检查尚未覆盖全部内容，暂不支持实际删除”。

## 8. 定时清理（可选）

当前没有在仓库中启用定时触发器，避免误删。需要自动清理时，可在云开发控制台为 `cleanupStorageFiles` 添加定时触发器，例如每天 03:00 执行一次。

定时触发器没有 OPENID，函数会按“云控制台/定时触发器”路径放行。但**定时触发器和云控制台默认仍然只做 dry-run**；要让它实际删除，需要给 `cleanupStorageFiles` 同时配置两个环境变量：

```text
STORAGE_CLEANUP_AUTO_DELETE=true
STORAGE_CLEANUP_ALLOW_REAL_DELETE=true
```

行为说明：

- 不配置或配置为非 `true`：无 OPENID 的调用默认 `dryRun: true`，只检查不删除。
- 只配置 `STORAGE_CLEANUP_AUTO_DELETE=true`：默认尝试实际删除，但会被 `STORAGE_CLEANUP_ALLOW_REAL_DELETE` 拒绝，返回“引用检查尚未覆盖全部内容，暂不支持实际删除”。
- 两个都配置为 `true`：无 OPENID 的调用默认 `dryRun: false`，会实际删除；此时在云控制台测试不要省略参数，先传 `{ "dryRun": true }` 预览。
- 小程序端调用不受 `AUTO_DELETE` 影响，仍然默认 dry-run；实际删除需要 `isAdmin` 且 `ALLOW_REAL_DELETE=true`。

启用自动删除前必须：

1. 先连续观察 dry-run 结果，确认引用检查覆盖了所有内容类型。
2. 确认 `storage_cleanup_tasks` 中的任务符合预期。
3. 首次定时执行后检查云存储和任务状态。
4. 如果要关闭自动删除，删除该环境变量并重新部署 `cleanupStorageFiles`。

## 9. 宽限期

`saveVideo`、`deleteVideo` 使用环境变量 `STORAGE_CLEANUP_GRACE_DAYS` 控制宽限期：

- 默认 `7` 天
- 允许范围 `1` 到 `30` 天
- 未配置时按 7 天处理

修改环境变量后需要重新部署 `saveVideo`、`deleteVideo`。

## 10. 历史遗留文件的一次性处理

清理队列只记录上线后发生的替换和删除；上线前已经存在的旧文件不会自动入队。建议做一次人工盘点：

1. 在云开发控制台存储中按 `videos/`、`video-covers/` 前缀查看文件。
2. 导出 `videos` 集合中的 `_id`、`videoUrl`、`coverImage`，与存储文件列表比对。
3. 对确认没有任何 `videos` 文档引用的文件，先备份文件 ID 清单。
4. 可以二选一：
   - 直接在云开发控制台删除确认无用的文件；
   - 或手工在 `storage_cleanup_tasks` 插入 `pending` 记录（`eligibleAt` 设为过去时间），再用 `cleanupStorageFiles` 的 dry-run/实际删除流程处理。
5. 处理前必须再次确认这些文件没有被文章、话题、题库、Banner、社区内容等复用。

云函数 SDK 没有“列出云存储全部文件”的能力，所以无法在 `cleanupStorageFiles` 中自动扫描历史孤立文件；这一步只能通过云开发控制台或额外的管理端脚本完成。

## 11. 尚未覆盖的情况

以下情况不会自动进入清理队列，需要人工在云开发控制台或后续扩展中处理：

- 上传成功但从未保存到 `videos` 集合的文件（例如上传后放弃保存、保存校验失败）。
- 话题正文配图 `topics.contentBlocks[].imageUrl`（当前只检查 `topics.coverImage`）。
- 被文章富文本 `content` 内嵌引用的文件（当前只检查 `articles.coverImage`）。
- 被 `products`、`notifications` 等其他内容类型引用、但未加入 `REFERENCE_FIELDS` 的文件。
- 云存储中历史遗留、无法从数据库反查出文件 ID 的孤立文件。

新增内容类型或文件字段时，必须同步修改：

```text
cloudfunctions/cleanupStorageFiles/index.js 的 REFERENCE_FIELDS
```

否则可能把仍被使用的文件误判为可删除。

## 12. 部署与验证

需要部署或重新部署的云函数：

```text
新增：cleanupStorageFiles
重新部署：getVideos、getAdminVideoList、saveVideo、deleteVideo
```

`cleanupStorageFiles/config.json` 已设置 `timeout: 60`，并保持 `triggers: []`（不自动定时执行）。如需定时清理，在云开发控制台添加触发器，或在 `config.json` 中补充 `triggers` 后重新部署。

建议索引（云开发控制台手动创建）：

- `videos`：`status` 升序 + `sort` 升序 + `publishedAt` 降序
- `videos`：`sort` 升序 + `updatedAt` 降序
- `storage_cleanup_tasks`：`status` 升序 + `eligibleAt` 升序；`fileId` 升序 + `status` 升序（用于入队去重）

验证步骤：

1. 管理员编辑一个视频，替换 `cloud://` 视频地址或封面 → 保存成功。
2. 检查 `storage_cleanup_tasks`：出现 `pending` 任务，`eligibleAt` 约等于当前时间 + 7 天。
3. 等待任务到期，或临时把 `eligibleAt` 改到过去。
4. 管理页点击“检查待清理文件” → 显示待清理数量，不删除。
5. **当前版本实际删除默认关闭**；配置 `STORAGE_CLEANUP_ALLOW_REAL_DELETE=true` 并恢复入口后，管理员点击“执行清理”才会删除文件，任务变为 `deleted`，`videos` 文档保持不变。
6. 如果文件仍被其他视频/文章/话题/题库/Banner/头像引用 → 任务变为 `skipped_referenced`，文件保留。
7. 普通用户调用 `cleanupStorageFiles` → 返回“无管理权限”。
8. `operator` 调用 `dryRun: false` → 返回“仅管理员可以执行实际删除”。
9. 删除草稿/已下线视频 → `videos` 文档被删除，`storage_cleanup_tasks` 出现对应任务，云存储文件不会立即删除。

## 13. 运维建议

- 正式环境建议先手动运行 dry-run，至少观察一个完整发布周期。
- 视频替换后保留 7 天再清理，避免审核、回滚和临时缓存问题。
- 每次扩大引用检查范围后，先 dry-run 验证，再执行实际删除。
- 定期检查 `storage_cleanup_tasks` 中 `failed` 和 `pending` 时间过长的任务。
- 快速验收看 [视频分页与存储清理简易测试（大白话版）](../guides/video-pagination-storage-cleanup-simple-test.md)，完整步骤看 [视频分页与存储清理测试说明](../guides/video-pagination-storage-cleanup-test.md)。
- 云存储容量和费用变化应纳入二期预算复核。
- `storage_cleanup_tasks` 会保留 `deleted` / `skipped_referenced` 等历史记录用于审计；数据量增长后，可按 `updatedAt` 手动清理 90 天前的历史任务。
- 当前没有实现分布式锁；避免多人同时执行“执行清理”，也不要让定时任务和手动清理同时运行。重复执行不会误删其他文件，但同一文件可能被记为 `missing` 或 `failed`。
