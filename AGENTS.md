# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**反诈卫士 (Anti-Fraud Guardian)** - A WeChat Mini Program for anti-fraud education targeting university students. Uses WeChat Cloud Development with AI integration (Tongyi Qianwen/Qwen).

## Tech Stack

- **Frontend**: WeChat Mini Program native framework (WXML, WXSS, JS)
- **Backend**: WeChat Cloud Functions (Node.js)
- **Database**: WeChat Cloud Database (NoSQL)
- **AI**: Alibaba Tongyi Qianwen (Qwen) API for chat functionality

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      WeChat Mini Program                     │
├──────────────┬──────────────┬───────────────────────────────┤
│   Pages/     │   Utils/     │         Images/               │
│  (30+ pages) │  (helpers)   │       (assets)                │
├──────────────┴──────────────┴───────────────────────────────┤
│                    Cloud Functions (45+)                     │
│  login, aiChat, userSignIn, getQuizQuestions, submitQuiz... │
├──────────────────────────────────────────────────────────────┤
│                    Cloud Database Collections                │
│  users, articles, quiz_questions, posts, comments, follows  │
└──────────────────────────────────────────────────────────────┘
```

## Key Directories

- `pages/` - Mini Program pages (each page has .js, .wxml, .wxss, .json)
- `cloudfunctions/` - Cloud functions (each function is a separate folder)
- `utils/` - Shared utility functions
- `images/` - Static image assets
- `docs/` - Project documentation

## Database Collections (Key ones)

| Collection | Purpose |
|------------|---------|
| `users` | User profiles, points, achievements, quiz stats |
| `public_profiles` | Public-facing profile data (v3) |
| `quiz_questions` | Quiz question bank (v3) |
| `quiz_attempts` | Quiz attempt records (v3) |
| `posts` | Community posts (v3) |
| `comments` | Comments on articles/posts (v3) |
| `follows` | User follow relationships (v3) |
| `notifications` | In-app notifications (v3) |
| `articles` | Anti-fraud articles |
| `points_records` | Points transaction history |

## Code Conventions

### File Header Comments
Each source file includes a standardized header:
```javascript
/**
 * 模块名称 - 所属模块 (版本)
 *
 * 上游依赖：依赖的模块/集合
 * 入口：导出函数名
 * 主要功能：功能描述
 * 输出：输出说明
 *
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */
```

### Cloud Function Pattern
```javascript
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  // ... business logic
  return { success: true, data: {...} }
}
```

### WeChat Cloud Database Patterns
- Use `db.collection('name').doc(id).set({ data: {...} })` to create/overwrite
- **Never include `_id` in `set()` data** - causes error "不能更新id的值"
- Use `.update({ data: {...} })` for partial updates
- Use `.add({ data: {...} })` for creating new documents with auto-generated IDs

## Deployment

### Cloud Functions
In WeChat Developer Tools, right-click each cloud function folder and select:
- "上传并部署：云端安装依赖" (Upload and deploy: install dependencies on cloud)

### Database Setup
Create collections in Cloud Console. See `cloudfunctions/database.md` for full schema.

### Environment Configuration
1. Configure the Mini Program `appid` in `project.config.json`
2. The app uses the project-bound default cloud environment in `app.js`
3. Configure AI credentials through `cloudfunctions/aiChat/config.json` or cloud function environment variables

### AI Chat Setup
Configure:
```json
{
  "QWEN_API_KEY": "sk-your-api-key",
  "QWEN_MODEL": "qwen-vl-plus"
}
```

## Important Notes

### Quiz Points System (v3)
- `quizPoints`: Leaderboard points (累計答对题数)
- Daily mall points reward cap: 30 points (Beijing time UTC+8 reset)
- `quizRewardDailyDate`: Tracks daily reward date
- `quizRewardDailyAwarded`: Points awarded today

### User UID
- 9-digit unique identifier generated on registration
- Used as document ID in `public_profiles` collection

### Public vs Private Data
- `users` collection contains sensitive data (student ID, phone) - not publicly readable
- `public_profiles` contains safe public data for profile viewing, leaderboards

## Common Cloud Functions

| Function | Purpose |
|----------|---------|
| `login` | Auto login, create/update user |
| `userSignIn` | Daily check-in, points |
| `aiChat` | AI conversation (Qwen) |
| `getQuizQuestions` | Get 10 random quiz questions |
| `submitQuizAttempt` | Submit answers, calculate score, award points |
| `initQuizQuestions` | Seed quiz question bank (run once) |
