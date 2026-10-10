const { formatDateLocal } = require('../../utils/util')
const { resolveCloudFileUrls, getCloudFunctionErrorMessage } = require('../../utils/cloud')
const { getBuiltinVideoById } = require('../../utils/defaultVideos.js')

Page({
  data: {
    loading: true,
    videoId: '',
    video: null,
    relatedArticles: [],
    relatedTopics: []
  },

  onLoad(options) {
    const videoId = options.id || ''
    this.setData({ videoId })

    if (!videoId) {
      wx.showToast({ title: '视频不存在', icon: 'none' })
      this.setData({ loading: false })
      return
    }

    this.loadVideoDetail()
  },

  async loadVideoDetail() {
    this.setData({ loading: true })

    const builtinVideo = getBuiltinVideoById(this.data.videoId)
    if (builtinVideo) {
      const urlMap = await resolveCloudFileUrls([builtinVideo.coverImage, builtinVideo.videoUrl])
      this.setData({
        video: {
          ...builtinVideo,
          coverImage: urlMap[builtinVideo.coverImage] || builtinVideo.coverImage || '',
          videoUrl: urlMap[builtinVideo.videoUrl] || builtinVideo.videoUrl || '',
          publishedAtText: builtinVideo.publishedAt ? formatDateLocal(new Date(builtinVideo.publishedAt)) : ''
        },
        relatedArticles: [],
        relatedTopics: [],
        loading: false
      })
      return
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'getVideoDetail',
        data: { videoId: this.data.videoId }
      })

      if (!(res.result && res.result.success)) {
        wx.showToast({ title: res.result?.errMsg || '加载失败', icon: 'none' })
        this.setData({ loading: false })
        return
      }

      const data = res.result.data || {}
      const video = data.video || {}
      const relatedArticles = data.relatedArticles || []
      const relatedTopics = data.relatedTopics || []
      const allUrls = [
        video.coverImage,
        video.videoUrl,
        ...relatedArticles.map(item => item.coverImage),
        ...relatedTopics.map(item => item.coverImage)
      ]
      const urlMap = await resolveCloudFileUrls(allUrls)

      this.setData({
        video: {
          ...video,
          coverImage: urlMap[video.coverImage] || video.coverImage || '',
          videoUrl: urlMap[video.videoUrl] || video.videoUrl || '',
          publishedAtText: video.publishedAt ? formatDateLocal(new Date(video.publishedAt)) : ''
        },
        relatedArticles: relatedArticles.map(item => ({
          ...item,
          coverImage: urlMap[item.coverImage] || item.coverImage || ''
        })),
        relatedTopics: relatedTopics.map(item => ({
          ...item,
          coverImage: urlMap[item.coverImage] || item.coverImage || ''
        })),
        loading: false
      })
    } catch (err) {
      console.error('loadVideoDetail failed:', err)
      wx.showToast({
        title: getCloudFunctionErrorMessage(err, 'getVideoDetail', '视频详情加载失败'),
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

  goTopic(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/topic-detail/topic-detail?id=${id}` })
  }
})
