# 题库 TXT 转小程序导入 JSON

把按题号整理的题库 txt 转成小程序“题目管理 → 批量导入”使用的 JSON 数组。

## 用法

```bash
node tools/question-bank-converter/convert.js <input.txt> <output.json> [--label 2025]
```

示例：

```bash
node tools/question-bank-converter/convert.js \
  test/question_bank/2025/2025全民反诈.txt \
  test/question_bank/2025/2025全民反诈.json \
  --label 2025

node tools/question-bank-converter/convert.js \
  test/question_bank/2026/2026反诈题目.txt \
  test/question_bank/2026/2026反诈题目.json \
  --label 2026
```

不需要安装依赖，Node.js 直接运行。

## 输入格式

```text
1.题干
A.选项一
B.选项二
C.选项三
D.选项四
答案：B
答案解析：可选解析
```

支持：

- 题号 `1.` 或 `1、`
- 选项 `A.` 到 `F.`
- 答案行 `答案：B` 或 `正确答案：B`
- 解析行可选
- 题号后带 `【单选题】` / `【多选题】` / 分值，会自动去掉

会跳过：

- `【多选题】` 或答案包含多个字母的题
- 没有答案、选项数量异常、答案超出选项范围的题
- 题干重复的题
- 选项与前面某题完全相同的题（疑似复制错误）

## 输出格式

输出是 JSON 数组，给小程序批量导入用：

```json
[
  {
    "question": "题干",
    "options": ["A", "B", "C", "D"],
    "answerIndex": 1,
    "explanation": "解析",
    "difficulty": 2,
    "tags": ["标签"],
    "isActive": true
  }
]
```

## 自动处理规则

- 原文件没有解析时，按题型模板自动补写解析；导入前建议抽查。
- `difficulty` 按题干长度和“不是/不会”等关键词粗分。
- `tags` 按关键词匹配，最多两个。
- 2025 文件里的多选题会跳过；2026 文件第 17 题因选项与题干不匹配会跳过。

## 不做什么

- 不写数据库。
- 不生成 `questionId`、`normalizedQuestion`、`bankIds`、`bankId`、时间戳。
- 不生成网页控制台直接导入需要的 JSON Lines。
- 因此：**日常新建题目请用小程序“题目管理 → 批量导入”**；网页控制台导入需要另行补全字段并转 JSON Lines。

## 新增题库文件

把新的 txt 放到任意路径，执行：

```bash
node tools/question-bank-converter/convert.js <新题库.txt> <输出.json> --label 2027
```

如果新题库格式和上面不同，需要调整 `parseFile` 的解析规则。

## 导入前检查

- 5/6 选项题是否完整；
- 2026 自动补写的解析是否准确；
- 答案分布是否明显异常；
- 标签和难度是否符合运营口径；
- 是否有敏感或不适合校园场景的措辞。

## 相关文件

- 转换结果和源题库：`test/question_bank/`（本地测试目录，`.gitignore` 已排除）
- 转换说明：`test/question_bank/转换说明.md`
