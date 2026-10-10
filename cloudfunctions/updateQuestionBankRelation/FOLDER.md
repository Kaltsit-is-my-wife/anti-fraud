# updateQuestionBankRelation 云函数目录

## 文件说明

- `index.js` - 管理端维护题目与题库的关联关系
- `package.json` - 云函数依赖与入口配置

## 功能说明

该云函数支持：

- 将题目加入指定题库
- 将题目从指定题库移出

当前题目与题库关系以 `quiz_questions.bankIds` 为准，兼容旧 `bankId` 数据。
