function formatDuration(seconds) {
  const value = Number(seconds) || 0
  const minute = Math.floor(value / 60)
  const second = value % 60
  return `${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
}

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
    videos: []
  },

  onLoad() {
    this.loadVideos()
  },

  async loadVideos() {
    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'getVideos',
        data: { pageSize: 20 }
      })

      if (!(res.result && res.result.success)) {
        wx.showToast({ title: res.result?.errMsg || '加载失败', icon: 'none' })
        this.setData({ loading: false })
        return
      }

      const list = res.result.data?.list || []
      const urlMap = await resolveCloudUrls(list.map(item => item.coverImage))
      const videos = list.map(item => ({
        ...item,
        coverImage: urlMap[item.coverImage] || item.coverImage || '',
        durationText: formatDuration(item.duration)
      }))

      this.setData({ videos, loading: false })
    } catch (err) {
      console.error('loadVideos failed:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/video-detail/video-detail?id=${id}` })
  }
})
