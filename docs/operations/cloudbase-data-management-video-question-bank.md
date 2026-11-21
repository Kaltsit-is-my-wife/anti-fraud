# 用 CloudBase 数据管理维护视频和题库

适用：想通过电脑浏览器直接维护 `videos`、`question_banks`、`quiz_questions` 数据的管理员/运营。

> 数据管理是“直接改数据库”，不会执行小程序里的校验。日常运营仍优先用小程序管理页；数据管理适合查数据、批量改字段、导出备份和修历史脏数据。

## 1. 从哪里进入

浏览器打开：

```text
https://tcb.cloud.tencent.com/dev
```

或者：

```text
微信公众平台 → 开发 → 开发管理 → 云开发 → 进入云开发控制台
```

选择你们小程序正在使用的云环境，然后进入：

```text
数据库 / 数据管理
```

如果看不到“数据管理/云后台”，直接用左侧的“数据库”标签也可以；不要为了这个功能新建环境。

## 2. 需要认识的集合

| 集合 | 用途 |
|---|---|
| `videos` | 视频记录 |
| `question_banks` | 题库 |
| `quiz_questions` | 题目池 |

题目和题库的关系：

```text
question_banks._id  ←→  quiz_questions.bankIds[]
```

一道题可以属于多个题库。`bankId` 是兼容旧代码的字段，填 `bankIds` 的第一个。

## 3. 视频：导入哪些字段

在云存储上传视频和封面，复制 `cloud://` 文件 ID，再到 `videos` 新增/编辑记录。

```json
{
  "title": "视频标题",
  "summary": "视频简介",
  "coverImage": "cloud://环境ID/video-covers/xxx.jpg",
  "videoUrl": "cloud://环境ID/videos/xxx.mp4",
  "duration": 180,
  "category": "反诈视频",
  "status": "draft",
  "sort": 0,
  "relatedArticleIds": [],
  "relatedTopicIds": [],
  "publishedAt": null,
  "createdAt": "2026-11-21T00:00:00.000Z",
  "updatedAt": "2026-11-21T00:00:00.000Z"
}
```

| 字段 | 说明 |
|---|---|
| `title` | 必填，标题 |
| `summary` | 简介 |
| `coverImage` | 封面，`cloud://` 或 HTTPS |
| `videoUrl` | 必填，`cloud://` 或 HTTPS |
| `duration` | 时长，单位秒 |
| `category` | 分类 |
| `status` | `draft` 草稿 / `published` 已发布 / `offline` 已下线 |
| `sort` | 排序，越小越靠前 |
| `relatedArticleIds` | 关联文章 `_id` 数组 |
| `relatedTopicIds` | 关联话题 `_id` 数组 |
| `publishedAt` | 发布时填写；草稿可为空 |
| `createdAt` / `updatedAt` | 创建/更新时间 |

视频日常规则：

- 先存 `draft`，在小程序视频管理页确认封面、播放、关联内容后再改 `published`。
- 下架改 `offline`，不要直接删已发布视频。
- 只有 `draft` / `offline` 可以删除记录。
- 删除记录不会立即删除云存储文件；旧文件由 `storage_cleanup_tasks` + `cleanupStorageFiles` 清理。
- **不要改已有记录的 `_id`**，否则关联和清理任务会错位。
- 直接改数据库不会走 `saveVideo` 的旧文件登记；经常替换视频时，优先用小程序视频管理页。

## 4. 题库：导入哪些字段

### 4.1 先建题库 `question_banks`

```json
{
  "name": "大学生反诈基础题库",
  "summary": "题库简介",
  "coverImage": "",
  "status": "draft",
  "sort": 1,
  "defaultQuestionCount": 10,
  "publishedAt": null,
  "createdAt": "2026-11-21T00:00:00.000Z",
  "updatedAt": "2026-11-21T00:00:00.000Z"
}
```

| 字段 | 说明 |
|---|---|
| `name` | 必填，题库名称 |
| `summary` | 题库简介 |
| `coverImage` | 封面，`cloud://` 或 HTTPS |
| `status` | `draft` / `published` / `offline` |
| `sort` | 排序，越小越靠前 |
| `defaultQuestionCount` | 默认抽题数，1–20 |
| `publishedAt` | 发布时填写 |
| `createdAt` / `updatedAt` | 创建/更新时间 |

保存后复制题库的 `_id`，下面题目要用。

### 4.2 再建题目 `quiz_questions`

```json
{
  "questionId": "q20261121001",
  "question": "接到自称客服的退款电话时，最安全的做法是？",
  "normalizedQuestion": "接到自称客服的退款电话时，最安全的做法是？",
  "options": ["按对方要求转账", "在原平台官方入口核实", "提供验证码配合退款", "下载对方发来的软件"],
  "answerIndex": 1,
  "explanation": "退款应在原平台官方入口核实，不能提供验证码或转账。",
  "difficulty": 2,
  "tags": ["冒充客服", "退款"],
  "isActive": true,
  "bankIds": ["把题库的_id放这里"],
  "bankId": "把题库的_id放这里",
  "createdAt": "2026-11-21T00:00:00.000Z",
  "updatedAt": "2026-11-21T00:00:00.000Z"
}
```

| 字段 | 说明 |
|---|---|
| `questionId` | 必填且唯一，建议 `q+日期+序号` |
| `question` | 题干 |
| `normalizedQuestion` | 题干去空格并转小写，用于查重 |
| `options` | 2–6 个选项，对应 A–F |
| `answerIndex` | 正确答案索引，A=0，B=1，E=4，F=5 |
| `explanation` | 启用题必须有解析 |
| `difficulty` | 难度 1–5 |
| `tags` | 标签数组 |
| `isActive` | `true` 启用，`false` 停用 |
| `bankIds` | 所属题库 `_id` 数组，可多个 |
| `bankId` | 兼容旧字段，填 `bankIds` 的第一个 |
| `createdAt` / `updatedAt` | 创建/更新时间 |

注意：

- 不要把 `default_bank`、`__all__`、`__unassigned__` 写进 `bankIds`。
- 选项不要超过 6 个，`answerIndex` 不要超过选项范围。
- 题目停用用 `isActive: false`，不要直接删记录。
- 不要改已有题目的 `_id` 或 `questionId`。

## 5. 发布题库前检查

发布前逐项确认：

- [ ] 题库里至少有 1 道启用题。
- [ ] 启用题数量 ≥ `defaultQuestionCount`。
- [ ] 每道启用题都有 `explanation`。
- [ ] 没有重复题干。
- [ ] 每道题 `options` 是 2–6 个。
- [ ] `answerIndex` 在选项范围内。
- [ ] 每道题都有 `questionId`。
- [ ] 题目的 `bankIds` 包含当前题库 `_id`。

确认后把题库改为：

```json
"status": "published",
"publishedAt": "2026-11-21T00:00:00.000Z",
"updatedAt": "2026-11-21T00:00:00.000Z"
```

下架改：

```json
"status": "offline"
```

## 6. 日常运营维护

### 视频

- 新增：云存储上传文件 → `videos` 新增记录 → `draft` → 小程序预览 → `published`。
- 修改：优先用小程序视频管理页；直接改库后记得更新 `updatedAt`。
- 下线：改 `offline`。
- 删除：只删 `draft` / `offline`；删除前确认是否需要保留云存储文件。
- 旧文件：清理默认先 dry-run，确认无引用后再执行删除。

### 题库

- 新建题库：先 `draft`，再慢慢加题。
- 加题/改题：优先用小程序题目管理页或批量导入，会自动补 `questionId`、`normalizedQuestion`、时间戳并查重。
- 绑定题库：编辑题目的 `bankIds`，或在小程序里点“加入当前题库”。
- 停用题目：`isActive: false`。
- 下线题库：`status: "offline"`。
- 删除题库：先确认没有题目的 `bankIds` 还引用它，否则会留下孤立引用。
- 数据管理批量导入：适合修历史数据；不要用它替代小程序批量导入，否则容易漏字段。

### 备份和导入

- 批量修改前先导出 `videos`、`question_banks`、`quiz_questions`。
- 导入时注意 Insert 和 Upsert 的区别，Upsert 会覆盖同 `_id` 记录。
- 日期字段优先用控制台的日期选择器；批量 JSON 导入时按控制台支持的格式填写，不要留空或写成普通字符串。
- 不要导入缺少 `questionId`、`bankIds`、`normalizedQuestion` 的题目。

### 权限

- 数据管理只给管理员/运营使用，不要把账号发给无关人员。
- 如果控制台支持成员/角色管理，给运营单独开账号。
- 集合权限按最小权限设置；数据管理本身是管理端操作，不受小程序端权限限制。

## 7. 最容易踩的坑

1. 改题库 `_id`：题目的 `bankIds` 全部对不上。
2. 只填 `bankIds` 不填 `bankId`：旧代码可能读不到归属。
3. 直接发布题库：绕过发布校验，用户可能看到空题库或异常题。
4. 题目没有 `questionId`：用户交卷会失败。
5. 选项超过 6 个或答案索引越界：用户侧会过滤，题库题量变少。
6. 直接删题目/题库：不如停用/下线，保留回退空间。
7. 直接改视频地址/封面：旧文件不会自动进清理队列；经常替换请走视频管理页。
