// pages/index/index.js

// 工具函数：格式化时间为相对时间
function formatRelativeTime(timestamp) {
  const now = Date.now()
  const diff = now - timestamp
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) {
    return '刚刚'
  } else if (diff < hour) {
    return `${Math.floor(diff / minute)}分钟前`
  } else if (diff < day) {
    return `${Math.floor(diff / hour)}小时前`
  } else if (diff < 2 * day) {
    return '昨天'
  } else if (diff < 7 * day) {
    return `${Math.floor(diff / day)}天前`
  } else {
    const date = new Date(timestamp)
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }
}

// 工具函数：格式化浏览量
function formatViews(views) {
  if (views >= 10000) {
    return `${(views / 10000).toFixed(1)}w`
  } else if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}k`
  } else {
    return views.toString()
  }
}

Page({
  data: {
    // 轮播图数据（从云端加载）
    banners: [],

    // 默认轮播图（加载失败时使用）
    defaultBanners: [
      {
        id: 1,
        icon: '🛡️',
        title: '防范电信诈骗',
        desc: '守护你的钱包安全',
        bgColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      },
      {
        id: 2,
        icon: '📱',
        title: '识别网络骗局',
        desc: '提高防范意识',
        bgColor: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
      },
      {
        id: 3,
        icon: '💡',
        title: '学习防骗知识',
        desc: '远离诈骗陷阱',
        bgColor: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
      }
    ],

    // 分类数据（使用官方分类，保留简写以保证简洁性）
    categories: [
      '全部', '刷单返利', '虚假投资理财', '虚假购物服务', '冒充电商客服',
      '虚假贷款', '虚假征信', '冒充领导熟人', '冒充公检法', '网络婚恋交友', '网游虚假交易'
    ],
    selectedCategory: '全部',

    // 分页相关
    currentPage: 1,
    pageSize: 10,
    totalCount: 0,
    hasMore: true,
    isLoading: false,

    // 所有文章数据（原始数据）
    allArticles: [
      {
        id: 1,
        tag: '紧急预警',
        tagType: 'danger',
        title: '警惕！"刷单兼职"骗局又出新花样，多名学生被骗',
        timestamp: Date.now() - 2 * 60 * 60 * 1000, // 2小时前
        views: 12300,
        category: '刷单返利'
      },
      {
        id: 2,
        tag: '案例分析',
        tagType: 'warning',
        title: '大学生网购遇"退款诈骗"，一步步掉入陷阱',
        timestamp: Date.now() - 5 * 60 * 60 * 1000, // 5小时前
        views: 8700,
        category: '冒充电商客服'
      },
      {
        id: 3,
        tag: '防骗知识',
        tagType: 'warning',
        title: '校园贷、培训贷...大学生必知的5种贷款陷阱',
        timestamp: Date.now() - 30 * 60 * 60 * 1000, // 约昨天
        views: 15200,
        category: '虚假贷款'
      },
      {
        id: 4,
        tag: '知识科普',
        tagType: 'info',
        title: '大学生求职防骗指南：识破"高薪兼职"套路',
        timestamp: Date.now() - 10 * 60 * 60 * 1000, // 10小时前
        views: 6500,
        category: '刷单返利'
      },
      {
        id: 5,
        tag: '视频教程',
        tagType: 'info',
        title: '3分钟了解"杀猪盘"：大学生恋爱交友防骗攻略',
        timestamp: Date.now() - 12 * 60 * 60 * 1000, // 12小时前
        views: 9800,
        category: '网络婚恋交友'
      },
      {
        id: 6,
        tag: '紧急预警',
        tagType: 'danger',
        title: '新型电信诈骗：冒充公检法人员要求转账',
        timestamp: Date.now() - 24 * 60 * 60 * 1000, // 1天前
        views: 18500,
        category: '冒充公检法'
      },
      {
        id: 7,
        tag: '案例分析',
        tagType: 'warning',
        title: '投资理财骗局揭秘：高收益背后的陷阱',
        timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2天前
        views: 11200,
        category: '虚假投资理财'
      },
      {
        id: 8,
        tag: '知识科普',
        tagType: 'info',
        title: '如何识别钓鱼邮件？这些特征要注意',
        timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3天前
        views: 7800,
        category: '冒充公检法'
      },
      {
        id: 9,
        tag: '防骗知识',
        tagType: 'warning',
        title: '校园贷的"套路"有多深？真实案例告诉你',
        timestamp: Date.now() - 4 * 24 * 60 * 60 * 1000, // 4天前
        views: 13600,
        category: '虚假贷款'
      },
      {
        id: 10,
        tag: '紧急预警',
        tagType: 'danger',
        title: '网购退款诈骗升级！这些话术要警惕',
        timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000, // 5天前
        views: 10500,
        category: '冒充电商客服'
      }
    ],

    // 显示的文章列表（会根据分类筛选）
    articles: []
  },

  onLoad(options) {
    console.log('========== 页面加载 ==========')
    console.log('本地文章数据示例：', this.data.allArticles[0])

    // 加载轮播图
    this.loadBanners()
    // 优先从云数据库加载文章（首页）
    this.loadArticlesFromCloud(true)
  },

  onShow() {
    // 每次显示页面时更新时间显示（相对时间会变化）
    if (this.data.articles.length > 0) {
      const currentCategory = this.data.selectedCategory
      this.selectCategory({
        currentTarget: {
          dataset: { category: currentCategory }
        }
      })
    }
  },

  // 从云数据库加载文章（支持分页）
  async loadArticlesFromCloud(isRefresh = false) {
    console.log('========== 开始加载文章 ==========')
    console.log('参数：', { isRefresh, currentPage: this.data.currentPage, pageSize: this.data.pageSize, hasMore: this.data.hasMore })

    // 防止重复请求
    if (this.data.isLoading) {
      console.log('❌ 已有请求正在进行，跳过')
      return
    }

    // 如果是刷新，重置分页
    if (isRefresh) {
      console.log('刷新模式：重置分页')
      this.setData({
        currentPage: 1,
        articles: [],
        hasMore: true
      })
    }

    // 如果没有更多数据，不再请求
    if (!this.data.hasMore && !isRefresh) {
      console.log('❌ 没有更多数据')
      return
    }

    this.setData({ isLoading: true })

    if (isRefresh) {
      wx.showLoading({ title: '加载中...' })
    }

    try {
      console.log('调用云函数，参数：', {
        name: 'getArticles',
        category: this.data.selectedCategory,
        page: this.data.currentPage,
        pageSize: this.data.pageSize
      })

      // 调用云函数获取文章列表
      const res = await wx.cloud.callFunction({
        name: 'getArticles',
        data: {
          category: this.data.selectedCategory,
          page: this.data.currentPage,
          pageSize: this.data.pageSize
        }
      })

      console.log('云函数返回：', res.result)

      if (res.result && res.result.success) {
        const { list, total, hasMore } = res.result.data

        console.log('========== 查询结果 ==========')
        console.log('当前分类：', this.data.selectedCategory)
        console.log('返回文章数：', list.length)
        console.log('总文章数：', total)
        console.log('是否还有更多：', hasMore)

        if (list.length > 0) {
          console.log('文章列表示例：')
          list.slice(0, 3).forEach((article, index) => {
            console.log(`  ${index + 1}. ${article.title}`)
            console.log(`     category: ${article.category || '(无)'}`)
            console.log(`     tag: ${article.tag || '(无)'}`)
          })
        } else {
          console.warn('⚠️ 该分类下没有文章！')
          console.warn('可能原因：')
          console.warn('1. 数据库文章缺少 category 字段')
          console.warn('2. category 字段值与分类名称不匹配')
          console.warn('3. 该分类确实没有文章')
        }
        console.log('=================================')

        // 格式化文章数据
        const formattedArticles = list.map(article => ({
          id: article._id,
          title: article.title,
          tag: article.tag || '知识科普',
          tagType: article.tagType || 'info',
          category: article.category || '全部',
          content: article.content || '',
          coverImage: article.coverImage || '',
          timestamp: article.timestamp || Date.now(),
          views: article.views || 0,
          author: article.author || '反诈小助手',
          time: formatRelativeTime(article.timestamp || Date.now()),
          viewsText: formatViews(article.views || 0)
        }))

        // 合并数据
        const newArticles = isRefresh ? formattedArticles : this.data.articles.concat(formattedArticles)

        this.setData({
          articles: newArticles,
          totalCount: total,
          hasMore: hasMore,
          currentPage: this.data.currentPage + 1,
          isLoading: false
        })

        if (isRefresh) {
          wx.hideLoading()
        }

        console.log(`加载成功：当前${newArticles.length}篇，共${total}篇`)
      } else {
        throw new Error(res.result?.errMsg || '加载失败')
      }
    } catch (err) {
      console.error('========== 加载失败 ==========')
      console.error('错误类型：', err.constructor.name)
      console.error('错误消息：', err.message)
      console.error('错误详情：', err)
      console.error('错误码：', err.errCode)
      console.error('微信错误信息：', err.errMsg)

      // 详细错误诊断
      if (err.errMsg) {
        if (err.errMsg.includes('cloud function')) {
          console.error('❌ 云函数错误 - 可能原因：')
          console.error('  1. 云函数 getArticles 未部署')
          console.error('  2. 云函数名称拼写错误')
          console.error('  3. 云开发环境 ID 配置错误')
        } else if (err.errMsg.includes('permission') || err.errMsg.includes('auth')) {
          console.error('❌ 权限错误 - 可能原因：')
          console.error('  1. articles 集合权限未设置为可读')
          console.error('  2. 用户未登录')
          console.error('  3. 云开发环境未初始化')
        } else if (err.errMsg.includes('timeout')) {
          console.error('❌ 超时错误 - 可能原因：')
          console.error('  1. 网络连接问题')
          console.error('  2. 云函数执行时间过长')
        } else if (err.errMsg.includes('not found') || err.errMsg.includes('404')) {
          console.error('❌ 资源不存在 - 可能原因：')
          console.error('  1. articles 集合不存在')
          console.error('  2. 云函数不存在')
        }
      }
      console.error('========================================')

      this.setData({ isLoading: false })

      if (isRefresh) {
        wx.hideLoading()
      }

      // 显示详细错误信息
      const errorMsg = err.errMsg || err.message || '未知错误'
      wx.showToast({
        title: `加载失败: ${errorMsg.substring(0, 20)}`,
        icon: 'none',
        duration: 3000
      })

      // 如果是首次加载失败，使用本地数据
      if (isRefresh && this.data.articles.length === 0) {
        console.log('⚠️ 首次加载失败，降级使用本地数据')
        this.loadLocalArticles()
      }
    }
  },

  // 加载更多文章
  loadMoreArticles() {
    // 如果正在加载或没有更多数据，直接返回
    if (this.data.isLoading || !this.data.hasMore) {
      return
    }

    // 加载下一页
    this.loadArticlesFromCloud(false)
  }
  ,

  // 加载本地备份文章
  loadLocalArticles() {
    console.log('使用本地备份数据')

    // 从本地存储加载文章数据（包含浏览量更新）
    this.loadArticlesFromStorage()

    // 获取当前分类的文章
    const filteredArticles = this.data.selectedCategory === '全部'
      ? this.data.allArticles
      : this.data.allArticles.filter(article => article.category === this.data.selectedCategory)

    // 分页处理
    const { currentPage, pageSize } = this.data
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    const pageArticles = filteredArticles.slice(start, end)

    // 格式化文章数据
    const formattedArticles = pageArticles.map(article => ({
      ...article,
      time: formatRelativeTime(article.timestamp),
      viewsText: formatViews(article.views)
    }))

    // 合并到现有列表
    const newArticles = currentPage === 1 ? formattedArticles : this.data.articles.concat(formattedArticles)

    this.setData({
      articles: newArticles,
      totalCount: filteredArticles.length,
      hasMore: end < filteredArticles.length,
      currentPage: currentPage + 1,
      isLoading: false
    })

    console.log(`本地数据加载成功：当前${newArticles.length}篇，共${filteredArticles.length}篇`)
    wx.hideLoading()
  },

  // 从本地存储加载文章数据
  loadArticlesFromStorage() {
    try {
      const savedArticles = wx.getStorageSync('articles_data')
      if (savedArticles && Array.isArray(savedArticles)) {
        // 合并保存的浏览量数据
        this.data.allArticles = this.data.allArticles.map(article => {
          const saved = savedArticles.find(a => a.id === article.id)
          if (saved && saved.views) {
            return { ...article, views: saved.views }
          }
          return article
        })
      }
    } catch (err) {
      console.error('加载文章数据失败：', err)
    }
  },

  // 更新文章列表（格式化时间和浏览量）
  updateArticlesList(articles) {
    const formattedArticles = articles.map(article => ({
      ...article,
      time: formatRelativeTime(article.timestamp),
      viewsText: formatViews(article.views)
    }))

    this.setData({
      articles: formattedArticles
    })
  },

  onPullDownRefresh() {
    // 下拉刷新，重新从云数据库加载
    this.loadArticlesFromCloud(true).then(() => {
      wx.stopPullDownRefresh()
      wx.showToast({
        title: '刷新成功',
        icon: 'success'
      })
    }).catch(() => {
      wx.stopPullDownRefresh()
      wx.showToast({
        title: '刷新失败',
        icon: 'none'
      })
    })
  },

  // 选择分类
  selectCategory(e) {
    const category = e.currentTarget.dataset.category

    console.log('========== 切换分类 ==========')
    console.log('选中分类：', category)
    console.log('当前分类：', this.data.selectedCategory)
    console.log('category 类型：', typeof category)
    console.log('category 长度：', category ? category.length : 0)
    
    // 去除前后空格，确保分类名称干净
    const trimmedCategory = category ? category.trim() : '全部'

    // 如果分类没有变化，不重复加载
    if (trimmedCategory === this.data.selectedCategory) {
      console.log('分类未变化，跳过加载')
      return
    }

    this.setData({
      selectedCategory: trimmedCategory,
      currentPage: 1,
      articles: [],
      hasMore: true,
      totalCount: 0
    })

    // 重新加载文章
    this.loadArticlesFromCloud(true)
  },

  // 搜索
  handleSearch(e) {
    const keyword = e.detail.value.trim()
    if (!keyword) {
      // 如果搜索为空，恢复当前分类的文章
      this.selectCategory({
        currentTarget: {
          dataset: { category: this.data.selectedCategory }
        }
      })
      return
    }

    // v3：跳转全局搜索页（支持搜索用户与资讯）
    wx.navigateTo({
      url: `/pages/search/search?keyword=${encodeURIComponent(keyword)}`
    })
  },

  // 查看文章详情
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

  // 加载轮播图
  async loadBanners() {
    try {
      const db = wx.cloud.database()
      const res = await db.collection('banners')
        .where({
          status: true  // 只显示启用的轮播图
        })
        .orderBy('sort', 'asc')  // 按排序升序
        .get()

      console.log('从云数据库加载轮播图：', res.data.length)

      if (res.data.length > 0) {
        // 转换云存储路径为临时 HTTPS 链接
        const banners = res.data
        const imageFileIds = banners
          .filter(banner => banner.image && banner.image.startsWith('cloud://'))
          .map(banner => banner.image)

        if (imageFileIds.length > 0) {
          try {
            // 批量获取临时链接
            const tempUrlRes = await wx.cloud.getTempFileURL({
              fileList: imageFileIds
            })

            console.log('获取临时链接成功：', tempUrlRes.fileList.length)

            // 替换为临时链接
            const fileMap = {}
            tempUrlRes.fileList.forEach(item => {
              if (item.status === 0) {
                fileMap[item.fileID] = item.tempFileURL
              }
            })

            banners.forEach(banner => {
              if (banner.image && fileMap[banner.image]) {
                banner.image = fileMap[banner.image]
              }
            })
          } catch (urlErr) {
            console.error('获取临时链接失败：', urlErr)
            // 失败时仍使用原始 cloud:// 路径
          }
        }

        this.setData({
          banners: banners
        })
      } else {
        // 云端没有数据，使用默认轮播图
        console.log('云端暂无轮播图，使用默认')
        this.setData({
          banners: this.data.defaultBanners
        })
      }
    } catch (err) {
      console.error('加载轮播图失败：', err)
      // 加载失败，使用默认轮播图
      this.setData({
        banners: this.data.defaultBanners
      })
    }
  },

  // 点击轮播图
  onBannerTap(e) {
    const link = e.currentTarget.dataset.link
    if (link) {
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
  }
})
