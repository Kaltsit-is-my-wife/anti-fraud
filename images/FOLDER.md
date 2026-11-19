# 图片资源目录 (v1.2)

## 目录概览

```text
images/
├── banners/                首页轮播本地降级图
├── 问题已找到-修复方案/      排查与验收截图，仅供文档追溯，不参与小程序运行时
├── 反诈骗.png ...           TabBar 图标
└── FOLDER.md / README.md
```

> 历史遗留：仓库根目录曾经同时存在 `image/` 与 `images/` 两个图片目录。现已合并到本目录，根目录不再保留 `image/` 和 `image.png`（合并时已按 MD5 去重）。

## 文件概览

### TabBar 图标

- `反诈骗.png` - 应用图标
- `反诈骗 (1).png` - 应用选中图标
- `个人中心.png` - 个人中心图标
- `个人中心 (1).png` - 个人中心选中图标
- `ai-聊天-思考-copy.png` - AI聊天图标
- `ai-聊天-思考-copy (1).png` - AI聊天选中图标
- `社区.png` - 社区Tab图标（v3新增，当前与首页图标复用占位）
- `社区 (1).png` - 社区Tab选中图标（v3新增，当前与首页图标复用占位）
- `社区-激活.png` / `社区-激活-active.png` - 社区 Tab 实际使用的未选中/选中图标
- `答题.png` / `答题-active.png` - 答题 Tab 未选中/选中图标
- `quiz.png` / `quiz-active.png` - 答题旧址图标，当前未在 `app.json` 引用
- `README.md` - 图片资源说明文件

### 首页轮播图（`images/banners/`）

`pages/index/index.js` 的 `HOME_BANNERS` 在 `getBanners` 云函数不可用时用作降级轮播，这 4 张图为对应的本地背景图：

| 文件 | 对应话题 | 建议标题 |
|---|---|---|
| `banner-01-shuadan.jpg` | 刷单返利 | 识别刷单返利骗局 |
| `banner-02-zhuanzhang.jpg` | 转账风险 | 转账前先停一停 |
| `banner-03-kefu.jpg` | 冒充客服 | 识别冒充客服话术 |
| `banner-04-yishi.jpg` | 日常防骗 | 建立日常防骗意识 |

- 规格：900 × 537（约 670rpx × 400rpx 的两倍图），JPEG，单张 10–12 KB。
- 画面已预留左下角深色区域，供页面叠加白色标题与描述；图片本身不含文字，标题/描述由 `pages/index/index.wxml` 的 `slide-text` 渲染，改文案不需要改图。
- 正式投放仍走 CMS：图片上传到云存储后，把 `cloud://` 文件 ID 或 HTTPS 地址写入 `banners` 集合的 `image` 字段，步骤见 [docs/operations/banner-image-upload.md](../docs/operations/banner-image-upload.md)。

### 排查截图（`images/问题已找到-修复方案/`）

- `articles-list-01.png`、`articles-list-02.png`、`articles-list-03.png` - `articles` 集合在云开发数据管理页的列表截图，用于排查文章分类/标签问题。
- `chat-input-bar.png` - 聊天输入栏截图，用于排查输入区样式问题。
- 这些截图不参与小程序运行时，不要在小程序代码中引用。

## 功能说明

图片资源目录包含小程序使用的各种图像资源，包括图标、轮播图等。称号系统主要使用 Emoji 图标，在前端动态显示，无需额外的图片资源文件。

## 重要说明

- 小程序主包有体积限制，新增图片请先压缩；轮播图单张建议不超过 200 KB。
- 修改 `HOME_BANNERS` 或 `images/banners/` 后，需清除 `index:banners:v2` 缓存或等待 10 分钟 TTL 才能看到效果。
- **每当所属的代码发生变化时，必须对相应的文档进行更新操作！**
