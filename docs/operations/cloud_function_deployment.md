# 云函数部署指南

## 问题说明

错误信息：`FunctionName parameter could not be found`

**原因**：云函数 `clearUserData` 和 `getUserInfo` 已创建但未部署到云端。

## 部署步骤

### 方法一：使用微信开发者工具部署（推荐）

1. **打开微信开发者工具**

2. **部署 clearUserData 云函数**
   - 在左侧文件树中找到 `cloudfunctions/clearUserData` 目录
   - 右键点击 `clearUserData` 文件夹
   - 选择 "上传并部署：云端安装依赖"
   - 等待部署完成（约30秒）

3. **部署 getUserInfo 云函数**
   - 在左侧文件树中找到 `cloudfunctions/getUserInfo` 目录
   - 右键点击 `getUserInfo` 文件夹
   - 选择 "上传并部署：云端安装依赖"
   - 等待部署完成（约30秒）

4. **部署 initAchievements 云函数**（如果尚未部署）
   - 在左侧文件树中找到 `cloudfunctions/initAchievements` 目录
   - 右键点击 `initAchievements` 文件夹
   - 选择 "上传并部署：云端安装依赖"
   - 等待部署完成（约30秒）

5. **验证部署**
   - 部署完成后，云函数图标会变成绿色勾选状态
   - 可以在云开发控制台查看已部署的云函数列表

### 方法二：使用命令行部署

1. **安装 Cloudbase CLI**
   ```bash
   npm install -g @cloudbase/cli
   ```

2. **登录 Cloudbase**
   ```bash
   cloudbase login
   ```

3. **部署云函数**
   ```bash
   # 部署 clearUserData
   cloudbase functions:deploy clearUserData
   
   # 部署 getUserInfo
   cloudbase functions:deploy getUserInfo
   
   # 部署 initAchievements
   cloudbase functions:deploy initAchievements
   ```

### 方法三：使用云开发控制台部署

1. **打开云开发控制台**
   - 在微信开发者工具中点击 "云开发" 按钮
   - 进入云开发控制台

2. **进入云函数管理**
   - 点击左侧 "云函数" 菜单
   - 点击 "新建" 按钮

3. **创建云函数**
   - 函数名称：`clearUserData`
   - 运行环境：Node.js
   - 点击 "确定"

4. **上传代码**
   - 在云函数详情页点击 "上传"
   - 选择 `cloudfunctions/clearUserData` 目录下的所有文件
   - 点击 "确定"

5. **重复步骤3-4**，创建其他云函数：
   - `getUserInfo`
   - `initAchievements`

## 需要部署的云函数列表

| 云函数名称 | 用途 | 是否必须 |
|-----------|------|---------|
| clearUserData | 清空用户数据 | 必须 |
| getUserInfo | 获取用户信息 | 必须 |
| initAchievements | 初始化成就数据 | 必须（首次使用） |
| aiChat | AI对话处理 | 应该已有 |
| trackAction | 行为追踪和成就检查 | 应该已有 |
| userSignIn | 用户签到 | 应该已有 |
| bindStudent | 绑定学号 | 应该已有 |
| login | 用户登录 | 应该已有 |
| getArticles | 获取文章列表 | 应该已有 |
| getArticleDetail | 获取文章详情 | 应该已有 |
| getTitles | 获取称号列表 | 应该已有 |
| getUserTitles | 获取用户称号 | 应该已有 |
| equipTitle | 佩戴称号 | 应该已有 |
| redeemTitle | 兑换称号 | 应该已有 |
| getSchools | 获取学校列表 | 应该已有 |
| initTitles | 初始化称号数据 | 应该已有 |

## 部署验证

### 1. 检查云函数列表
- 在云开发控制台查看所有已部署的云函数
- 确认新增的云函数在列表中

### 2. 测试云函数调用

**测试 clearUserData**：
```javascript
wx.cloud.callFunction({
  name: 'clearUserData',
  data: {}
}).then(res => {
  console.log('测试成功:', res)
}).catch(err => {
  console.error('测试失败:', err)
})
```

**测试 getUserInfo**：
```javascript
wx.cloud.callFunction({
  name: 'getUserInfo',
  data: {}
}).then(res => {
  console.log('测试成功:', res)
}).catch(err => {
  console.error('测试失败:', err)
})
```

### 3. 测试清空数据功能
- 在设置页面点击"清空所有数据"
- 确认可以正常清空数据

## 常见问题

### Q1: 部署失败，提示"网络错误"
**A**: 检查网络连接，确保可以访问微信云开发服务器

### Q2: 部署成功但调用失败
**A**: 
- 检查云函数名称是否正确
- 确认云开发环境是否正确配置
- 查看云函数日志排查错误

### Q3: 云函数图标显示红色叉号
**A**: 
- 云函数部署失败
- 检查代码是否有语法错误
- 重新部署云函数

### Q4: 清空数据时提示"云函数未部署"
**A**: 
- 已修改代码，即使云函数未部署也能清空本地数据
- 但要完整功能，仍需部署云函数

## 临时解决方案

在云函数部署完成前，可以使用修改后的代码清空本地数据：

1. 进入设置页面
2. 点击"清空所有数据"
3. 系统会提示"本地数据已清空（云端数据未清空）"
4. 本地数据已清空，但云端数据保留

**注意**：这只是临时方案，完整功能需要部署云函数。

## 部署后的操作

部署完成后，建议执行以下操作：

1. **初始化成就数据**
   - 调用 `initAchievements` 云函数
   - 或在云开发控制台手动执行

2. **测试数据流**
   - 进行一次AI对话
   - 检查积分是否增加
   - 检查成就是否解锁

3. **测试清空功能**
   - 在设置页面清空所有数据
   - 确认云端和本地数据都被清空

## 技术支持

如遇到部署问题，请参考：
- 微信云开发文档：https://docs.cloudbase.net/
- 云函数文档：https://docs.cloudbase.net/functions/intro.html
- 错误码说明：https://docs.cloudbase.net/error-code/basic.html