/**
 * 个人主页页面 - 社交/个人主页模块 (v3)
 *
 * 上游依赖：云函数(getPublicProfile/followUser)
 * 入口：页面 onLoad(uid)
 * 主要功能：展示他人公共主页；关注/取消关注
 * 输出：主页内容渲染
 *
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */

Page({
  data: {
    uid: '',
    loading: true,
    profile: null,
    displayTitles: [],
    displayAchievements: [],
    isFollowing: false
  },

  onLoad(options) {
    const uid = options.uid || ''
    this.setData({ uid })
    this.load()
  },

  async load() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'getPublicProfile',
        data: { uid: this.data.uid }
      })
      if (res.result && res.result.success) {
        const data = res.result.data
        this.setData({
          profile: data.profile,
          displayTitles: data.displayTitles || [],
          displayAchievements: data.displayAchievements || [],
          isFollowing: !!data.isFollowing,
          loading: false
        })
      } else {
        wx.showToast({ title: res.result?.errMsg || '加载失败', icon: 'none' })
        this.setData({ loading: false })
      }
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  async toggleFollow() {
    const profile = this.data.profile
    if (!profile || !profile.uid) return
    const action = this.data.isFollowing ? 'unfollow' : 'follow'
    try {
      const res = await wx.cloud.callFunction({
        name: 'followUser',
        data: { uid: profile.uid, action }
      })
      if (res.result && res.result.success) {
        this.setData({ isFollowing: !!res.result.data.isFollowing })
        // 轻量刷新计数
        this.load()
      } else {
        wx.showToast({ title: res.result?.errMsg || '操作失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  goBack() {
    wx.navigateBack()
  }
})

