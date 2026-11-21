# 视频分页与云存储旧文件清理测试说明

> 只想快速验收：看 [视频分页和旧文件清理简易测试（大白话版）](./video-pagination-storage-cleanup-simple-test.md)。

- 适用日期：2026-11-16
- 适用改动：视频列表分页（用户端/管理端）、视频旧云存储文件清理队列
- 适用对象：组长、验收人、后续开发者
- 关联文档：
  - [云存储旧文件清理说明](../operations/storage_cleanup.md)
  - [CHANGELOG](../../CHANGELOG.md) 2026-11-15 两条记录
  - [CLAUDE.md](../../CLAUDE.md) 视频章节

## 0. 测试目标

本次测试要确认三件事：

1. 用户端和管理端的视频列表都按页加载，不会因为超过 20 条而看不到后面的视频，也不会重复加载。
2. 替换视频/封面或删除视频记录后，旧云存储文件会进入 `storage_cleanup_tasks`，在宽限期后由 `cleanupStorageFiles` 安全清理。
3. 清理过程不会误删仍被其他内容引用的文件，权限和 dry-run 保护有效。

> 重要：实际清理会永久删除云存储文件。第一次验证必须使用测试环境、测试账号和可丢弃的测试文件。不要在正式环境直接执行 `dryRun: false`。

---

## 1. 测试前准备

### 1.1 环境和账号

- [ ] 使用微信开发者工具打开仓库根目录，确认 `project.config.json` 的 AppID 与当前云环境一致。
- [ ] 确认前端、云函数、云存储、数据库都在同一个云环境。
- [ ] 准备三个账号：
  - 普通用户：`users` 中没有 `isAdmin`，`roles` 不包含 `operator`。
  - operator：`roles` 包含 `"operator"`，`isAdmin` 不为 `true`。
  - 管理员：`users.isAdmin === true`。
- [ ] 每个账号切换后重新进入管理中心或重新编译，确认权限快照是最新的。
- [ ] 如果开发者工具不方便切换多个微信账号，可以在云开发控制台临时修改测试账号的 `isAdmin` / `roles` 字段，测试完成后恢复原值；不要修改真实用户权限。

### 1.2 部署云函数

在微信开发者工具中，对以下目录右键选择 **“上传并部署：云端安装依赖”**：

| 云函数 | 是否必须重新部署 | 用途 |
|---|---|---|
| `getVideos` | 是 | 用户端分页 |
| `getAdminVideoList` | 是 | 管理端分页 |
| `saveVideo` | 是 | 替换文件登记、`publishedAt` 保留 |
| `deleteVideo` | 是 | 删除记录登记 |
| `cleanupStorageFiles` | 是（新增） | 旧文件检查与删除 |

- [ ] `cleanupStorageFiles` 是新目录，确认已经部署，并且 `config.json` 的 `timeout: 60` 生效。
- [ ] `cleanupStorageFiles` 默认没有定时触发器（`triggers: []`），本次测试不需要开启。

### 1.3 创建数据库集合和索引

`storage_cleanup_tasks` 集合会由云函数自动创建。如果没有自动创建，在云开发控制台手动创建，权限设置为仅管理端可读写。

建议在云开发控制台 → 数据库 → 索引管理中添加：

| 集合 | 索引字段 |
|---|---|
| `videos` | `status` 升序、`sort` 升序、`publishedAt` 降序 |
| `videos` | `sort` 升序、`updatedAt` 降序 |
| `storage_cleanup_tasks` | `status` 升序、`eligibleAt` 升序 |
| `storage_cleanup_tasks` | `fileId` 升序、`status` 升序 |

索引不是小数据量测试的硬性前提，但建议提前建好，避免数据量增长后才暴露问题。

### 1.4 准备分页测试数据

测试视频列表分页，至少需要 **21 条已发布视频**；建议准备 23 条，便于看到第二页。

- [ ] 所有测试视频标题统一加 `[TEST]` 前缀，例如 `[TEST] 分页视频 01`。
- [ ] 如果当前 `videos` 中已经有超过 20 条已发布视频，可以直接复用，不必重复造数。
- [ ] 如果不足，使用管理员账号进入 `pages/video-management` 创建测试视频：
  - 标题：`[TEST] 分页视频 01` 到 `[TEST] 分页视频 23`
  - `videoUrl`：可播放的测试 HTTPS 地址，或测试用 `cloud://` 文件 ID
  - 状态：`published`
  - `sort`：01–23 分别填 1–23，便于核对排序
  - 封面可选，建议至少前几条填封面，便于确认封面显示
- [ ] 管理端分页使用同一批 `[TEST]` 视频即可；管理端会显示所有状态，所以草稿/已下线记录也可以计入 21 条。
- [ ] 如果云开发控制台支持复制文档，可以复制一条 `[TEST]` 视频，只修改标题、`sort` 和 `publishedAt`，快速凑够 21 条；不要复制正式内容或真实用户数据。

> 用户端第一页会额外合并 1 条内置演示视频，所以第一页看到的卡片数可能是“20 条云端视频 + 1 条内置演示视频”。不要把内置演示视频当成云端数据。

### 1.5 准备清理测试数据

建议准备 4 条清理测试视频和若干可丢弃的云存储文件：

| 测试记录 | 用途 | 初始状态 |
|---|---|---|
| `[TEST] 清理-替换` | 替换视频/封面，验证 replaced 任务 | `draft` |
| `[TEST] 清理-删除` | 删除记录，验证 record_deleted 任务 | `draft` |
| `[TEST] 清理-引用A` | 与引用B共用同一个封面或视频文件 | `draft` |
| `[TEST] 清理-引用B` | 保留对共用文件的引用 | `draft` |

准备步骤：

1. 用管理员账号在视频管理页上传测试视频和封面（真机选择上传），或先在云开发控制台上传测试文件，再把 `cloud://` File ID 填入管理页。
2. 每条测试记录至少准备：
   - 一个测试视频文件 ID
   - 一个测试封面文件 ID
3. 在测试记录表中记录每个文件的 File ID，例如：

```text
记录 A 视频：cloud://<env>/videos/test-cleanup-a.mp4
记录 A 封面：cloud://<env>/video-covers/test-cleanup-a.jpg
```

4. `[TEST] 清理-引用A` 和 `[TEST] 清理-引用B` 的 `coverImage` 填同一个测试封面文件 ID，用于验证清理时的引用保护。

### 1.6 备份与安全

- [ ] 测试前导出 `videos` 和 `storage_cleanup_tasks` 集合（云开发控制台支持导出）。
- [ ] 清理测试只使用标题带 `[TEST]` 的记录和专门准备的测试文件。
- [ ] 不要在正式环境执行实际删除；如果必须在正式环境验证，只使用已确认无用的测试文件，并先完整 dry-run。
- [ ] 记下测试前的云存储文件列表，便于比对删除结果。

---

## 2. 快速冒烟测试（约 10–15 分钟）

如果时间有限，先完成这 5 步，全部通过后再做详细测试：

1. 用户端打开视频列表，确认第一页能加载；向下滚动或点“加载更多”，确认能加载第二页。
2. 管理端打开视频管理，确认列表可以加载更多；编辑一条测试视频，确认保存后列表刷新。
3. 编辑 `[TEST] 清理-替换`，替换视频或封面；检查 `storage_cleanup_tasks` 出现 `pending` 任务。
4. 管理页点击“检查待清理文件”，确认只检查不删除；再用管理员执行一次清理（先把 `eligibleAt` 调整到过去），确认测试文件被删除、任务变为 `deleted`。
5. 普通用户调用 `cleanupStorageFiles`，确认返回“无管理权限”；operator 实际删除返回“仅管理员可以执行实际删除”。

---

## 3. 视频分页详细测试

### 3.1 用户端

入口：首页 → “视频学习”入口（`pages/video/video`）。

| 编号 | 测试项 | 操作步骤 | 预期结果 |
|---|---|---|---|
| V-PAGE-01 | 首屏加载 | 打开视频列表 | 显示加载状态；加载完成后显示第一页视频；不出现空白页 |
| V-PAGE-02 | 第一页数量 | 有至少 21 条已发布视频 | 第一页最多 20 条云端视频，另加 1 条内置演示视频 |
| V-PAGE-03 | 加载更多 | 向下滚动到底部，或点击“加载更多” | 追加第二页视频；已显示的视频不重复 |
| V-PAGE-04 | 末页状态 | 连续加载到最后一页 | 显示“没有更多了”；不再重复请求 |
| V-PAGE-05 | 内置演示视频 | 检查第一页和第二页 | 内置演示视频只在第一页出现，第二页不重复 |
| V-PAGE-06 | 下拉刷新 | 在列表顶部下拉 | 回到第一页；刷新后列表不重复、不丢失 |
| V-PAGE-07 | 从详情返回 | 第一页打开一个视频详情，返回 | 第一页会重新加载；列表仍正常 |
| V-PAGE-08 | 多页后返回 | 加载到第二页，打开详情再返回 | 列表保持第二页，不会强制回到第一页 |
| V-PAGE-09 | 排序 | 给测试视频设置不同 `sort` 和发布时间 | 按 `sort` 升序；`sort` 相同时按发布时间倒序 |
| V-PAGE-10 | 网络异常（可选） | 断网或临时调用错误云环境 | 页面有错误提示；重置加载失败时会切换到内置演示视频兜底 |

### 3.2 管理端

入口：管理中心 → 视频管理（`pages/video-management`）。

| 编号 | 测试项 | 操作步骤 | 预期结果 |
|---|---|---|---|
| A-PAGE-01 | 首屏加载 | 管理员打开视频管理 | 第一页最多 20 条，不显示内置演示视频 |
| A-PAGE-02 | 加载更多 | 滚动到底部或点击“加载更多” | 追加下一页；无重复 |
| A-PAGE-03 | 保存后刷新 | 编辑任意视频并保存 | 提示保存成功；列表重新加载第一页；修改后的数据可见 |
| A-PAGE-04 | 删除后刷新 | 删除一条草稿/已下线视频 | 提示删除成功；列表重新加载第一页；记录消失 |
| A-PAGE-05 | 分页不丢数据 | 准备 21 条以上测试视频，逐页核对标题 | 所有测试视频都能通过分页找到 |
| A-PAGE-06 | 权限 | 普通用户打开视频管理页 | 提示无管理权限并离开页面 |

### 3.3 分页边界

- [ ] 恰好 20 条已发布视频：第一页显示 20 条 + 内置演示视频，显示“没有更多了”。
- [ ] 恰好 21 条：第一页 20 条 + 内置演示视频，“加载更多”出现；第二页 1 条，不显示内置演示视频。
- [ ] 23 条以上：第二页正常加载，末页显示“没有更多了”。
- [ ] 连续快速点击“加载更多”不会产生重复请求或重复数据。
- [ ] 如果 `getVideos` 返回的数据没有 `hasMore` 字段，说明云函数没有重新部署，先回到 1.2 检查。

### 3.4 云函数返回检查

用户端调用：

```javascript
wx.cloud.callFunction({
  name: 'getVideos',
  data: { page: 1, pageSize: 20 }
}).then(res => console.log(res.result))
```

管理端调用（管理员账号）：

```javascript
wx.cloud.callFunction({
  name: 'getAdminVideoList',
  data: { page: 1, pageSize: 20 }
}).then(res => console.log(res.result))
```

预期返回结构：

```text
{
  success: true,
  data: {
    list: [...],
    page: 1,
    pageSize: 20,
    hasMore: true / false
  }
}
```

- [ ] `page`、`pageSize`、`hasMore` 都存在。
- [ ] 第二页的 `page` 为 2，`list` 不重复。
- [ ] 最后一页 `hasMore: false`。

---

## 4. 云存储旧文件清理详细测试

### 4.1 替换文件登记

| 编号 | 测试项 | 操作步骤 | 预期结果 |
|---|---|---|---|
| C-QUEUE-01 | 替换视频地址 | 编辑 `[TEST] 清理-替换`，把 `videoUrl` 改成另一个 `cloud://` 文件，保存 | 保存成功；`storage_cleanup_tasks` 新增一条 `fileType: video`、`sourceField: videoUrl`、`reason: replaced` 的任务 |
| C-QUEUE-02 | 替换封面 | 编辑同一条记录，替换 `coverImage`，保存 | 新增一条 `fileType: cover`、`sourceField: coverImage`、`reason: replaced` 的任务 |
| C-QUEUE-03 | 未变化不登记 | 只修改标题，不改变视频/封面，保存 | 不新增清理任务 |
| C-QUEUE-04 | HTTPS 不登记 | 把 `videoUrl` 或 `coverImage` 改为 HTTPS 地址，保存 | 旧 `cloud://` 文件会被登记；HTTPS 地址本身不会进入队列 |

检查任务字段：

```text
fileId         旧文件 ID
fileType       video / cover
sourceCollection videos
sourceField    videoUrl / coverImage
sourceId       视频文档 _id
reason         replaced
status         pending
attempts       0
eligibleAt     当前时间 + 7 天（默认）
```

### 4.2 删除记录登记

| 编号 | 测试项 | 操作步骤 | 预期结果 |
|---|---|---|---|
| C-DEL-01 | 删除草稿视频 | 删除 `[TEST] 清理-删除` 记录 | `videos` 文档被删除；`storage_cleanup_tasks` 新增 video/cover 任务；云存储文件仍然存在 |
| C-DEL-02 | 已发布视频不可删 | 对一条 `published` 测试视频点击删除 | 提示“已发布视频不能删除，请先下线”；不产生删除任务 |
| C-DEL-03 | 删除后不立即删文件 | 删除成功后立即查看云存储 | 文件仍然存在；只有执行 `cleanupStorageFiles` 后才可能删除 |

### 4.3 dry-run 检查

先让测试任务进入可清理状态：

1. 在云开发控制台 → 数据库 → `storage_cleanup_tasks` 找到本次测试任务。
2. 把 `eligibleAt` 改为一个过去的时间（测试环境专用），例如 `2026-01-01T00:00:00.000Z`。
3. 如果控制台无法编辑日期字段，可删除该测试任务，然后手工新增一条相同 `fileId`、`status: pending`、`eligibleAt` 为过去时间的记录。**只对测试文件这样做。**

然后：

| 编号 | 测试项 | 操作步骤 | 预期结果 |
|---|---|---|---|
| C-DRY-01 | 管理页检查 | 管理员进入视频管理 → 存储清理 → 点击“检查待清理文件” | 显示待清理数量和仍被引用数量；云存储文件没有减少 |
| C-DRY-02 | 默认 dry-run | DevTools 控制台调用 `cleanupStorageFiles`，不传 `dryRun` | 仍为 dry-run，只返回候选文件，不删除 |
| C-DRY-03 | 明确 dry-run | 调用 `{ dryRun: true, limit: 20 }` | 同 C-DRY-02；响应包含 `candidateFileIds` |
| C-DRY-04 | 任务状态 | 检查 dry-run 后的任务 | 任务仍为 `pending`；文件仍在 |

控制台调用示例：

```javascript
wx.cloud.callFunction({
  name: 'cleanupStorageFiles',
  data: { dryRun: true, limit: 20 }
}).then(res => console.log(res.result))
```

### 4.4 实际删除

> 只在测试环境执行，且只删除测试文件。

| 编号 | 测试项 | 操作步骤 | 预期结果 |
|---|---|---|---|
| C-DEL-04 | 管理员执行 | 管理员先点击“检查待清理文件”，再点击“执行清理”并确认 | 候选文件被删除；任务变为 `deleted`；`deletedAt` 写入 |
| C-DEL-05 | 返回字段 | 查看 `cleanupStorageFiles` 返回 | 包含 `deletedCount`、`failedCount`、`missingCount`、`referencedCount`、`hasMore` |
| C-DEL-06 | 分批处理 | 候选任务超过 20 个时，先检查再执行，重复操作 | 返回 `hasMore: true`；再次检查/执行可继续处理 |
| C-DEL-07 | 文件不存在 | 手工删除一个待清理文件后再执行 | 任务变为 `missing`（如果云存储返回的错误信息无法识别，则进入 `failed` 重试流程），不阻塞其他文件 |
| C-DEL-08 | 删除失败重试 | 模拟失败（可选） | 任务 `attempts` 增加；未超过 3 次时回到 `pending` 并延后 1 天 |

DevTools 控制台实际执行示例（管理员账号）：

```javascript
wx.cloud.callFunction({
  name: 'cleanupStorageFiles',
  data: { dryRun: false, limit: 20 }
}).then(res => console.log(res.result))
```

模拟失败（可选）：复制一条测试任务，把 `fileId` 改成一个不存在的 `cloud://` 文件 ID，并让 `eligibleAt` 到期；执行后观察 `attempts` 和任务状态。测试完成后删除这条模拟任务。

### 4.5 引用保护

| 编号 | 测试项 | 操作步骤 | 预期结果 |
|---|---|---|---|
| C-REF-01 | 共用封面 | `[TEST] 清理-引用A` 和 `[TEST] 清理-引用B` 使用同一个封面文件 | 两个视频都能正常显示该封面 |
| C-REF-02 | 替换 A 的封面 | 只替换 A 的封面，使旧共用封面进入队列 | 任务 `pending`；旧封面仍存在 |
| C-REF-03 | dry-run 检查引用 | 让任务可清理后执行 dry-run | 旧封面被计入“仍被引用”，不出现在候选列表 |
| C-REF-04 | 实际清理 | 管理员执行实际清理 | 旧封面不被删除；任务变为 `skipped_referenced`；B 的封面正常 |
| C-REF-05 | 解除引用后 | 删除 B（或替换 B 的封面）后再清理 | 旧封面不再被引用，可在后续任务中被删除 |

### 4.6 权限测试

| 编号 | 测试项 | 操作步骤 | 预期结果 |
|---|---|---|---|
| C-PERM-01 | 普通用户调用 | 普通账号在 DevTools 控制台调用 `cleanupStorageFiles({ dryRun: true })` | `success: false`，`errMsg` 为“无管理权限” |
| C-PERM-02 | operator 检查 | operator 账号在管理页点击“检查待清理文件” | 可以检查；看不到“执行清理”按钮；页面提示实际删除仅限管理员 |
| C-PERM-03 | operator 实际删除 | operator 在控制台调用 `{ dryRun: false }` | `success: false`，`errMsg` 为“仅管理员可以执行实际删除” |
| C-PERM-04 | 管理员实际删除 | 管理员账号执行实际删除 | 成功；任务和文件状态符合预期 |
| C-PERM-05 | 普通用户管理页 | 普通账号打开视频管理页 | 被提示无管理权限并离开 |

普通用户/operator 控制台调用示例：

```javascript
wx.cloud.callFunction({
  name: 'cleanupStorageFiles',
  data: { dryRun: false, limit: 20 }
}).then(res => console.log(res.result))
```

### 4.7 清理相关边界

- [ ] `storage_cleanup_tasks` 中的 `eligibleAt` 还没到期时，检查结果不包含该文件。
- [ ] 旧文件是 HTTPS 地址时，不会进入队列，也不会被 `cloud.deleteFile` 处理。
- [ ] `storage_cleanup_tasks` 集合不存在时，云函数应能正常返回空结果或提示；不能影响视频列表。
- [ ] 不在同一时间由多人执行实际清理，也不要在定时任务和手动清理同时运行时重复操作。
- [ ] 清理函数超时时间已设置为 60 秒；如果处理 50 个文件仍然超时，减少 `limit` 后重试。

### 4.8 补充验证 `saveVideo` 修复

| 编号 | 测试项 | 操作步骤 | 预期结果 |
|---|---|---|---|
| C-SAVE-01 | 编辑不存在的视频 | 管理员在控制台调用 `saveVideo`，传一个不存在的 `id` 和合法 `payload` | 返回 `success: false`，`errMsg` 为“视频不存在或已删除” |
| C-SAVE-02 | 保留发布时间 | 编辑一条已发布视频，只改标题并保存 | `publishedAt` 不变；视频不会因为编辑而跳到发布时间最新位置 |
| C-SAVE-03 | 重新发布 | 把一条视频改为 `offline`，再改回 `published` | 重新发布时写入新的 `publishedAt` |

控制台调用示例：

```javascript
wx.cloud.callFunction({
  name: 'saveVideo',
  data: {
    id: '不存在的测试ID',
    payload: {
      title: '测试',
      videoUrl: 'https://example.com/test.mp4',
      status: 'draft'
    }
  }
}).then(res => console.log(res.result))
```

### 4.9 可选：定时自动删除（高级）

如果确实要验证定时触发器/自动删除：

1. 只在测试环境给 `cleanupStorageFiles` 配置环境变量 `STORAGE_CLEANUP_AUTO_DELETE=true`，重新部署。
2. 在云开发控制台用云函数测试调用（无 OPENID），不传 `dryRun`，确认会执行实际删除。
3. 验证完成后删除该环境变量并重新部署，避免测试环境之外误删。

如果不需要自动清理，跳过本节，保持默认 `triggers: []` 和空环境变量。

---

## 5. 测试记录表

复制下表到本地验收文档，逐项填写：

| 编号 | 测试项 | 结果（通过/失败/跳过） | 实际结果/截图 | 备注 |
|---|---|---|---|---|
| V-PAGE-01 | 用户端首屏加载 |  |  |  |
| V-PAGE-02 | 用户端第一页数量 |  |  |  |
| V-PAGE-03 | 用户端加载更多 |  |  |  |
| V-PAGE-04 | 用户端末页状态 |  |  |  |
| V-PAGE-05 | 内置演示视频不重复 |  |  |  |
| V-PAGE-06 | 下拉刷新 |  |  |  |
| V-PAGE-07 | 详情返回 |  |  |  |
| V-PAGE-08 | 多页后返回 |  |  |  |
| V-PAGE-09 | 排序 |  |  |  |
| V-PAGE-10 | 网络异常兜底（可选） |  |  |  |
| V-PAGE-11 | getVideos 返回结构 |  |  |  |
| A-PAGE-01 | 管理端首屏 |  |  |  |
| A-PAGE-02 | 管理端加载更多 |  |  |  |
| A-PAGE-03 | 保存后刷新 |  |  |  |
| A-PAGE-04 | 删除后刷新 |  |  |  |
| A-PAGE-05 | 分页不丢数据 |  |  |  |
| A-PAGE-06 | 普通用户管理页拒绝 |  |  |  |
| A-PAGE-07 | getAdminVideoList 返回结构 |  |  |  |
| C-QUEUE-01 | 替换视频登记 |  |  |  |
| C-QUEUE-02 | 替换封面登记 |  |  |  |
| C-QUEUE-03 | 未变化不登记 |  |  |  |
| C-QUEUE-04 | HTTPS 不登记 |  |  |  |
| C-DEL-01 | 删除记录登记 |  |  |  |
| C-DEL-02 | 已发布不可删 |  |  |  |
| C-DEL-03 | 删除后文件保留 |  |  |  |
| C-DRY-01 | 管理页 dry-run |  |  |  |
| C-DRY-02 | 默认 dry-run |  |  |  |
| C-DRY-03 | 明确 dry-run |  |  |  |
| C-DEL-04 | 管理员实际删除 |  |  |  |
| C-DEL-05 | 返回字段 |  |  |  |
| C-DEL-06 | 分批处理 |  |  |  |
| C-DEL-07 | 文件不存在 |  |  |  |
| C-DEL-08 | 删除失败重试（可选） |  |  |  |
| C-REF-01 | 共用封面 |  |  |  |
| C-REF-02 | 替换 A 封面 |  |  |  |
| C-REF-03 | dry-run 引用检查 |  |  |  |
| C-REF-04 | 实际清理跳过引用 |  |  |  |
| C-REF-05 | 解除引用后清理 |  |  |  |
| C-PERM-01 | 普通用户拒绝 |  |  |  |
| C-PERM-02 | operator 只能检查 |  |  |  |
| C-PERM-03 | operator 实际删除拒绝 |  |  |  |
| C-PERM-04 | 管理员实际删除 |  |  |  |
| C-PERM-05 | 普通用户管理页拒绝 |  |  |  |
| C-SAVE-01 | 不存在 ID 报错 |  |  |  |
| C-SAVE-02 | 保留 publishedAt |  |  |  |
| C-SAVE-03 | 重新发布更新时间 |  |  |  |

---

## 6. 通过标准

本次测试至少满足以下条件才算通过：

- [ ] V-PAGE-01 到 V-PAGE-09、V-PAGE-11 全部通过。
- [ ] A-PAGE-01 到 A-PAGE-05、A-PAGE-07 全部通过。
- [ ] C-QUEUE-01、C-QUEUE-02、C-QUEUE-03 全部通过。
- [ ] C-DEL-01、C-DEL-02、C-DEL-03 全部通过。
- [ ] C-DRY-01、C-DRY-02、C-DRY-03 全部通过，且 dry-run 没有删除任何文件。
- [ ] C-DEL-04、C-DEL-05 全部通过，且只删除了测试文件。
- [ ] C-REF-01 到 C-REF-05 至少验证通过 C-REF-04：被引用文件不会被删除。
- [ ] C-PERM-01 到 C-PERM-05 全部通过。
- [ ] C-SAVE-01、C-SAVE-02 通过。
- [ ] 没有出现误删、重复加载、权限绕过或未处理的控制台错误。

---

## 7. 常见问题排查

| 现象 | 可能原因 | 处理 |
|---|---|---|
| 用户端第一页仍只显示旧数量，没有“加载更多” | `getVideos` 没有重新部署 | 重新部署 `getVideos`，清理开发者工具缓存后重试 |
| 管理端列表没有分页 | `getAdminVideoList` 没有重新部署 | 重新部署 `getAdminVideoList` |
| 点击“检查待清理文件”提示未部署 | `cleanupStorageFiles` 未部署 | 部署新云函数，确认目录名和云环境一致 |
| 检查结果一直是 0 | 任务还在 7 天宽限期内，或任务未创建 | 检查 `storage_cleanup_tasks`；测试环境可把 `eligibleAt` 调到过去；确认替换/删除操作确实改了 `cloud://` 文件 |
| 已把 `eligibleAt` 调到过去但仍不出现 | `eligibleAt` 被保存成字符串，和查询使用的日期类型不匹配 | 在控制台把该字段保存为日期类型；或删除测试任务后手工新增 `eligibleAt` 为 Date 类型的记录 |
| 任务状态是 `skipped_referenced` | 文件仍被其他视频/文章/话题/题库/Banner/社区内容引用 | 先解除引用；确认没有误把共用文件当成废弃文件 |
| 任务状态是 `failed` | `cloud.deleteFile` 失败、网络问题、文件 ID 异常 | 查看任务 `lastError` 和云函数日志；最多重试 3 次后会停在 `failed` |
| 管理员执行删除仍提示无权限 | 当前账号 `isAdmin` 不是布尔 `true` | 在 `users` 集合确认权限字段类型和值 |
| operator 看到“执行清理”按钮 | 前端权限快照过期或账号实际有管理员权限 | 重新登录/重新进入页面；检查 `users.isAdmin` |
| 编辑已发布视频后排序变了 | `saveVideo` 没有重新部署 | 重新部署 `saveVideo`；确认 `publishedAt` 保留逻辑生效 |
| 删除草稿视频后文件立刻消失 | 运行的不是本次代码或调用了其他清理逻辑 | 检查 `deleteVideo` 是否仍只删除文档；确认没有额外的即时删除代码 |
| 分页出现重复或遗漏 | 排序字段不稳定、数据在测试期间被新增/删除 | 固定 `sort` 和发布时间后重试；检查组合索引是否生效 |

---

## 8. 测试数据清理

测试完成后：

1. 把标题带 `[TEST]` 的已发布视频先改为 `offline`，再删除记录。
2. 删除 `storage_cleanup_tasks` 中本次测试产生的任务（可按 `sourceId` 或 `fileId` 识别）。
3. 在云开发控制台删除仍然残留的测试云存储文件。
4. 如果临时设置过 `STORAGE_CLEANUP_AUTO_DELETE=true`，删除该环境变量并重新部署 `cleanupStorageFiles`。
5. 保留 `videos` 和 `storage_cleanup_tasks` 的导出备份，按团队规定归档或删除。
6. 在 `CHANGELOG.md` 或本地验收记录中填写测试环境、账号角色、测试数据和遗留问题；不要把本地验收表提交到 Git（该文件已被 `.gitignore` 忽略）。

---

## 9. 测试结论模板

```text
测试环境：
测试日期：
测试账号角色：普通用户 / operator / 管理员
部署的云函数：getVideos、getAdminVideoList、saveVideo、deleteVideo、cleanupStorageFiles
测试数据：23 条 [TEST] 视频、4 条清理测试记录

通过项：
失败项：
未执行项：
发现的遗留问题：
是否需要回滚：
验收人：
```

---

## 10. 相关文档

- [云存储旧文件清理说明](../operations/storage_cleanup.md)
- [开发者交接手册](./developer-handoff.md)
- [CLAUDE.md](../../CLAUDE.md) 视频章节
- [CHANGELOG.md](../../CHANGELOG.md) 2026-11-15 两条记录
