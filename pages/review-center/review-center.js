const { formatDateTimeLocal } = require('../../utils/util')
const { ensurePagePermission } = require('../../utils/permission')
const { getCloudFunctionErrorMessage } = require('../../utils/cloud')

const TARGET_TYPE_LABELS = {
  topic_comment: '话题评论',
  feedback: '用户反馈',
  scam_report: '诈骗举报'
}

const STATUS_LABELS = {
  pending_review: '待审核',
  approved: '已通过',
  rejected: '已驳回',
  hidden: '已隐藏'
}

const KEYWORD_LEVEL_LABELS = {
  none: '未命中',
  medium: '中风险',
  high: '高风险'
}

const ACTION_LABELS = {
  approve: '通过',
  reject: '驳回',
  hide: '隐藏'
}

function buildSubmitterText(task) {
  const nickName = task.submitterNickName || ''
  const uid = task.submitterUid || ''
  if (nickName && uid && nickName !== uid) return `${nickName}（${uid}）`
  return nickName || uid || ''
}

function buildSourceMetaLines(task) {
  const lines = []
  const sourceMeta = task.sourceMeta && typeof task.sourceMeta === 'object' ? task.sourceMeta : {}
  const submitterText = buildSubmitterText(task)

  if (submitterText) {
    lines.push(`提交人：${submitterText}`)
  }

  if (task.targetType === 'topic_comment') {
    if (sourceMeta.topicTitle) {
      lines.push(`所属话题：${sourceMeta.topicTitle}`)
    } else if (sourceMeta.topicId) {
      lines.push(`话题ID：${sourceMeta.topicId}`)
    }

    if (sourceMeta.parentId) {
      lines.push(`父评论ID：${sourceMeta.parentId}`)
    }

    if (sourceMeta.replyToUid) {
      lines.push(`回复对象：${sourceMeta.replyToUid}`)
    }
  }

  if (task.targetType === 'feedback' && sourceMeta.contactInfo) {
    lines.push(`联系方式：${sourceMeta.contactInfo}`)
  }

  if (task.targetType === 'scam_report') {
    if (sourceMeta.type) lines.push(`诈骗类型：${sourceMeta.type}`)
    if (sourceMeta.channel) lines.push(`发生渠道：${sourceMeta.channel}`)
    if (sourceMeta.scamAccount) lines.push(`涉诈账号：${sourceMeta.scamAccount}`)
    if (sourceMeta.scamLink) lines.push(`相关链接：${sourceMeta.scamLink}`)
    if (sourceMeta.imageCount) lines.push(`图片数量：${sourceMeta.imageCount}`)
  }

  if (!task.sourceExists) {
    lines.push('源记录状态：原始内容不存在，请先核对数据')
  }

  return lines
}

Page({
  data: {
    loading: true,
    permissionLoading: true,
    hasPageAccess: false,
    actionLoading: false,
    currentStatus: 'pending_review',
    tasks: [],
    tabs: [
      { key: 'pending_review', label: '待审核' },
      { key: 'approved', label: '已通过' },
      { key: 'rejected', label: '已驳回' },
      { key: 'hidden', label: '已隐藏' }
    ]
  },

  async onLoad() {
    const access = await ensurePagePermission(this, 'review')
    if (!access.allowed) {
      this.setData({ loading: false })
      return
    }
    this.loadTasks()
  },

  onShow() {
    if (this.data.hasPageAccess && !this.data.actionLoading && !this.data.loading) {
      this.loadTasks()
    }
  },

  async loadTasks() {
    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'getReviewTasks',
        data: {
          status: this.data.currentStatus,
          pageSize: 50
        }
      })

      if (res.result && res.result.success) {
        const tasks = (res.result.data?.list || []).map(item => ({
          ...item,
          targetTypeLabel: TARGET_TYPE_LABELS[item.targetType] || item.targetType || '未知类型',
          reviewStatusLabel: STATUS_LABELS[item.reviewStatus] || item.reviewStatus || '未知状态',
          keywordLevelLabel: KEYWORD_LEVEL_LABELS[item.keywordHitLevel] || '未命中',
          createdAtText: item.createdAt ? formatDateTimeLocal(new Date(item.createdAt)) : '',
          reviewedAtText: item.reviewedAt ? formatDateTimeLocal(new Date(item.reviewedAt)) : '',
          keywordText: Array.isArray(item.keywordHits) ? item.keywordHits.join('、') : '',
          contentText: item.contentText || '无内容预览',
          sourceMetaLines: buildSourceMetaLines(item),
          remark: '',
          remarkLength: 0
        }))
        this.setData({
          tasks,
          loading: false
        })
        return
      }

      wx.showToast({ title: res.result?.errMsg || '加载失败', icon: 'none' })
    } catch (err) {
      console.error('loadTasks failed:', err)
      wx.showToast({
        title: getCloudFunctionErrorMessage(err, 'getReviewTasks', '审核任务加载失败'),
        icon: 'none'
      })
    }

    this.setData({ loading: false })
  },

  switchTab(e) {
    const currentStatus = e.currentTarget.dataset.status
    if (!currentStatus || currentStatus === this.data.currentStatus) return
    this.setData({ currentStatus }, () => this.loadTasks())
  },

  onRemarkInput(e) {
    const index = Number(e.currentTarget.dataset.index)
    if (!Number.isInteger(index) || index < 0) return

    const value = typeof e.detail?.value === 'string' ? e.detail.value.slice(0, 200) : ''
    this.setData({
      [`tasks[${index}].remark`]: value,
      [`tasks[${index}].remarkLength`]: value.length
    })
  },

  async reviewTask(e) {
    const taskId = e.currentTarget.dataset.id
    const action = e.currentTarget.dataset.action
    const index = Number(e.currentTarget.dataset.index)
    const task = Number.isInteger(index) && index >= 0 ? this.data.tasks[index] : null
    if (!taskId || !action || this.data.actionLoading || !task) return
    if (!task.sourceExists) {
      wx.showToast({ title: '原始内容不存在，无法审核', icon: 'none' })
      return
    }

    const remark = (task.remark || '').trim()
    if ((action === 'reject' || action === 'hide') && !remark) {
      wx.showToast({ title: '驳回或隐藏请填写审核说明', icon: 'none' })
      return
    }

    const actionLabel = ACTION_LABELS[action] || '处理'
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: `确认${actionLabel}`,
        content: remark
          ? `该操作会同步更新源内容状态，并记录审核说明“${remark}”，确定要${actionLabel}吗？`
          : `该操作会同步更新源内容状态，确定要${actionLabel}吗？`,
        success: res => resolve(res.confirm),
        fail: () => resolve(false)
      })
    })
    if (!confirmed) return

    try {
      this.setData({ actionLoading: true })
      const res = await wx.cloud.callFunction({
        name: 'reviewContent',
        data: { taskId, action, remark }
      })

      if (res.result && res.result.success) {
        wx.showToast({ title: '处理成功', icon: 'success' })
        await this.loadTasks()
        return
      }

      wx.showToast({ title: res.result?.errMsg || '处理失败', icon: 'none' })
    } catch (err) {
      console.error('reviewTask failed:', err)
      wx.showToast({
        title: getCloudFunctionErrorMessage(err, 'reviewContent', '处理失败'),
        icon: 'none'
      })
    } finally {
      this.setData({ actionLoading: false })
    }
  }
})
