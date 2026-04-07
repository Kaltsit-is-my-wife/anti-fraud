// pages/settings/settings.js
Page({
  data: {
    settings: {
      notifications: true,
      sound: true,
      vibrate: false,
      autoLogin: true
    },
    version: '1.0.0',
    hasReviewAccess: false,
    hasAdminAccess: false
  },

  onLoad() {
    this.loadSettings()
    this.loadPermissionInfo()
  },

  loadSettings() {
    try {
      const settings = wx.getStorageSync('appSettings') || this.data.settings
      this.setData({ settings })
    } catch (e) {
      console.error('加载设置失败：', e)
    }
  },

  loadPermissionInfo() {
    try {
      const userInfo = wx.getStorageSync('userInfo') || {}
      const roles = Array.isArray(userInfo.roles) ? userInfo.roles : []
      const hasReviewAccess = userInfo.isAdmin === true || roles.includes('reviewer') || roles.includes('operator')
      const hasAdminAccess = userInfo.isAdmin === true || roles.includes('operator')
      this.setData({ hasReviewAccess, hasAdminAccess })
    } catch (e) {
      console.error('加载权限信息失败：', e)
    }
  },

  // 切换开关
toggleSwitch(e) {
    const key = e.currentTarget.dataset.key
    const value = e.detail.value
    
    this.setData({
      [`settings.${key}`]: value
    })
    
    try {
      wx.setStorageSync('appSettings', this.data.settings)
      wx.showToast({
        title: '设置已保存',
        icon: 'success',
        duration: 1000
      })
    } catch (e) {
      console.error('保存设置失败：', e)
    }
  },

  navigateTo(e) {
    const url = e.currentTarget.dataset.url
    if (!url) return
    
    wx.navigateTo({ url })
  },

  clearCache() {
    wx.showModal({
      title: '确认清除',
      content: '清除缓存后需要重新登录',
      success: (res) => {
        if (res.confirm) {
          try {
            wx.clearStorageSync()
            wx.showToast({
              title: '缓存已清除',
              icon: 'success'
            })
            setTimeout(() => {
              wx.reLaunch({
                url: '/pages/index/index'
              })
            }, 1500)
          } catch (e) {
            console.error('清除缓存失败：', e)
          }
        }
      }
    })
  },

  // 清空所有数据
  clearAllData() {
    wx.showModal({
      title: '⚠️ 危险操作',
      content: '此操作将清空您的所有数据，包括：\n\n• 积分和成就\n• 签到记录\n• 学号绑定信息\n• 称号和头像\n\n此操作不可恢复，确定要继续吗？',
      confirmText: '确定清空',
      confirmColor: '#ef4444',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '清空中...' })
          
          try {
            // 1. 清空云端数据
            let cloudSuccess = false
            try {
              const cloudResult = await wx.cloud.callFunction({
                name: 'clearUserData',
                data: {}
              })
              
              if (cloudResult.result && cloudResult.result.success) {
                cloudSuccess = true
                console.log('云端数据清空成功:', cloudResult.result.data)
              } else {
                console.warn('云端数据清空失败，仅清空本地数据')
              }
            } catch (cloudErr) {
              console.warn('云函数调用失败，仅清空本地数据:', cloudErr)
              // 云函数未部署或其他错误，继续清空本地数据
            }
            
            // 2. 清空本地数据
            this.clearLocalData()
            
            wx.hideLoading()
            
            const message = cloudSuccess 
              ? '云端和本地数据已清空' 
              : '本地数据已清空（云端数据未清空，请先部署clearUserData云函数）'
            
            wx.showModal({
              title: '清空完成',
              content: message,
              showCancel: false,
              success: () => {
                wx.reLaunch({
                  url: '/pages/index/index'
                })
              }
            })
          } catch (err) {
            wx.hideLoading()
            console.error('清空数据失败：', err)
            wx.showModal({
              title: '清空失败',
              content: err.message || '清空数据失败，请重试',
              showCancel: false
            })
          }
        }
      }
    })
  },

  // 清空本地数据
  clearLocalData() {
    try {
      // 清空所有本地存储
      wx.clearStorageSync()
      console.log('本地数据已清空')
    } catch (e) {
      console.error('清空本地数据失败：', e)
    }
  },

  // 检查更新
  checkUpdate() {
    wx.showLoading({ title: '检查中...' })
    setTimeout(() => {
      wx.hideLoading()
      wx.showToast({
        title: '当前已是最新版本',
        icon: 'none'
      })
    }, 1000)
  },

  goBack() {
    wx.navigateBack()
  }
})
