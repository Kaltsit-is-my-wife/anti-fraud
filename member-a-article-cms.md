# 成员 A：文章与 CMS 链路

## 工作目标

修复文章用户侧发布状态边界，并完成文章 CMS 发布链路的代码验收准备。

## 建议分支

```text
fix/article-publish-status
```

## 主要任务

- 修改 `cloudfunctions/getArticles/index.js`，只返回允许用户查看的已发布文章。
- 修改 `cloudfunctions/getArticleDetail/index.js`，阻止用户通过文章 ID 访问草稿或下架文章。
- 修改 `cloudfunctions/searchArticles/index.js`，搜索结果只包含已发布文章。
- 检查详情页的相关文章查询，避免草稿出现在相关推荐。
- 统一文章不存在、草稿、下架文章的返回结构和用户提示。
- 保持 CMS 管理方式不变，不新增小程序文章管理页。
- 更新根目录 `CHANGELOG.md`，记录问题场景、修改方案和验证结果。

## 依赖与边界

- 依赖 CMS 实际使用的状态值，当前文档约定为 `status = 1` 草稿、`status = 2` 已发布。
- 不与 Banner 或视频上传混合修改。
- 修改云函数返回结构时，检查首页、搜索页、详情页和相关推荐调用方。
- 代码合并后必须在目标云环境重新部署相关云函数。

## 验收标准

- 草稿文章不出现在首页列表。
- 草稿文章不出现在搜索结果。
- 已知草稿 ID 无法打开用户详情。
- 草稿不出现在相关文章。
- 已发布文章仍能正常出现在列表、搜索、详情和相关推荐。
- 云函数异常有明确错误返回，不使用成功形状的静默兜底。

## 验证命令与部署

```text
node --check cloudfunctions/getArticles/index.js
node --check cloudfunctions/getArticleDetail/index.js
node --check cloudfunctions/searchArticles/index.js
```

在微信开发者工具中部署：

```text
getArticles
getArticleDetail
searchArticles
```

