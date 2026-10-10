# 社区话题和题库初始化操作

## 部署顺序

在微信开发者工具中分别右键以下目录，选择“上传并部署：云端安装依赖”：

1. `cloudfunctions/initQuizQuestions`
2. `cloudfunctions/initQuestionBanks`
3. `cloudfunctions/initTopics`

## 执行顺序

在云开发控制台的云函数调试中执行：

1. `initQuizQuestions`：导入内置的 50 道启用题目。
2. `initQuestionBanks`：创建并发布“大学生反诈基础题库”，自动把未分配的启用题目关联到该题库。
3. `initTopics`：创建并发布 5 个官方反诈专题。

三个函数都支持重复执行：已存在的题库和同名话题会更新或复用，不会重复创建。

## 验证

- 调用 `getTopics`，应返回 5 个 `status: published` 的话题。
- 调用 `getQuestionBanks`，应返回 1 个已发布题库，并显示题目数量。
- 调用 `getQuizQuestions`，应能返回题目。
- 在小程序中清除社区缓存后重新进入社区；进入答题首页检查题库列表。

## 注意

初始化函数必须部署到当前小程序正在使用的云环境。若控制台调试提示集合不存在，函数会尝试自动创建集合；若账号没有创建集合权限，需要先在云开发数据库中手动创建 `topics`、`question_banks` 和 `quiz_questions`。
