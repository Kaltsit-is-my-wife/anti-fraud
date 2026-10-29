# 用户数据架构改进文档

## 问题背景

### 发现的问题
1. **绑定学号后积分没有增加**：云函数正确更新了数据库，但前端没有同步更新本地存储
2. **重新编译后积分清零**：用户数据主要存储在本地，重新编译后丢失
3. **数据不一致**：不同页面使用不同的数据源，导致数据不同步

### 根本原因
- 用户数据（积分、成就、称号、头像、昵称等）主要存储在本地存储（wx.setStorageSync）
- 云端数据库更新后，前端没有及时同步
- 本地存储在重新编译或清除缓存后会丢失

## 解决方案

### 架构改进原则
1. **数据源统一**：所有用户数据以云端数据库为准
2. **本地存储为缓存**：本地存储仅作为缓存，提升访问速度
3. **云端优先策略**：页面加载时优先从云端获取最新数据
4. **降级机制**：云端请求失败时降级到本地存储

### 实施方案

#### 1. 创建getUserInfo云函数
**文件**：`cloudfunctions/getUserInfo/index.js`

**功能**：
- 从云端数据库获取用户完整信息
- 包括：积分、签到天数、对话次数、阅读次数、成就列表、称号列表等
- 聚合user_achievements集合的成就详情

**返回数据结构**：
```javascript
{
  success: true,
  data: {
    openid: "用户openid",
    userInfo: {
      _id: "用户ID",
      nickName: "昵称",
      avatarUrl: "头像URL",
      studentId: "学号",
      schoolName: "学校名称",
      collegeName: "院系名称",
      majorName: "专业名称",
      grade: "年级",
      isBound: true/false,
      points: 100,
      signDays: 7,
      totalChatCount: 10,
      totalReadCount: 5,
      continuousLearnDays: 3,
      achievements: ["chat_1", "read_1"],
      titles: ["title_id_1"],
      equippedTitleId: "title_id_1",
      createdAt: "创建时间",
      updatedAt: "更新时间"
    },
    achievements: [...], // 成就详情
    titles: [...],       // 称号列表
    equippedTitleId: "当前佩戴的称号ID"
  }
}
```

#### 2. 修改各页面数据加载逻辑

**修改的页面**：

1. **用户页面** (`pages/user/user.js`)
   - `onShow()` 调用 `loadUserDataFromCloud()`
   - 新增 `loadUserDataFromCloud()` 方法，从云端获取数据
   - 保留 `loadUserData()` 作为降级方案

2. **积分页面** (`pages/points/points.js`)
   - `onShow()` 调用 `loadUserPointsFromCloud()`
   - 新增 `loadUserPointsFromCloud()` 方法，从云端获取积分
   - 保留 `loadUserPoints()` 作为降级方案

3. **成就页面** (`pages/achievements/achievements.js`)
   - `onLoad()` 和 `onShow()` 调用 `loadUserDataFromCloud()`
   - 新增 `loadUserDataFromCloud()` 方法，从云端获取数据
   - 保留 `loadUserData()` 作为降级方案

4. **学习记录页面** (`pages/learning/learning.js`)
   - `onShow()` 调用 `loadLearningDataFromCloud()`
   - 新增 `loadLearningDataFromCloud()` 方法，从云端获取数据
   - 保留 `loadLearningData()` 作为降级方案

5. **签到页面** (`pages/sign-in/sign-in.js`)
   - `onShow()` 调用 `refreshStateFromCloud()`
   - 新增 `refreshStateFromCloud()` 方法，从云端获取数据
   - 保留 `refreshState()` 作为降级方案

6. **绑定学号页面** (`pages/bind-student/bind-student.js`)
   - 绑定成功后更新本地存储的积分和用户信息
   - 确保前端显示与云端数据一致

#### 3. 数据同步策略

**数据流向**：
```
用户行为 → 云函数更新数据库 → 前端接收响应 → 更新本地存储
页面显示 → 优先从云端获取 → 降级到本地存储
```

**关键更新点**：
- AI对话：trackAction云函数更新数据库，前端更新本地存储
- 阅读文章：trackAction云函数更新数据库，前端更新本地存储
- 签到：userSignIn云函数更新数据库，前端更新本地存储
- 绑定学号：bindStudent云函数更新数据库，前端更新本地存储
- 积分兑换：redeemTitle云函数更新数据库，前端更新本地存储

## 数据存储架构

### 云端数据库（主数据源）

**users集合**：
```javascript
{
  _id: "用户ID",
  _openid: "用户openid",
  nickName: "昵称",
  avatarUrl: "头像URL",
  studentId: "学号",
  schoolName: "学校名称",
  collegeName: "院系名称",
  majorName: "专业名称",
  grade: "年级",
  className: "班级",
  phone: "手机号",
  isBound: true/false,
  points: 100,                    // 积分
  signDays: 7,                    // 签到天数
  lastSignDate: "2024-01-22",     // 最后签到日期
  totalChatCount: 10,             // 总对话次数
  lastChatDate: "2024-01-22",     // 最后对话日期
  totalReadCount: 5,              // 总阅读次数
  lastReadDate: "2024-01-22",     // 最后阅读日期
  continuousLearnDays: 3,         // 连续学习天数
  lastLearnDate: "2024-01-22",    // 最后学习日期
  achievements: ["chat_1", "read_1"], // 成就ID列表
  titles: ["title_id_1"],         // 称号ID列表
  equippedTitleId: "title_id_1",  // 当前佩戴的称号ID
  createdAt: "创建时间",
  updatedAt: "更新时间"
}
```

**user_achievements集合**：
```javascript
{
  _id: "记录ID",
  _openid: "用户openid",
  userId: "用户ID",
  achievementId: "成就ID",
  achievementName: "成就名称",
  earnedAt: "获得时间",
  rewardTitleId: "奖励称号ID",
  pointsEarned: "获得积分"
}
```

### 本地存储（缓存）

**存储的数据**：
```javascript
// 用户信息缓存
wx.setStorageSync('userInfo', {...})

// 积分缓存
wx.setStorageSync('points', 100)

// 签到天数缓存
wx.setStorageSync('signDays', 7)

// 对话次数缓存
wx.setStorageSync('chatTimes', 10)

// 阅读次数缓存
wx.setStorageSync('readArticles', 5)

// 成就数量缓存
wx.setStorageSync('achievements', 2)

// 最后签到日期缓存
wx.setStorageSync('lastSignDate', '2024-01-22')

// OpenID缓存
wx.setStorageSync('openid', '用户openid')
```

## 使用说明

### 部署步骤
1. 部署 `getUserInfo` 云函数
2. 重新编译小程序
3. 测试各页面数据加载是否正常

### 测试验证
1. 绑定学号后检查积分是否增加
2. 重新编译后检查积分是否保持
3. 在不同设备登录检查数据是否同步
4. 检查各页面显示的数据是否一致

### 注意事项
1. 云函数请求失败时会自动降级到本地存储
2. 本地存储的数据会在页面显示时更新为云端最新数据
3. 用户信息修改后需要调用相应的云函数更新数据库
4. 避免直接修改本地存储而不更新云端数据库

## 优势

1. **数据持久化**：用户数据存储在云端，不会因为重新编译或清除缓存而丢失
2. **数据一致性**：所有页面从同一数据源获取数据，确保数据一致
3. **跨设备同步**：用户在不同设备登录时数据自动同步
4. **性能优化**：本地存储作为缓存，减少云端请求次数
5. **容错机制**：云端请求失败时降级到本地存储，保证用户体验

## 相关文件

### 新增文件
- `cloudfunctions/getUserInfo/index.js` - 获取用户信息云函数
- `cloudfunctions/getUserInfo/package.json` - 云函数配置
- `cloudfunctions/clearUserData/index.js` - 清空用户数据云函数
- `cloudfunctions/clearUserData/package.json` - 云函数配置

### 修改文件
- `pages/user/user.js` - 用户页面数据加载
- `pages/points/points.js` - 积分页面数据加载
- `pages/achievements/achievements.js` - 成就页面数据加载
- `pages/learning/learning.js` - 学习记录页面数据加载
- `pages/sign-in/sign-in.js` - 签到页面数据加载
- `pages/bind-student/bind-student.js` - 绑定学号页面数据更新
- `pages/settings/settings.js` - 设置页面清空数据功能
- `pages/settings/settings.wxml` - 设置页面UI
- `pages/settings/settings.wxss` - 设置页面样式

## 版本历史

- v1.0 (2024-01-22) - 初始版本，实现用户数据云端存储架构
- v1.1 (2024-01-22) - 新增清空数据功能