const { resolveCloudFileUrls, getCloudFunctionErrorMessage } = require('../../utils/cloud')
function splitIds(value) {
  if (typeof value !== 'string') return []
  return value.split(/[，,\n]/).map(item => item.trim()).filter(Boolean)
}

function getFileExtension(filePath) {
  if (typeof filePath !== 'string') return '.jpg'
  const cleanPath = filePath.split('?')[0]
  const match = cleanPath.match(/\.[a-zA-Z0-9]+$/)
  return match ? match[0].toLowerCase() : '.jpg'
}

function chooseSingleImage() {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: resolve,
      fail: reject
    })
  })
}

const { ensurePagePermission } = require('../../utils/permission')
const { getCloudFunctionErrorMessage } = require('../../utils/cloud')

function createEmptyForm() {
  return {
    title: '',
    summary: '',
    contentText: '',
    coverImage: '',
    coverImagePreview: '', 
    status: 'draft',
    sort: '0',
    startAt: '',
    endAt: '',
    relatedArticleIdsText: '',
    relatedVideoIdsText: ''
  }
}

function isStoragePermissionDenied(err) {
  const errCode = String(err?.errCode || '')
  const message = `${err?.errMsg || ''} ${err?.message || ''}`.toLowerCase()
  return errCode === '-503002' ||
    message.includes('storage permission denied') ||
    message.includes('have no access right to the storage')
}

Page({
  data: {
    loading: true,
    permissionLoading: true,
    hasPageAccess: false,
    submitting: false,
    coverUploading: false,
    deletingTopicId: '',
    editingId: '',
    topics: [],
    form: createEmptyForm(),
    statusOptions: ['draft', 'published', 'offline']
  },

  async onLoad() {
    const access = await ensurePagePermission(this, 'admin')
    if (!access.allowed) {
      this.setData({ loading: false })
      return
    }
    this.loadTopics()
  },

  async loadTopics() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({ name: 'getAdminTopicList', data: {} })
      if (res.result && res.result.success) {
        const list = res.result.data?.list || []
        const coverIds = list
          .map(item => item.coverImage)
          .filter(v => typeof v === 'string' && v.startsWith('cloud://'))
  
        let urlMap = {}
        if (coverIds.length > 0) {
          try {
            urlMap = await resolveCloudFileUrls(coverIds)
          } catch (err) {
            console.error('resolve list covers failed:', err)
          }
        }
  
        const topics = list.map(item => {
          const cover = item.coverImage || ''
          const preview = (cover && urlMap[cover]) || cover
          return { ...item, coverImagePreview: preview }
        })



        this.setData({ topics, loading: false })
        return
      }
      wx.showToast({ title: res.result?.errMsg || '加载失败', icon: 'none' })
    } catch (err) {
      console.error('loadTopics failed:', err)
      wx.showToast({
        title: getCloudFunctionErrorMessage(err, 'getAdminTopicList', '话题列表加载失败'),
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

  editTopic(e) {
    const id = e.currentTarget.dataset.id
    const topic = this.data.topics.find(item => item._id === id)
    if (!topic) return

    const contentText = Array.isArray(topic.contentBlocks) && topic.contentBlocks.length > 0
      ? topic.contentBlocks.map(item => item.text || '').filter(Boolean).join('\n\n')
      : ''
      const coverImage = topic.coverImage || ''
      let coverImagePreview = coverImage
      if (coverImage.startsWith('cloud://')) {
        try {
          const urlMap = await resolveCloudFileUrls([coverImage])
          coverImagePreview = urlMap[coverImage] || coverImage
        } catch (err) {
          console.error('resolve edit cover failed:', err)
        }
      }

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
      form: createEmptyForm()
    })
  },

  async chooseCoverImage() {
    if (this.data.coverUploading || this.data.submitting || this.data.deletingTopicId) return

    try {
      const res = await chooseSingleImage()
      const filePath = res?.tempFiles?.[0]?.tempFilePath
      if (!filePath) return
      await this.uploadCoverImage(filePath)
    } catch (err) {
      if (err && typeof err.errMsg === 'string' && err.errMsg.includes('cancel')) return
      console.error('chooseCoverImage failed:', err)
      wx.showToast({ title: '选择图片失败', icon: 'none' })
    }
  },

  async uploadCoverImage(filePath) {
    this.setData({ coverUploading: true })
    wx.showLoading({ title: '上传中...' })

    try {
      const ext = getFileExtension(filePath)
      const cloudPath = `topics/covers/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath
      })
      const fileID = uploadRes.fileID || ''

      let previewUrl = fileID
      if (fileID.startsWith('cloud://')) {
        try {
          const urlMap = await resolveCloudFileUrls([fileID])
          previewUrl = urlMap[fileID] || fileID
        } catch (e) {
          console.error('resolve cover url failed:', e)
        }
    }
      this.setData({
        'form.coverImage': fileID,
        'form.coverImagePreview': previewUrl
      })
      wx.showToast({ title: '上传成功', icon: 'success' })
    } catch (err) {
      console.error('uploadCoverImage failed:', err)
      if (isStoragePermissionDenied(err)) {
        wx.showModal({
          title: '封面上传失败',
          content: '当前云环境未开放小程序端云存储上传权限，所以图片被拒绝写入。请先到云开发控制台为当前环境开启存储上传权限，再重试上传。',
          showCancel: false
        })
      } else {
        wx.showToast({ title: '封面上传失败', icon: 'none' })
      }
    } finally {
      this.setData({ coverUploading: false })
      wx.hideLoading()
    }
  },

  clearCoverImage() {
    if (this.data.coverUploading || this.data.submitting || this.data.deletingTopicId) return
    this.setData({ 'form.coverImage': '' , 'form.coverImagePreview': ''})
  },

  async saveTopic() {
    if (this._savingTopic || this.data.submitting) return
    if (this.data.coverUploading) {
      wx.showToast({ title: '请等待封面上传完成', icon: 'none' })
      return
    }

    if (!this.data.form.title.trim()) {
      wx.showToast({ title: '请填写话题标题', icon: 'none' })
      return
    }

    if (this.data.form.startAt && this.data.form.endAt) {
      const startAt = new Date(this.data.form.startAt).getTime()
      const endAt = new Date(this.data.form.endAt).getTime()
      if (Number.isFinite(startAt) && Number.isFinite(endAt) && startAt > endAt) {
        wx.showToast({ title: '结束时间不能早于开始时间', icon: 'none' })
        return
      }
    }

    this._savingTopic = true
    this.setData({ submitting: true })

    try {
      const { coverImagePreview, ...formData } = this.data.form
      const payload = {
        ...formData,
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
        await this.loadTopics()
        return
      }
      wx.showToast({ title: res.result?.errMsg || '保存失败', icon: 'none' })
    } catch (err) {
      console.error('saveTopic failed:', err)
      wx.showToast({
        title: getCloudFunctionErrorMessage(err, 'saveTopic', '保存失败'),
        icon: 'none'
      })
    } finally {
      this._savingTopic = false
      this.setData({ submitting: false })
    }
  },

  async deleteTopic(e) {
    const id = e.currentTarget.dataset.id
    if (!id || this.data.submitting || this.data.coverUploading || this.data.deletingTopicId) return

    const topic = this.data.topics.find(item => item._id === id)
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '确认删除',
        content: `删除“${topic?.title || '该话题'}”后不可恢复，并会清理该话题下的评论和审核任务。确定继续吗？`,
        confirmColor: '#ef4444',
        success: res => resolve(Boolean(res.confirm)),
        fail: () => resolve(false)
      })
    })

    if (!confirmed) return

    this.setData({ deletingTopicId: id })

    try {
      const res = await wx.cloud.callFunction({
        name: 'deleteTopic',
        data: { id }
      })

      if (res.result && res.result.success) {
        if (this.data.editingId === id) {
          this.resetForm()
        }
        wx.showToast({ title: '删除成功', icon: 'success' })
        await this.loadTopics()
        return
      }

      wx.showToast({ title: res.result?.errMsg || '删除失败', icon: 'none' })
    } catch (err) {
      console.error('deleteTopic failed:', err)
      wx.showToast({
        title: getCloudFunctionErrorMessage(err, 'deleteTopic', '删除失败'),
        icon: 'none'
      })
    } finally {
      this.setData({ deletingTopicId: '' })
    }
  }
})
