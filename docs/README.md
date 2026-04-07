# 文档导航

本项目当前文档按“当前有效 / 运维说明 / 历史归档 / 非产品资料”四类管理。

---

## 1. 当前有效文档

这些文档代表当前仍在使用、应优先维护的内容。

- `../README.md`
  项目总览、环境要求、部署入口、功能概况
- `../ARCHITECTURE.md`
  当前项目架构说明
- `phase2_development_plan.md`
  二期开发计划，当前最重要的产品规划文档
- `phase2_requirements.md`
  二期需求文档，用于后续拆任务和验收对齐
- `phase2_feature_description.md`
  二期功能描述，偏产品口径，不包含任务和技术细节
- `phase2_backlog.md`
  二期 backlog，按页面/云函数/数据表/审核与管理端拆分
- `phase2_task_split.md`
  二期任务拆分，按任务包、责任角色和人日估算组织
- `phase2_acceptance_checklist.md`
  二期验收清单，用于联调、提测和上线前检查
- `phase2_page_task_list.md`
  二期页面任务清单，按用户侧 / 管理侧页面拆分
- `phase2_cloud_function_task_list.md`
  二期云函数任务清单，按服务端职责拆分
- `phase2_data_model_design.md`
  二期数据模型设计稿，统一集合职责、字段命名和迁移口径
- `phase2_budget.md`
  二期预算简表，仅包含工具费和云服务费
- `phase2_video_resource_plan.md`
  二期视频资源方案，对比外部 HTTPS 直链与云存储两种做法
- `phase2_cloud_service_estimate.md`
  二期云服务费测算，按 20 条视频 / 5000 次播放的场景估算月成本
- `phase2_budget_calculation.md`
  二期费用测算，仅保留工具费和云服务费的计算结果
- `manual/README.md`
  使用手册与测试手册入口
- `../CMS使用文档.md`
  CMS 管理说明
- `../CMS使用文档-简洁版.md`
  CMS 快速说明
- `../cloudfunctions/database.md`
  云数据库设计说明
- `ai_image_guide.md`
  AI 图片识别能力当前说明与部署方法

---

## 2. 运维与部署说明

这些文档仍可参考，但更多是针对特定阶段或专项功能。

- `cloud_function_deployment.md`
  云函数部署问题处理说明
- `QUICK_DEPLOY.md`
  快速部署说明
- `clear_data_feature.md`
  清空用户数据功能说明
- `user_data_architecture.md`
  用户数据结构与同步策略说明

---

## 3. 历史归档文档

这些文档主要用于追溯旧版本设计，不应作为当前开发的主依据。

### v1.1 归档

- `archive/v1.1/v1.1_plan.md`
- `archive/v1.1/v1.1_achievements_design.md`
- `archive/v1.1/v1.1_implementation_guide.md`
- `archive/v1.1/v1.1_deployment_plan.md`

### v3 归档

- `archive/v3/v3_update_plan.md`
- `archive/v3/v3_implementation_guide.md`
- `archive/v3/v3_update_summary.md`
- `archive/v3/quiz_questions_seed.json`

说明：

- 这些文档保留用于回溯历史方案
- 当前开发优先以 `README.md`、`ARCHITECTURE.md`、`phase2_development_plan.md` 为准

---

## 4. 非产品资料

以下文件不属于项目功能文档主线，不建议混入研发文档体系：

- `../项目开发费用报账明细.md`
  项目费用记录

---

## 5. 文档维护原则

- 当前功能说明优先写入 `README.md`、`ARCHITECTURE.md` 或 `docs/` 主文档
- 阶段性排障、一次性修复记录不再长期保留在根目录
- 新版本规划统一写入 `docs/phase*_development_plan.md`
- 历史版本说明保留在 `docs/` 下，作为归档资料，不与当前计划混用
