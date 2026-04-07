/**
 * 社区页面 - 社区模块 (v3)
 *
 * 上游依赖：云函数(getTopics)，页面路由 topic-detail
 * 入口：Tab页 onShow/onLoad
 * 主要功能：热点话题列表加载、跳转话题详情
 * 输出：热点话题列表渲染
 *
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */

const { formatDateLocal } = require('../../utils/util')

Page({
  data: {
    topics: [],
    loading: false,
    loadFailed: false
  },

  onLoad() {
    this.refresh()
  },

  onShow() {
    // 回到列表时可轻量刷新
  },

  async refresh() {
    if (this.data.loading) return
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'getTopics',
        data: { pageSize: 20 }
      })
      if (res.result && res.result.success) {
        const normalized = (res.result.data?.list || []).map(topic => ({
          ...topic,
          publishedAtText: topic.publishedAt ? formatDateLocal(new Date(topic.publishedAt)) : '',
          periodText: this.formatPeriodText(topic.startAt, topic.endAt)
        }))
        this.setData({
          topics: normalized,
          loadFailed: false,
          loading: false
        })
      } else {
        this.setData({ loading: false, loadFailed: true })
      }
    } catch (err) {
      console.error('load topics failed:', err)
      this.setData({ loading: false, loadFailed: true })
    }
  },

  formatPeriodText(startAt, endAt) {
    const startText = startAt ? formatDateLocal(new Date(startAt)) : ''
    const endText = endAt ? formatDateLocal(new Date(endAt)) : ''

    if (startText && endText) return `${startText} - ${endText}`
    if (startText) return `开始时间：${startText}`
    if (endText) return `结束时间：${endText}`
    return '长期开放'
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/topic-detail/topic-detail?id=${id}` })
  },

  showCommunityNotice() {
    wx.showToast({
      title: '社区已升级为官方话题讨论',
      icon: 'none'
    })
  }
})
