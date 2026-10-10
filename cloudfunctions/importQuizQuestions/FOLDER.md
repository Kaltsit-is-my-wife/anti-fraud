# importQuizQuestions 云函数目录

## 文件说明

- `index.js` - 管理端批量导入题目逻辑
- `package.json` - 云函数依赖与入口配置

## 功能说明

该云函数支持管理员向指定题库批量导入题目，当前输入格式为 JSON 数组。

支持字段：

- `question`
- `options` 或 `optionA ~ optionD`
- `answerIndex` 或 `answer`
- `explanation`
- `difficulty`
- `tags`
- `isActive`

## 重要说明

导入前会校验：

- 题干不能为空
- 至少两个选项
- 答案索引合法
- 启用题必须有解析
- 同一题库内不能和现有题目重复
- 同一批导入内容中不能重复
