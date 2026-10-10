/**
 * 成就页面 - 成就系统模块
 * 
 * 上游依赖：本地存储数据（积分、签到天数、阅读文章数、对话次数）
 * 入口：页面onLoad生命周期，通过loadUserData加载用户数据
 * 主要功能：成就列表展示、成就解锁状态检查、成就统计、分享功能
 * 输出：渲染成就列表界面，显示用户成就进度和解锁状态
 * 
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */
// pages/achievements/achievements.js
Page({
  data: {
    // 用户数据
    totalPoints: 0,
    signDays: 0,
    readArticles: 0,
    chatTimes: 0,
    
    // 成就列表
    achievements: [
       // 签到类成就
       {
         id: 'sign_1',
         title: '初来乍到',
         desc: '完成首次签到',
         icon: '🎯',
         points: 10,
         target: 1,
         current: 0,
         type: 'sign',
         unlocked: false,
         rewardTitleId: null
       },
       {
         id: 'sign_7',
         title: '坚持不懈',
         desc: '连续签到7天',
         icon: '📅',
         points: 50,
         target: 7,
         current: 0,
         type: 'sign',
         unlocked: false,
         rewardTitleId: 'sign_7_title',  // 示例称号ID
         rewardTitleName: '七日勤勉'     // 示例称号名称
       },
       {
         id: 'sign_30',
         title: '月度冠军',
         desc: '连续签到30天',
         icon: '🏆',
         points: 200,
         target: 30,
         current: 0,
         type: 'sign',
         unlocked: false,
         rewardTitleId: 'sign_30_title',  // 示例称号ID
         rewardTitleName: '签到大师'      // 示例称号名称
       },
       {
         id: 'sign_100',
         title: '百日传奇',
         desc: '连续签到100天',
         icon: '💎',
         points: 1000,
         target: 100,
         current: 0,
         type: 'sign',
         unlocked: false,
         rewardTitleId: 'sign_100_title',  // 示例称号ID
         rewardTitleName: '百日传奇'       // 示例称号名称
       },
      
       // 学习类成就
       {
         id: 'read_1',
         title: '求知若渴',
         desc: '阅读1篇反诈文章',
         icon: '📖',
         points: 10,
         target: 1,
         current: 0,
         type: 'read',
         unlocked: false,
         rewardTitleId: null
       },
       {
         id: 'read_10',
         title: '博览群书',
         desc: '阅读10篇反诈文章',
         icon: '📚',
         points: 100,
         target: 10,
         current: 0,
         type: 'read',
         unlocked: false,
         rewardTitleId: 'read_10_title',   // 示例称号ID
         rewardTitleName: '求知者'         // 示例称号名称
       },
       {
         id: 'read_50',
         title: '反诈达人',
         desc: '阅读50篇反诈文章',
         icon: '🎓',
         points: 500,
         target: 50,
         current: 0,
         type: 'read',
         unlocked: false,
         rewardTitleId: 'read_50_title',   // 示例称号ID
         rewardTitleName: '博学者'         // 示例称号名称
       },
      
       // AI对话类成就
       {
         id: 'chat_1',
         title: '初次对话',
         desc: '与AI助手对话1次',
         icon: '💬',
         points: 10,
         target: 1,
         current: 0,
         type: 'chat',
         unlocked: false,
         rewardTitleId: null
       },
       {
         id: 'chat_10',
         title: '积极提问',
         desc: '与AI助手对话10次',
         icon: '🗨️',
         points: 50,
         target: 10,
         current: 0,
         type: 'chat',
         unlocked: false,
         rewardTitleId: 'chat_expert_10',   // 对应称号ID
         rewardTitleName: '对话新手'        // 对应称号名称
       },
       {
         id: 'chat_50',
         title: '防诈专家',
         desc: '与AI助手对话50次',
         icon: '🎖️',
         points: 200,
         target: 50,
         current: 0,
         type: 'chat',
         unlocked: false,
         rewardTitleId: 'chat_expert_50',   // 对应称号ID
         rewardTitleName: '对话达人'        // 对应称号名称
       },
      
       // 积分类成就
       {
         id: 'points_100',
         title: '初级卫士',
         desc: '累计获得100积分',
         icon: '⭐',
         points: 0,
         target: 100,
         current: 0,
         type: 'points',
         unlocked: false,
         rewardTitleId: null
       },
       {
         id: 'points_500',
         title: '中级卫士',
         desc: '累计获得500积分',
         icon: '🌟',
         points: 0,
         target: 500,
         current: 0,
         type: 'points',
         unlocked: false,
         rewardTitleId: null
       },
       {
         id: 'points_1000',
         title: '高级卫士',
         desc: '累计获得1000积分',
         icon: '✨',
         points: 0,
         target: 1000,
         current: 0,
         type: 'points',
         unlocked: false,
         rewardTitleId: null
       }
    ],
    
    // 统计数据
    stats: {
      unlocked: 0,
      total: 0,
      progress: 0
    },

    // v3：主页展示成就（用户可选，最多6个）
    displayAchievementIds: []
  },

  onLoad() {
    this.refreshAchievementData()
  },


  // 从云端加载用户数据
  async loadUserDataFromCloud() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'getUserInfo',
        data: {}
      })

      if (result.result.success) {
        const response = result.result.data || {}
        const userInfo = response.userInfo || {}
        const signDays = userInfo.signDays || 0
        const points = userInfo.points || 0
        const readArticles = userInfo.totalReadCount || 0
        const chatTimes = userInfo.totalChatCount || 0
        const achievementList = this.normalizeAchievementList(response.achievementList || [])
        const displayAchievementIds = Array.isArray(userInfo.displayAchievementIds)
          ? userInfo.displayAchievementIds
          : []

        const nextData = {
          signDays,
          totalPoints: points,
          readArticles,
          chatTimes,
          displayAchievementIds
        }

        if (achievementList.length > 0) {
          nextData.achievements = this.applyDisplayedFlags(achievementList, displayAchievementIds)
        }

        this.setData(nextData)

        if (achievementList.length > 0) {
          this.updateAchievementStats(nextData.achievements)
        } else {
          this.checkAchievements()
        }

        // Sync local cache
        if (userInfo && Object.keys(userInfo).length > 0) {
          wx.setStorageSync('userInfo', userInfo)
        }
        if (Array.isArray(userInfo.signDates)) {
          wx.setStorageSync('signDates', userInfo.signDates)
        }
        wx.setStorageSync('signDays', signDays)
        wx.setStorageSync('points', points)
        wx.setStorageSync('readArticles', readArticles)
        wx.setStorageSync('chatTimes', chatTimes)
        wx.setStorageSync('displayAchievementIds', displayAchievementIds)
        if (achievementList.length > 0) {
          wx.setStorageSync('achievements', achievementList.filter(item => item.unlocked).length)
        }

        return true
      }
    } catch (err) {
    }

    this.loadUserData()
    this.checkAchievements()
    return false
  },


  onShow() {
    this.refreshAchievementData()
  },

  refreshAchievementData() {
    this.loadUserDataFromCloud()
  },


  // 加载用户数据
  loadUserData() {
    try {
      const signDays = wx.getStorageSync('signDays') || 0
      const points = wx.getStorageSync('points') || 0
      const readArticles = wx.getStorageSync('readArticles') || 0
      const chatTimes = wx.getStorageSync('chatTimes') || 0
      const displayAchievementIds = wx.getStorageSync('displayAchievementIds')
        || (wx.getStorageSync('userInfo') || {}).displayAchievementIds
        || []

      this.setData({
        signDays,
        totalPoints: points,
        readArticles,
        chatTimes,
        displayAchievementIds
      })
    } catch (e) {
    }
  },
  formatAchievementTime(value) {
    if (!value) return ''

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')

    return `${year}-${month}-${day} ${hour}:${minute}`
  },

  normalizeAchievementList(list) {
    if (!Array.isArray(list)) return []

    const normalized = list.map(item => {
      const target = Number(item.target) || 0
      const current = Number(item.current) || 0
      const unlocked = typeof item.unlocked === 'boolean'
        ? item.unlocked
        : current >= target
      const earnedAtText = item.earnedAt
        ? this.formatAchievementTime(item.earnedAt)
        : ''

      return {
        ...item,
        target,
        current,
        unlocked,
        earnedAtText
      }
    })

    normalized.sort((a, b) => {
      if (a.unlocked && !b.unlocked) return -1
      if (!a.unlocked && b.unlocked) return 1
      return 0
    })

    return normalized
  },

  applyDisplayedFlags(achievements, displayAchievementIds) {
    const set = new Set(displayAchievementIds || [])
    return (achievements || []).map(a => ({
      ...a,
      isDisplayed: a.unlocked ? set.has(a.id) : false
    }))
  },

  updateAchievementStats(achievements) {
    const unlocked = achievements.filter(item => item.unlocked).length
    const total = achievements.length
    const progress = total > 0 ? Math.round((unlocked / total) * 100) : 0

    this.setData({
      'stats.unlocked': unlocked,
      'stats.total': total,
      'stats.progress': progress
    })
  },



  // 检查成就解锁状态
  checkAchievements() {
    const { signDays, totalPoints, readArticles, chatTimes } = this.data

    let achievements = this.data.achievements.map(item => {
      let current = 0
      
      // 根据类型获取当前进度
      switch (item.type) {
        case 'sign':
          current = signDays
          break
        case 'read':
          current = readArticles
          break
        case 'chat':
          current = chatTimes
          break
        case 'points':
          current = totalPoints
          break
      }
      
      // 检查是否解锁
      const unlocked = current >= item.target

      return {
        ...item,
        current,
        unlocked
      }
    })
    
    // 将已解锁的成就置顶
    achievements.sort((a, b) => {
      if (a.unlocked && !b.unlocked) return -1
      if (!a.unlocked && b.unlocked) return 1
      return 0
    })
    
    // 计算统计数据
    const unlocked = achievements.filter(item => item.unlocked).length
    const total = achievements.length
    const progress = total > 0 ? Math.round((unlocked / total) * 100) : 0

    const displayAchievementIds = Array.isArray(this.data.displayAchievementIds)
      ? this.data.displayAchievementIds
      : []
    this.setData({
      achievements: this.applyDisplayedFlags(achievements, displayAchievementIds),
      'stats.unlocked': unlocked,
      'stats.total': total,
      'stats.progress': progress
    })
  },

  // 显示解锁提示
  showUnlockTip(achievement) {
    wx.showToast({
      title: `🎉 解锁成就：${achievement.title}`,
      icon: 'none',
      duration: 2000
    })
  },

  // 切换成就类型筛选
  filterAchievements(e) {
  },

  // 分享成就
  shareAchievement(e) {
    const id = e.currentTarget.dataset.id
    const achievement = this.data.achievements.find(item => item.id === id)
    
    if (!achievement || !achievement.unlocked) {
      wx.showToast({
        title: '该成就尚未解锁',
        icon: 'none'
      })
      return
    }
    
    wx.showToast({
      title: '请点击右上角菜单分享',
      icon: 'none'
    })
  },

  // v3：设置/取消成就展示（最多6个）
  async toggleDisplayAchievement(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.achievements.find(x => x.id === id)
    if (!item || !item.unlocked) {
      wx.showToast({ title: '该成就尚未解锁', icon: 'none' })
      return
    }

    const current = Array.isArray(this.data.displayAchievementIds) ? [...this.data.displayAchievementIds] : []
    const exists = current.includes(id)
    let next = []
    if (exists) {
      next = current.filter(x => x !== id)
    } else {
      if (current.length >= 6) {
        wx.showToast({ title: '最多展示6个成就', icon: 'none' })
        return
      }
      next = current.concat(id)
    }

    wx.showLoading({ title: '保存中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'updateProfileDisplay',
        data: { displayAchievementIds: next }
      })
      wx.hideLoading()
      if (res.result && res.result.success) {
        const ids = res.result.data.displayAchievementIds || next
        this.setData({
          displayAchievementIds: ids,
          achievements: this.applyDisplayedFlags(this.data.achievements, ids)
        })
        wx.setStorageSync('displayAchievementIds', ids)
        const cachedUserInfo = wx.getStorageSync('userInfo') || {}
        if (cachedUserInfo && typeof cachedUserInfo === 'object') {
          wx.setStorageSync('userInfo', { ...cachedUserInfo, displayAchievementIds: ids })
        }
        wx.showToast({ title: exists ? '已取消展示' : '已设为展示', icon: 'success' })
      } else {
        wx.showToast({ title: res.result?.errMsg || '保存失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  }
})
