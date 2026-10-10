const LOGIN_CACHE_MS = 5 * 60 * 1000
const BIND_REMIND_INTERVAL_MS = 12 * 60 * 60 * 1000
const LAST_BIND_REMIND_KEY = 'last_bind_remind_at'

App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上基础库以使用云能力')
      return
    }

    this.restoreLocalSession()

    wx.cloud.init({
      traceUser: true
    })

    this.globalData.db = wx.cloud.database()
    this.ensureLogin({ silent: true })

    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)
  },

  restoreLocalSession() {
    const userInfo = wx.getStorageSync('userInfo') || null
    const openid = wx.getStorageSync('openid') || null

    if (userInfo) {
      this.globalData.userInfo = userInfo
      this.globalData.loginData = {
        userInfo,
        openid
      }
    }

    if (openid) {
      this.globalData.openid = openid
    }
  },

  persistSession(data) {
    if (!data || typeof data !== 'object') return

    this.globalData.loginData = data
    this.globalData.loginFetchedAt = Date.now()
    this.globalData.openid = data.openid || null
    this.globalData.userInfo = data.userInfo || null

    try {
      if (data.openid) {
        wx.setStorageSync('openid', data.openid)
      }
      if (data.userInfo) {
        wx.setStorageSync('userInfo', data.userInfo)
      }
    } catch (err) {
      console.warn('persistSession failed:', err)
    }
  },

  async ensureLogin(options = {}) {
    const force = options.force === true
    const silent = options.silent !== false
    const now = Date.now()

    if (!force && this.globalData.loginData && (now - this.globalData.loginFetchedAt) < LOGIN_CACHE_MS) {
      return this.globalData.loginData
    }

    if (this.globalData.loginPromise) {
      return this.globalData.loginPromise
    }

    this.globalData.loginPromise = wx.cloud.callFunction({
      name: 'login',
      data: {}
    }).then((result) => {
      if (!(result.result && result.result.success)) {
        throw new Error(result.result?.errMsg || 'login failed')
      }

      const data = result.result.data || {}
      this.persistSession(data)
      this.checkStudentBind(data.userInfo)
      return data
    }).catch((err) => {
      if (!silent) {
        console.error('ensureLogin failed:', err)
      }
      throw err
    }).finally(() => {
      this.globalData.loginPromise = null
    })

    return this.globalData.loginPromise
  },

  checkStudentBind(userInfo) {
    if (!userInfo || userInfo.isBound || this.globalData.bindPromptShown) {
      return
    }

    let lastRemindAt = 0
    try {
      lastRemindAt = wx.getStorageSync(LAST_BIND_REMIND_KEY) || 0
    } catch (err) {
      lastRemindAt = 0
    }

    if (Date.now() - lastRemindAt < BIND_REMIND_INTERVAL_MS) {
      return
    }

    this.globalData.bindPromptShown = true

    setTimeout(() => {
      wx.showModal({
        title: '完善学生信息',
        content: '为了提供更好的反诈教育服务，请绑定您的学号信息。',
        confirmText: '去绑定',
        cancelText: '稍后',
        success: (res) => {
          try {
            wx.setStorageSync(LAST_BIND_REMIND_KEY, Date.now())
          } catch (err) {
            // ignore cache failure
          }

          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/bind-student/bind-student'
            })
            return
          }

          this.globalData.bindRemindCount = (this.globalData.bindRemindCount || 0) + 1
        }
      })
    }, 2000)
  },

  globalData: {
    userInfo: null,
    db: null,
    openid: null,
    loginData: null,
    loginPromise: null,
    loginFetchedAt: 0,
    bindPromptShown: false,
    bindRemindCount: 0
  }
})
