Page({
  data: {
    loading: true,
    editingId: '',
    banks: [],
    form: {
      name: '',
      summary: '',
      coverImage: '',
      status: 'draft',
      sort: '0',
      defaultQuestionCount: '10'
    },
    statusOptions: ['draft', 'published', 'offline']
  },

  onLoad() {
    this.loadBanks()
  },

  async loadBanks() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({ name: 'getAdminQuestionBankList', data: {} })
      if (res.result && res.result.success) {
        this.setData({ banks: res.result.data?.list || [], loading: false })
        return
      }
      wx.showToast({ title: res.result?.errMsg || '加载失败', icon: 'none' })
    } catch (err) {
      console.error('loadBanks failed:', err)
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
      form: {
        name: '',
        summary: '',
        coverImage: '',
        status: 'draft',
        sort: '0',
        defaultQuestionCount: '10'
      }
    })
  },

  async saveBank() {
    if (!this.data.form.name.trim()) {
      wx.showToast({ title: '请填写题库名称', icon: 'none' })
      return
    }

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
        this.loadBanks()
        return
      }
      wx.showToast({ title: res.result?.errMsg || '保存失败', icon: 'none' })
    } catch (err) {
      console.error('saveBank failed:', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  }
})
