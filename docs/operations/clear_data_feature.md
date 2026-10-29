# 清空数据功能文档

## 功能概述

提供清空用户所有数据的功能，包括云端数据和本地数据，用于重置用户账户或测试环境清理。

## 功能特性

### 1. 云端数据清空
**云函数**：`clearUserData`

**清空的数据**：
- 用户成就记录（user_achievements集合）
- 绑定日志（bind_logs集合）
- 用户业务数据（users集合中的业务字段）

**保留的数据**：
- 用户基本信息（_id, _openid, nickName, avatarUrl, createdAt）
- 账户基本信息（确保用户账户仍然存在）

**重置的字段**：
```javascript
{
  points: 0,                    // 积分
  signDays: 0,                  // 签到天数
  lastSignDate: null,           // 最后签到日期
  totalChatCount: 0,            // 总对话次数
  lastChatDate: null,           // 最后对话日期
  totalReadCount: 0,            // 总阅读次数
  lastReadDate: null,           // 最后阅读日期
  continuousLearnDays: 0,       // 连续学习天数
  lastLearnDate: null,          // 最后学习日期
  achievements: [],             // 成就列表
  titles: [],                   // 称号列表
  equippedTitleId: null,        // 当前佩戴的称号
  studentId: '',                // 学号
  schoolId: '',                 // 学校ID
  schoolName: '',               // 学校名称
  collegeId: '',                // 院系ID
  collegeName: '',              // 院系名称
  majorId: '',                  // 专业ID
  majorName: '',                // 专业名称
  grade: '',                    // 年级
  className: '',                // 班级
  phone: '',                    // 手机号
  realName: '',                 // 真实姓名
  isBound: false,               // 绑定状态
  verifiedAt: null,             // 验证时间
  updatedAt: new Date()         // 更新时间
}
```

### 2. 本地数据清空
**方法**：`clearLocalData()`

**清空的数据**：
- 所有本地存储（wx.clearStorageSync）
- 包括：userInfo, points, signDays, chatTimes, readArticles, achievements, lastSignDate, openid等

### 3. 用户界面
**位置**：设置页面（pages/settings/settings.wxml）

**入口**：账号设置 → 清空所有数据

**样式**：红色背景，警示图标，强调危险性

**确认流程**：
1. 点击"清空所有数据"
2. 显示二次确认对话框，列出将要清空的数据
3. 用户确认后开始清空
4. 显示加载状态
5. 清空完成后跳转到首页

## 使用场景

### 1. 测试环境清理
- 开发测试时需要清空测试数据
- 重新开始测试流程

### 2. 用户账户重置
- 用户希望重新开始使用应用
- 清除所有历史数据

### 3. 数据异常处理
- 数据出现异常需要重置
- 排除数据问题

## 安全措施

### 1. 二次确认
- 显示详细的清空内容说明
- 明确标注"此操作不可恢复"
- 使用红色警示样式

### 2. 权限控制
- 云函数自动识别用户openid
- 只能清空当前用户的数据
- 无法清空其他用户的数据

### 3. 错误处理
- 云端清空失败时显示错误信息
- 不会清空本地数据（避免数据不一致）
- 提供重试机制

## 技术实现

### 云函数实现
**文件**：`cloudfunctions/clearUserData/index.js`

**执行流程**：
1. 获取用户openid
2. 查询用户信息
3. 删除user_achievements记录
4. 删除bind_logs记录
5. 重置users集合中的业务字段
6. 返回清空结果

**返回数据**：
```javascript
{
  success: true,
  data: {
    deletedData: {
      user: {...},           // 重置后的用户数据
      userAchievements: 10,  // 删除的成就记录数
      bindLogs: 5           // 删除的绑定日志数
    },
    userInfo: {...}         // 更新后的用户信息
  },
  message: '数据清空成功'
}
```

### 前端实现
**文件**：`pages/settings/settings.js`

**执行流程**：
1. 显示确认对话框
2. 调用clearUserData云函数清空云端数据
3. 调用clearLocalData清空本地数据
4. 显示成功提示
5. 跳转到首页

**关键代码**：
```javascript
clearAllData() {
  wx.showModal({
    title: '⚠️ 危险操作',
    content: '此操作将清空您的所有数据...',
    confirmText: '确定清空',
    confirmColor: '#ef4444',
    success: async (res) => {
      if (res.confirm) {
        wx.showLoading({ title: '清空中...' })
        
        // 清空云端数据
        const cloudResult = await wx.cloud.callFunction({
          name: 'clearUserData',
          data: {}
        })
        
        // 清空本地数据
        this.clearLocalData()
        
        // 跳转到首页
        wx.reLaunch({ url: '/pages/index/index' })
      }
    }
  })
}
```

## 注意事项

### 1. 云函数部署要求
**重要**：使用此功能前必须先部署 `clearUserData` 云函数。

**部署方法**：
1. 在微信开发者工具中找到 `cloudfunctions/clearUserData` 文件夹
2. 右键点击 → 选择"上传并部署：云端安装依赖"
3. 等待部署完成（约30秒）

**快速部署指南**：参见 `docs/operations/QUICK_DEPLOY.md`

### 2. 临时方案（云函数未部署时）
如果云函数未部署，系统会：
- ✅ 清空本地数据
- ⚠️  提示"云端数据未清空，请先部署clearUserData云函数"
- ⚠️  云端数据保留，需要手动在云开发控制台清空

**手动清空云端数据**：
1. 打开云开发控制台
2. 进入数据库 → users 集合
3. 找到用户记录，修改业务字段为0或空
4. 进入 user_achievements 集合，删除相关记录
5. 进入 bind_logs 集合，删除相关记录

### 3. 不可逆操作
- 此操作不可恢复
- 清空后无法找回历史数据
- 请谨慎使用

### 2. 数据一致性
- 云端和本地数据同时清空
- 确保数据完全重置
- 避免数据残留

### 3. 用户体验
- 提供明确的警告提示
- 显示清空进度
- 清空后自动跳转到首页

### 4. 测试建议
- 在测试环境充分测试
- 验证所有数据都被清空
- 确认清空后应用正常运行

## 相关文件

### 新增文件
- `cloudfunctions/clearUserData/index.js` - 清空用户数据云函数
- `cloudfunctions/clearUserData/package.json` - 云函数配置

### 修改文件
- `pages/settings/settings.js` - 添加清空数据功能
- `pages/settings/settings.wxml` - 添加清空数据入口
- `pages/settings/settings.wxss` - 添加危险操作样式

## 版本历史

- v1.0 (2024-01-22) - 初始版本，实现清空所有数据功能