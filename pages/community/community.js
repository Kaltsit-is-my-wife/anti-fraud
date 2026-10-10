/**
 * 社区页面
 */

const { formatDateLocal } = require('../../utils/util')
const { resolveCloudFileUrls, getCloudFunctionErrorMessage } = require('../../utils/cloud')
const { readCacheData, writeCacheData, shouldRefresh } = require('../../utils/cache')

const TOPIC_CACHE_KEY = 'community:topics'
const TOPIC_CACHE_TTL_MS = 60 * 1000

Page({
  data: {
    topics: [],
    loading: false,
    loadFailed: false
  },

  onLoad() {
    const hasCachedTopics = this.restoreCachedTopics()
    if (!hasCachedTopics || shouldRefresh(TOPIC_CACHE_KEY, TOPIC_CACHE_TTL_MS)) {
      this.refresh({ silent: hasCachedTopics })
    }
  },

  onShow() {
    if (!this.data.loading && shouldRefresh(TOPIC_CACHE_KEY, TOPIC_CACHE_TTL_MS)) {
      this.refresh({ silent: this.data.topics.length > 0 })
    }
  },

  restoreCachedTopics() {
    const cached = readCacheData(TOPIC_CACHE_KEY)
    const topics = cached?.data
    if (!Array.isArray(topics) || topics.length === 0) {
      return false
    }

    this.setData({
      topics,
      loadFailed: false
    })
    return true
  },

  async refresh(options = {}) {
    if (this.data.loading) return false

    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'getTopics',
        data: { pageSize: 20 }
      })

      if (!(res.result && res.result.success)) {
        throw new Error(res.result?.errMsg || '话题列表加载失败')
      }

      const list = res.result.data?.list || []
      const urlMap = await resolveCloudFileUrls(list.map(topic => topic.coverImage))
      const topics = list.map(topic => ({
        ...topic,
        coverImage: urlMap[topic.coverImage] || topic.coverImage || '',
        publishedAtText: topic.publishedAt ? formatDateLocal(new Date(topic.publishedAt)) : '',
        periodText: this.formatPeriodText(topic.startAt, topic.endAt)
      }))

      this.setData({
        topics,
        loadFailed: false,
        loading: false
      })
      writeCacheData(TOPIC_CACHE_KEY, topics)
      return true
    } catch (err) {
      if (!options.silent || this.data.topics.length === 0) {
        wx.showToast({
          title: getCloudFunctionErrorMessage(err, 'getTopics', '话题列表加载失败'),
          icon: 'none'
        })
      }

      this.setData({
        loading: false,
        loadFailed: true
      })
      return false
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
    wx.showModal({
      title: '社区参与说明',
      content: '这里展示的是平台整理的反诈专题。\n\n进入话题详情后可以查看背景说明、参与评论交流，也欢迎结合真实案例补充经验与提醒。',
      showCancel: false,
      confirmText: '知道了'
    })
  }
})
