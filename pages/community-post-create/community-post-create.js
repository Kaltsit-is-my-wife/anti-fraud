/**
 * 发帖页面 - 社区模块 (v3)
 *
 * 上游依赖：云函数(createPost)
 * 入口：页面 onLoad
 * 主要功能：发布帖子内容
 * 输出：发布成功后返回上一页并提示
 *
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */

Page({
  data: {
    content: '',
    submitting: false
  },

  onInput(e) {
    this.setData({ content: e.detail.value })
  },

  async submit() {
    const content = (this.data.content || '').trim()
    if (!content) {
      wx.showToast({ title: '请输入内容', icon: 'none' })
      return
    }
    if (this.data.submitting) return
    this.setData({ submitting: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'createPost',
        data: { content, images: [] }
      })
      if (res.result && res.result.success) {
        const message = res.result.data?.message || '发布成功'
        wx.showToast({ title: message, icon: 'none', duration: 1800 })
        setTimeout(() => wx.navigateBack(), 1200)
      } else {
        wx.showToast({ title: res.result?.errMsg || '发布失败', icon: 'none' })
      }
    } catch (err) {
      console.error('createPost failed:', err)
      wx.showToast({ title: '发布失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },

  goBack() {
    wx.navigateBack()
  }
})

