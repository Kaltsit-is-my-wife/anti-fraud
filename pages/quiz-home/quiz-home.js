const { resolveCloudFileUrls, getCloudFunctionErrorMessage } = require('../../utils/cloud')

Page({
  data: {
    loading: false,
    banks: []
  },

  onLoad() {
    this.loadBanks()
  },

  onShow() {
    if (!this.data.loading) {
      this.loadBanks()
    }
  },

  async loadBanks() {
    if (this.data.loading) return
    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'getQuestionBanks',
        data: {}
      })

      if (res.result && res.result.success) {
        const list = res.result.data?.list || []
        const urlMap = await resolveCloudFileUrls(list.map(item => item.coverImage))
        this.setData({
          banks: list.map(item => ({
            ...item,
            coverImage: urlMap[item.coverImage] || item.coverImage || ''
          })),
          loading: false
        })
        return
      }

      wx.showToast({ title: res.result?.errMsg || '加载失败', icon: 'none' })
    } catch (err) {
      wx.showToast({
        title: getCloudFunctionErrorMessage(err, 'getQuestionBanks', '题库列表加载失败'),
        icon: 'none'
      })
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
