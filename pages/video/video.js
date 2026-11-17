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
    loadingMore: false,
    videos: [],
    page: 1,
    pageSize: 20,
    hasMore: true
  },

  onLoad() {
    this.loadVideos({ reset: true })
  },

  onShow() {
    if (this.data.loading || this.data.loadingMore) return
    // 只刷新第一页；用户已经加载多页时，从详情页返回不重置列表
    if (this.data.page === 1) {
      this.loadVideos({ reset: true })
    }
  },

  onPullDownRefresh() {
    this.loadVideos({ reset: true }).finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    this.loadMore()
  },

  loadMore() {
    if (!this.data.hasMore || this.data.loading || this.data.loadingMore) return
    this.loadVideos({ reset: false })
  },

  async loadVideos(options = {}) {
    const reset = options.reset !== false
    if (this._loading) return
    if (!reset && !this.data.hasMore) return

    this._loading = true
    const nextPage = reset ? 1 : this.data.page + 1
    this.setData(reset ? { loading: true } : { loadingMore: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'getVideos',
        data: {
          page: nextPage,
          pageSize: this.data.pageSize
        }
      })

      if (res.result && res.result.success) {
        const data = res.result.data || {}
        const cloudList = data.list || []
        const hasMore = data.hasMore === true
        // 内置占位视频只在第一页合并，避免每页重复出现
        const pageList = nextPage === 1 ? mergeBuiltinVideos(cloudList) : cloudList
        const urlMap = await resolveCloudFileUrls(pageList.map(item => item.coverImage))
        const normalized = pageList.map(item => ({
          ...item,
          coverImage: urlMap[item.coverImage] || item.coverImage || '',
          durationText: item.durationText || formatDuration(item.duration)
        }))
        const existingIds = new Set(
          reset ? [] : this.data.videos.map(item => String(item._id || ''))
        )
        const appended = normalized.filter(item => !existingIds.has(String(item._id || '')))

        this.setData({
          videos: reset ? appended : this.data.videos.concat(appended),
          page: nextPage,
          hasMore,
          loading: false,
          loadingMore: false
        })
        return
      }

      wx.showToast({
        title: res.result?.errMsg || '视频列表加载失败',
        icon: 'none'
      })

      if (reset) {
        await this.showFallbackVideos()
      }
    } catch (err) {
      console.error('loadVideos failed:', err)

      if (reset) {
        await this.showFallbackVideos()
      }

      wx.showToast({
        title: getCloudFunctionErrorMessage(err, 'getVideos', '视频列表加载失败'),
        icon: 'none'
      })
    } finally {
      this._loading = false
      this.setData({ loading: false, loadingMore: false })
    }
  },

  async showFallbackVideos() {
    const fallbackVideos = getBuiltinVideos()
    const urlMap = await resolveCloudFileUrls(fallbackVideos.map(item => item.coverImage))
    this.setData({
      videos: fallbackVideos.map(item => ({
        ...item,
        coverImage: urlMap[item.coverImage] || item.coverImage || '',
        durationText: item.durationText || formatDuration(item.duration)
      })),
      page: 1,
      hasMore: false
    })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/video-detail/video-detail?id=${id}` })
  }
})
