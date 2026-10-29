# 题库重构后需重新部署的云函数

适用日期：2026-04-09

## 需要重新上传

- `getAdminQuestionBankList`
- `saveQuestionBank`
- `getQuestionBanks`
- `getQuizQuestionList`
- `saveQuizQuestion`
- `getQuizQuestions`
- `deleteQuestionBank`
- `importQuizQuestions`
- `updateQuestionBankRelation`
- `submitQuizAttempt`

## 说明

- 这批函数需要和当前前端“题目池 + 题库选题”逻辑保持一致
- 如果不重传，题目池、加入题库、按题库抽题、题库统计等行为会不一致
