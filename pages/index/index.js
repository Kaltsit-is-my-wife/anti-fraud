// pages/index/index.js
const { resolveCloudFileUrls } = require('../../utils/cloud')
const { readCacheData, writeCacheData, shouldRefresh } = require('../../utils/cache')

const INDEX_BANNER_CACHE_KEY = 'index:banners:v2'
const INDEX_ARTICLE_CACHE_KEY = 'index:articles:first-page'
const INDEX_BANNER_CACHE_TTL_MS = 10 * 60 * 1000
const INDEX_ARTICLE_CACHE_TTL_MS = 3 * 60 * 1000

const HOME_BANNERS = [
  {
    id: 1,
    title: '识别刷单返利骗局',
    desc: '先看套路，再看风险点，避免被高回报话术带偏。',
    bgColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  {
    id: 2,
    title: '转账前先停一停',
    desc: '遇到催促、保密、核验截图这类要求，先确认真实身份。',
    bgColor: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  },
  {
    id: 3,
    title: '识别冒充客服话术',
    desc: '退款、注销、征信修复这些高频套路，先核验平台官方渠道。',
    bgColor: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  },
  {
    id: 4,
    title: '建立日常防骗意识',
    desc: '把反诈知识变成习惯，看到异常流程就能及时停下来。',
    bgColor: 'linear-gradient(135deg, #36d1dc 0%, #5b86e5 100%)',
  }
]

function formatRelativeTime(timestamp) {
  const now = Date.now()
  const diff = now - timestamp
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)}分钟前`
  if (diff < day) return `${Math.floor(diff / hour)}小时前`
  if (diff < 2 * day) return '昨天'
  if (diff < 7 * day) return `${Math.floor(diff / day)}天前`

  const date = new Date(timestamp)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function formatViews(views) {
  if (views >= 10000) return `${(views / 10000).toFixed(1)}w`
  if (views >= 1000) return `${(views / 1000).toFixed(1)}k`
  return String(views)
}

function normalizeArticle(article) {
  const timestamp = article.timestamp || Date.now()
  const views = Number(article.views) || 0

  return {
    id: article._id || article.id,
    title: article.title || '',
    tag: article.tag || '知识科普',
    tagType: article.tagType || 'info',
    category: article.category || '全部',
    content: article.content || '',
    coverImage: article.coverImage || '',
    timestamp,
    views,
    author: article.author || '反诈小助手',
    time: formatRelativeTime(timestamp),
    viewsText: formatViews(views)
  }
}

Page({
  data: {
    banners: [],
    defaultBanners: HOME_BANNERS,
    categories: [
      '全部', '刷单返利', '虚假投资理财', '虚假购物服务', '冒充电商客服',
      '虚假贷款', '虚假征信', '冒充领导熟人', '冒充公检法', '网络婚恋交友', '网游虚假交易'
    ],
    selectedCategory: '全部',
    currentPage: 1,
    pageSize: 10,
    totalCount: 0,
    hasMore: true,
    isLoading: false,
    allArticles: [
      {
        id: 1,
        tag: '紧急预警',
        tagType: 'danger',
        title: '警惕：刷单兼职骗局又出新花样，多名学生被骗',
        timestamp: Date.now() - 2 * 60 * 60 * 1000,
        views: 12300,
        category: '刷单返利'
      },
      {
        id: 2,
        tag: '案例分析',
        tagType: 'warning',
        title: '大学生网购遭遇退款诈骗，一步步掉入陷阱',
        timestamp: Date.now() - 5 * 60 * 60 * 1000,
        views: 8700,
        category: '冒充电商客服'
      },
      {
        id: 3,
        tag: '防骗知识',
        tagType: 'warning',
        title: '校园贷、培训贷：大学生必须知道的五种贷款陷阱',
        timestamp: Date.now() - 30 * 60 * 60 * 1000,
        views: 15200,
        category: '虚假贷款'
      },
      {
        id: 4,
        tag: '知识科普',
        tagType: 'info',
        title: '大学生求职防骗指南：识破高薪兼职套路',
        timestamp: Date.now() - 10 * 60 * 60 * 1000,
        views: 6500,
        category: '刷单返利'
      },
      {
        id: 5,
        tag: '视频教程',
        tagType: 'info',
        title: '3分钟了解杀猪盘：大学生恋爱交友防骗攻略',
        timestamp: Date.now() - 12 * 60 * 60 * 1000,
        views: 9800,
        category: '网络婚恋交友'
      },
      {
        id: 6,
        tag: '紧急预警',
        tagType: 'danger',
        title: '新型电信诈骗：冒充公检法人员要求转账',
        timestamp: Date.now() - 24 * 60 * 60 * 1000,
        views: 18500,
        category: '冒充公检法'
      },
      {
        id: 7,
        tag: '案例分析',
        tagType: 'warning',
        title: '投资理财骗局揭秘：高收益背后的陷阱',
        timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000,
        views: 11200,
        category: '虚假投资理财'
      },
      {
        id: 8,
        tag: '知识科普',
        tagType: 'info',
        title: '如何识别钓鱼页面？这些特征要注意',
        timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000,
        views: 7800,
        category: '冒充公检法'
      },
      {
        id: 9,
        tag: '防骗知识',
        tagType: 'warning',
        title: '校园贷的套路有多深？真实案例告诉你',
        timestamp: Date.now() - 4 * 24 * 60 * 60 * 1000,
        views: 13600,
        category: '虚假贷款'
      },
      {
        id: 10,
        tag: '紧急预警',
        tagType: 'danger',
        title: '网购退款诈骗升级，这些话术要警惕',
        timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000,
        views: 10500,
        category: '冒充电商客服'
      }
    ],
    articles: []
  },

  onLoad() {
    const hasCachedBanners = this.restoreCachedBanners()
    const hasCachedArticles = this.restoreCachedArticles()

    if (!hasCachedBanners || shouldRefresh(INDEX_BANNER_CACHE_KEY, INDEX_BANNER_CACHE_TTL_MS)) {
      this.loadBanners()
    }

    if (!hasCachedArticles || shouldRefresh(INDEX_ARTICLE_CACHE_KEY, INDEX_ARTICLE_CACHE_TTL_MS)) {
      this.loadArticlesFromCloud(true, { silent: hasCachedArticles })
    }
  },

  onShow() {
    if (this.data.articles.length > 0) {
      this.updateArticlesList(this.data.articles)
    }
  },

  restoreCachedBanners() {
    const cached = readCacheData(INDEX_BANNER_CACHE_KEY)
    const banners = cached?.data
    if (!Array.isArray(banners) || banners.length === 0) return false

    this.setData({ banners })
    return true
  },

  restoreCachedArticles() {
    if (this.data.selectedCategory !== '全部') return false

    const cached = readCacheData(INDEX_ARTICLE_CACHE_KEY)
    const payload = cached?.data
    if (!payload || !Array.isArray(payload.articles) || payload.articles.length === 0) {
      return false
    }

    this.setData({
      articles: payload.articles,
      totalCount: payload.totalCount || payload.articles.length,
      hasMore: payload.hasMore !== false,
      currentPage: payload.currentPage || 2
    })
    this.updateArticlesList(payload.articles)
    return true
  },

  async loadArticlesFromCloud(isRefresh = false, options = {}) {
    if (this.data.isLoading) return false

    const requestPage = isRefresh ? 1 : this.data.currentPage
    if (!isRefresh && !this.data.hasMore) return false

    if (isRefresh) {
      this.setData({
        currentPage: 1,
        articles: options.silent ? this.data.articles : [],
        hasMore: true
      })
    }

    this.setData({ isLoading: true })

    if (isRefresh && !options.silent) {
      wx.showLoading({ title: '加载中...' })
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'getArticles',
        data: {
          category: this.data.selectedCategory,
          page: requestPage,
          pageSize: this.data.pageSize
        }
      })

      if (!(res.result && res.result.success)) {
        throw new Error(res.result?.errMsg || '加载失败')
      }

      const { list = [], total = 0, hasMore = false } = res.result.data || {}
      const normalized = list.map(normalizeArticle)
      const newArticles = isRefresh ? normalized : this.data.articles.concat(normalized)
      const nextPage = requestPage + 1

      this.setData({
        articles: newArticles,
        totalCount: total,
        hasMore,
        currentPage: nextPage,
        isLoading: false
      })

      if (isRefresh && this.data.selectedCategory === '全部') {
        writeCacheData(INDEX_ARTICLE_CACHE_KEY, {
          articles: newArticles,
          totalCount: total,
          hasMore,
          currentPage: nextPage
        })
      }

      if (isRefresh && !options.silent) {
        wx.hideLoading()
      }

      return true
    } catch (err) {
      this.setData({ isLoading: false })

      if (isRefresh && !options.silent) {
        wx.hideLoading()
      }

      if (!options.silent || this.data.articles.length === 0) {
        wx.showToast({
          title: '加载失败，请稍后重试',
          icon: 'none',
          duration: 2000
        })
      }

      if (isRefresh && this.data.articles.length === 0) {
        this.loadLocalArticles()
      }

      return false
    }
  },

  loadMoreArticles() {
    if (this.data.isLoading || !this.data.hasMore) return
    this.loadArticlesFromCloud(false)
  },

  loadLocalArticles() {
    this.loadArticlesFromStorage()

    const filteredArticles = this.data.selectedCategory === '全部'
      ? this.data.allArticles
      : this.data.allArticles.filter(article => article.category === this.data.selectedCategory)

    const { currentPage, pageSize } = this.data
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    const pageArticles = filteredArticles.slice(start, end).map(normalizeArticle)
    const newArticles = currentPage === 1 ? pageArticles : this.data.articles.concat(pageArticles)

    this.setData({
      articles: newArticles,
      totalCount: filteredArticles.length,
      hasMore: end < filteredArticles.length,
      currentPage: currentPage + 1,
      isLoading: false
    })

    wx.hideLoading()
  },

  loadArticlesFromStorage() {
    try {
      const savedArticles = wx.getStorageSync('articles_data')
      if (!savedArticles || !Array.isArray(savedArticles)) return

      this.data.allArticles = this.data.allArticles.map(article => {
        const saved = savedArticles.find(item => item.id === article.id)
        if (saved && saved.views) {
          return { ...article, views: saved.views }
        }
        return article
      })
    } catch (err) {
      // ignore local cache errors
    }
  },

  updateArticlesList(articles) {
    this.setData({
      articles: (articles || []).map(normalizeArticle)
    })
  },

  onPullDownRefresh() {
    this.loadArticlesFromCloud(true).then((success) => {
      wx.stopPullDownRefresh()
      wx.showToast({
        title: success ? '刷新完成' : '刷新失败',
        icon: success ? 'success' : 'none'
      })
    })
  },

  selectCategory(e) {
    const category = (e.currentTarget.dataset.category || '全部').trim()
    if (category === this.data.selectedCategory) return

    this.setData({
      selectedCategory: category,
      currentPage: 1,
      articles: [],
      hasMore: true,
      totalCount: 0
    })

    this.loadArticlesFromCloud(true)
  },

  viewArticle(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/article-detail/article-detail?id=${id}`
    })
  },

  goTopicCommunity() {
    wx.switchTab({ url: '/pages/community/community' })
  },

  goVideoList() {
    wx.navigateTo({ url: '/pages/video/video' })
  },

  goQuizHome() {
    wx.switchTab({ url: '/pages/quiz-home/quiz-home' })
  },

  async loadBanners() {
    try {
      const banners = (this.data.defaultBanners || HOME_BANNERS).map(item => ({ ...item }))
      const fileMap = await resolveCloudFileUrls(banners.map(banner => banner.image))

      banners.forEach(banner => {
        if (banner.image && fileMap[banner.image]) {
          banner.image = fileMap[banner.image]
        }
      })

      this.setData({ banners })
      writeCacheData(INDEX_BANNER_CACHE_KEY, banners)
    } catch (err) {
      if (!this.data.banners.length) {
        this.setData({ banners: HOME_BANNERS })
      }
    }
  },

  onBannerTap(e) {
    const link = e.currentTarget.dataset.link
    if (!link) return

    wx.navigateTo({
      url: link,
      fail: () => {
        wx.showToast({
          title: '页面不存在',
          icon: 'none'
        })
      }
    })
  }
})
