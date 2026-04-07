const { formatDateLocal } = require('../../utils/util')

Page({
  data: {
    loading: true,
    topicId: '',
    topic: null,
    relatedArticles: [],
    relatedVideos: [],
    comments: [],
    inputText: '',
    replyTo: null,
    replyPlaceholder: '发表评论...'
  },

  onLoad(options) {
    const topicId = options.id || ''
    this.setData({ topicId })

    if (!topicId) {
      wx.showToast({ title: '话题不存在', icon: 'none' })
      this.setData({ loading: false })
      return
    }

    this.loadTopicDetail()
    this.loadComments()
  },

  async loadTopicDetail() {
    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'getTopicDetail',
        data: { topicId: this.data.topicId }
      })

      if (!(res.result && res.result.success)) {
        wx.showToast({ title: res.result?.errMsg || '加载失败', icon: 'none' })
        this.setData({ loading: false })
        return
      }

      const data = res.result.data || {}
      const topic = data.topic || {}

      this.setData({
        topic: {
          ...topic,
          publishedAtText: topic.publishedAt ? formatDateLocal(new Date(topic.publishedAt)) : '',
          startAtText: topic.startAt ? formatDateLocal(new Date(topic.startAt)) : '',
          endAtText: topic.endAt ? formatDateLocal(new Date(topic.endAt)) : ''
        },
        relatedArticles: data.relatedArticles || [],
        relatedVideos: data.relatedVideos || [],
        loading: false
      })
    } catch (err) {
      console.error('loadTopicDetail failed:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  goArticle(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/article-detail/article-detail?id=${id}` })
  },

  async loadComments() {
    if (!this.data.topicId) return

    try {
      const res = await wx.cloud.callFunction({
        name: 'getTopicComments',
        data: { topicId: this.data.topicId, pageSize: 100 }
      })

      if (!(res.result && res.result.success)) return

      const list = res.result.data?.comments || []
      const byId = new Map(list.map(item => [item._id, item]))
      const comments = list.map(item => ({
        ...item,
        createdAtText: item.createdAt ? formatDateLocal(new Date(item.createdAt)) : '',
        replyToNickName: item.parentId ? (byId.get(item.parentId)?.authorNickName || '') : ''
      }))

      this.setData({ comments })
    } catch (err) {
      console.error('loadComments failed:', err)
    }
  },

  onCommentInput(e) {
    this.setData({ inputText: e.detail.value })
  },

  startReply(e) {
    const parentId = e.currentTarget.dataset.id
    const replyToUid = e.currentTarget.dataset.uid
    const replyToNickName = e.currentTarget.dataset.name || ''

    this.setData({
      replyTo: { parentId, replyToUid, replyToNickName },
      replyPlaceholder: replyToNickName ? `回复 ${replyToNickName}...` : '回复...'
    })
  },

  async submitComment() {
    const content = (this.data.inputText || '').trim()
    if (!content) {
      wx.showToast({ title: '请输入评论内容', icon: 'none' })
      return
    }

    const payload = {
      topicId: this.data.topicId,
      content
    }

    if (this.data.replyTo && this.data.replyTo.parentId) {
      payload.parentId = this.data.replyTo.parentId
      payload.replyToUid = this.data.replyTo.replyToUid
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'submitTopicComment',
        data: payload
      })

      if (res.result && res.result.success) {
        this.setData({
          inputText: '',
          replyTo: null,
          replyPlaceholder: '发表评论...'
        })
        wx.showToast({
          title: res.result.data?.message || '评论已提交审核',
          icon: 'none'
        })
        return
      }

      wx.showToast({
        title: res.result?.errMsg || '提交失败',
        icon: 'none'
      })
    } catch (err) {
      console.error('submitTopicComment failed:', err)
      wx.showToast({ title: '提交失败', icon: 'none' })
    }
  },

  goVideo(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/video-detail/video-detail?id=${id}` })
  }
})
