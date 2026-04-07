/**
 * 诈骗反馈页面 - 诈骗反馈模块 (v3)
 *
 * 上游依赖：云函数(createScamReport)
 * 入口：页面 onLoad
 * 主要功能：提交诈骗反馈；成功后提示拨打 96110
 * 输出：反馈记录入库
 *
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */

Page({
  data: {
    typeOptions: ['电信诈骗', '刷单返利', '冒充客服退款', '冒充公检法', '校园贷/网贷', '杀猪盘', '其他'],
    typeIndex: 0,
    channelOptions: ['电话', '短信', '社交软件', '网页/链接', 'APP', '线下', '其他'],
    channelIndex: 0,
    scamAccount: '',
    scamLink: '',
    content: '',
    submitting: false
  },

  onTypeChange(e) {
    this.setData({ typeIndex: Number(e.detail.value) || 0 })
  },

  onChannelChange(e) {
    this.setData({ channelIndex: Number(e.detail.value) || 0 })
  },

  onAccountInput(e) {
    this.setData({ scamAccount: e.detail.value })
  },

  onLinkInput(e) {
    this.setData({ scamLink: e.detail.value })
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value })
  },

  async submit() {
    const content = (this.data.content || '').trim()
    if (!content) {
      wx.showToast({ title: '请填写详细描述', icon: 'none' })
      return
    }
    if (this.data.submitting) return
    this.setData({ submitting: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'createScamReport',
        data: {
          type: this.data.typeOptions[this.data.typeIndex],
          channel: this.data.channelOptions[this.data.channelIndex],
          scamAccount: this.data.scamAccount,
          scamLink: this.data.scamLink,
          content,
          images: []
        }
      })
      if (res.result && res.result.success) {
        this.setData({ content: '', scamAccount: '', scamLink: '' })
        wx.showModal({
          title: '反馈成功',
          content: '反馈已提交并进入审核。如你正在遭遇诈骗或已发生转账，请立即拨打 96110 反诈专线报警/咨询。',
          confirmText: '拨打96110',
          cancelText: '稍后',
          success: (r) => {
            if (r.confirm) {
              wx.makePhoneCall({ phoneNumber: '96110' })
            }
          }
        })
      } else {
        wx.showToast({ title: res.result?.errMsg || '提交失败', icon: 'none' })
      }
    } catch (err) {
      console.error('createScamReport failed:', err)
      wx.showToast({ title: '提交失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },

  goBack() {
    wx.navigateBack()
  }
})

