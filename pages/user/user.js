// pages/user/user.js
const { formatDateLocal } = require('../../utils/util.js')
const { buildPermissionSnapshot } = require('../../utils/permission')
const { FEATURE_FLAGS, POINTS_MALL_NOTICE } = require('../../utils/feature')
const { readCacheData, writeCacheData, shouldRefresh } = require('../../utils/cache')

const USER_SUMMARY_CACHE_KEY = 'user:summary'
const USER_TITLES_CACHE_KEY = 'user:titles'
const USER_UNREAD_CACHE_KEY = 'user:unread'
const USER_SUMMARY_CACHE_TTL_MS = 60 * 1000
const USER_TITLES_CACHE_TTL_MS = 2 * 60 * 1000
const USER_UNREAD_CACHE_TTL_MS = 30 * 1000

Page({
  data: {
    userInfo: {
      nickName: '',
      avatarUrl: ''
    },
    signDays: 0,
    signDates: [],
    points: 0,
    achievements: 0,
    displayAchievements: [],
    todaySigned: false,
    equippedTitles: [],
    allTitles: [],
    hasReviewAccess: false,
    hasAdminAccess: false,
    pointsMallEnabled: FEATURE_FLAGS.pointsMallEnabled,
    unreadCount: 0
  },

  onLoad() {
    this.loadUserData()
    this.restoreCachedTitles()
    this.restoreCachedUnreadCount()
    this.refreshPageData({ force: true, preferLogin: true })
  },

  onShow() {
    this.refreshPageData()
  },

  onHide() {
    this.saveToLocal()
  },

  onUnload() {
    this.saveToLocal()
  },

  saveToLocal() {
    wx.setStorageSync('signDays', this.data.signDays)
    wx.setStorageSync('signDates', this.data.signDates)
    wx.setStorageSync('points', this.data.points)
    wx.setStorageSync('achievements', this.data.achievements)
    wx.setStorageSync('displayAchievements', this.data.displayAchievements || [])

    const displayAchievementIds = (this.data.displayAchievements || [])
      .map(item => item?.id)
      .filter(Boolean)
    wx.setStorageSync('displayAchievementIds', displayAchievementIds)

    if (this.data.signDates.length > 0) {
      wx.setStorageSync('lastSignDate', this.data.signDates[this.data.signDates.length - 1])
    }
  },

  async refreshPageData(options = {}) {
    if (this._refreshPromise) {
      return this._refreshPromise
    }

    const tasks = []

    if (options.force || shouldRefresh(USER_SUMMARY_CACHE_KEY, USER_SUMMARY_CACHE_TTL_MS)) {
      tasks.push(this.loadUserDataFromCloud({ preferLogin: options.preferLogin === true }))
    }

    if (options.force || shouldRefresh(USER_TITLES_CACHE_KEY, USER_TITLES_CACHE_TTL_MS)) {
      tasks.push(this.loadUserTitles())
    }

    if (options.force || shouldRefresh(USER_UNREAD_CACHE_KEY, USER_UNREAD_CACHE_TTL_MS)) {
      tasks.push(this.loadUnreadCount())
    }

    if (!tasks.length) {
      return []
    }

    this._refreshPromise = Promise.allSettled(tasks).finally(() => {
      this._refreshPromise = null
    })

    return this._refreshPromise
  },

  applyUserData(data = {}) {
    const userInfo = data.userInfo || {}
    const signDates = Array.isArray(userInfo.signDates) ? userInfo.signDates : []
    const signDays = this.calculateConsecutiveDays(signDates)
    const achievementList = Array.isArray(data.achievementList) ? data.achievementList : []
    const displayAchievementIds = Array.isArray(userInfo.displayAchievementIds)
      ? userInfo.displayAchievementIds
      : []
    const displayAchievements = achievementList.length > 0
      ? achievementList
        .filter(item => item.unlocked && displayAchievementIds.includes(item.id))
        .slice(0, 6)
      : (wx.getStorageSync('displayAchievements') || [])
    const todaySigned = this.checkTodaySigned(signDates)
    const permission = buildPermissionSnapshot(userInfo)

    this.setData({
      userInfo,
      signDays,
      signDates,
      points: userInfo.points || 0,
      achievements: Array.isArray(userInfo.achievements) ? userInfo.achievements.length : (wx.getStorageSync('achievements') || 0),
      displayAchievements,
      todaySigned,
      hasReviewAccess: permission.hasReviewAccess,
      hasAdminAccess: permission.hasAdminAccess
    })

    wx.setStorageSync('userInfo', userInfo)
    if (data.openid) {
      wx.setStorageSync('openid', data.openid)
    }
    wx.setStorageSync('signDays', signDays)
    wx.setStorageSync('signDates', signDates)
    wx.setStorageSync('points', userInfo.points || 0)
    wx.setStorageSync('achievements', Array.isArray(userInfo.achievements) ? userInfo.achievements.length : 0)
    wx.setStorageSync('displayAchievements', displayAchievements)
    wx.setStorageSync('displayAchievementIds', displayAchievementIds)

    if (signDates.length > 0) {
      wx.setStorageSync('lastSignDate', signDates[signDates.length - 1])
    }
  },

  async loadUserDataFromCloud(options = {}) {
    try {
      if (options.preferLogin) {
        const app = getApp()
        if (app && typeof app.ensureLogin === 'function') {
          const loginData = await app.ensureLogin({ silent: true })
          if (loginData && loginData.userInfo) {
            this.applyUserData(loginData)
          }
        }
      }

      const result = await wx.cloud.callFunction({
        name: 'getUserInfo',
        data: {}
      })

      if (!(result.result && result.result.success)) {
        throw new Error(result.result?.errMsg || 'getUserInfo failed')
      }

      const data = result.result.data || {}
      this.applyUserData(data)
      writeCacheData(USER_SUMMARY_CACHE_KEY, data)
      return true
    } catch (err) {
      this.loadUserData()
      return false
    }
  },

  loadUserData() {
    const userInfo = wx.getStorageSync('userInfo') || {}
    const signDates = wx.getStorageSync('signDates') || []
    const signDays = this.calculateConsecutiveDays(signDates)
    const points = wx.getStorageSync('points') || 0
    const achievements = Array.isArray(userInfo.achievements)
      ? userInfo.achievements.length
      : (wx.getStorageSync('achievements') || 0)
    const todaySigned = this.checkTodaySigned(signDates)
    const displayAchievements = wx.getStorageSync('displayAchievements') || []
    const permission = buildPermissionSnapshot(userInfo)

    this.setData({
      userInfo,
      signDays,
      signDates,
      points,
      achievements,
      displayAchievements,
      todaySigned,
      hasReviewAccess: permission.hasReviewAccess,
      hasAdminAccess: permission.hasAdminAccess
    })
  },

  calculateConsecutiveDays(signDates) {
    if (!signDates || signDates.length === 0) return 0

    const todayDate = new Date()
    const today = formatDateLocal(todayDate)
    const sortedDates = [...signDates].sort()

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
      if (!sortedDates.includes(dateStr)) {
        break
      }
      consecutiveDays++
      checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000)
    }

    return consecutiveDays
  },

  checkTodaySigned(signDates) {
    const dates = signDates || this.data.signDates || wx.getStorageSync('signDates') || []
    const today = formatDateLocal(new Date())
    return dates.includes(today)
  },

  async onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    wx.showLoading({ title: '更新中...' })

    try {
      const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath,
        filePath: avatarUrl
      })

      const cloudAvatarUrl = uploadResult.fileID
      const result = await wx.cloud.callFunction({
        name: 'login',
        data: {
          nickName: this.data.userInfo.nickName,
          avatarUrl: cloudAvatarUrl
        }
      })

      if (!(result.result && result.result.success)) {
        throw new Error(result.result?.errMsg || 'update avatar failed')
      }

      const data = result.result.data || {}
      this.applyUserData(data)
      const app = getApp()
      if (app && typeof app.persistSession === 'function') {
        app.persistSession(data)
      }

      wx.showToast({
        title: '头像更新成功',
        icon: 'success'
      })
    } catch (err) {
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  async handleSignIn() {
    if (this.checkTodaySigned()) {
      this.setData({ todaySigned: true })
      wx.showToast({
        title: '今天已签到',
        icon: 'none'
      })
      return
    }

    wx.showLoading({ title: '签到中...' })

    try {
      const result = await wx.cloud.callFunction({
        name: 'userSignIn',
        data: {}
      })

      wx.hideLoading()

      if (!(result.result && result.result.success)) {
        const errMsg = result.result?.errMsg || '签到失败'
        if (errMsg.includes('已经签到') || errMsg.includes('已签到')) {
          this.refreshPageData({ force: true })
        }
        wx.showToast({
          title: errMsg,
          icon: 'none'
        })
        return
      }

      const data = result.result.data || {}
      this.setData({
        signDays: data.signDays || this.data.signDays,
        signDates: data.signDates || this.data.signDates,
        points: data.points || this.data.points,
        todaySigned: true
      })
      this.saveToLocal()

      wx.showModal({
        title: '签到成功',
        content: result.result.message || `恭喜你，连续签到${data.signDays}天，获得${data.earnedPoints}积分。`,
        showCancel: false,
        confirmText: '知道了'
      })

      this.refreshPageData({ force: true })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({
        title: '签到失败，请重试',
        icon: 'none'
      })
    }
  },

  openMyProfile() {
    if (!this.data.userInfo.nickName) {
      wx.showToast({
        title: '请先设置昵称',
        icon: 'none'
      })
      return
    }

    wx.navigateTo({
      url: '/pages/my/my'
    })
  },

  navigateTo(e) {
    const url = e.currentTarget.dataset.url
    if (!url) return

    if (url === '/pages/points/points' && !this.data.pointsMallEnabled) {
      this.showPointsMallClosed()
      return
    }

    if (url === '/pages/review-center/review-center' && !this.data.hasReviewAccess) {
      wx.showToast({
        title: '无审核权限',
        icon: 'none'
      })
      return
    }

    if (url === '/pages/admin-center/admin-center' && !this.data.hasAdminAccess) {
      wx.showToast({
        title: '无管理权限',
        icon: 'none'
      })
      return
    }

    wx.navigateTo({ url })
  },

  showPointsMallClosed() {
    wx.showModal({
      title: '积分商城暂未开放',
      content: POINTS_MALL_NOTICE,
      showCancel: false,
      confirmText: '知道了'
    })
  },

  restoreCachedTitles() {
    const cached = readCacheData(USER_TITLES_CACHE_KEY)
    const payload = cached?.data
    if (!payload) return false

    this.setData({
      equippedTitles: payload.equippedTitles || [],
      allTitles: payload.allTitles || []
    })
    return true
  },

  async loadUserTitles() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'getUserTitles',
        data: {}
      })

      if (!(result.result && result.result.success)) {
        return false
      }

      const payload = {
        equippedTitles: result.result.data?.equippedTitles || [],
        allTitles: result.result.data?.allTitles || []
      }

      this.setData(payload)
      writeCacheData(USER_TITLES_CACHE_KEY, payload)
      return true
    } catch (err) {
      return false
    }
  },

  showTitleManagement() {
    wx.navigateTo({
      url: '/pages/title-management/title-management'
    })
  },

  restoreCachedUnreadCount() {
    const cached = readCacheData(USER_UNREAD_CACHE_KEY)
    const payload = cached?.data
    if (!payload || typeof payload.unreadCount !== 'number') {
      return false
    }

    this.setData({ unreadCount: payload.unreadCount })
    return true
  },

  async loadUnreadCount() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getUnreadCount',
        data: {}
      })

      if (!(res.result && res.result.success)) {
        return false
      }

      const unreadCount = res.result.data?.unread || 0
      this.setData({ unreadCount })
      writeCacheData(USER_UNREAD_CACHE_KEY, { unreadCount })
      return true
    } catch (err) {
      return false
    }
  },

  openMessages() {
    wx.navigateTo({ url: '/pages/messages/messages' })
  }
})
