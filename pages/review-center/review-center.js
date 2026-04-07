const { formatDateTimeLocal } = require('../../utils/util')

Page({
  data: {
    loading: true,
    currentStatus: 'pending_review',
    tasks: [],
    tabs: [
      { key: 'pending_review', label: '待审核' },
      { key: 'approved', label: '已通过' },
      { key: 'rejected', label: '已驳回' },
      { key: 'hidden', label: '已隐藏' }
    ]
  },

  onLoad() {
    this.loadTasks()
  },

  async loadTasks() {
    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'getReviewTasks',
        data: {
          status: this.data.currentStatus,
          pageSize: 50
        }
      })

      if (res.result && res.result.success) {
        const tasks = (res.result.data?.list || []).map(item => ({
          ...item,
          createdAtText: item.createdAt ? formatDateTimeLocal(new Date(item.createdAt)) : '',
          keywordText: Array.isArray(item.keywordHits) ? item.keywordHits.join('、') : ''
        }))
        this.setData({
          tasks,
          loading: false
        })
        return
      }

      wx.showToast({ title: res.result?.errMsg || '加载失败', icon: 'none' })
    } catch (err) {
      console.error('loadTasks failed:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }

    this.setData({ loading: false })
  },

  switchTab(e) {
    const currentStatus = e.currentTarget.dataset.status
    if (!currentStatus || currentStatus === this.data.currentStatus) return
    this.setData({ currentStatus }, () => this.loadTasks())
  },

  async reviewTask(e) {
    const taskId = e.currentTarget.dataset.id
    const action = e.currentTarget.dataset.action
    if (!taskId || !action) return

    try {
      const res = await wx.cloud.callFunction({
        name: 'reviewContent',
        data: { taskId, action, remark: '' }
      })

      if (res.result && res.result.success) {
        wx.showToast({ title: '处理成功', icon: 'success' })
        this.loadTasks()
        return
      }

      wx.showToast({ title: res.result?.errMsg || '处理失败', icon: 'none' })
    } catch (err) {
      console.error('reviewTask failed:', err)
      wx.showToast({ title: '处理失败', icon: 'none' })
    }
  }
})
