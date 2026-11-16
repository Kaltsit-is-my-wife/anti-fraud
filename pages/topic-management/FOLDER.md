# 话题管理页面目录

## 文件说明

- `topic-management.js` - 管理端话题编辑逻辑：加载列表、编辑、保存、防重复提交、封面与正文配图上传、删除话题
- `topic-management.wxml` - 页面结构：话题表单、封面区、正文配图区、话题列表、编辑/删除操作
- `topic-management.wxss` - 页面样式
- `topic-management.json` - 页面配置

## 功能说明

当前页面提供管理员的话题管理能力，支持：

- 创建和编辑话题，状态在 `draft` / `published` / `offline` 之间切换
- 上传或手动填写封面图
- 上传正文配图（最多 9 张），可填写图注、逐张移除；保存后写入 `topics.contentBlocks` 的 `image` 内容块
- 保存时防止重复提交，图片上传中禁止保存
- 删除话题，并同步清理该话题下的评论和审核任务

## 数据契约

`saveTopic` 入参：

```js
{
  id: string,            // 空串表示新建
  payload: {
    title, summary, contentText, coverImage, status, sort, startAt, endAt,
    relatedArticleIds: [], relatedVideoIds: [],
    contentImages: [{ imageUrl, caption }]   // 正文配图，最多 9 张
  }
}
```

- `contentText` 按空行拆分为 `text` 内容块。
- `contentImages` 传空数组表示清空配图；缺省（旧版调用方）表示沿用库内已有配图。
- 内容块最终顺序为：正文段落 → 配图 → `article_link` → `video_link` → 未知类型块，并统一重排 `sort`。

## 依赖说明

- 封面上传走 `topics/covers/`，配图上传走 `topics/content/`，均依赖当前微信云开发环境的云存储写权限；若存储未开放小程序端上传，`wx.cloud.uploadFile` 会返回 `-503002`。
- 页面权限依赖 `utils/permission.js` 的 `ensurePagePermission(this, 'admin')`；云函数侧 `saveTopic` / `getAdminTopicList` / `deleteTopic` 仍会自行校验 `isAdmin` / `operator`。

## 重要说明

- 状态选择器使用 `data.statusIndex` 预计算下标，WXML 里不要写 `statusOptions.indexOf(...)`（WXML 表达式不支持方法调用）。
- **每当所属代码发生变化时，必须对相应的文档进行更新操作。**
