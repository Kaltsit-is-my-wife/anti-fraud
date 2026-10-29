# 反诈卫士

大学生反诈骗教育微信小程序。

当前代码基于微信小程序原生框架 + 微信云开发，已具备资讯、AI 助手、趣味答题、社区、积分、成就、站内消息等能力；下一阶段产品规划见二期开发计划。

---

## 项目定位

`反诈卫士` 面向大学生用户，核心目标是把反诈骗内容做成可学习、可互动、可持续运营的小程序产品。

当前版本重点能力：

- 反诈资讯浏览与分类筛选
- AI 反诈问答与图片分析
- 学生认证、签到、积分、成就、称号
- 趣味答题、排行榜、答题奖励
- 社区帖子、评论、关注、站内消息
- 诈骗反馈与积分商城基础能力

---

## 当前状态

当前代码主线仍以已实现的 v3 能力为主。

后续产品演进以二期计划为准：

- [二期开发计划](./docs/planning/phase2_development_plan.md)

二期已确认方向：

- 资讯升级为图文文章
- 社区升级为“官方热点话题 + 用户讨论”
- 增加关键词审核与人工审核
- 新增反诈视频播放
- 新增题库与题目管理能力

---

## 技术栈

- 前端：微信小程序原生框架
- 后端：微信云开发 / 云函数（Node.js）
- 数据：微信云数据库
- AI：通义千问（Qwen）

---

## 快速开始

### 1. 配置小程序

修改 `project.config.json` 中的 `appid`。

### 2. 初始化云开发

`app.js` 当前使用项目绑定的默认云环境：

```javascript
wx.cloud.init({
  traceUser: true
})
```

### 3. 配置 AI 环境变量

在 `cloudfunctions/aiChat/config.json` 或云函数环境变量中配置：

```json
{
  "QWEN_API_KEY": "sk-your-api-key-here",
  "QWEN_MODEL": "qwen-vl-plus"
}
```

### 4. 部署云函数

在微信开发者工具中，右键对应云函数目录，选择：

- `上传并部署：云端安装依赖`

云函数部署、数据库结构和专项配置请直接查看下方文档导航，不再在 README 中重复维护细节。

---

## 文档导航

### 当前有效文档

- [文档导航](./docs/README.md)
- [项目架构](./ARCHITECTURE.md)
- [二期开发计划](./docs/planning/phase2_development_plan.md)
- [二期功能描述](./docs/planning/phase2_feature_description.md)
- [二期需求文档](./docs/planning/phase2_requirements.md)
- [二期 Backlog](./docs/planning/phase2_backlog.md)
- [二期任务拆分](./docs/planning/phase2_task_split.md)
- [二期验收清单](./docs/planning/phase2_acceptance_checklist.md)
- [AI 图片识别说明](./docs/guides/ai_image_guide.md)
- [数据库设计](./cloudfunctions/database.md)
- [CMS 使用文档](./CMS使用文档.md)
- [CMS 使用文档-简洁版](./CMS使用文档-简洁版.md)

### 运维与部署文档

- [云函数部署说明](./docs/operations/cloud_function_deployment.md)
- [快速部署说明](./docs/operations/QUICK_DEPLOY.md)
- [用户数据架构](./docs/operations/user_data_architecture.md)
- [清空用户数据功能说明](./docs/operations/clear_data_feature.md)

### 历史归档

- [历史归档入口](./docs/archive/README.md)

---

## 目录结构

```text
miniprogram-14/
├── app.js
├── app.json
├── pages/
├── cloudfunctions/
├── utils/
├── images/
└── docs/
```

---

## 说明

- 项目记忆、当前实现事实、架构约束和发布流程统一优先参考 [`CLAUDE.md`](./CLAUDE.md)。
- `AGENTS.md` 和 `ARCHITECTURE.md` 保留作历史/补充说明；如与代码或 `CLAUDE.md` 冲突，以 `CLAUDE.md` 和当前代码为准。
- `README.md` 负责项目简介、快速开始和文档导航，不重复维护详细实现记忆。
- 产品规划以 [`docs/planning/phase2_development_plan.md`](./docs/planning/phase2_development_plan.md) 为准，但规划内容不代表当前已经实现或部署。
- 历史版本文档已迁入 `docs/archive/`
- 一次性排障与临时修复记录不再作为长期文档保留
