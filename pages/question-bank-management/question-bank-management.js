const { ensurePagePermission } = require('../../utils/permission')
const { getCloudFunctionErrorMessage } = require('../../utils/cloud')

function createEmptyForm() {
  return {
    name: '',
    summary: '',
    coverImage: '',
    status: 'draft',
    sort: '0',
    defaultQuestionCount: '10'
  }
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
    actionBankId: '',
    actionType: '',
    editingId: '',
    banks: [],
    summary: {
      bankCount: 0,
      poolQuestionCount: 0,
      unassignedQuestionCount: 0
    },
    form: createEmptyForm(),
    statusOptions: ['draft', 'published', 'offline']
  },

  async onLoad() {
    const access = await ensurePagePermission(this, 'admin')
    if (!access.allowed) {
      this.setData({ loading: false })
      return
    }
    this.loadBanks()
  },

  async loadBanks() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({ name: 'getAdminQuestionBankList', data: {} })
      if (res.result && res.result.success) {
        this.setData({
          banks: res.result.data?.list || [],
          summary: res.result.data?.summary || { bankCount: 0, poolQuestionCount: 0, unassignedQuestionCount: 0 },
          loading: false
        })
        return
      }
      wx.showToast({ title: res.result?.errMsg || '加载失败', icon: 'none' })
    } catch (err) {
      console.error('loadBanks failed:', err)
      wx.showToast({
        title: getCloudFunctionErrorMessage(err, 'getAdminQuestionBankList', '题库列表加载失败'),
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

  editBank(e) {
    const id = e.currentTarget.dataset.id
    const bank = this.data.banks.find(item => item._id === id)
    if (!bank) return
    this.setData({
      editingId: id,
      form: {
        name: bank.name || '',
        summary: bank.summary || '',
        coverImage: bank.coverImage || '',
        status: bank.status || 'draft',
        sort: String(bank.sort || 0),
        defaultQuestionCount: String(bank.defaultQuestionCount || 10)
      }
    })
  },

  resetForm() {
    this.setData({
      editingId: '',
      form: createEmptyForm()
    })
  },

  openQuestionPool(e) {
    const bankId = e.currentTarget.dataset.id || '__all__'
    const bankName = e.currentTarget.dataset.name || '全部题目池'
    const entryMode = e.currentTarget.dataset.entryMode || 'pool'
    wx.navigateTo({
      url: `/pages/question-editor/question-editor?bankId=${encodeURIComponent(bankId)}&bankName=${encodeURIComponent(bankName)}&entryMode=${encodeURIComponent(entryMode)}`
    })
  },

  previewBank(e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name || '题库预览'
    const count = Math.max(1, Math.min(Number(e.currentTarget.dataset.count) || 10, 20))
    if (!id) return

    wx.navigateTo({
      url: `/pages/quiz/quiz?bankId=${encodeURIComponent(id)}&bankName=${encodeURIComponent(name)}&count=${count}&preview=1`
    })
  },

  async chooseCoverImage() {
    if (this.data.coverUploading || this.data.submitting || this.data.actionBankId) return

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
      const cloudPath = `question-banks/covers/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath
      })

      this.setData({
        'form.coverImage': uploadRes.fileID || ''
      })
      wx.showToast({ title: '上传成功', icon: 'success' })
    } catch (err) {
      console.error('uploadCoverImage failed:', err)
      if (isStoragePermissionDenied(err)) {
        wx.showModal({
          title: '封面上传失败',
          content: '当前云环境未开放小程序端云存储上传权限，请先到云开发控制台为当前环境开启存储上传权限，再重试上传。',
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
    if (this.data.coverUploading || this.data.submitting || this.data.actionBankId) return
    this.setData({ 'form.coverImage': '' })
  },

  async saveBank() {
    if (this._savingBank || this.data.submitting) return
    if (this.data.coverUploading) {
      wx.showToast({ title: '请等待封面上传完成', icon: 'none' })
      return
    }

    if (!this.data.form.name.trim()) {
      wx.showToast({ title: '请填写题库名称', icon: 'none' })
      return
    }

    this._savingBank = true
    this.setData({ submitting: true })

    try {
      const payload = {
        ...this.data.form,
        sort: Number(this.data.form.sort) || 0,
        defaultQuestionCount: Number(this.data.form.defaultQuestionCount) || 10
      }
      const res = await wx.cloud.callFunction({
        name: 'saveQuestionBank',
        data: { id: this.data.editingId, payload }
      })
      if (res.result && res.result.success) {
        wx.showToast({ title: '保存成功', icon: 'success' })
        this.resetForm()
        await this.loadBanks()
        return
      }
      wx.showToast({ title: res.result?.errMsg || '保存失败', icon: 'none' })
    } catch (err) {
      console.error('saveBank failed:', err)
      wx.showToast({
        title: getCloudFunctionErrorMessage(err, 'saveQuestionBank', '保存失败'),
        icon: 'none'
      })
    } finally {
      this._savingBank = false
      this.setData({ submitting: false })
    }
  },

  async confirmBankAction(id, title, content, action) {
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title,
        content,
        confirmColor: action === 'delete' ? '#ef4444' : '#0ea5e9',
        success: res => resolve(Boolean(res.confirm)),
        fail: () => resolve(false)
      })
    })

    if (!confirmed) return

    this.setData({ actionBankId: id, actionType: action })

    try {
      const res = await wx.cloud.callFunction({
        name: 'deleteQuestionBank',
        data: { id, action }
      })

      if (res.result && res.result.success) {
        if (this.data.editingId === id && action === 'delete') {
          this.resetForm()
        }
        wx.showToast({
          title: action === 'delete' ? '删除成功' : '已下线',
          icon: 'success'
        })
        await this.loadBanks()
        return
      }

      wx.showToast({ title: res.result?.errMsg || '操作失败', icon: 'none' })
    } catch (err) {
      console.error(`${action} question bank failed:`, err)
      wx.showToast({
        title: getCloudFunctionErrorMessage(err, 'deleteQuestionBank', '操作失败'),
        icon: 'none'
      })
    } finally {
      this.setData({ actionBankId: '', actionType: '' })
    }
  },

  offlineBank(e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name || '该题库'
    if (!id || this.data.actionBankId || this.data.submitting || this.data.coverUploading) return
    this.confirmBankAction(id, '确认下线', `下线“${name}”后，用户侧将不再展示该题库。确定继续吗？`, 'offline')
  },

  deleteBank(e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name || '该题库'
    if (!id || this.data.actionBankId || this.data.submitting || this.data.coverUploading) return
    this.confirmBankAction(id, '确认删除', `删除“${name}”前必须保证题库下没有题目。确定继续吗？`, 'delete')
  }
})
