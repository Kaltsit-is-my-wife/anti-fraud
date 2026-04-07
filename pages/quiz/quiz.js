/**
 * 趣味答题页面 - 趣味答题模块 (v3)
 *
 * 上游依赖：云函数(getQuizQuestions/submitQuizAttempt)
 * 入口：页面 onLoad
 * 主要功能：抽题、答题、交卷判分、展示结果与解析
 * 输出：答题结果；提示本次获得排行榜积分与商城积分（日上限30，UTC+8）
 *
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */

Page({
  data: {
    loading: true,
    bankId: 'default_bank',
    bankName: '基础题库',
    questionCount: 10,
    questions: [],
    currentIndex: 0,
    currentQuestion: null,
    selectedIndex: -1,
    answers: {}, // { [questionId]: index }
    submitted: false,
    result: null
  },

  onLoad(options) {
    const bankId = options.bankId || 'default_bank'
    const bankName = options.bankName ? decodeURIComponent(options.bankName) : '基础题库'
    const questionCount = Math.max(1, Math.min(Number(options.count) || 10, 20))
    this.setData({ bankId, bankName, questionCount })
    this.loadQuestions()
  },

  syncCurrent() {
    const q = this.data.questions[this.data.currentIndex] || null
    const selectedIndex = q ? (this.data.answers[q.questionId] ?? -1) : -1
    this.setData({ currentQuestion: q, selectedIndex })
  },

  async loadQuestions() {
    this.setData({ loading: true, submitted: false, result: null, currentIndex: 0, answers: {} })
    try {
      const res = await wx.cloud.callFunction({
        name: 'getQuizQuestions',
        data: { count: this.data.questionCount, bankId: this.data.bankId }
      })
      if (res.result && res.result.success) {
        const questions = res.result.data.questions || []
        this.setData({ questions, loading: false, currentIndex: 0 })
        this.syncCurrent()
      } else {
        wx.showToast({ title: res.result?.errMsg || '加载失败', icon: 'none' })
        this.setData({ loading: false })
      }
    } catch (err) {
      console.error('getQuizQuestions failed:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  selectOption(e) {
    const idx = e.currentTarget.dataset.index
    const q = this.data.currentQuestion
    if (!q) return
    const answers = { ...this.data.answers, [q.questionId]: idx }
    this.setData({ answers, selectedIndex: idx })
  },

  prev() {
    if (this.data.currentIndex <= 0) return
    this.setData({ currentIndex: this.data.currentIndex - 1 })
    this.syncCurrent()
  },

  async nextOrSubmit() {
    const q = this.data.questions[this.data.currentIndex]
    if (!q) return
    const selected = this.data.answers[q.questionId]
    if (typeof selected !== 'number') {
      wx.showToast({ title: '请选择答案', icon: 'none' })
      return
    }

    if (this.data.currentIndex === this.data.questions.length - 1) {
      await this.submit()
      return
    }
    this.setData({ currentIndex: this.data.currentIndex + 1 })
    this.syncCurrent()
  },

  async submit() {
    const questionIds = this.data.questions.map(q => q.questionId)
    const answers = questionIds.map(id => this.data.answers[id])
    if (answers.some(a => typeof a !== 'number')) {
      wx.showToast({ title: '请完成全部题目', icon: 'none' })
      return
    }

    wx.showLoading({ title: '判分中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'submitQuizAttempt',
        data: { questionIds, answers, bankId: this.data.bankId }
      })
      wx.hideLoading()
      if (res.result && res.result.success) {
        this.setData({ submitted: true, result: res.result.data })
        // 同步本地积分缓存（便于“我的/积分商城”立即刷新）
        try {
          const userInfoRes = await wx.cloud.callFunction({ name: 'getUserInfo', data: {} })
          if (userInfoRes.result && userInfoRes.result.success) {
            const points = userInfoRes.result.data.userInfo.points || 0
            wx.setStorageSync('points', points)
          }
        } catch (e) {}
      } else {
        wx.showToast({ title: res.result?.errMsg || '提交失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      console.error('submitQuizAttempt failed:', err)
      wx.showToast({ title: '提交失败', icon: 'none' })
    }
  },

  restart() {
    this.loadQuestions()
  },

  goLeaderboard() {
    wx.navigateTo({ url: '/pages/quiz-leaderboard/quiz-leaderboard' })
  },

  goQuizHome() {
    wx.switchTab({ url: '/pages/quiz-home/quiz-home' })
  }
})
