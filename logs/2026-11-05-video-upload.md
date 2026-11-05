# 视频上传无响应排查

- 日期：2026-11-05
- 分支/提交：test-and-change
- 环境：微信开发者工具 / 待补充真机
- 基础库版本：待补充
- 云环境：待补充
- 复现步骤：进入视频管理页 → 点击「选择视频」→ Windows 文件选择器弹出 → 选择视频并打开
- 预期结果：选择完成后显示“上传中...”并出现上传进度，成功后回填 `form.videoUrl`
- 实际结果：文件选择器关闭后没有任何后续反应，不显示“上传中”；随后日志显示 `choose-video:empty`，页面提示“未获取到视频文件，请换一个 MP4 视频重试”；云函数日志无记录（上传不经过云函数）

## 已加日志点

`pages/video-management/video-management.js` 中统一使用 `[video-upload]` 前缀，覆盖：

- `module:loaded`：页面模块加载时输出一次（WARN），用于确认运行的是带诊断日志的代码
- `choose-video:invoked`：点击事件是否进入函数，并输出 `uploadingVideo` / `uploadingCover` 当前状态（WARN）
- `choose-video:select-timeout`：`wx.chooseMedia` 10 秒未返回时输出（WARN）
- `choose-video:start` / `selected` / `empty` / `too-large` / `cancel` / `fail`
- 视频「选择视频」按钮曾在排查期间临时移除 `disabled`，定位完成后已恢复为 `disabled="{{uploadingVideo}}"`
- `upload-video:start` / `task-created` / `progress` / `heartbeat` / `callback-success` / `callback-fail` / `api-throw` / `success` / `fail`
- `choose-cover:*` / `upload-cover:*`
- `save-video:start` / `success` / `fail`

重点看：

1. 是否出现 `choose-video:selected`：判断 `wx.chooseMedia` 是否正常返回
2. 是否出现 `upload-video:task-created`：
   - 没有 → `wx.cloud.uploadFile` 调用阶段就异常
   - 有但 `hasOnProgressUpdate=false` → 上传任务对象异常
3. 是否出现 `upload-video:progress`：
   - 一直没有 → 文件没有真正开始上传
4. 是否出现 `upload-video:heartbeat`：
   - 每 10 秒一次，说明上传 Promise 长时间没有回调
5. 是否出现 `callback-success` / `callback-fail`：
   - 区分成功、明确失败、还是永远没有回调
6. `errMsg` / `errCode`：区分 timeout、权限不足、环境错误

## 先确认代码是否在运行

1. 在微信开发者工具中重新编译，确认当前打开的是 `pages/video-management/video-management`
2. 进入页面后，Console 应出现：
   ```text
   [video-upload] {"level":"WARN","stage":"module:loaded","page":"video-management"}
   ```
3. 如果连 `module:loaded` 都没有：
   - 运行的不是当前代码（旧编译缓存 / 真机体验版 / 另一个项目目录）
   - 或 Console 的 WARN 级别被过滤
   - 或看的是云函数日志，而不是客户端 Console
4. 如果出现 `module:loaded`，但点击「选择视频」没有 `choose-video:start`：
   - 按钮可能处于 `disabled="{{uploadingVideo}}"` 状态，文字显示“上传中...”
   - 或点击的不是视频管理页的按钮

## 结论

- 真机调试：选择视频、上传和进度显示均正常。
- 开发者工具（PC）：`wx.chooseMedia` 返回 `tempFilesLength: 0`，结果中包含 `failedCount`，`uploadVideo` 从未被调用。
- 已确认视频文件存在且大小合适，排除文件缺失、路径或超限问题。
- 根因：开发者工具对 `wx.chooseMedia({ mediaType: ['video'] })` 的本地视频选择支持不完整，选择器关闭后没有把文件导入模拟器临时目录。这是 DevTools 限制，不是业务代码、视频文件或云存储问题。
- 处理方式：
  - 开发者工具中改用「视频地址」手动填写 `cloud://` 或 HTTPS 地址，继续测试保存/发布；
  - 本地选择视频上传以真机调试为准；
  - 页面已增加 DevTools 专用提示：“开发者工具暂不支持本地视频选择，请用真机调试或手动填写视频地址”；
  - 已恢复视频按钮的 `disabled="{{uploadingVideo}}"`。
- 后续如需在开发者工具中直接选视频，可评估 `wx.chooseVideo` 作为 DevTools 专用回退，但需确认其时长上限是否影响“不限制时长”的约定。

## 关键日志

```text
[video-upload] {"level":"WARN","stage":"choose-video:invoked","uploadingVideo":false,"uploadingCover":false}
[video-upload] {"level":"WARN","stage":"choose-video:start"}
[video-upload] {"level":"INFO","stage":"choose-video:selected","resultKeys":["errMsg","failedCount","type","tempFiles"],"tempFilesLength":0,"fileKeys":null,"sizeType":"undefined"}
[video-upload] {"level":"WARN","stage":"choose-video:empty","resultKeys":["errMsg","failedCount","type","tempFiles"],"tempFilesLength":0}
```


## 分析

- 上传使用 `wx.cloud.uploadFile` 直传云存储，不经过 `getAdminVideoList` 或 `saveVideo` 云函数，因此云函数日志为空是正常的。
- 封面按钮可以进入并显示“上传中”，说明页面、日志函数和点击事件整体正常。
- 最新现象：视频选择器已经弹出，说明 `chooseVideo` 被调用；断点在 `wx.chooseMedia` 成功回调之后到 `uploadVideo` 之前。
- 可能原因：
  1. `wx.chooseMedia` 选择完成后成功回调没有触发或严重延迟
  2. 成功回调触发但 `tempFiles` 为空，`file` 取不到（现在会 toast 提示）
  3. 返回的视频元数据异常（如 `size`、`tempFilePath` 缺失）
  4. 选中的文件过大，`file.size > MAX_VIDEO_SIZE`，会 toast“视频不能超过 1GB”
- 日志新增字段：`resultKeys`、`tempFilesLength`、`fileKeys`、`sizeType`，用于确认返回结构。
- 暂未排除：文件大小、DevTools 模拟器超时、网络、云环境或存储权限。

## 结论与下一步

- 待复现并补充关键日志后填写。
- 如果是 `heartbeat` 持续但没有 `progress`，优先检查网络、云环境和开发者工具上传限制。
- 如果是 `callback-fail`，按 `errMsg` / `errCode` 区分 timeout 和权限问题。
