/**
 * 搜索页面 - 搜索模块 (v3)
 *
 * 上游依赖：云函数(searchArticles/searchUsers)
 * 入口：页面 onLoad
 * 主要功能：搜索资讯与用户并展示
 * 输出：搜索结果列表
 *
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */

const { resolveTag, resolveTagType } = require('../../utils/article-tags')

Page({
  data: {
    keyword: '',
    tab: 'articles',
    loading: false,
    articles: [],
    users: []
  },

  onLoad(options) {
    const keyword = options.keyword ? String(options.keyword) : ''
    if (keyword) {
      this.setData({ keyword })
      this.doSearch()
    }
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ tab })
    // 若已有关键词且对应结果为空，触发一次搜索
    if (this.data.keyword.trim()) {
      this.doSearch()
    }
  },

  async doSearch() {
    const keyword = (this.data.keyword || '').trim()
    if (!keyword) {
      this.setData({ articles: [], users: [] })
      return
    }
    this.setData({ loading: true })
    try {
      if (this.data.tab === 'articles') {
        const res = await wx.cloud.callFunction({ name: 'searchArticles', data: { keyword, limit: 30 } })
        if (res.result && res.result.success) {
          const rawArticles = res.result.data.articles || []
          this.setData({
            articles: rawArticles.map(a => ({
              ...a,
              tag: resolveTag(a.tag),
              tagType: resolveTagType(a.tagType)
            }))
          })
        }
      } else {
        const res = await wx.cloud.callFunction({ name: 'searchUsers', data: { keyword, limit: 30 } })
        if (res.result && res.result.success) {
          this.setData({ users: res.result.data.users || [] })
        }
      }
    } catch (err) {
      console.error('search failed:', err)
      wx.showToast({ title: '搜索失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  openArticle(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/article-detail/article-detail?id=${id}` })
  },

  openUser(e) {
    const uid = e.currentTarget.dataset.uid
    wx.navigateTo({ url: `/pages/profile/profile?uid=${uid}` })
  },

  goBack() {
    wx.navigateBack()
  }
})

