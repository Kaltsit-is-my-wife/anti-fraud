Page({
  data: {
    loading: true,
    editingId: '',
    banks: [],
    selectedBankId: 'default_bank',
    selectedBankIndex: 0,
    selectedBankName: '基础题库',
    questions: [],
    form: {
      question: '',
      optionsText: '',
      answerIndex: '0',
      explanation: '',
      difficulty: '1',
      tagsText: '',
      isActive: true
    }
  },

  onLoad() {
    this.loadBanks().then(() => this.loadQuestions())
  },

  async loadBanks() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getAdminQuestionBankList', data: {} })
      if (res.result && res.result.success) {
        const banks = [
          { _id: 'default_bank', name: '基础题库' },
          ...(res.result.data?.list || [])
        ]
        const selectedBank = banks.find(item => item._id === this.data.selectedBankId) || banks[0]
        const selectedBankIndex = banks.findIndex(item => item._id === selectedBank._id)
        this.setData({
          banks,
          selectedBankId: selectedBank._id,
          selectedBankIndex,
          selectedBankName: selectedBank.name
        })
        return
      }
    } catch (err) {
      console.error('loadBanks failed:', err)
    }
    this.setData({
      banks: [{ _id: 'default_bank', name: '基础题库' }],
      selectedBankId: 'default_bank',
      selectedBankIndex: 0,
      selectedBankName: '基础题库'
    })
  },

  async loadQuestions() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'getQuizQuestionList',
        data: { bankId: this.data.selectedBankId }
      })
      if (res.result && res.result.success) {
        this.setData({
          questions: res.result.data?.list || [],
          loading: false
        })
        return
      }
      wx.showToast({ title: res.result?.errMsg || '加载失败', icon: 'none' })
    } catch (err) {
      console.error('loadQuestions failed:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
    this.setData({ loading: false })
  },

  onBankChange(e) {
    const index = Number(e.detail.value) || 0
    const bank = this.data.banks[index]
    if (!bank) return
    this.setData({
      selectedBankId: bank._id,
      selectedBankIndex: index,
      selectedBankName: bank.name
    }, () => this.loadQuestions())
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key
    if (!key) return
    this.setData({ [`form.${key}`]: e.detail.value })
  },

  onActiveChange(e) {
    this.setData({ 'form.isActive': e.detail.value })
  },

  editQuestion(e) {
    const id = e.currentTarget.dataset.id
    const question = this.data.questions.find(item => item._id === id)
    if (!question) return
    this.setData({
      editingId: id,
      selectedBankId: question.bankId || 'default_bank',
      selectedBankName: ((this.data.banks.find(item => item._id === (question.bankId || 'default_bank'))) || { name: '基础题库' }).name,
      selectedBankIndex: Math.max(0, this.data.banks.findIndex(item => item._id === (question.bankId || 'default_bank'))),
      form: {
        question: question.question || '',
        optionsText: Array.isArray(question.options) ? question.options.join('\n') : '',
        answerIndex: String(question.answerIndex || 0),
        explanation: question.explanation || '',
        difficulty: String(question.difficulty || 1),
        tagsText: Array.isArray(question.tags) ? question.tags.join(', ') : '',
        isActive: question.isActive !== false
      }
    })
  },

  resetForm() {
    this.setData({
      editingId: '',
      form: {
        question: '',
        optionsText: '',
        answerIndex: '0',
        explanation: '',
        difficulty: '1',
        tagsText: '',
        isActive: true
      }
    })
  },

  async saveQuestion() {
    const options = (this.data.form.optionsText || '')
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean)
    if (!this.data.form.question.trim()) {
      wx.showToast({ title: '请填写题目内容', icon: 'none' })
      return
    }
    if (options.length < 2) {
      wx.showToast({ title: '请至少填写两个选项', icon: 'none' })
      return
    }

    try {
      const payload = {
        bankId: this.data.selectedBankId,
        question: this.data.form.question,
        options,
        answerIndex: Number(this.data.form.answerIndex) || 0,
        explanation: this.data.form.explanation,
        difficulty: Number(this.data.form.difficulty) || 1,
        tags: this.data.form.tagsText,
        isActive: this.data.form.isActive
      }
      const res = await wx.cloud.callFunction({
        name: 'saveQuizQuestion',
        data: { id: this.data.editingId, payload }
      })
      if (res.result && res.result.success) {
        wx.showToast({ title: '保存成功', icon: 'success' })
        this.resetForm()
        this.loadQuestions()
        return
      }
      wx.showToast({ title: res.result?.errMsg || '保存失败', icon: 'none' })
    } catch (err) {
      console.error('saveQuestion failed:', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  async deleteQuestion(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    try {
      const res = await wx.cloud.callFunction({ name: 'deleteQuizQuestion', data: { id } })
      if (res.result && res.result.success) {
        wx.showToast({ title: '已停用', icon: 'success' })
        this.loadQuestions()
        if (this.data.editingId === id) this.resetForm()
        return
      }
      wx.showToast({ title: res.result?.errMsg || '操作失败', icon: 'none' })
    } catch (err) {
      console.error('deleteQuestion failed:', err)
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  }
})
