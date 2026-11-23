# 文档导航

项目文档按用途分层，当前实现事实和架构约束优先参考根目录的
[CLAUDE.md](../CLAUDE.md)；本文件负责说明其他文档的位置和用途。

## 当前有效文档

- [待改进项 Backlog](./planning/improvement-backlog.md)：当前阶段的产品、体验、技术债、安全和运维改进项

### 历史二期规划归档

以下二期规划文档已归档到 `archive/phase2-planning/`，仅用于追溯，不作为当前开发依据：

- [二期开发计划](./archive/phase2-planning/phase2_development_plan.md)
- [二期需求](./archive/phase2-planning/phase2_requirements.md)
- [二期功能描述](./archive/phase2-planning/phase2_feature_description.md)
- [二期 Backlog](./archive/phase2-planning/phase2_backlog.md)
- [二期任务拆分](./archive/phase2-planning/phase2_task_split.md)
- [二期验收清单](./archive/phase2-planning/phase2_acceptance_checklist.md)
- [二期页面任务清单](./archive/phase2-planning/phase2_page_task_list.md)
- [二期云函数任务清单](./archive/phase2-planning/phase2_cloud_function_task_list.md)
- [二期数据模型设计](./archive/phase2-planning/phase2_data_model_design.md)
- [二期预算与成本](./archive/phase2-planning/phase2_budget.md)
- [二期视频资源方案](./archive/phase2-planning/phase2_video_resource_plan.md)

## 部署与运维

- [云函数部署说明](./operations/cloud_function_deployment.md)
- [快速部署说明](./operations/QUICK_DEPLOY.md)
- [云存储旧文件清理说明](./operations/storage_cleanup.md)
- [首页 Banner 图片上传与上线](./operations/banner-image-upload.md)
- [用 CloudBase 数据管理维护视频和题库](./operations/cloudbase-data-management-video-question-bank.md)
- [清空用户数据功能说明](./operations/clear_data_feature.md)
- [用户数据架构](./operations/user_data_architecture.md)

## 开发与专项指南

- [用户手册与测试案例](./manual/README.md)
- [开发者交接手册](./guides/developer-handoff.md)
- [视频分页与存储清理简易测试（大白话版）](./guides/video-pagination-storage-cleanup-simple-test.md)
- [视频分页与存储清理测试说明](./guides/video-pagination-storage-cleanup-test.md)
- [题库操作指南](./guides/question-bank-operation-guide.md)
- [题库 P0 修复简易测试（大白话版）](./guides/question-bank-p0-simple-test.md)
- [题库 TXT 转小程序导入 JSON 工具](../tools/question-bank-converter/README.md)
- [题库重新部署清单](./guides/question-bank-redeploy-list.md)
- [题库导入样例](./guides/question-bank-import-sample.json)
- [话题发布测试](./guides/topic-publish-test.md)

### 历史指南归档

以下旧指南已归档到 `archive/guides/`，仅用于追溯：

- [AI 图片识别说明](./archive/guides/ai_image_guide.md)
- [项目交接手册](./archive/guides/project-handoff.md)
- [题库管理计划](./archive/guides/question-bank-management-plan.md)
- [话题与题库初始化](./archive/guides/topic-and-question-bank-init.md)
- [简历项目亮点](./archive/guides/resume_project_highlight.md)

## 调研与问题分析

- [性能问题调查](./research/performance-investigation-2026-04-11.md)
- [性能解决方案](./research/performance-solution-plan-2026-04-11.md)

## 历史归档

- [历史归档入口](./archive/README.md)

`archive/` 下的内容用于追溯历史方案，不作为当前实现依据。

## 协作资料

当前 3+1 分工按角色分别维护，属于正式约定，纳入 Git 跟踪：

- [成员 A：内容运营与社区治理](./team-collaboration/member-a-content-community.md)
- [成员 B：权限、审核与平台能力](./team-collaboration/member-b-permission-review.md)
- [成员 C：学习内容与视频收口](./team-collaboration/member-c-learning-video.md)
- [成员 D：审查、验收与弱代码编辑](./team-collaboration/member-d-review-acceptance.md)

其他协作资料：

- [team-collaboration/archive/](./team-collaboration/archive/README.md)：历史分工说明归档，仅用于追溯，不作为当前依据。
- `team-collaboration/acceptance-checklist.md` 是本地验收工作表，可能包含测试环境和账号信息，已加入 `.gitignore`，不会提交到仓库。

## 文档维护原则

- 当前实现、架构约束和发布事实写入根目录 [CLAUDE.md](../CLAUDE.md)。
- 产品规划放入 `planning/`，不能把规划描述成已实现功能。
- 部署、环境、数据维护说明放入 `operations/`。
- 可执行的开发、交接和专项操作说明放入 `guides/`。
- 调研、性能分析和问题定位材料放入 `research/`。
- 历史版本方案放入 `archive/`。
- 新增文档必须选择对应目录，并同步更新本导航。
