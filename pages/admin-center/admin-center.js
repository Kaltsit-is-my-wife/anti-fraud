Page({
  data: {
    entries: [
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
        url: '/pages/review-center/review-center'
      }
    ]
  },

  openEntry(e) {
    const url = e.currentTarget.dataset.url
    if (!url) return
    wx.navigateTo({ url })
  }
})
