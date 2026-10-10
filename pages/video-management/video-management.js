function splitIds(value) {
  if (typeof value !== 'string') return []
  return value.split(/[，,\n]/).map(item => item.trim()).filter(Boolean)
}

const { ensurePagePermission } = require('../../utils/permission')
const { getCloudFunctionErrorMessage } = require('../../utils/cloud')

Page({
  data: {
    loading: true,
    permissionLoading: true,
    hasPageAccess: false,
    editingId: '',
    videos: [],
    form: {
      title: '',
      summary: '',
      coverImage: '',
      videoUrl: '',
      duration: '180',
      category: '',
      status: 'draft',
      sort: '0',
      relatedArticleIdsText: '',
      relatedTopicIdsText: ''
    },
    statusOptions: ['draft', 'published', 'offline']
  },

  async onLoad() {
    const access = await ensurePagePermission(this, 'admin')
    if (!access.allowed) {
      this.setData({ loading: false })
      return
    }
    this.loadVideos()
  },

  async loadVideos() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({ name: 'getAdminVideoList', data: {} })
      if (res.result && res.result.success) {
        this.setData({ videos: res.result.data?.list || [], loading: false })
        return
      }
      wx.showToast({ title: res.result?.errMsg || '加载失败', icon: 'none' })
    } catch (err) {
      console.error('loadVideos failed:', err)
      wx.showToast({
        title: getCloudFunctionErrorMessage(err, 'getAdminVideoList', '视频列表加载失败'),
        icon: 'none'
      })
    }
    this.setData({ loading: false })
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key
    if (!key) return
    this.setData({ [`form.${key}`]: e.detail.value })
  },

  onStatusChange(e) {
    const index = Number(e.detail.value) || 0
    this.setData({ 'form.status': this.data.statusOptions[index] })
  },

  editVideo(e) {
    const id = e.currentTarget.dataset.id
    const video = this.data.videos.find(item => item._id === id)
    if (!video) return
    this.setData({
      editingId: id,
      form: {
        title: video.title || '',
        summary: video.summary || '',
        coverImage: video.coverImage || '',
        videoUrl: video.videoUrl || '',
        duration: String(video.duration || 0),
        category: video.category || '',
        status: video.status || 'draft',
        sort: String(video.sort || 0),
        relatedArticleIdsText: Array.isArray(video.relatedArticleIds) ? video.relatedArticleIds.join(', ') : '',
        relatedTopicIdsText: Array.isArray(video.relatedTopicIds) ? video.relatedTopicIds.join(', ') : ''
      }
    })
  },

  resetForm() {
    this.setData({
      editingId: '',
      form: {
        title: '',
        summary: '',
        coverImage: '',
        videoUrl: '',
        duration: '180',
        category: '',
        status: 'draft',
        sort: '0',
        relatedArticleIdsText: '',
        relatedTopicIdsText: ''
      }
    })
  },

  async saveVideo() {
    if (!this.data.form.title.trim()) {
      wx.showToast({ title: '请填写视频标题', icon: 'none' })
      return
    }
    if (!this.data.form.videoUrl.trim()) {
      wx.showToast({ title: '请填写视频地址', icon: 'none' })
      return
    }

    try {
      const payload = {
        ...this.data.form,
        duration: Number(this.data.form.duration) || 0,
        sort: Number(this.data.form.sort) || 0,
        relatedArticleIds: splitIds(this.data.form.relatedArticleIdsText),
        relatedTopicIds: splitIds(this.data.form.relatedTopicIdsText)
      }
      const res = await wx.cloud.callFunction({
        name: 'saveVideo',
        data: { id: this.data.editingId, payload }
      })
      if (res.result && res.result.success) {
        wx.showToast({ title: '保存成功', icon: 'success' })
        this.resetForm()
        this.loadVideos()
        return
      }
      wx.showToast({ title: res.result?.errMsg || '保存失败', icon: 'none' })
    } catch (err) {
      console.error('saveVideo failed:', err)
      wx.showToast({
        title: getCloudFunctionErrorMessage(err, 'saveVideo', '保存失败'),
        icon: 'none'
      })
    }
  }
})
