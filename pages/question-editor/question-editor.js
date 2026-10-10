const { ensurePagePermission } = require('../../utils/permission')
const { getCloudFunctionErrorMessage } = require('../../utils/cloud')

const POOL_ALL_ID = '__all__'
const UNASSIGNED_ID = '__unassigned__'

function createEmptyForm() {
  return {
    question: '',
    optionsText: '',
    answerIndex: '0',
    explanation: '',
    difficulty: '1',
    tagsText: '',
    isActive: true
  }
}

function createBankOptions(banks) {
  return [
    { _id: POOL_ALL_ID, name: '全部题目池' },
    { _id: UNASSIGNED_ID, name: '未加入任何题库' },
    ...banks
  ]
}

function getImportTemplate() {
  return JSON.stringify([
    {
      question: '接到自称客服的退款电话时，最安全的做法是？',
      options: [
        '按对方要求转账',
        '在原平台官方入口核实',
        '提供验证码配合退款',
        '下载对方发来的处理软件'
      ],
      answerIndex: 1,
      explanation: '退款应在原平台官方入口核实，不能提供验证码或转账。',
      difficulty: 2,
      tags: ['冒充客服', '退款'],
      isActive: true
    }
  ], null, 2)
}

function isSpecialBank(bankId) {
  return !bankId || [POOL_ALL_ID, UNASSIGNED_ID].includes(bankId)
}

Page({
  data: {
    loading: true,
    permissionLoading: true,
    hasPageAccess: false,
    submitting: false,
    processingQuestionId: '',
    importing: false,
    entryMode: 'pool',
    editingId: '',
    banks: [],
    selectedBankId: POOL_ALL_ID,
    selectedBankIndex: 0,
    selectedBankName: '全部题目池',
    statusFilterOptionList: [
      { value: 'all', label: '全部题目' },
      { value: 'active', label: '仅启用' },
      { value: 'inactive', label: '仅停用' }
    ],
    selectedStatusFilter: 'all',
    selectedStatusIndex: 0,
    selectedStatusLabel: '全部题目',
    difficultyFilterOptionList: [
      { value: 'all', label: '全部难度' },
      { value: '1', label: '难度 1' },
      { value: '2', label: '难度 2' },
      { value: '3', label: '难度 3' },
      { value: '4', label: '难度 4' },
      { value: '5', label: '难度 5' }
    ],
    selectedDifficultyFilter: 'all',
    selectedDifficultyIndex: 0,
    selectedDifficultyLabel: '全部难度',
    relationScopeOptionList: [
      { value: 'all', label: '全部题目' },
      { value: 'linked', label: '已加入当前题库' },
      { value: 'unlinked', label: '未加入当前题库' }
    ],
    selectedRelationScope: 'all',
    selectedRelationIndex: 0,
    selectedRelationLabel: '全部题目',
    showRelationScope: false,
    entryHint: '这里展示全部题目池。',
    createHint: '新建题目后会先进入题目池，不自动加入正式题库。',
    importHint: '导入后只进入题目池，不自动加入正式题库。',
    filterKeyword: '',
    filterTag: '',
    importText: '',
    questions: [],
    form: createEmptyForm()
  },

  async onLoad(options) {
    const access = await ensurePagePermission(this, 'admin')
    if (!access.allowed) {
      this.setData({ loading: false })
      return
    }

    this.pendingBankId = typeof options?.bankId === 'string' ? decodeURIComponent(options.bankId) : POOL_ALL_ID
    this.pendingBankName = typeof options?.bankName === 'string' ? decodeURIComponent(options.bankName) : '全部题目池'
    this.pendingEntryMode = typeof options?.entryMode === 'string' ? decodeURIComponent(options.entryMode) : 'pool'

    await this.loadBanks()
    await this.loadQuestions()

    const entryMode = ['create', 'import', 'pool'].includes(this.pendingEntryMode) ? this.pendingEntryMode : 'pool'
    this.setData({ entryMode })
    if (entryMode === 'create') this.scrollToCreatePanel()
    if (entryMode === 'import') this.scrollToImportPanel()
    if (entryMode === 'pool') this.scrollToPoolPanel()
  },

  updateViewHints() {
    let entryHint = '这里展示全部题目池。'
    let createHint = '新建题目后会先进入题目池，不自动加入正式题库。'
    let importHint = '导入后只进入题目池，不自动加入正式题库。'
    const showRelationScope = !isSpecialBank(this.data.selectedBankId)

    if (this.data.selectedBankId === UNASSIGNED_ID) {
      entryHint = '这里展示未加入任何题库的题目。切换到某个题库后，可把这些题加入进去。'
    } else if (showRelationScope) {
      entryHint = `下方列表是全局题目池。点击“加入当前题库 / 移出当前题库”即可维护《${this.data.selectedBankName}》的选题。`
      createHint = '新建题目后会先进入题目池，并自动加入当前题库。'
      importHint = '导入后先进入题目池，并自动加入当前题库。'
    }

    this.setData({
      showRelationScope,
      entryHint,
      createHint,
      importHint
    })
  },

  async loadBanks() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getAdminQuestionBankList', data: {} })
      const realBanks = ((res.result && res.result.success ? res.result.data?.list : []) || []).map(item => ({
        _id: item._id,
        name: item.name || '未命名题库'
      }))
      const bankOptions = createBankOptions(realBanks)

      const targetBankId = this.pendingBankId || POOL_ALL_ID
      const selectedBank = bankOptions.find(item => item._id === targetBankId) || bankOptions[0]
      const selectedBankIndex = Math.max(0, bankOptions.findIndex(item => item._id === selectedBank._id))

      this.setData({
        banks: bankOptions,
        selectedBankId: selectedBank._id,
        selectedBankIndex,
        selectedBankName: this.pendingBankName || selectedBank.name
      })
      this.updateViewHints()
    } catch (err) {
      console.error('loadBanks failed:', err)
      wx.showToast({
        title: getCloudFunctionErrorMessage(err, 'getAdminQuestionBankList', '题库加载失败'),
        icon: 'none'
      })
      const bankOptions = createBankOptions([])
      this.setData({
        banks: bankOptions,
        selectedBankId: POOL_ALL_ID,
        selectedBankIndex: 0,
        selectedBankName: '全部题目池'
      })
      this.updateViewHints()
    } finally {
      this.pendingBankId = ''
      this.pendingBankName = ''
      this.pendingEntryMode = ''
    }
  },

  canManageCurrentBankRelation() {
    return !isSpecialBank(this.data.selectedBankId)
  },

  enrichQuestion(question) {
    const bankMap = new Map(this.data.banks.map(item => [item._id, item.name]))
    const tagText = Array.isArray(question.tags) ? question.tags.filter(Boolean).join('、') : ''
    const linkedBankNameText = Array.isArray(question.bankIds)
      ? question.bankIds.map(id => bankMap.get(id) || id).filter(Boolean).join('、')
      : ''
    const canManageRelation = this.canManageCurrentBankRelation()

    return {
      ...question,
      statusText: question.isActive === false ? '停用' : '启用',
      tagText,
      linkedBankNameText,
      relationAction: canManageRelation && question.isInSelectedBank ? 'remove' : 'add',
      relationActionLabel: canManageRelation
        ? (question.isInSelectedBank ? '移出当前题库' : '加入当前题库')
        : '加入题库',
      activeActionLabel: question.isActive === false ? '启用' : '停用',
      relationButtonType: canManageRelation && question.isInSelectedBank ? 'secondary' : '',
      activeButtonType: question.isActive === false ? '' : 'danger'
    }
  },

  async loadQuestions() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'getQuizQuestionList',
        data: {
          bankId: this.data.selectedBankId,
          status: this.data.selectedStatusFilter,
          keyword: this.data.filterKeyword,
          tag: this.data.filterTag,
          difficulty: this.data.selectedDifficultyFilter,
          relationScope: this.canManageCurrentBankRelation() ? this.data.selectedRelationScope : 'all'
        }
      })

      if (res.result && res.result.success) {
        this.setData({
          questions: (res.result.data?.list || []).map(item => this.enrichQuestion(item)),
          loading: false
        })
        return
      }

      wx.showToast({ title: res.result?.errMsg || '加载失败', icon: 'none' })
    } catch (err) {
      console.error('loadQuestions failed:', err)
      wx.showToast({
        title: getCloudFunctionErrorMessage(err, 'getQuizQuestionList', '题目列表加载失败'),
        icon: 'none'
      })
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
      selectedBankName: bank.name,
      selectedRelationScope: 'all',
      selectedRelationIndex: 0,
      selectedRelationLabel: '全部题目'
    }, () => {
      this.updateViewHints()
      this.loadQuestions()
    })
  },

  onStatusFilterChange(e) {
    const index = Number(e.detail.value) || 0
    const option = this.data.statusFilterOptionList[index] || { value: 'all', label: '全部题目' }
    this.setData({
      selectedStatusIndex: index,
      selectedStatusFilter: option.value,
      selectedStatusLabel: option.label
    }, () => this.loadQuestions())
  },

  onDifficultyFilterChange(e) {
    const index = Number(e.detail.value) || 0
    const option = this.data.difficultyFilterOptionList[index] || { value: 'all', label: '全部难度' }
    this.setData({
      selectedDifficultyIndex: index,
      selectedDifficultyFilter: option.value,
      selectedDifficultyLabel: option.label
    }, () => this.loadQuestions())
  },

  onRelationScopeChange(e) {
    const index = Number(e.detail.value) || 0
    const option = this.data.relationScopeOptionList[index] || { value: 'all', label: '全部题目' }
    this.setData({
      selectedRelationIndex: index,
      selectedRelationScope: option.value,
      selectedRelationLabel: option.label
    }, () => this.loadQuestions())
  },

  onFilterInput(e) {
    const key = e.currentTarget.dataset.key
    if (!key) return
    this.setData({ [key]: e.detail.value })
  },

  applyFilters() {
    this.loadQuestions()
  },

  clearFilters() {
    this.setData({
      filterKeyword: '',
      filterTag: '',
      selectedStatusFilter: 'all',
      selectedStatusIndex: 0,
      selectedStatusLabel: '全部题目',
      selectedDifficultyFilter: 'all',
      selectedDifficultyIndex: 0,
      selectedDifficultyLabel: '全部难度',
      selectedRelationScope: 'all',
      selectedRelationIndex: 0,
      selectedRelationLabel: '全部题目'
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
    this.scrollToCreatePanel()
  },

  resetForm() {
    this.setData({
      editingId: '',
      form: createEmptyForm()
    })
  },

  scrollToCreatePanel() {
    this.setData({ entryMode: 'create' })
    wx.pageScrollTo({ selector: '#create-panel', duration: 200 })
  },

  scrollToImportPanel() {
    this.setData({ entryMode: 'import' })
    wx.pageScrollTo({ selector: '#import-panel', duration: 200 })
  },

  scrollToPoolPanel() {
    this.setData({ entryMode: 'pool' })
    wx.pageScrollTo({ selector: '#pool-panel', duration: 200 })
  },

  getInitialBankIdForCreate() {
    return this.canManageCurrentBankRelation() ? this.data.selectedBankId : ''
  },

  async saveQuestion() {
    if (this._savingQuestion || this.data.submitting) return

    const options = (this.data.form.optionsText || '')
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean)
    const answerIndex = Number(this.data.form.answerIndex)

    if (!this.data.form.question.trim()) {
      wx.showToast({ title: '请填写题目内容', icon: 'none' })
      return
    }
    if (options.length < 2) {
      wx.showToast({ title: '请至少填写两个选项', icon: 'none' })
      return
    }
    if (!Number.isFinite(answerIndex) || answerIndex < 0 || answerIndex >= options.length) {
      wx.showToast({ title: '正确答案索引不合法', icon: 'none' })
      return
    }

    this._savingQuestion = true
    this.setData({ submitting: true })

    try {
      const payload = {
        question: this.data.form.question,
        options,
        answerIndex,
        explanation: this.data.form.explanation,
        difficulty: Number(this.data.form.difficulty) || 1,
        tags: this.data.form.tagsText,
        isActive: this.data.form.isActive,
        ...(this.data.editingId ? {} : { initialBankId: this.getInitialBankIdForCreate() })
      }

      const res = await wx.cloud.callFunction({
        name: 'saveQuizQuestion',
        data: { id: this.data.editingId, payload }
      })

      if (res.result && res.result.success) {
        wx.showToast({ title: '保存成功', icon: 'success' })
        this.resetForm()
        await this.loadQuestions()
        return
      }

      wx.showToast({ title: res.result?.errMsg || '保存失败', icon: 'none' })
    } catch (err) {
      console.error('saveQuestion failed:', err)
      wx.showToast({
        title: getCloudFunctionErrorMessage(err, 'saveQuizQuestion', '保存失败'),
        icon: 'none'
      })
    } finally {
      this._savingQuestion = false
      this.setData({ submitting: false })
    }
  },

  async toggleQuestionActive(e) {
    const id = e.currentTarget.dataset.id
    const question = this.data.questions.find(item => item._id === id)
    if (!id || !question || this.data.processingQuestionId || this.data.submitting || this.data.importing) return

    this.setData({ processingQuestionId: id })

    try {
      if (question.isActive === false) {
        const res = await wx.cloud.callFunction({
          name: 'saveQuizQuestion',
          data: {
            id,
            payload: {
              question: question.question || '',
              options: question.options || [],
              answerIndex: question.answerIndex || 0,
              explanation: question.explanation || '',
              difficulty: question.difficulty || 1,
              tags: Array.isArray(question.tags) ? question.tags.join(', ') : '',
              isActive: true
            }
          }
        })

        if (res.result && res.result.success) {
          if (this.data.editingId === id) {
            this.setData({ 'form.isActive': true })
          }
          wx.showToast({ title: '已启用', icon: 'success' })
          await this.loadQuestions()
          return
        }

        wx.showToast({ title: res.result?.errMsg || '启用失败', icon: 'none' })
        return
      }

      const res = await wx.cloud.callFunction({ name: 'deleteQuizQuestion', data: { id } })
      if (res.result && res.result.success) {
        if (this.data.editingId === id) {
          this.setData({ 'form.isActive': false })
        }
        wx.showToast({ title: '已停用', icon: 'success' })
        await this.loadQuestions()
        return
      }

      wx.showToast({ title: res.result?.errMsg || '操作失败', icon: 'none' })
    } catch (err) {
      console.error('toggleQuestionActive failed:', err)
      wx.showToast({
        title: getCloudFunctionErrorMessage(err, question.isActive === false ? 'saveQuizQuestion' : 'deleteQuizQuestion', '操作失败'),
        icon: 'none'
      })
    } finally {
      this.setData({ processingQuestionId: '' })
    }
  },

  async toggleRelation(e) {
    const questionId = e.currentTarget.dataset.id
    const action = e.currentTarget.dataset.action
    if (!questionId || !action || this.data.processingQuestionId || this.data.submitting || this.data.importing) return

    this.setData({ processingQuestionId: questionId })
    try {
      let bankId = this.data.selectedBankId
      let nextAction = action

      if (!this.canManageCurrentBankRelation()) {
        const targetBanks = this.data.banks.filter(item => !isSpecialBank(item._id))
        if (!targetBanks.length) {
          wx.showToast({ title: '暂无可加入的题库', icon: 'none' })
          return
        }

        const chosenIndex = await new Promise(resolve => {
          wx.showActionSheet({
            itemList: targetBanks.map(item => item.name),
            success: res => resolve(Number(res.tapIndex)),
            fail: () => resolve(-1)
          })
        })

        if (chosenIndex < 0) return
        bankId = targetBanks[chosenIndex]?._id || ''
        nextAction = 'add'
        if (!bankId) return
      }

      const res = await wx.cloud.callFunction({
        name: 'updateQuestionBankRelation',
        data: {
          questionId,
          bankId,
          action: nextAction
        }
      })

      if (res.result && res.result.success) {
        wx.showToast({
          title: nextAction === 'add' ? '已加入题库' : '已移出当前题库',
          icon: 'success'
        })
        await this.loadQuestions()
        return
      }

      wx.showToast({ title: res.result?.errMsg || '操作失败', icon: 'none' })
    } catch (err) {
      console.error('toggleRelation failed:', err)
      wx.showToast({
        title: getCloudFunctionErrorMessage(err, 'updateQuestionBankRelation', '操作失败'),
        icon: 'none'
      })
    } finally {
      this.setData({ processingQuestionId: '' })
    }
  },

  onImportInput(e) {
    this.setData({ importText: e.detail.value })
  },

  fillImportTemplate() {
    this.setData({ importText: getImportTemplate() })
  },

  clearImportText() {
    this.setData({ importText: '' })
  },

  async importQuestions() {
    if (this.data.importing || this.data.submitting || this.data.processingQuestionId) return
    if (!this.data.importText.trim()) {
      wx.showToast({ title: '请先填写导入内容', icon: 'none' })
      return
    }

    this.setData({ importing: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'importQuizQuestions',
        data: {
          initialBankId: this.getInitialBankIdForCreate(),
          rawText: this.data.importText
        }
      })

      if (res.result && res.result.success) {
        wx.showToast({
          title: `已导入 ${res.result.data?.importedCount || 0} 道题`,
          icon: 'success'
        })
        this.setData({ importText: '' })
        await this.loadQuestions()
        return
      }

      wx.showToast({ title: res.result?.errMsg || '导入失败', icon: 'none' })
    } catch (err) {
      console.error('importQuestions failed:', err)
      wx.showToast({
        title: getCloudFunctionErrorMessage(err, 'importQuizQuestions', '导入失败'),
        icon: 'none'
      })
    } finally {
      this.setData({ importing: false })
    }
  }
})
