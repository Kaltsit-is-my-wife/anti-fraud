# 视频详情页面目录

## 文件概览

- `video-detail.js`：视频详情逻辑，支持加载云端视频详情和内置视频详情。
- `video-detail.wxml`：视频详情结构。
- `video-detail.wxss`：视频详情样式。
- `video-detail.json`：页面配置。

## 当前能力

- 常规视频走 `getVideoDetail` 云函数读取。
- 当视频 ID 命中内置视频资源时，详情页直接本地组装并解析 `cloud://` 视频地址。
- 详情页支持视频播放以及关联文章、关联话题展示。
