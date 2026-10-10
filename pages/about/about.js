// pages/about/about.js
Page({
  data: {
    appInfo: {
      name: '反诈卫士',
      stage: '校园反诈教育项目',
      description: '面向大学生群体的反诈教育微信小程序',
      mission: '通过资讯学习、案例讨论、AI 辅助和题库训练，帮助用户提升识骗、防骗和止损能力。'
    },

    facts: [
      { label: '服务对象', value: '大学生及校园场景用户' },
      { label: '开发团队', value: '中央财经大学 Cyber先锋社' },
      { label: '核心能力', value: '资讯学习、AI 辅助、社区讨论、题库训练' }
    ],

    features: [
      { icon: '📰', title: '反诈资讯', desc: '聚焦校园高发骗局与社会热点案例，持续更新风险提醒和基础防骗知识。' },
      { icon: '🤖', title: 'AI 助手', desc: '提供反诈问答与图片分析能力，辅助识别可疑信息和高风险场景。' },
      { icon: '💬', title: '热点话题', desc: '围绕平台整理的专题开展讨论，适合案例复盘、经验交流与问题补充。' },
      { icon: '📘', title: '题库答题', desc: '按题库进行主题化学习与答题训练，帮助用户巩固识别套路和止损步骤。' }
    ],

    projectNotes: [
      {
        title: '项目定位',
        desc: '项目聚焦校园反诈宣传与学习场景，面向大学生提供案例认知、风险提示、知识传播和互动训练能力。'
      },
      {
        title: '建设思路',
        desc: '将资讯浏览、互动讨论、AI 问答与题库训练结合起来，形成从“看到风险”到“理解套路”再到“掌握应对”的学习链路。'
      },
      {
        title: '服务边界',
        desc: '平台内容主要用于宣传教育与日常学习，不替代公安、学校、银行等机构发布的正式通知和处置意见。'
      }
    ],

    teamInfo: {
      name: '中央财经大学 Cyber先锋社',
      desc: '本项目当前由中央财经大学 Cyber先锋社负责开发与维护，围绕校园反诈宣传、知识普及和学习互动持续进行内容与功能迭代。'
    },

    emergencyTips: [
      '如正在遭遇诈骗、已经发生转账或存在紧急风险，请第一时间拨打 96110 或 110。',
      '如涉及账户、支付、学籍或个人信息风险，请同时尽快联系相关平台、学校老师或银行处理。'
    ],

    contacts: [
      { label: '帮助与反馈', value: '如需反馈功能问题或内容建议，可前往“帮助与反馈”页面提交。', hint: '点击前往', action: 'navigate', url: '/pages/feedback/feedback' },
      { label: '反诈专线', value: '96110', hint: '点击拨打', action: 'call' }
    ]
  },

  handleContactTap(e) {
    const { action, value, url } = e.currentTarget.dataset

    if (action === 'navigate' && url) {
      wx.navigateTo({ url })
      return
    }

    if (action === 'call' && value) {
      wx.makePhoneCall({
        phoneNumber: value
      })
      return
    }

    if (action === 'copy' && value) {
      wx.setClipboardData({
        data: value,
        success: () => {
          wx.showToast({
            title: '已复制',
            icon: 'success'
          })
        }
      })
    }
  },

  goBack() {
    wx.navigateBack()
  }
})
