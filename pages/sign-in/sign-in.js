/**
 * 每日签到页面 - 签到日历模块
 * 
 * 上游依赖：云函数(userSignIn)，本地缓存(signDays, points, lastSignDate)
 * 入口：页面onLoad/onShow生命周期
 * 主要功能：展示签到日历、自动触发今日签到、同步签到数据
 * 输出：更新页面数据与本地缓存，触发签到交互提示
 * 
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */
// pages/sign-in/sign-in.js
const { formatDateLocal } = require('../../utils/util.js')

Page({
  data: {
    signDays: 0,
    signDates: [],
    points: 0,
    todaySigned: false,
    calendarDays: [],
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    currentMonthLabel: '',
    isSigning: false
  },

  onLoad() {
    this.refreshState()
    this.buildCalendar()
    this.autoSignIn()
  },

  onShow() {
    this.refreshStateFromCloud()
    this.buildCalendar()
    this.autoSignIn()
  },

  async refreshStateFromCloud() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'getUserInfo',
        data: {}
      })
      
      if (result.result.success) {
        const data = result.result.data.userInfo
        const signDates = data.signDates || []
        const signDays = this.calculateConsecutiveDays(signDates)
        const points = data.points || 0
        const todaySigned = this.checkTodaySigned(signDates)
        
        this.setData({
          signDays,
          signDates,
          points,
          todaySigned
        })
        
        wx.setStorageSync('signDates', signDates)
        wx.setStorageSync('points', points)
        
      }
    } catch (err) {
      this.refreshState()
    }
  },

  refreshState() {
    const signDates = wx.getStorageSync('signDates') || []
    const signDays = this.calculateConsecutiveDays(signDates)
    const points = wx.getStorageSync('points') || 0
    const todaySigned = this.checkTodaySigned(signDates)

    this.setData({
      signDays,
      signDates,
      points,
      todaySigned
    })
  },

  calculateConsecutiveDays(signDates) {
    if (!signDates || signDates.length === 0) return 0
    
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
        consecutiveDays++
        checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000)
      } else {
        break
      }
    }
    
    return consecutiveDays
  },

  getLocalDate() {
    return new Date()
  },

  checkTodaySigned(signDates) {
    const dates = signDates || this.data.signDates || wx.getStorageSync('signDates') || []
    const today = formatDateLocal(this.getLocalDate())
    return dates.includes(today)
  },

  buildCalendar() {
    const now = this.getLocalDate()
    const year = now.getFullYear()
    const month = now.getMonth()
    const firstDay = new Date(year, month, 1)
    const startWeekday = firstDay.getDay()
    const totalDays = new Date(year, month + 1, 0).getDate()
    const currentMonthLabel = `${year}年${String(month + 1).padStart(2, '0')}月`

    const signDates = this.data.signDates || []
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const calendarDays = []

    for (let i = 0; i < startWeekday; i += 1) {
      calendarDays.push({ day: '', isPlaceholder: true })
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(year, month, day)
      const dateStr = formatDateLocal(date)
      const isToday = date.getTime() === todayDate.getTime()
      const isSigned = signDates.includes(dateStr)

      calendarDays.push({
        day,
        isPlaceholder: false,
        isToday,
        isSigned
      })
    }

    this.setData({
      calendarDays,
      currentMonthLabel
    })
  },

  autoSignIn() {
    if (this.data.todaySigned || this.data.isSigning) {
      return
    }

    this.doSignIn(true)
  },

  handleSignIn() {
    this.doSignIn(false)
  },

  async doSignIn(isAuto) {
    const todaySigned = this.checkTodaySigned()

    if (todaySigned) {
      this.setData({ todaySigned: true })
      if (!isAuto) {
        wx.showToast({
          title: '今天已签到',
          icon: 'none'
        })
      }
      return
    }

    if (this.data.isSigning) return
    this.setData({ isSigning: true })

    const showLoading = !isAuto
    if (showLoading) {
      wx.showLoading({ title: '签到中...' })
    }

    try {
      const result = await wx.cloud.callFunction({
        name: 'userSignIn',
        data: {}
      })

      if (showLoading) {
        wx.hideLoading()
      }

      if (result.result && result.result.success) {
        const data = result.result.data || {}
        const signDays = data.signDays ?? this.data.signDays
        const signDates = data.signDates ?? this.data.signDates
        const points = data.points ?? this.data.points
        const achievementPoints = data.achievementPoints || 0

        this.setData({
          signDays,
          signDates,
          points,
          todaySigned: true
        })

        wx.setStorageSync('signDays', signDays)
        wx.setStorageSync('signDates', signDates)
        wx.setStorageSync('points', points)
        if (data.lastSignDate) {
          wx.setStorageSync('lastSignDate', data.lastSignDate)
        }

        this.buildCalendar()

        if (isAuto) {
          wx.showToast({
            title: achievementPoints ? `自动签到+${achievementPoints}` : '已自动签到',
            icon: 'success'
          })
        } else {
          let content = result.result.message || `连续签到${signDays}天，获得${data.earnedPoints || 0}积分`
          if (achievementPoints) {
            content += `\n成就奖励 +${achievementPoints} 积分`
          }
          wx.showModal({
            title: '签到成功',
            content,
            showCancel: false,
            confirmText: '知道了'
          })
        }
      } else {
        const errMsg = result.result?.errMsg || '签到失败'
        if (!isAuto) {
          wx.showToast({
            title: errMsg,
            icon: 'none'
          })
        }
      }
    } catch (err) {
      if (showLoading) {
        wx.hideLoading()
      }
      if (!isAuto) {
        wx.showToast({
          title: '签到失败，请重试',
          icon: 'none'
        })
      }
    } finally {
      this.setData({ isSigning: false })
    }
  },

  goBack() {
    wx.navigateBack()
  }
})
