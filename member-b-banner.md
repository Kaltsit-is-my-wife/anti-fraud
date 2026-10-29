# 成员 B：Banner CMS 动态化

## 工作目标

把首页 Banner 从本地固定数据升级为可由 CMS `banners` 集合管理，同时保留可识别的本地降级能力。

## 建议分支

```text
feature/banner-cms
```

## 主要任务

### 第一阶段：新增云函数

- 新增 `cloudfunctions/getBanners/index.js`。
- 查询 `banners` 集合。
- 只返回 `status: true` 的 Banner。
- 按 `sort` 升序排列。
- 返回标题、描述、图标、图片、背景色、链接等展示字段。
- 对空集合、数据库异常和资源异常返回明确结果。

### 第二阶段：首页接入

- 修改 `pages/index/index.js` 的 `loadBanners()`，调用 `getBanners`。
- 复用 `utils/cloud.js` 解析 `cloud://` 图片地址。
- 复用 `utils/cache.js`，保持 Banner 缓存策略。
- 云函数失败时使用本地渐变 Banner。
- 云函数成功但返回空列表时，不应把旧缓存误当作最新结果。
- 校验 `link` 只能跳转到已注册的小程序页面。

## 依赖与边界

- 第二阶段依赖第一阶段的 `getBanners` 云函数。
- 不修改首页文章加载、文章缓存和本地文章示例逻辑。
- 不新增 Banner 管理页；运营数据继续通过 CMS 维护。
- 新增云函数后必须部署到与小程序相同的云环境。

## 验收标准

- 启用 Banner 可见。
- 禁用 Banner 不可见。
- `sort` 排序正确。
- `cloud://` 图片能够显示。
- HTTPS 图片能够显示。
- 无图片时背景色或渐变正常。
- 有效内部链接可以跳转。
- 无链接时点击不会报错。
- 云函数失败时首页仍可用，并明确使用了本地降级。
- 云端返回空列表时页面表现符合设计，不显示过期内容。

## 建议验证

```text
node --check cloudfunctions/getBanners/index.js
node --check pages/index/index.js
```

