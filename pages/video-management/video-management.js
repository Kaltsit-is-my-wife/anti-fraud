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

function isDevTools() {
  try {
    if (typeof wx.getDeviceInfo === 'function') {
      return wx.getDeviceInfo().platform === 'devtools'
    }
    return wx.getSystemInfoSync().platform === 'devtools'
  } catch (err) {
    return false
  }
}

const { resolveCloudFileUrls, getCloudFunctionErrorMessage } = require('../../utils/cloud')

const UPLOAD_LOG_PREFIX = '[video-upload]'

/**
 * 临时上传诊断日志，格式见 logs/README.md。
 * 不记录 openid、手机号、学号、密钥等敏感信息。
 */
function logUpload(stage, detail = {}, level = 'log') {
  const payload = {
    ts: new Date().toISOString(),
    level: level === 'log' ? 'INFO' : level.toUpperCase(),
    stage,
    ...detail
  }
  const line = `${UPLOAD_LOG_PREFIX} ${JSON.stringify(payload)}`
  if (level === 'error') {
    console.error(line)
  } else if (level === 'warn') {
    console.warn(line)
  } else {
    console.log(line)
  }
}

// 页面模块加载时输出一次，用于确认运行的是带诊断日志的代码
logUpload('module:loaded', { page: 'video-management' }, 'warn')

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

  askDeleteVideo(e) {
    const id = e.currentTarget.dataset.id
    const title = e.currentTarget.dataset.title || '该视频'
    const status = e.currentTarget.dataset.status || 'draft'

    if (!id) return
    if (status === 'published') {
      wx.showToast({ title: '已发布视频不能删除，请先下线', icon: 'none' })
      return
    }

    wx.showModal({
      title: '删除视频记录',
      content: `确定删除「${title}」吗？仅删除数据库记录，云存储中的视频和封面文件会保留。`,
      confirmText: '删除',
      confirmColor: '#dc2626',
      success: (res) => {
        if (res.confirm) this.deleteVideoRecord(id)
      }
    })
  },

  async deleteVideoRecord(id) {
    wx.showLoading({ title: '删除中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'deleteVideo',
        data: { id }
      })
      wx.hideLoading()

      if (res.result && res.result.success) {
        wx.showToast({ title: '删除成功', icon: 'success' })
        if (this.data.editingId === id) {
          this.resetForm()
        }
        this.loadVideos()
        return
      }

      wx.showToast({
        title: res.result?.errMsg || '删除失败',
        icon: 'none'
      })
    } catch (err) {
      wx.hideLoading()
      console.error('deleteVideo failed:', err)
      wx.showToast({
        title: getCloudFunctionErrorMessage(err, 'deleteVideo', '删除失败'),
        icon: 'none'
      })
    }
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
    logUpload('choose-video:invoked', {
      uploadingVideo: this.data.uploadingVideo,
      uploadingCover: this.data.uploadingCover
    }, 'warn')
    if (this.data.uploadingVideo) {
      logUpload('choose-video:skipped', { reason: 'uploading' }, 'warn')
      return
    }
    const startedAt = Date.now()
    logUpload('choose-video:start', {}, 'warn')
    let selectTimer = setTimeout(() => {
      logUpload('choose-video:select-timeout', {
        elapsedMs: Date.now() - startedAt,
        hint: 'wx.chooseMedia 未在 10 秒内返回，可能是开发者工具不支持视频选择或选择器未弹出'
      }, 'warn')
    }, 10000)
    try {
      const res = await chooseMediaFile(['video'], ['album', 'camera'])
      clearTimeout(selectTimer)
      selectTimer = null
      const file = res && res.tempFiles && res.tempFiles[0]
      logUpload('choose-video:selected', {
        elapsedMs: Date.now() - startedAt,
        platform: isDevTools() ? 'devtools' : 'device',
        errMsg: res && res.errMsg,
        failedCount: res && res.failedCount,
        type: res && res.type,
        resultKeys: res && typeof res === 'object' ? Object.keys(res) : null,
        tempFilesLength: res && Array.isArray(res.tempFiles) ? res.tempFiles.length : null,
        fileKeys: file && typeof file === 'object' ? Object.keys(file) : null,
        size: file && file.size,
        sizeType: typeof (file && file.size),
        duration: file && file.duration,
        fileType: file && file.fileType,
        tempFilePath: file && file.tempFilePath
      })
      if (!file) {
        const devTools = isDevTools()
        logUpload('choose-video:empty', {
          platform: devTools ? 'devtools' : 'device',
          errMsg: res && res.errMsg,
          failedCount: res && res.failedCount,
          type: res && res.type,
          resultKeys: res && typeof res === 'object' ? Object.keys(res) : null,
          tempFilesLength: res && Array.isArray(res.tempFiles) ? res.tempFiles.length : null
        }, 'warn')
        wx.showToast({
          title: devTools
            ? '开发者工具暂不支持本地视频选择，请用真机调试或手动填写视频地址'
            : '未获取到视频文件，请换一个 MP4 视频重试',
          icon: 'none',
          duration: 3000
        })
        return
      }
      if (file.size > MAX_VIDEO_SIZE) {
        logUpload('choose-video:too-large', {
          size: file.size,
          maxSize: MAX_VIDEO_SIZE
        }, 'warn')
        wx.showToast({ title: '视频不能超过 1GB', icon: 'none' })
        return
      }
      await this.uploadVideo(file, startedAt)
    } catch (err) {
      if (selectTimer) clearTimeout(selectTimer)
      if (err && typeof err.errMsg === 'string' && err.errMsg.includes('cancel')) {
        logUpload('choose-video:cancel', {
          errMsg: err.errMsg,
          elapsedMs: Date.now() - startedAt
        })
        return
      }
      logUpload('choose-video:fail', {
        errMsg: err?.errMsg,
        errCode: err?.errCode,
        elapsedMs: Date.now() - startedAt
      }, 'error')
      console.error('chooseVideo failed:', err)
      wx.showToast({ title: '选择视频失败', icon: 'none' })
    }
  },

  async uploadVideo(file, chooseStartedAt) {
    const startedAt = Date.now()
    this.setData({ uploadingVideo: true, uploadProgress: 0 })
    const ext = getFileExtension(file.tempFilePath, '.mp4')
    const cloudPath = `videos/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`

    logUpload('upload-video:start', {
      chooseElapsedMs: chooseStartedAt ? startedAt - chooseStartedAt : null,
      size: file && file.size,
      duration: file && file.duration,
      tempFilePath: file && file.tempFilePath,
      cloudPath
    }, 'warn')

    let heartbeatTimer = null
    let lastProgressBucket = -1

    try {
      // 进度监听需要 success/fail 回调形式返回的 UploadTask；
      // 纯 Promise 形式返回的对象没有 onProgressUpdate 方法
      const uploadRes = await new Promise((resolve, reject) => {
        let task
        try {
          task = wx.cloud.uploadFile({
            cloudPath,
            filePath: file.tempFilePath,
            success: (res) => {
              logUpload('upload-video:callback-success', {
                fileID: res && res.fileID,
                elapsedMs: Date.now() - startedAt
              })
              resolve(res)
            },
            fail: (err) => {
              logUpload('upload-video:callback-fail', {
                errMsg: err?.errMsg,
                errCode: err?.errCode,
                elapsedMs: Date.now() - startedAt
              }, 'error')
              reject(err)
            }
          })
        } catch (err) {
          logUpload('upload-video:api-throw', {
            errMsg: err?.errMsg,
            errCode: err?.errCode,
            elapsedMs: Date.now() - startedAt
          }, 'error')
          reject(err)
          return
        }

        logUpload('upload-video:task-created', {
          hasTask: !!task,
          hasOnProgressUpdate: !!(task && typeof task.onProgressUpdate === 'function'),
          elapsedMs: Date.now() - startedAt
        })

        if (task && typeof task.onProgressUpdate === 'function') {
          task.onProgressUpdate((res) => {
            const bucket = Math.floor(res.progress / 10) * 10
            if (bucket !== lastProgressBucket || res.progress === 100) {
              lastProgressBucket = bucket
              logUpload('upload-video:progress', {
                progress: res.progress,
                totalBytesSent: res.totalBytesSent,
                totalBytesExpectedToSend: res.totalBytesExpectedToSend,
                elapsedMs: Date.now() - startedAt
              })
            }
            this.setData({ uploadProgress: res.progress })
          })
        }

        // 上传长时间没有回调时，每 10 秒输出一次心跳，便于判断是否卡住
        heartbeatTimer = setInterval(() => {
          logUpload('upload-video:heartbeat', {
            elapsedMs: Date.now() - startedAt,
            progress: this.data.uploadProgress,
            uploadingVideo: this.data.uploadingVideo
          }, 'warn')
        }, 10000)
      })

      this.setData({
        'form.videoUrl': uploadRes.fileID || '',
        'form.duration': file.duration ? String(Math.round(file.duration)) : this.data.form.duration,
        uploadingVideo: false
      })
      logUpload('upload-video:success', {
        fileID: uploadRes && uploadRes.fileID,
        elapsedMs: Date.now() - startedAt
      })
      wx.showToast({ title: '上传成功，保存前仍是草稿', icon: 'none' })
    } catch (err) {
      this.setData({ uploadingVideo: false })
      logUpload('upload-video:fail', {
        errMsg: err?.errMsg,
        errCode: err?.errCode,
        elapsedMs: Date.now() - startedAt
      }, 'error')
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
    } finally {
      if (heartbeatTimer) clearInterval(heartbeatTimer)
    }
  },

  async chooseCover() {
    if (this.data.uploadingCover) {
      logUpload('choose-cover:skipped', { reason: 'uploading' }, 'warn')
      return
    }
    const startedAt = Date.now()
    logUpload('choose-cover:start')
    try {
      const res = await chooseMediaFile(['image'], ['album', 'camera'])
      const file = res && res.tempFiles && res.tempFiles[0]
      logUpload('choose-cover:selected', {
        elapsedMs: Date.now() - startedAt,
        size: file && file.size,
        fileType: file && file.fileType,
        tempFilePath: file && file.tempFilePath
      })
      if (!file) {
        logUpload('choose-cover:empty', {}, 'warn')
        return
      }
      if (file.size > MAX_COVER_SIZE) {
        logUpload('choose-cover:too-large', {
          size: file.size,
          maxSize: MAX_COVER_SIZE
        }, 'warn')
        wx.showToast({ title: '封面图不能超过 20MB', icon: 'none' })
        return
      }
      await this.uploadCoverImage(file.tempFilePath, startedAt)
    } catch (err) {
      if (err && typeof err.errMsg === 'string' && err.errMsg.includes('cancel')) {
        logUpload('choose-cover:cancel', {
          errMsg: err.errMsg,
          elapsedMs: Date.now() - startedAt
        })
        return
      }
      logUpload('choose-cover:fail', {
        errMsg: err?.errMsg,
        errCode: err?.errCode,
        elapsedMs: Date.now() - startedAt
      }, 'error')
      console.error('chooseCover failed:', err)
      wx.showToast({ title: '选择图片失败', icon: 'none' })
    }
  },

  async uploadCoverImage(filePath, chooseStartedAt) {
    const startedAt = Date.now()
    this.setData({ uploadingCover: true })
    wx.showLoading({ title: '上传中...' })

    try {
      const ext = getFileExtension(filePath, '.jpg')
      const cloudPath = `video-covers/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`
      logUpload('upload-cover:start', {
        chooseElapsedMs: chooseStartedAt ? startedAt - chooseStartedAt : null,
        tempFilePath: filePath,
        cloudPath
      })
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath
      })
      const fileID = uploadRes.fileID || ''
      logUpload('upload-cover:success', {
        fileID,
        elapsedMs: Date.now() - startedAt
      })

      let previewUrl = fileID
      if (fileID.startsWith('cloud://')) {
        try {
          const urlMap = await resolveCloudFileUrls([fileID])
          previewUrl = urlMap[fileID] || fileID
        } catch (e) {
          logUpload('upload-cover:preview-fail', {
            errMsg: e?.errMsg,
            errCode: e?.errCode
          }, 'warn')
          console.error('resolve cover url failed:', e)
        }
      }
      this.setData({
        'form.coverImage': fileID,
        coverImagePreview: previewUrl
      })
      wx.showToast({ title: '上传成功', icon: 'success' })
    } catch (err) {
      logUpload('upload-cover:fail', {
        errMsg: err?.errMsg,
        errCode: err?.errCode,
        elapsedMs: Date.now() - startedAt
      }, 'error')
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

    const startedAt = Date.now()
    logUpload('save-video:start', {
      editingId: this.data.editingId || '',
      status: this.data.form.status,
      hasVideoUrl: !!this.data.form.videoUrl,
      hasCoverImage: !!this.data.form.coverImage
    })

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
        logUpload('save-video:success', {
          editingId: this.data.editingId || '',
          elapsedMs: Date.now() - startedAt
        })
        wx.showToast({ title: '保存成功', icon: 'success' })
        this.resetForm()
        this.loadVideos()
        return
      }
      logUpload('save-video:fail', {
        errMsg: res.result?.errMsg,
        elapsedMs: Date.now() - startedAt
      }, 'error')
      wx.showToast({ title: res.result?.errMsg || '保存失败', icon: 'none' })
    } catch (err) {
      logUpload('save-video:fail', {
        errMsg: err?.errMsg,
        errCode: err?.errCode,
        elapsedMs: Date.now() - startedAt
      }, 'error')
      console.error('saveVideo failed:', err)
      wx.showToast({
        title: getCloudFunctionErrorMessage(err, 'saveVideo', '保存失败'),
        icon: 'none'
      })
    }
  }
})
