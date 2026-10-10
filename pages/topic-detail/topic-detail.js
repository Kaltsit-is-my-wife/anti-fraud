const { formatDateLocal } = require('../../utils/util')
const { resolveCloudFileUrls, getCloudFunctionErrorMessage } = require('../../utils/cloud')

Page({
  data: {
    loading: true,
    topicId: '',
    topic: null,
    relatedArticles: [],
    relatedVideos: [],
    comments: [],
    inputText: '',
    commentSubmitting: false,
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

  onShow() {
    if (this.data.topicId && this.data.topic) {
      this.loadComments()
    }
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
      const contentBlocks = Array.isArray(topic.contentBlocks) ? topic.contentBlocks : []
      const relatedArticles = data.relatedArticles || []
      const relatedVideos = data.relatedVideos || []
      const imageUrls = [
        topic.coverImage,
        ...contentBlocks.filter(item => item && item.type === 'image').map(item => item.imageUrl),
        ...relatedArticles.map(item => item.coverImage),
        ...relatedVideos.map(item => item.coverImage)
      ]
      const urlMap = await resolveCloudFileUrls(imageUrls)

      this.setData({
        topic: {
          ...topic,
          coverImage: urlMap[topic.coverImage] || topic.coverImage || '',
          contentBlocks: contentBlocks.map(item => {
            if (!item || item.type !== 'image') return item
            return {
              ...item,
              imageUrl: urlMap[item.imageUrl] || item.imageUrl || ''
            }
          }),
          publishedAtText: topic.publishedAt ? formatDateLocal(new Date(topic.publishedAt)) : '',
          startAtText: topic.startAt ? formatDateLocal(new Date(topic.startAt)) : '',
          endAtText: topic.endAt ? formatDateLocal(new Date(topic.endAt)) : ''
        },
        relatedArticles: relatedArticles.map(item => ({
          ...item,
          coverImage: urlMap[item.coverImage] || item.coverImage || ''
        })),
        relatedVideos: relatedVideos.map(item => ({
          ...item,
          coverImage: urlMap[item.coverImage] || item.coverImage || ''
        })),
        loading: false
      })
    } catch (err) {
      console.error('loadTopicDetail failed:', err)
      wx.showToast({
        title: getCloudFunctionErrorMessage(err, 'getTopicDetail', '话题详情加载失败'),
        icon: 'none'
      })
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
      wx.showToast({
        title: getCloudFunctionErrorMessage(err, 'getTopicComments', '评论加载失败'),
        icon: 'none'
      })
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
    if (this.data.commentSubmitting) return

    const payload = {
      topicId: this.data.topicId,
      content
    }

    if (this.data.replyTo && this.data.replyTo.parentId) {
      payload.parentId = this.data.replyTo.parentId
      payload.replyToUid = this.data.replyTo.replyToUid
    }

    try {
      this.setData({ commentSubmitting: true })
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
      wx.showToast({
        title: getCloudFunctionErrorMessage(err, 'submitTopicComment', '提交失败'),
        icon: 'none'
      })
    } finally {
      this.setData({ commentSubmitting: false })
    }
  },

  goVideo(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/video-detail/video-detail?id=${id}` })
  }
})
