/**
 * 积分商城页面 - 当前阶段前端关闭态
 *
 * 上游依赖：用户积分数据、背包页面
 * 入口：页面 onLoad / onShow
 * 主要功能：展示当前积分、说明商城暂未开放、保留背包入口
 * 输出：渲染积分商城关闭提示页
 */
// pages/points/points.js
const { FEATURE_FLAGS, POINTS_MALL_NOTICE } = require('../../utils/feature')

Page({
  data: {
    userPoints: 0,
    pointsMallEnabled: FEATURE_FLAGS.pointsMallEnabled,
    closedNotice: POINTS_MALL_NOTICE,
    closedHighlights: [
      '积分会继续累计，可正常用于成长记录。',
      '已兑换的内容仍可在背包中查看。',
      '后续重新开放时，无需重新领取或迁移积分。'
    ]
  },

  onLoad() {
    this.loadUserPointsFromCloud()
  },

  onShow() {
    this.loadUserPointsFromCloud()
  },

  async loadUserPointsFromCloud() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'getUserInfo',
        data: {}
      })

      if (result.result && result.result.success) {
        const points = result.result.data?.userInfo?.points || 0
        this.setData({ userPoints: points })
        wx.setStorageSync('points', points)
        return
      }
    } catch (err) {
    }

    this.loadUserPoints()
  },

  loadUserPoints() {
    try {
      const points = wx.getStorageSync('points') || 0
      this.setData({ userPoints: points })
    } catch (e) {
    }
  },

  navigateToBackpack() {
    wx.navigateTo({
      url: '/pages/backpack/backpack'
    })
  },

  goBack() {
    wx.navigateBack()
  }
})
