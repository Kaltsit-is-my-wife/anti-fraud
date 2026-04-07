Page({
  data: {
    currentPoints: 0,
    currentTab: 'all',
    records: [],
    allRecords: []
  },

  onLoad() {
    this.loadPointsHistory()
  },

  onShow() {
    this.loadPointsHistory()
  },

  async loadPointsHistory() {
    wx.showLoading({ title: '加载中...' })

    try {
      const [pointsResult, recordsResult] = await Promise.all([
        wx.cloud.callFunction({
          name: 'getUserInfo',
          data: {}
        }),
        wx.cloud.callFunction({
          name: 'getPointsRecords',
          data: {
            page: 1,
            pageSize: 50
          }
        })
      ])

      wx.hideLoading()

      if (pointsResult.result.success) {
        this.setData({
          currentPoints: pointsResult.result.data.userInfo.points || 0
        })
      }

      const records = recordsResult.result?.success
        ? (recordsResult.result.data.records || [])
        : []
      const formattedRecords = records.map(record => ({
        ...record,
        timeStr: this.formatTime(record.createdAt)
      }))

      this.setData({
        allRecords: formattedRecords,
        records: this.filterRecords(formattedRecords, this.data.currentTab)
      })
    } catch (err) {
      wx.hideLoading()
      console.error('加载积分记录失败：', err)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  filterRecords(records, tab) {
    if (tab === 'all') {
      return records
    }
    return records.filter(record => record.type === tab)
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({
      currentTab: tab,
      records: this.filterRecords(this.data.allRecords, tab)
    })
  },

  formatTime(timestamp) {
    if (!timestamp) return ''
    
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (24 * 60 * 60 * 1000))
    
    if (days === 0) {
      const hours = Math.floor(diff / (60 * 60 * 1000))
      if (hours === 0) {
        const minutes = Math.floor(diff / (60 * 1000))
        if (minutes === 0) {
          return '刚刚'
        }
        return `${minutes}分钟前`
      }
      return `${hours}小时前`
    } else if (days === 1) {
      return '昨天'
    } else if (days < 7) {
      return `${days}天前`
    } else {
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${month}-${day}`
    }
  }
})
