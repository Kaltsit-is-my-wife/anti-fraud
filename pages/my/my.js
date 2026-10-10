/**
 * 我的页面 - 用户个人资料模块
 * 
 * 上游依赖：云函数(getUserTitles)，本地缓存(userInfo, points, signDays)
 * 入口：页面onLoad/onShow生命周期
 * 主要功能：展示用户基本信息、成就数、称号列表、积分等数据
 * 输出：渲染用户个人资料界面并同步称号数据
 * 
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */
// pages/my/my.js
const { formatDateLocal } = require('../../utils/util.js')
const { FEATURE_FLAGS, POINTS_MALL_NOTICE } = require('../../utils/feature')

Page({
data: {
    userInfo: {},
    signDays: 0,
    points: 0,
    achievements: 0,
    totalReadCount: 0,
    // v3：主页展示成就
    displayAchievements: [],
    displayTitles: [],
    titleStats: {
      owned: 0,
      equipped: 0
    },
    pointsMallEnabled: FEATURE_FLAGS.pointsMallEnabled,
    tempNickname: '',
    isEditingNickname: false
  },

  onLoad() {
    this.refreshUserData()
    this.loadUserTitles()
  },

  onShow() {
    this.refreshUserData()
    this.loadUserTitles()
  },

  refreshUserData() {
    this.loadUserData()
    this.loadUserDataFromCloud()
  },

loadUserData() {
    const userInfo = wx.getStorageSync('userInfo') || {}
    const signDays = wx.getStorageSync('signDays') || 0
    const points = wx.getStorageSync('points') || 0
    const achievements = userInfo.achievements
      ? userInfo.achievements.length
      : (wx.getStorageSync('achievements') || 0)
    const totalReadCount = userInfo.totalReadCount || 0

    this.setData({
      userInfo,
      signDays,
      points,
      achievements,
      totalReadCount,
      tempNickname: userInfo.nickName || ''
    })
  },

  async loadUserDataFromCloud() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'getUserInfo',
        data: {}
      })

      if (result.result.success) {
        const response = result.result.data || {}
        const userInfo = response.userInfo || {}
        const signDates = Array.isArray(userInfo.signDates)
          ? userInfo.signDates
          : (wx.getStorageSync('signDates') || [])
        const signDays = typeof userInfo.signDays === 'number'
          ? userInfo.signDays
          : this.calculateConsecutiveDays(signDates)
        const points = typeof userInfo.points === 'number'
          ? userInfo.points
          : (wx.getStorageSync('points') || 0)
        const achievementList = Array.isArray(response.achievementList)
          ? response.achievementList
          : null
const achievements = achievementList
           ? achievementList.filter(item => item.unlocked).length
           : (Array.isArray(userInfo.achievements)
             ? userInfo.achievements.length
             : (wx.getStorageSync('achievements') || 0))
        const totalReadCount = userInfo.totalReadCount || 0

        const displayAchievementIds = Array.isArray(userInfo.displayAchievementIds)
          ? userInfo.displayAchievementIds
          : []
        const displayAchievements = achievementList
          ? achievementList.filter(item => item.unlocked && displayAchievementIds.includes(item.id)).slice(0, 6)
          : []

        this.setData({
          userInfo,
          signDays,
          points,
          achievements,
          totalReadCount,
          displayAchievements,
          tempNickname: userInfo.nickName || ''
        })

        wx.setStorageSync('userInfo', userInfo)
        wx.setStorageSync('signDates', signDates)
        wx.setStorageSync('signDays', signDays)
        wx.setStorageSync('points', points)
        wx.setStorageSync('achievements', achievements)
        wx.setStorageSync('totalReadCount', totalReadCount)
      } else {
        this.loadUserData()
      }
    } catch (err) {
      console.error('loadUserDataFromCloud failed:', err)
      this.loadUserData()
    }
  },


  getLocalDate() {
    return new Date()
  },

  calculateConsecutiveDays(signDates) {
    if (!Array.isArray(signDates) || signDates.length === 0) return 0

    const todayDate = this.getLocalDate()
    const today = formatDateLocal(todayDate)
    const sortedDates = [...signDates].sort().reverse()

    if (!sortedDates.includes(today)) {
      const yesterdayDate = new Date(todayDate.getTime() - 24 * 60 * 60 * 1000)
      const yesterday = formatDateLocal(yesterdayDate)
      if (!sortedDates.includes(yesterday)) {
        return 0
      }
    }

    let consecutiveDays = 0
    let checkDate = todayDate

    while (true) {
      const dateStr = formatDateLocal(checkDate)
      if (sortedDates.includes(dateStr)) {
        consecutiveDays += 1
        checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000)
      } else {
        break
      }
    }

    return consecutiveDays
  },

  async loadUserTitles() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'getUserTitles',
        data: {}
      })

      if (result.result.success) {
        const equippedTitles = result.result.data.equippedTitles || []
        const allTitles = result.result.data.allTitles || []
        const equippedIds = new Set(equippedTitles.map(item => item.titleId))
        const displayTitles = allTitles.map(item => ({
          ...item,
          isEquipped: equippedIds.has(item.titleId)
        }))

        this.setData({
          displayTitles,
          titleStats: {
            owned: result.result.data.ownedCount || allTitles.length,
            equipped: result.result.data.equippedCount || equippedTitles.length
          }
        })
      }
    } catch (err) {
      console.error('加载用户称号失败：', err)
    }
  },

  startEditNickname() {
    this.setData({
      isEditingNickname: true,
      tempNickname: this.data.userInfo.nickName
    })
  },

  async onNicknameBlur(e) {
    const nickName = e.detail.value.trim()
    if (nickName && nickName !== this.data.userInfo.nickName) {
      await this.updateNickname(nickName)
    }
    if (nickName) {
      this.setData({
        isEditingNickname: false
      })
    }
  },

  async onNicknameConfirm(e) {
    const nickName = e.detail.value.trim()
    const success = await this.updateNickname(nickName)
    if (success) {
      this.setData({
        isEditingNickname: false
      })
    }
  },

  async updateNickname(nickName) {
    if (!nickName || nickName.length < 2 || nickName.length > 20) {
      wx.showToast({
        title: '昵称长度需2-20个字符',
        icon: 'none'
      })
      return false
    }

    wx.showLoading({ title: '更新中...' })
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'login',
        data: {
          nickName: nickName,
          avatarUrl: this.data.userInfo.avatarUrl || ''
        }
      })
      
      if (result.result.success) {
        const updatedUserInfo = {
          ...this.data.userInfo,
          nickName: nickName
        }
        this.setData({
          userInfo: updatedUserInfo,
          tempNickname: nickName
        })
        wx.setStorageSync('userInfo', updatedUserInfo)
        wx.showToast({
          title: '昵称更新成功',
          icon: 'success'
        })
        return true
      } else {
        wx.showToast({
          title: result.result.errMsg || '更新失败',
          icon: 'none'
        })
        return false
      }
    } catch (err) {
      console.error('更新昵称失败：', err)
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      })
      return false
    } finally {
      wx.hideLoading()
    }
},

  navigateToLearningRecords() {
    wx.navigateTo({
      url: '/pages/learning-records/learning-records'
    })
  },

  navigateToBackpack() {
    wx.navigateTo({
      url: '/pages/backpack/backpack'
    })
  },

  navigateToPoints() {
    if (!this.data.pointsMallEnabled) {
      this.showPointsMallClosed()
      return
    }

    wx.navigateTo({
      url: '/pages/points/points'
    })
  },

  showPointsMallClosed() {
    wx.showModal({
      title: '积分商城暂未开放',
      content: POINTS_MALL_NOTICE,
      showCancel: false,
      confirmText: '知道了'
    })
  },

  // v3：管理展示成就
  navigateToAchievements() {
    wx.navigateTo({
      url: '/pages/achievements/achievements'
    })
  },

  goBack() {
    wx.navigateBack()
  }
})
