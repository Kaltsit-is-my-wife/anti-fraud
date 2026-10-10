Page({
  data: {
    loading: true,
    bankId: 'default_bank',
    bankName: '基础题库',
    questionCount: 10,
    previewMode: false,
    questions: [],
    currentIndex: 0,
    currentQuestion: null,
    selectedIndex: -1,
    answers: {},
    submitted: false,
    result: null
  },

  onLoad(options) {
    const bankId = options.bankId || 'default_bank'
    const bankName = options.bankName ? decodeURIComponent(options.bankName) : '基础题库'
    const questionCount = Math.max(1, Math.min(Number(options.count) || 10, 20))
    const previewMode = options.preview === '1'
    this.setData({ bankId, bankName, questionCount, previewMode })
    this.loadQuestions()
  },

  syncCurrent() {
    const question = this.data.questions[this.data.currentIndex] || null
    const selectedIndex = question ? (this.data.answers[question.questionId] ?? -1) : -1
    this.setData({ currentQuestion: question, selectedIndex })
  },

  async loadQuestions() {
    this.setData({ loading: true, submitted: false, result: null, currentIndex: 0, answers: {} })
    try {
      const res = await wx.cloud.callFunction({
        name: 'getQuizQuestions',
        data: {
          count: this.data.questionCount,
          bankId: this.data.bankId,
          preview: this.data.previewMode
        }
      })

      if (res.result && res.result.success) {
        const questions = res.result.data?.questions || []
        this.setData({ questions, loading: false, currentIndex: 0 })
        this.syncCurrent()
        return
      }

      wx.showToast({ title: res.result?.errMsg || '加载失败', icon: 'none' })
      this.setData({ loading: false })
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  selectOption(e) {
    const index = e.currentTarget.dataset.index
    const question = this.data.currentQuestion
    if (!question) return
    const answers = { ...this.data.answers, [question.questionId]: index }
    this.setData({ answers, selectedIndex: index })
  },

  prev() {
    if (this.data.currentIndex <= 0) return
    this.setData({ currentIndex: this.data.currentIndex - 1 })
    this.syncCurrent()
  },

  async nextOrSubmit() {
    const question = this.data.questions[this.data.currentIndex]
    if (!question) return
    const selected = this.data.answers[question.questionId]
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

  buildPreviewResult(questionIds, answers) {
    let correctCount = 0
    const results = this.data.questions.map(question => {
      const selected = answers[question.questionId]
      const correctIndex = Number(question.answerIndex || 0)
      const correct = selected === correctIndex
      if (correct) correctCount += 1

      return {
        questionId: question.questionId,
        correct,
        correctIndex,
        explanation: question.explanation || ''
      }
    })

    return {
      previewMode: true,
      correctCount,
      earnedQuizPoints: 0,
      earnedMallPoints: 0,
      dailyAwarded: 0,
      dailyCap: 0,
      results,
      message: '预览模式不会记录积分、排行榜和答题记录。'
    }
  },

  async submit() {
    const questionIds = this.data.questions.map(question => question.questionId)
    const answersArray = questionIds.map(id => this.data.answers[id])
    if (answersArray.some(answer => typeof answer !== 'number')) {
      wx.showToast({ title: '请完成全部题目', icon: 'none' })
      return
    }

    if (this.data.previewMode) {
      const answerMap = questionIds.reduce((acc, id, index) => {
        acc[id] = answersArray[index]
        return acc
      }, {})
      this.setData({
        submitted: true,
        result: this.buildPreviewResult(questionIds, answerMap)
      })
      return
    }

    wx.showLoading({ title: '判分中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'submitQuizAttempt',
        data: { questionIds, answers: answersArray, bankId: this.data.bankId }
      })
      wx.hideLoading()
      if (res.result && res.result.success) {
        this.setData({ submitted: true, result: res.result.data })
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
      wx.showToast({ title: '提交失败', icon: 'none' })
    }
  },

  restart() {
    this.loadQuestions()
  },

  goLeaderboard() {
    if (this.data.previewMode) return
    wx.navigateTo({ url: '/pages/quiz-leaderboard/quiz-leaderboard' })
  },

  goQuizHome() {
    if (this.data.previewMode) {
      wx.navigateBack()
      return
    }
    wx.switchTab({ url: '/pages/quiz-home/quiz-home' })
  }
})
