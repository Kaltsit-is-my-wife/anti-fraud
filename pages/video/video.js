const { resolveCloudFileUrls, getCloudFunctionErrorMessage } = require('../../utils/cloud')
const { getBuiltinVideos, mergeBuiltinVideos } = require('../../utils/defaultVideos.js')

function formatDuration(seconds) {
  const value = Number(seconds) || 0
  const minute = Math.floor(value / 60)
  const second = value % 60
  return `${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
}

Page({
  data: {
    loading: true,
    videos: []
  },

  onLoad() {
    this.loadVideos()
  },

  onShow() {
    if (!this.data.loading) {
      this.loadVideos()
    }
  },

  async loadVideos() {
    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'getVideos',
        data: { pageSize: 20 }
      })

      const list = res.result && res.result.success
        ? (res.result.data?.list || [])
        : []
      const mergedList = mergeBuiltinVideos(list)
      const urlMap = await resolveCloudFileUrls(mergedList.map(item => item.coverImage))
      const videos = mergedList.map(item => ({
        ...item,
        coverImage: urlMap[item.coverImage] || item.coverImage || '',
        durationText: item.durationText || formatDuration(item.duration)
      }))

      this.setData({ videos, loading: false })
    } catch (err) {
      console.error('loadVideos failed:', err)

      const fallbackVideos = getBuiltinVideos()
      const urlMap = await resolveCloudFileUrls(fallbackVideos.map(item => item.coverImage))
      const videos = fallbackVideos.map(item => ({
        ...item,
        coverImage: urlMap[item.coverImage] || item.coverImage || '',
        durationText: item.durationText || formatDuration(item.duration)
      }))

      this.setData({ videos, loading: false })

      if (videos.length === 0) {
        wx.showToast({
          title: getCloudFunctionErrorMessage(err, 'getVideos', '视频列表加载失败'),
          icon: 'none'
        })
      }
    }
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/video-detail/video-detail?id=${id}` })
  }
})
