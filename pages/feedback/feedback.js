// pages/feedback/feedback.js
const { getCloudFunctionErrorMessage } = require('../../utils/cloud')

Page({
  data: {
    currentTab: 'help', // help, feedback
    feedbackContent: '',
    contactInfo: '',
    submitting: false,
    
    // 常见问题
    faqs: [
      {
        q: '如何每日签到？',
        a: '进入"我的"页面，点击"每日签到"按钮即可完成签到，每天可获得10积分。'
      },
      {
        q: 'AI助手如何使用？',
        a: '点击底部"AI助手"tab，输入您的问题，AI会为您解答反诈骗相关咨询。'
      },
      {
        q: '积分有什么用？',
        a: '积分会继续累计，用于学习激励和成长记录；积分商城当前暂未开放。'
      },
      {
        q: '如何查看学习记录？',
        a: '进入"我的"页面，点击"学习记录"可查看阅读历史和AI对话记录。'
      },
      {
        q: '遇到诈骗怎么办？',
        a: '立即拨打110报警或96110反诈专线，保留证据并冻结相关账户。'
      }
    ]
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ currentTab: tab })
  },

  onFeedbackInput(e) {
    this.setData({ feedbackContent: e.detail.value })
  },

  onContactInput(e) {
    this.setData({ contactInfo: e.detail.value })
  },

  async submitFeedback() {
    const { feedbackContent, contactInfo } = this.data
    
    if (!feedbackContent.trim()) {
      wx.showToast({
        title: '请填写反馈内容',
        icon: 'none'
      })
      return
    }

    if (this.data.submitting) return
    this.setData({ submitting: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'submitFeedback',
        data: {
          content: feedbackContent,
          contactInfo
        }
      })

      if (res.result && res.result.success) {
        wx.showToast({
          title: res.result.data?.message || '反馈已提交',
          icon: 'none'
        })
        this.setData({
          feedbackContent: '',
          contactInfo: ''
        })
      } else {
        wx.showToast({
          title: res.result?.errMsg || '提交失败',
          icon: 'none'
        })
      }
    } catch (err) {
      wx.showToast({
        title: getCloudFunctionErrorMessage(err, 'submitFeedback', '提交失败'),
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  },

  goBack() {
    wx.navigateBack()
  }
})
