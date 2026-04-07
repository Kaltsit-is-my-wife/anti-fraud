/**
 * 小程序全局配置 - 应用入口模块
 * 
 * 上游依赖：微信云开发环境，login云函数
 * 入口：onLaunch生命周期函数
 * 主要功能：云开发初始化、用户登录、全局数据管理
 * 输出：初始化小程序环境，设置全局数据
 * 
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */

// app.js
App({
  onLaunch() {
    // 初始化云开发环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      const cloudConfig = {
        // 不在客户端写死云环境，默认使用当前项目绑定的云环境。
        traceUser: true
      }

      wx.cloud.init(cloudConfig)
      
      // 获取云开发数据库引用
      this.globalData.db = wx.cloud.database()
      
      // 自动获取 openid（静默登录）
      this.getOpenId()
    }

    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)
  },
  
  // 获取用户 openid
  async getOpenId() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'login',
        data: {}
      })
      
      if (result.result.success) {
        const data = result.result.data
        this.globalData.openid = data.openid
        this.globalData.userInfo = data.userInfo
        console.log('自动登录成功，openid:', data.openid)
        
        // 检查是否已绑定学号
        this.checkStudentBind(data.userInfo)
      }
    } catch (err) {
      console.error('获取 openid 失败：', err)
    }
  },
  
  // 检查是否已绑定学号
  checkStudentBind(userInfo) {
    // 如果未绑定学号，延迟2秒后提示绑定
    if (!userInfo.isBound) {
      setTimeout(() => {
        wx.showModal({
          title: '完善学生信息',
          content: '为了提供更好的反诈教育服务，请绑定您的学号信息',
          confirmText: '去绑定',
          cancelText: '稍后',
          success: (res) => {
            if (res.confirm) {
              wx.navigateTo({
                url: '/pages/bind-student/bind-student'
              })
            } else {
              // 记录用户取消绑定
              this.globalData.bindRemindCount = (this.globalData.bindRemindCount || 0) + 1
            }
          }
        })
      }, 2000)
    }
  },
  
  globalData: {
    userInfo: null,
    db: null,
    openid: null,
    bindRemindCount: 0  // 绑定提醒次数
  }
})
