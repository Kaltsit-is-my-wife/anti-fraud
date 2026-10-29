# 快速部署指南 - 解决云函数未部署问题

## 当前问题
错误：`FunctionName parameter could not be found`

原因：云函数 `clearUserData` 和 `getUserInfo` 已创建但未部署。

## 快速解决方案（3步完成）

### 步骤1：部署 clearUserData 云函数
1. 打开微信开发者工具
2. 在左侧文件树中找到 `cloudfunctions/clearUserData` 文件夹
3. **右键点击** `clearUserData` 文件夹
4. 选择 **"上传并部署：云端安装依赖"**
5. 等待30秒，看到绿色勾选即成功

### 步骤2：部署 getUserInfo 云函数
1. 在左侧文件树中找到 `cloudfunctions/getUserInfo` 文件夹
2. **右键点击** `getUserInfo` 文件夹
3. 选择 **"上传并部署：云端安装依赖"**
4. 等待30秒，看到绿色勾选即成功

### 步骤3：部署 initAchievements 云函数（重要！）
1. 在左侧文件树中找到 `cloudfunctions/initAchievements` 文件夹
2. **右键点击** `initAchievements` 文件夹
3. 选择 **"上传并部署：云端安装依赖"**
4. 等待30秒，看到绿色勾选即成功

## 部署后验证

### 方法1：检查图标状态
- 已部署的云函数图标显示绿色勾选 ✓
- 未部署的云函数图标显示灰色或红色叉号 ✗

### 方法2：测试清空功能
1. 进入设置页面
2. 点击"清空所有数据"
3. 应该显示"云端和本地数据已清空"

### 方法3：测试数据加载
1. 重新编译小程序
2. 进入用户页面
3. 检查积分、成就等数据是否正常显示

## 当前临时方案

在云函数部署完成前，清空数据功能会：
- ✅ 清空本地数据
- ⚠️  提示"云端数据未清空"
- ⚠️  需要手动在云开发控制台清空云端数据

## 完整部署后的功能

部署完成后，清空数据功能将：
- ✅ 清空云端数据（积分、成就、称号、学号等）
- ✅ 清空本地数据
- ✅ 显示"云端和本地数据已清空"
- ✅ 自动跳转到首页

## 需要部署的所有云函数

### 新增的云函数（必须部署）
- ✅ `clearUserData` - 清空用户数据
- ✅ `getUserInfo` - 获取用户信息
- ✅ `initAchievements` - 初始化成就数据

### 已有的云函数（检查是否部署）
- `aiChat` - AI对话
- `trackAction` - 行为追踪
- `userSignIn` - 用户签到
- `bindStudent` - 绑定学号
- `login` - 用户登录
- `getArticles` - 获取文章
- `getArticleDetail` - 获取文章详情
- `getTitles` - 获取称号
- `getUserTitles` - 获取用户称号
- `equipTitle` - 佩戴称号
- `redeemTitle` - 兑换称号
- `getSchools` - 获取学校
- `initTitles` - 初始化称号

## 部署失败怎么办？

### 检查1：网络连接
- 确保网络正常
- 尝试刷新页面

### 检查2：云开发环境
- 点击"云开发"按钮
- 确认云开发环境已开通

### 检查3：文件结构
- 确认 `cloudfunctions/clearUserData/index.js` 存在
- 确认 `cloudfunctions/clearUserData/package.json` 存在

### 检查4：代码语法
- 打开 `index.js` 文件
- 检查是否有语法错误（红色波浪线）

## 部署成功标志

部署成功后，你会看到：
1. 文件夹图标变成绿色勾选 ✓
2. 控制台显示"上传成功"
3. 云开发控制台可以看到该云函数

## 下一步操作

部署完成后：
1. 调用 `initAchievements` 初始化成就数据
2. 测试AI对话功能
3. 测试积分增加
4. 测试成就解锁
5. 测试清空数据功能

## 获取帮助

如遇到问题，请查看：
- 详细部署指南：`docs/operations/cloud_function_deployment.md`
- 微信云开发文档：https://docs.cloudbase.net/
- 错误码说明：https://docs.cloudbase.net/error-code/basic.html