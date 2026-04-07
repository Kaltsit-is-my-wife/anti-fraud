/**
 * 发帖页面 - 社区模块 (v3)
 *
 * 上游依赖：无
 * 入口：页面 onLoad
 * 主要功能：提示社区已升级为官方话题讨论
 * 输出：引导用户返回社区页
 *
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */

Page({
  data: {
    notice: '社区已升级为官方话题讨论模式，普通用户暂不支持公开发帖。'
  },

  goCommunity() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.switchTab({ url: '/pages/community/community' })
  }
})

