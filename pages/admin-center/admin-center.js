const { ensurePagePermission, loadPermissionSnapshot } = require('../../utils/permission')

const BASE_ENTRIES = [
  {
    icon: '📌',
    title: '话题管理',
    desc: '创建、编辑和发布热点话题',
    url: '/pages/topic-management/topic-management'
  },
  {
    icon: '🎬',
    title: '视频管理',
    desc: '维护视频内容、封面和播放地址',
    url: '/pages/video-management/video-management'
  },
  {
    icon: '🧠',
    title: '题库管理',
    desc: '维护题库基础信息和发布状态',
    url: '/pages/question-bank-management/question-bank-management'
  },
  {
    icon: '✏️',
    title: '题目管理',
    desc: '维护题目、答案、解析和题库归属',
    url: '/pages/question-editor/question-editor'
  },
  {
    icon: '🛡️',
    title: '审核中心',
    desc: '处理用户评论、反馈和举报审核',
    url: '/pages/review-center/review-center',
    scope: 'review'
  }
]

Page({
  data: {
    entries: [],
    permissionLoading: true,
    hasPageAccess: false
  },

  async onLoad() {
    const access = await ensurePagePermission(this, 'admin')
    if (!access.allowed) return
    this.applyEntries(access.snapshot)
  },

  async onShow() {
    if (this.data.permissionLoading) return

    const snapshot = await loadPermissionSnapshot()
    if (!snapshot.hasAdminAccess) return
    this.applyEntries(snapshot)
  },

  applyEntries(snapshot) {
    const entries = BASE_ENTRIES.filter(item => item.scope !== 'review' || snapshot.hasReviewAccess)
    this.setData({
      entries,
      hasPageAccess: true,
      permissionLoading: false
    })
  },

  openEntry(e) {
    const url = e.currentTarget.dataset.url
    if (!url) return
    wx.navigateTo({ url })
  }
})
