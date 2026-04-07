const { formatDateLocal } = require('../../utils/util')

async function resolveCloudUrls(urls) {
  const fileList = urls.filter(url => typeof url === 'string' && url.startsWith('cloud://'))
  if (!fileList.length) return {}

  try {
    const res = await wx.cloud.getTempFileURL({ fileList })
    const map = {}
    ;(res.fileList || []).forEach(item => {
      if (item.status === 0) {
        map[item.fileID] = item.tempFileURL
      }
    })
    return map
  } catch (err) {
    console.error('resolveCloudUrls failed:', err)
    return {}
  }
}

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
      const allUrls = [video.coverImage, video.videoUrl]
      const urlMap = await resolveCloudUrls(allUrls)

      this.setData({
        video: {
          ...video,
          coverImage: urlMap[video.coverImage] || video.coverImage || '',
          videoUrl: urlMap[video.videoUrl] || video.videoUrl || '',
          publishedAtText: video.publishedAt ? formatDateLocal(new Date(video.publishedAt)) : ''
        },
        relatedArticles: data.relatedArticles || [],
        relatedTopics: data.relatedTopics || [],
        loading: false
      })
    } catch (err) {
      console.error('loadVideoDetail failed:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
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
