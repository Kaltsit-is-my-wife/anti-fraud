function splitIds(value) {
  if (typeof value !== 'string') return []
  return value.split(/[，,\n]/).map(item => item.trim()).filter(Boolean)
}

Page({
  data: {
    loading: true,
    editingId: '',
    topics: [],
    form: {
      title: '',
      summary: '',
      contentText: '',
      coverImage: '',
      status: 'draft',
      sort: '0',
      startAt: '',
      endAt: '',
      relatedArticleIdsText: '',
      relatedVideoIdsText: ''
    },
    statusOptions: ['draft', 'published', 'offline']
  },

  onLoad() {
    this.loadTopics()
  },

  async loadTopics() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({ name: 'getAdminTopicList', data: {} })
      if (res.result && res.result.success) {
        this.setData({ topics: res.result.data?.list || [], loading: false })
        return
      }
      wx.showToast({ title: res.result?.errMsg || '加载失败', icon: 'none' })
    } catch (err) {
      console.error('loadTopics failed:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
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

  editTopic(e) {
    const id = e.currentTarget.dataset.id
    const topic = this.data.topics.find(item => item._id === id)
    if (!topic) return
    const contentText = Array.isArray(topic.contentBlocks) && topic.contentBlocks.length > 0
      ? topic.contentBlocks.map(item => item.text || '').filter(Boolean).join('\n\n')
      : ''

    this.setData({
      editingId: id,
      form: {
        title: topic.title || '',
        summary: topic.summary || '',
        contentText,
        coverImage: topic.coverImage || '',
        status: topic.status || 'draft',
        sort: String(topic.sort || 0),
        startAt: topic.startAt ? String(topic.startAt).slice(0, 10) : '',
        endAt: topic.endAt ? String(topic.endAt).slice(0, 10) : '',
        relatedArticleIdsText: Array.isArray(topic.relatedArticleIds) ? topic.relatedArticleIds.join(', ') : '',
        relatedVideoIdsText: Array.isArray(topic.relatedVideoIds) ? topic.relatedVideoIds.join(', ') : ''
      }
    })
  },

  resetForm() {
    this.setData({
      editingId: '',
      form: {
        title: '',
        summary: '',
        contentText: '',
        coverImage: '',
        status: 'draft',
        sort: '0',
        startAt: '',
        endAt: '',
        relatedArticleIdsText: '',
        relatedVideoIdsText: ''
      }
    })
  },

  async saveTopic() {
    if (!this.data.form.title.trim()) {
      wx.showToast({ title: '请填写话题标题', icon: 'none' })
      return
    }

    try {
      const payload = {
        ...this.data.form,
        sort: Number(this.data.form.sort) || 0,
        relatedArticleIds: splitIds(this.data.form.relatedArticleIdsText),
        relatedVideoIds: splitIds(this.data.form.relatedVideoIdsText)
      }
      const res = await wx.cloud.callFunction({
        name: 'saveTopic',
        data: {
          id: this.data.editingId,
          payload
        }
      })

      if (res.result && res.result.success) {
        wx.showToast({ title: '保存成功', icon: 'success' })
        this.resetForm()
        this.loadTopics()
        return
      }
      wx.showToast({ title: res.result?.errMsg || '保存失败', icon: 'none' })
    } catch (err) {
      console.error('saveTopic failed:', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  }
})
