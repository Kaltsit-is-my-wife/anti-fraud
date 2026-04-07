Page({
  data: {
    loading: true,
    banks: []
  },

  onLoad() {
    this.loadBanks()
  },

  onShow() {
    if (!this.data.loading && this.data.banks.length === 0) {
      this.loadBanks()
    }
  },

  async loadBanks() {
    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'getQuestionBanks',
        data: {}
      })

      if (res.result && res.result.success) {
        this.setData({
          banks: res.result.data?.list || [],
          loading: false
        })
        return
      }

      wx.showToast({ title: res.result?.errMsg || '加载失败', icon: 'none' })
    } catch (err) {
      console.error('getQuestionBanks failed:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }

    this.setData({ loading: false })
  },

  startQuiz(e) {
    const bankId = e.currentTarget.dataset.id
    const bankName = e.currentTarget.dataset.name
    const questionCount = e.currentTarget.dataset.count || 10
    if (!bankId) return

    wx.navigateTo({
      url: `/pages/quiz/quiz?bankId=${encodeURIComponent(bankId)}&bankName=${encodeURIComponent(bankName || '')}&count=${questionCount}`
    })
  }
})
