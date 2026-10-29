# 文档导航

项目文档按用途分层，当前实现事实和架构约束优先参考根目录的
[CLAUDE.md](../CLAUDE.md)；本文件负责说明其他文档的位置和用途。

## 当前有效文档

- [二期开发计划](./planning/phase2_development_plan.md)：产品阶段规划和推进节奏
- [二期需求](./planning/phase2_requirements.md)：需求、范围和验收口径
- [二期功能描述](./planning/phase2_feature_description.md)：产品功能说明
- [二期 Backlog](./planning/phase2_backlog.md)：页面、云函数、数据和管理端任务
- [二期任务拆分](./planning/phase2_task_split.md)：任务包、角色和排期
- [二期验收清单](./planning/phase2_acceptance_checklist.md)：阶段联调和上线检查
- [二期页面任务清单](./planning/phase2_page_task_list.md)
- [二期云函数任务清单](./planning/phase2_cloud_function_task_list.md)
- [二期数据模型设计](./planning/phase2_data_model_design.md)
- [二期预算与成本](./planning/phase2_budget.md)
- [二期视频资源方案](./planning/phase2_video_resource_plan.md)

## 部署与运维

- [云函数部署说明](./operations/cloud_function_deployment.md)
- [快速部署说明](./operations/QUICK_DEPLOY.md)
- [清空用户数据功能说明](./operations/clear_data_feature.md)
- [用户数据架构](./operations/user_data_architecture.md)

## 开发与专项指南

- [AI 图片识别说明](./guides/ai_image_guide.md)
- [开发者交接手册](./guides/developer-handoff.md)
- [项目交接手册](./guides/project-handoff.md)
- [题库管理计划](./guides/question-bank-management-plan.md)
- [题库操作指南](./guides/question-bank-operation-guide.md)
- [题库重新部署清单](./guides/question-bank-redeploy-list.md)
- [题库导入样例](./guides/question-bank-import-sample.json)
- [话题与题库初始化](./guides/topic-and-question-bank-init.md)
- [话题发布测试](./guides/topic-publish-test.md)

## 调研与问题分析

- [性能问题调查](./research/performance-investigation-2026-04-11.md)
- [性能解决方案](./research/performance-solution-plan-2026-04-11.md)

## 历史归档

- [历史归档入口](./archive/README.md)

`archive/` 下的内容用于追溯历史方案，不作为当前实现依据。

## 协作资料

- 根目录 `member-a-article-cms.md`、`member-b-banner.md`、`member-c-video.md`、`member-d-support-and-acceptance.md` 是正式的多人协作分工文档，会纳入 Git 跟踪。
- `team-collaboration/acceptance-checklist.md` 是本地验收工作表，可能包含测试环境和账号信息，已加入 `.gitignore`，不会提交到仓库。

## 文档维护原则

- 当前实现、架构约束和发布事实写入根目录 [CLAUDE.md](../CLAUDE.md)。
- 产品规划放入 `planning/`，不能把规划描述成已实现功能。
- 部署、环境、数据维护说明放入 `operations/`。
- 可执行的开发、交接和专项操作说明放入 `guides/`。
- 调研、性能分析和问题定位材料放入 `research/`。
- 历史版本方案放入 `archive/`。
- 新增文档必须选择对应目录，并同步更新本导航。
