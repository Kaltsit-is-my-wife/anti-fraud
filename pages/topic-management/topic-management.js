/**
 * 话题管理页面 - 二期社区模块（成员 A：话题发布主链路）
 *
 * 上游依赖：getAdminTopicList、saveTopic、deleteTopic、utils/cloud、utils/permission
 * 入口：/pages/topic-management/topic-management
 * 主要功能：管理员/运营创建、编辑、发布、下线话题，并维护封面图与正文配图
 * 输出：话题表单与话题列表
 *
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */

const { resolveCloudFileUrls, getCloudFunctionErrorMessage } = require('../../utils/cloud')
const { ensurePagePermission } = require('../../utils/permission')
const { createLogger } = require('../../utils/logger')

const MAX_CONTENT_IMAGES = 9

const log = createLogger('topic-management')

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

function buildImagePreview(imageUrl, urlMap) {
  if (!imageUrl) return ''
  return (urlMap && urlMap[imageUrl]) || imageUrl
}

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
    contentImageUploading: false,
    deletingTopicId: '',
    editingId: '',
    topics: [],
    form: createEmptyForm(),
    statusIndex: 0,
    contentImages: [],
    maxContentImages: MAX_CONTENT_IMAGES,
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
            log('WARN', 'covers:resolve-failed', { msg: err && err.message })
          }
        }

        const topics = list.map(item => {
          const cover = item.coverImage || ''
          const preview = (cover && urlMap[cover]) || cover
          const blocks = Array.isArray(item.contentBlocks) ? item.contentBlocks : []
          return {
            ...item,
            coverImagePreview: preview,
            imageCount: blocks.filter(block => block && block.type === 'image').length
          }
        })

        this.setData({ topics, loading: false })
        return
      }
      wx.showToast({ title: res.result?.errMsg || '加载失败', icon: 'none' })
    } catch (err) {
      log('ERROR', 'list:load-failed', { msg: err && err.message })
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
    this.setData({
      'form.status': this.data.statusOptions[index],
      statusIndex: index
    })
  },

  async editTopic(e) {
    const id = e.currentTarget.dataset.id
    const topic = this.data.topics.find(item => item._id === id)
    if (!topic) return

    const contentText = Array.isArray(topic.contentBlocks)
      ? topic.contentBlocks
        .filter(item => item && (item.type === 'text' || item.type === 'paragraph'))
        .map(item => item.text || '')
        .filter(Boolean)
        .join('\n\n')
      : ''

    const contentImages = (Array.isArray(topic.contentBlocks) ? topic.contentBlocks : [])
      .filter(item => item && item.type === 'image' && item.imageUrl)
      .map(item => ({
        imageUrl: item.imageUrl,
        caption: item.caption || '',
        preview: ''
      }))

    const coverImage = topic.coverImage || ''
    const imageUrls = [coverImage, ...contentImages.map(item => item.imageUrl)]
    let urlMap = {}
    try {
      urlMap = await resolveCloudFileUrls(imageUrls)
    } catch (err) {
      log('WARN', 'edit:resolve-images-failed', { msg: err && err.message })
    }

    const statusIndex = Math.max(0, this.data.statusOptions.indexOf(topic.status || 'draft'))

    this.setData({
      editingId: id,
      statusIndex,
      form: {
        title: topic.title || '',
        summary: topic.summary || '',
        contentText,
        coverImage,
        coverImagePreview: buildImagePreview(coverImage, urlMap),
        status: topic.status || 'draft',
        sort: String(topic.sort || 0),
        startAt: topic.startAt ? String(topic.startAt).slice(0, 10) : '',
        endAt: topic.endAt ? String(topic.endAt).slice(0, 10) : '',
        relatedArticleIdsText: Array.isArray(topic.relatedArticleIds) ? topic.relatedArticleIds.join(', ') : '',
        relatedVideoIdsText: Array.isArray(topic.relatedVideoIds) ? topic.relatedVideoIds.join(', ') : ''
      },
      contentImages: contentImages.map(item => ({
        ...item,
        preview: buildImagePreview(item.imageUrl, urlMap)
      }))
    })
  },

  resetForm() {
    this.setData({
      editingId: '',
      form: createEmptyForm(),
      statusIndex: 0,
      contentImages: []
    })
  },

  /** 上传图片到云存储，返回 { fileID, preview }；失败时抛出原始错误 */
  async uploadImageToCloud(filePath, folder) {
    const ext = getFileExtension(filePath)
    const cloudPath = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`
    const uploadRes = await wx.cloud.uploadFile({
      cloudPath,
      filePath
    })
    const fileID = uploadRes.fileID || ''
    if (!fileID) throw new Error('云存储未返回 fileID')

    let preview = fileID
    try {
      const urlMap = await resolveCloudFileUrls([fileID])
      preview = urlMap[fileID] || fileID
    } catch (e) {
      log('WARN', 'upload:preview-resolve-failed', { msg: e && e.message })
    }

    return { fileID, preview }
  },

  showUploadError(err, title) {
    log('ERROR', 'upload:failed', { title, msg: err && err.message })
    if (isStoragePermissionDenied(err)) {
      wx.showModal({
        title,
        content: '当前云环境未开放小程序端云存储上传权限，所以图片被拒绝写入。请先到云开发控制台为当前环境开启存储上传权限，再重试上传。',
        showCancel: false
      })
      return
    }
    wx.showToast({ title, icon: 'none' })
  },

  async chooseCoverImage() {
    if (this.data.coverUploading || this.data.contentImageUploading || this.data.submitting || this.data.deletingTopicId) return

    try {
      const res = await chooseSingleImage()
      const filePath = res?.tempFiles?.[0]?.tempFilePath
      if (!filePath) return
      await this.uploadCoverImage(filePath)
    } catch (err) {
      if (err && typeof err.errMsg === 'string' && err.errMsg.includes('cancel')) return
      log('ERROR', 'cover:choose-failed', { msg: err && err.message })
      wx.showToast({ title: '选择图片失败', icon: 'none' })
    }
  },

  async uploadCoverImage(filePath) {
    this.setData({ coverUploading: true })
    wx.showLoading({ title: '上传中...' })

    try {
      const { fileID, preview } = await this.uploadImageToCloud(filePath, 'topics/covers')
      this.setData({
        'form.coverImage': fileID,
        'form.coverImagePreview': preview
      })
      wx.showToast({ title: '上传成功', icon: 'success' })
    } catch (err) {
      this.showUploadError(err, '封面上传失败')
    } finally {
      this.setData({ coverUploading: false })
      wx.hideLoading()
    }
  },

  clearCoverImage() {
    if (this.data.coverUploading || this.data.submitting || this.data.deletingTopicId) return
    this.setData({ 'form.coverImage': '' , 'form.coverImagePreview': ''})
  },

  /** 正文配图：选择并上传一张图片，追加到配图列表末尾 */
  async addContentImage() {
    if (this.data.submitting || this.data.coverUploading || this.data.contentImageUploading || this.data.deletingTopicId) return

    if (this.data.contentImages.length >= MAX_CONTENT_IMAGES) {
      wx.showToast({ title: `最多添加 ${MAX_CONTENT_IMAGES} 张配图`, icon: 'none' })
      return
    }

    let filePath = ''
    try {
      const res = await chooseSingleImage()
      filePath = res?.tempFiles?.[0]?.tempFilePath || ''
    } catch (err) {
      if (err && typeof err.errMsg === 'string' && err.errMsg.includes('cancel')) return
      log('ERROR', 'content-image:choose-failed', { msg: err && err.message })
      wx.showToast({ title: '选择图片失败', icon: 'none' })
      return
    }

    if (!filePath) return

    this.setData({ contentImageUploading: true })
    wx.showLoading({ title: '上传中...' })

    try {
      const { fileID, preview } = await this.uploadImageToCloud(filePath, 'topics/content')
      const contentImages = [...this.data.contentImages, { imageUrl: fileID, caption: '', preview }]
      this.setData({ contentImages })
      wx.showToast({ title: '配图已添加', icon: 'success' })
    } catch (err) {
      this.showUploadError(err, '配图上传失败')
    } finally {
      this.setData({ contentImageUploading: false })
      wx.hideLoading()
    }
  },

  onContentImageCaptionInput(e) {
    const index = Number(e.currentTarget.dataset.index)
    if (!Number.isInteger(index) || index < 0) return
    this.setData({ [`contentImages[${index}].caption`]: e.detail.value })
  },

  removeContentImage(e) {
    if (this.data.submitting || this.data.contentImageUploading || this.data.deletingTopicId) return
    const index = Number(e.currentTarget.dataset.index)
    if (!Number.isInteger(index) || index < 0) return

    const contentImages = this.data.contentImages.filter((item, itemIndex) => itemIndex !== index)
    this.setData({ contentImages })
  },

  async saveTopic() {
    if (this._savingTopic || this.data.submitting) return
    if (this.data.coverUploading || this.data.contentImageUploading) {
      wx.showToast({ title: '请等待图片上传完成', icon: 'none' })
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
      const formData = { ...this.data.form }
      delete formData.coverImagePreview

      const payload = {
        ...formData,
        sort: Number(this.data.form.sort) || 0,
        relatedArticleIds: splitIds(this.data.form.relatedArticleIdsText),
        relatedVideoIds: splitIds(this.data.form.relatedVideoIdsText),
        // 显式传空数组表示清空配图；始终下发当前表单里的配图顺序
        contentImages: this.data.contentImages.map(item => ({
          imageUrl: item.imageUrl,
          caption: item.caption || ''
        }))
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
      log('ERROR', 'save:failed', { msg: err && err.message })
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
    if (!id || this.data.submitting || this.data.coverUploading || this.data.contentImageUploading || this.data.deletingTopicId) return

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
      log('ERROR', 'delete:failed', { msg: err && err.message })
      wx.showToast({
        title: getCloudFunctionErrorMessage(err, 'deleteTopic', '删除失败'),
        icon: 'none'
      })
    } finally {
      this.setData({ deletingTopicId: '' })
    }
  }
})
