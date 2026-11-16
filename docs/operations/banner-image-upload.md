# 首页 Banner 图片上传与上线

适用版本：二期（社区与首页展示）

本说明解决一个问题：仓库里已经有了 Banner 图（`images/banners/`），但用户端首页轮播必须由云端 `banners` 集合驱动，图片需要先上传到云存储，再把地址写进集合。只改仓库文件不会自动出现在线上首页。

## 1. 仓库里已有的 Banner 图

| 文件 | 建议标题 | 建议描述 |
|---|---|---|
| `images/banners/banner-01-shuadan.jpg` | 识别刷单返利骗局 | 先看套路，再看风险点，避免被高回报话术带偏。 |
| `images/banners/banner-02-zhuanzhang.jpg` | 转账前先停一停 | 遇到催促、保密、核验截图这类要求，先确认真实身份。 |
| `images/banners/banner-03-kefu.jpg` | 识别冒充客服话术 | 退款、注销、征信修复这些高频套路，先核验平台官方渠道。 |
| `images/banners/banner-04-yishi.jpg` | 建立日常防骗意识 | 把反诈知识变成习惯，看到异常流程就能及时停下来。 |

4 张图规格统一为 900 × 537、JPEG、10–12 KB，画面左下角已压暗，页面会在其上叠加白色标题与描述，因此图片本身不含文字。

## 2. 上传到云存储

1. 微信开发者工具 → 云开发 → 存储 → 上传文件。
2. 目标目录建议 `banners/`，与小程序、云函数使用同一个云环境。
3. 上传完成后复制每个文件的 `cloud://` 文件 ID（点击文件可查看）。

也可以在开发者工具控制台用 `wx.cloud.uploadFile` 上传，但要注意：客户端直传不会产生云函数日志，失败原因只看客户端 Console。

## 3. 写入 `banners` 集合

在云开发控制台 → 数据库 → `banners` 集合逐条新增，字段如下（`status` 必须是布尔 `true`，`sort` 必须是数字）：

```json
{
  "title": "识别刷单返利骗局",
  "desc": "先看套路，再看风险点，避免被高回报话术带偏。",
  "image": "cloud://<环境ID>.xxxx/banners/banner-01-shuadan.jpg",
  "bgColor": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "link": "/pages/community/community",
  "sort": 1,
  "status": true
}
```

其余 3 条同理，`sort` 依次为 2、3、4。

字段约定：

| 字段 | 说明 |
|---|---|
| `title` | 必填，为空会被首页丢弃 |
| `desc` | 描述，可不填 |
| `icon` | 可选 Emoji，一般不需要（图里已有图形） |
| `image` | `cloud://` 文件 ID 或 HTTPS 地址；解析失败会回退到 `bgColor` 渐变 |
| `bgColor` | 无图或图片加载失败时的兜底背景 |
| `link` | 必须命中 `pages/index/index.js` 的 `REGISTERED_PAGES` 白名单 |
| `sort` | 数字，越小越靠前 |
| `status` | 布尔 `true` 才下发 |

## 4. 验收

1. `getBanners` 云函数已部署到同一云环境（未部署时首页会回落到 `HOME_BANNERS` 本地图，并提示“云端轮播暂不可用”）。
2. 清除 `index:banners:v2` 缓存，或等待 10 分钟 TTL 后切回首页。
3. 检查项：
   - 首页轮播出现 4 张图，标题与描述可读，图片不变形（`aspectFill`）。
   - 点击可跳到白名单内页面；未注册路径不跳转也不报错。
   - 把某条 `status` 改为 `false` 后，该条不再出现。
   - 把 `image` 改成无效 `cloud://` 后，该条回退到渐变背景，不出现破图。
   - 把全部记录停用后，首页显示“暂无轮播内容”空态。

## 5. 已知边界

- 没有小程序内 Banner 管理页、`saveBanner` 云函数和 Banner 媒体上传函数，运营只能通过 CMS / 云开发控制台维护 `banners`。
- `HOME_BANNERS` 只在云端不可用时作为降级展示，不是正式内容源；云端成功但返回空列表时首页进入空态，不会回落到本地图。
