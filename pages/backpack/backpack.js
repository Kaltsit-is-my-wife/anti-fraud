/**
 * 用户背包页面 - 背包系统模块
 * 
 * 上游依赖：云函数(getUserBackpack)，本地缓存
 * 入口：页面onLoad/onShow生命周期
 * 主要功能：展示用户背包中的虚拟商品、道具卡、实体商品
 * 输出：渲染背包界面
 * 
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */

Page({
  data: {
    backpack: [],
    activeCards: [],
    stats: {
      total: 0,
      unused: 0,
      active: 0
    },
    currentCategory: 'all',
    categories: ['all', 'virtual', 'tool', 'physical']
  },

  onLoad() {
    this.loadUserBackpack()
  },

  onShow() {
    this.loadUserBackpack()
  },

  async loadUserBackpack() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'getUserBackpack',
        data: {
          category: this.data.currentCategory
        }
      })

      if (result.result.success) {
        const { backpack, activeCards, stats } = result.result.data
        this.setData({
          backpack,
          activeCards,
          stats
        })
      } else {
        wx.showToast({
          title: result.result.errMsg || '加载失败',
          icon: 'none'
        })
      }
    } catch (err) {
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  switchCategory(e) {
    const category = e.currentTarget.dataset.category
    this.setData({
      currentCategory: category
    })
    this.loadUserBackpack()
  },

  getIconByCategory(category) {
    const iconMap = {
      'virtual': '🎁',
      'tool': '🔧',
      'physical': '📦',
      'all': '🎒'
    }
    return iconMap[category] || '📦'
  },

  getItemIcon(category) {
    const iconMap = {
      'virtual': '🎁',
      'tool': '🔧',
      'physical': '📦'
    }
    return iconMap[category] || '📦'
  },

  getStatusText(status) {
    const statusMap = {
      'unused': '未使用',
      'active': '生效中',
      'used': '已使用',
      'expired': '已过期',
      'pending_shipment': '待发货'
    }
    return statusMap[status] || status
  },

  getStatusClass(status) {
    const classMap = {
      'unused': 'status-unused',
      'active': 'status-active',
      'used': 'status-used',
      'expired': 'status-expired',
      'pending_shipment': 'status-pending'
    }
    return classMap[status] || ''
  },

  formatDate(dateStr) {
    if (!dateStr) return '永久有效'
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}月${date.getDate()}日`
  },

  async useItem(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.backpack.find(item => item._id === id)
    
    if (!item) return
    
    // 检查物品状态
    if (item.status === 'used' || item.status === 'expired') {
      wx.showToast({
        title: item.status === 'expired' ? '物品已过期' : '物品已使用',
        icon: 'none'
      })
      return
    }
    
    // 对于道具卡，可以添加使用逻辑
    if (item.itemCategory === 'tool') {
      wx.showModal({
        title: '确认使用',
        content: `确定使用"${item.itemName}"吗？`,
        success: (res) => {
          if (res.confirm) {
            this.doUseItem(item)
          }
        }
      })
    } else if (item.itemCategory === 'virtual') {
      wx.showToast({
        title: '虚拟商品已生效',
        icon: 'none'
      })
    } else {
      wx.showModal({
        title: '物品说明',
        content: `这是"${item.itemName}"，请按说明使用`,
        showCancel: false
      })
    }
  },

  async doUseItem(item) {
    wx.showLoading({
      title: '使用中...'
    })
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'useBackpackItem',
        data: {
          itemId: item._id
        }
      })
      
      wx.hideLoading()
      
      if (result.result.success) {
        await this.loadUserBackpack()
        wx.showToast({
          title: '使用成功',
          icon: 'success'
        })
      } else {
        wx.showToast({
          title: result.result.errMsg || '使用失败',
          icon: 'none'
        })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({
        title: '使用失败',
        icon: 'none'
      })
    }
  },

  goBack() {
    wx.navigateBack()
  }
})