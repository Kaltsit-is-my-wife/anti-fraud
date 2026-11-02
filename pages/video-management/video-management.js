/**
 * 视频管理页：维护视频内容、封面和播放地址。
 *
 * 第二阶段新增本地上传能力：wx.chooseMedia 选择视频/封面，
 * wx.cloud.uploadFile 上传到云存储后自动回填 videoUrl / coverImage。
 * 上传成功只改变表单内容，不改变发布状态（仍按表单 status 保存，
 * 默认 draft）；数据库保存 cloud:// 文件 ID，页面预览用临时 URL。
 * 不删除旧文件：替换视频或封面后，旧资源仍保留在云存储中。
 */

function splitIds(value) {
  if (typeof value !== 'string') return []
  return value.split(/[，,\n]/).map(item => item.trim()).filter(Boolean)
}

const { ensurePagePermission } = require('../../utils/permission')

// 上传大小上限（字节）：视频 ≤ 1GB（不做时长限制），封面 ≤ 20MB
const MAX_VIDEO_SIZE = 1024 * 1024 * 1024
const MAX_COVER_SIZE = 20 * 1024 * 1024

function getFileExtension(filePath, fallback) {
  if (typeof filePath !== 'string') return fallback || '.mp4'
  const cleanPath = filePath.split('?')[0]
  const dotIndex = cleanPath.lastIndexOf('.')
  if (dotIndex < 0 || dotIndex >= cleanPath.length - 1) return fallback || '.mp4'
  const ext = cleanPath.slice(dotIndex).toLowerCase()
  return ext.indexOf('/') === -1 ? ext : (fallback || '.mp4')
}

function chooseMediaFile(mediaType, sourceType) {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: 1,
      mediaType,
      sourceType,
      success: resolve,
      fail: reject
    })
  })
}

function isStoragePermissionDenied(err) {
  const errCode = String(err?.errCode || '')
  const message = `${err?.errMsg || ''} ${err?.message || ''}`.toLowerCase()
  return errCode === '-503002' ||
    message.includes('storage permission denied') ||
    message.includes('have no access right to the storage')
}

const { resolveCloudFileUrls, getCloudFunctionErrorMessage } = require('../../utils/cloud')

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
    statusOptions: ['draft', 'published', 'offline'],
    uploadingVideo: false,
    uploadingCover: false,
    uploadProgress: 0,
    coverImagePreview: ''
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

  async editVideo(e) {
    const id = e.currentTarget.dataset.id
    const video = this.data.videos.find(item => item._id === id)
    if (!video) return
    const coverImage = video.coverImage || ''
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
        title: video.title || '',
        summary: video.summary || '',
        coverImage,
        videoUrl: video.videoUrl || '',
        duration: String(video.duration || 0),
        category: video.category || '',
        status: video.status || 'draft',
        sort: String(video.sort || 0),
        relatedArticleIdsText: Array.isArray(video.relatedArticleIds) ? video.relatedArticleIds.join(', ') : '',
        relatedTopicIdsText: Array.isArray(video.relatedTopicIds) ? video.relatedTopicIds.join(', ') : ''
      },
      coverImagePreview,
      uploadProgress: 0
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
      },
      uploadingVideo: false,
      uploadingCover: false,
      uploadProgress: 0,
      coverImagePreview: ''
    })
  },

  async chooseVideo() {
    if (this.data.uploadingVideo) return
    try {
      const res = await chooseMediaFile(['video'], ['album', 'camera'])
      const file = res && res.tempFiles && res.tempFiles[0]
      if (!file) return
      if (file.size > MAX_VIDEO_SIZE) {
        wx.showToast({ title: '视频不能超过 1GB', icon: 'none' })
        return
      }
      await this.uploadVideo(file)
    } catch (err) {
      if (err && typeof err.errMsg === 'string' && err.errMsg.includes('cancel')) return
      console.error('chooseVideo failed:', err)
      wx.showToast({ title: '选择视频失败', icon: 'none' })
    }
  },

  async uploadVideo(file) {
    this.setData({ uploadingVideo: true, uploadProgress: 0 })
    const ext = getFileExtension(file.tempFilePath, '.mp4')
    const cloudPath = `videos/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`

    try {
      // 进度监听需要 success/fail 回调形式返回的 UploadTask；
      // 纯 Promise 形式返回的对象没有 onProgressUpdate 方法
      const uploadRes = await new Promise((resolve, reject) => {
        const task = wx.cloud.uploadFile({
          cloudPath,
          filePath: file.tempFilePath,
          success: resolve,
          fail: reject
        })
        if (task && typeof task.onProgressUpdate === 'function') {
          task.onProgressUpdate((res) => {
            this.setData({ uploadProgress: res.progress })
          })
        }
      })
      this.setData({
        'form.videoUrl': uploadRes.fileID || '',
        'form.duration': file.duration ? String(Math.round(file.duration)) : this.data.form.duration,
        uploadingVideo: false
      })
      wx.showToast({ title: '上传成功，保存前仍是草稿', icon: 'none' })
    } catch (err) {
      this.setData({ uploadingVideo: false })
      console.error('uploadVideo failed:', err)
      if (isStoragePermissionDenied(err)) {
        wx.showModal({
          title: '视频上传失败',
          content: '当前云环境未开放小程序端云存储上传权限，所以文件被拒绝写入。请先到云开发控制台为当前环境开启存储上传权限，再重试上传。',
          showCancel: false
        })
      } else {
        wx.showToast({ title: '视频上传失败，请重试', icon: 'none' })
      }
    }
  },

  async chooseCover() {
    if (this.data.uploadingCover) return
    try {
      const res = await chooseMediaFile(['image'], ['album', 'camera'])
      const file = res && res.tempFiles && res.tempFiles[0]
      if (!file) return
      if (file.size > MAX_COVER_SIZE) {
        wx.showToast({ title: '封面图不能超过 20MB', icon: 'none' })
        return
      }
      await this.uploadCoverImage(file.tempFilePath)
    } catch (err) {
      if (err && typeof err.errMsg === 'string' && err.errMsg.includes('cancel')) return
      console.error('chooseCover failed:', err)
      wx.showToast({ title: '选择图片失败', icon: 'none' })
    }
  },

  async uploadCoverImage(filePath) {
    this.setData({ uploadingCover: true })
    wx.showLoading({ title: '上传中...' })

    try {
      const ext = getFileExtension(filePath, '.jpg')
      const cloudPath = `video-covers/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`
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
        coverImagePreview: previewUrl
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
      this.setData({ uploadingCover: false })
      wx.hideLoading()
    }
  },

  async saveVideo() {
    if (this.data.uploadingVideo || this.data.uploadingCover) {
      wx.showToast({ title: '请等待上传完成', icon: 'none' })
      return
    }
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
