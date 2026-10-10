// pages/chat/chat.js
Page({
  data: {
    messages: [],
    inputValue: '',
    inputFilled: false,
    isTextMode: false,
    inputFocus: false,
    voiceHintShown: false,
    loading: false,
    scrollToView: '',
    introTitle: '遇到可疑短信、链接或转账要求，先别急着处理。',
    introDescription: '把聊天内容、来电话术或截图发给我，我会帮你拆风险点、判断套路，并告诉你下一步该怎么做。',
    privacyText: '隐私保护已开启：对话记录只保存在本机，不会作为历史记录上传存储。',
    quickPrompts: [
      {
        icon: '短信',
        title: '判断这条短信',
        example: '收到“快递异常需点链接处理”，这是真的吗？',
        prompt: '帮我判断这条短信是否存在诈骗风险：'
      },
      {
        icon: '转账',
        title: '分析转账要求',
        example: '对方让我先垫付后返款，这种说法靠谱吗？',
        prompt: '请帮我分析这个转账要求有没有诈骗风险：'
      },
      {
        icon: '截图',
        title: '我想发张截图',
        example: '上传聊天记录、付款页面或陌生链接页面进行识别。',
        prompt: '我准备上传一张截图，请先告诉我该重点看哪些风险点。'
      }
    ]
  },

  onLoad(options) {
    // 🔒 从本地存储加载历史记录
    this.loadLocalMessages()
  },

  onShow() {
    // 每次显示页面时刷新滚动位置
    if (this.data.messages.length > 0) {
      this.setData({
        scrollToView: `msg-${this.data.messages.length - 1}`
      })
    }
  },

  // 从本地存储加载消息
  loadLocalMessages() {
    try {
      const localMessages = wx.getStorageSync('chat_messages')
      if (localMessages && localMessages.length > 0) {
        this.setData({
          messages: localMessages,
          scrollToView: `msg-${localMessages.length - 1}`
        })
      }
    } catch (err) {
      // 静默失败
    }
  },

  // 保存消息到本地存储
  saveLocalMessages(messages) {
    try {
      // 最多保存最近100条消息（避免占用太多空间）
      const messagesToSave = messages.slice(-100)
      wx.setStorageSync('chat_messages', messagesToSave)
    } catch (err) {
      // 静默失败
    }
  },

  // Sync user info from cloud
  async syncUserInfoFromCloud() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'getUserInfo',
        data: {}
      })

      if (result.result && result.result.success) {
        const data = result.result.data || {}
        const userInfo = data.userInfo || {}

        if (userInfo && Object.keys(userInfo).length > 0) {
          wx.setStorageSync('userInfo', userInfo)
        }

        if (typeof userInfo.points === 'number') {
          wx.setStorageSync('points', userInfo.points)
        }
        if (typeof userInfo.totalChatCount === 'number') {
          wx.setStorageSync('chatTimes', userInfo.totalChatCount)
        }
        if (typeof userInfo.totalReadCount === 'number') {
          wx.setStorageSync('readArticles', userInfo.totalReadCount)
        }
        if (typeof userInfo.signDays === 'number') {
          wx.setStorageSync('signDays', userInfo.signDays)
        }

        const achievementList = Array.isArray(data.achievementList)
          ? data.achievementList
          : null
        if (achievementList) {
          wx.setStorageSync('achievements', achievementList.filter(item => item.unlocked).length)
        } else if (Array.isArray(userInfo.achievements)) {
          wx.setStorageSync('achievements', userInfo.achievements.length)
        }
      }
    } catch (err) {
      // 静默失败
    }
  },

  // Clear local messages
  clearLocalMessages() {
    wx.showModal({
      title: '清除历史记录',
      content: '确定要清除所有对话记录吗？此操作不可恢复。',
      confirmText: '清除',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          try {
            wx.removeStorageSync('chat_messages')
            this.setData({
              messages: [],
              inputValue: '',
              inputFilled: false,
              inputFocus: false,
              isTextMode: false
            })
            wx.showToast({
              title: '已清除历史记录',
              icon: 'success'
            })
          } catch (err) {
            wx.showToast({
              title: '清除失败',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  onInput(e) {
    const value = e.detail.value || ''
    this.setData({
      inputValue: value,
      inputFilled: value.trim().length > 0,
      isTextMode: true
    })
  },

  onInputFocus() {
    this.setData({
      isTextMode: true,
      inputFocus: true
    })
  },

  onInputBlur() {
    const hasValue = (this.data.inputValue || '').trim().length > 0
    this.setData({
      inputFocus: false,
      isTextMode: hasValue
    })
  },

  handleVoiceButtonTap() {
    if (this.data.loading) {
      return
    }

    const showHint = !this.data.voiceHintShown
    this.setData({
      isTextMode: true,
      inputFocus: true,
      voiceHintShown: true
    })

    if (showHint) {
      wx.showToast({
        title: '语音功能待接入，先用文字输入',
        icon: 'none'
      })
    }
  },

  showQuickPromptSheet() {
    if (this.data.loading) {
      return
    }

    const itemList = this.data.quickPrompts.map(item => item.title)
    wx.showActionSheet({
      itemList,
      success: (res) => {
        const promptItem = this.data.quickPrompts[res.tapIndex]
        if (!promptItem) {
          return
        }

        this.setData({
          inputValue: promptItem.prompt,
          inputFilled: promptItem.prompt.trim().length > 0,
          isTextMode: true,
          inputFocus: true
        })
      }
    })
  },

  handleComposerAction() {
    if (this.data.loading) {
      return
    }

    if (this.data.isTextMode && this.data.inputFilled) {
      this.sendMessage()
      return
    }

    const itemList = [
      this.data.isTextMode ? '收起输入框' : '输入文字',
      '上传图片'
    ]

    if (this.data.messages.length > 0) {
      itemList.push('清空本地对话')
    }

    wx.showActionSheet({
      itemList,
      success: (res) => {
        const action = itemList[res.tapIndex]
        if (action === '上传图片') {
          this.uploadImage()
          return
        }

        if (action === '清空本地对话') {
          this.clearLocalMessages()
          return
        }

        this.setData({
          isTextMode: !this.data.isTextMode,
          inputFocus: !this.data.isTextMode
        })
      }
    })
  },

  applyQuickPrompt(e) {
    const prompt = e.currentTarget.dataset.prompt || ''
    this.setData({
      inputValue: prompt,
      inputFilled: prompt.trim().length > 0,
      isTextMode: true,
      inputFocus: true
    })
  },

  async sendMessage() {
    const message = this.data.inputValue.trim()
    if (!message) {
      wx.showToast({
        title: '请输入消息',
        icon: 'none'
      })
      return
    }

    // 添加用户消息
    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: message
    }

    this.setData({
      messages: [...this.data.messages, userMsg],
      inputValue: '',
      inputFilled: false,
      inputFocus: false,
      isTextMode: true,
      loading: true,
      scrollToView: `msg-${this.data.messages.length}`
    })

    try {
      // 🔒 隐私保护：构建历史记录（仅保存在内存中）
      // 获取最近10轮对话（20条消息），保持上下文连贯性
      const currentMessages = this.data.messages
      const recentMessages = currentMessages.slice(-20)
      const history = recentMessages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }))

      // 调用云函数获取AI回复（传入历史记录）
      const result = await wx.cloud.callFunction({
        name: 'aiChat',
        data: {
          message,
          history,  // 传递最近10轮对话历史，让AI记住上下文
          stream: true  // 启用流式处理
        }
      })

      if (result.result.success) {
        const reply = result.result.data.reply
        const actionData = result.result.data.actionData

        if (actionData) {
          if (typeof actionData.updatedCount === 'number') {
            wx.setStorageSync('chatTimes', actionData.updatedCount)
          } else {
            const currentChatTimes = wx.getStorageSync('chatTimes') || 0
            wx.setStorageSync('chatTimes', currentChatTimes + 1)
          }

          if (typeof actionData.userPoints === 'number') {
            wx.setStorageSync('points', actionData.userPoints)
          } else if (actionData.totalPoints) {
            const points = wx.getStorageSync('points') || 0
            wx.setStorageSync('points', points + actionData.totalPoints)
          }

          if (Array.isArray(actionData.newAchievements) && actionData.newAchievements.length > 0) {
            const achievementIds = actionData.newAchievements
              .map(item => item.achievementId)
              .filter(Boolean)
            const userInfo = wx.getStorageSync('userInfo') || {}

            if (Array.isArray(userInfo.achievements) && achievementIds.length > 0) {
              const merged = Array.from(new Set([...userInfo.achievements, ...achievementIds]))
              userInfo.achievements = merged
              wx.setStorageSync('userInfo', userInfo)
              wx.setStorageSync('achievements', merged.length)
            } else {
              const achievements = wx.getStorageSync('achievements') || 0
              wx.setStorageSync('achievements', achievements + actionData.newAchievements.length)
            }
          }
        } else {
          // 备用：手动更新本地计数
          const currentChatTimes = wx.getStorageSync('chatTimes') || 0
          const points = wx.getStorageSync('points') || 0
          wx.setStorageSync('chatTimes', currentChatTimes + 1)
          wx.setStorageSync('points', points + 2) // 基础积分
        }

        const botMsg = {
          id: Date.now() + 1,
          role: 'bot',
          content: reply
        }

        const newMessages = [...this.data.messages, botMsg]
        this.setData({
          messages: newMessages,
          loading: false,
          scrollToView: `msg-${newMessages.length - 1}`
        })

        // 🔒 保存到本地存储
        this.saveLocalMessages(newMessages)
        this.syncUserInfoFromCloud()
      } else {
        // AI 调用失败
        throw new Error(result.result.errMsg || 'AI 服务返回失败')
      }
    } catch (err) {
      const botMsg = {
        id: Date.now() + 1,
        role: 'bot',
        content: '抱歉，服务暂时不可用，请稍后再试。\n\n如需紧急帮助，请拨打反诈专线：96110'
      }

      const newMessages = [...this.data.messages, botMsg]
      this.setData({
        messages: newMessages,
        loading: false,
        scrollToView: `msg-${newMessages.length - 1}`
      })

      // 🔒 保存到本地存储
      this.saveLocalMessages(newMessages)
    }
  },

  uploadImage() {
    if (this.data.loading) {
      return
    }

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFile = res.tempFiles[0]
        let tempFilePath = tempFile.tempFilePath
        const fileSize = tempFile.size

        // 检查文件大小（限制5MB）
        if (fileSize > 5 * 1024 * 1024) {
          wx.showToast({
            title: '图片太大，请选择小于5MB的图片',
            icon: 'none'
          })
          return
        }

        // 如果是网络地址，需要先下载到本地
        if (tempFilePath.startsWith('http://') || tempFilePath.startsWith('https://')) {
          wx.showLoading({
            title: '正在下载图片...',
            mask: true
          })

          try {
            const downloadRes = await new Promise((resolve, reject) => {
              wx.downloadFile({
                url: tempFilePath,
                success: resolve,
                fail: reject
              })
            })

            tempFilePath = downloadRes.tempFilePath
            wx.hideLoading()
          } catch (err) {
            wx.hideLoading()
            wx.showToast({
              title: '图片下载失败',
              icon: 'none'
            })
            return
          }
        }

        // 显示加载提示
        wx.showLoading({
          title: '正在识别图片...',
          mask: true
        })

        // 将图片转为 base64
        const fs = wx.getFileSystemManager()
        fs.readFile({
          filePath: tempFilePath,
          encoding: 'base64',
          success: async (fileRes) => {
            const base64Image = fileRes.data

            // 添加用户消息（显示图片）
            const userMsg = {
              id: Date.now(),
              role: 'user',
              content: '[图片]',
              imageUrl: tempFilePath
            }

            this.setData({
              messages: [...this.data.messages, userMsg],
              loading: true,
              scrollToView: `msg-${this.data.messages.length}`
            })

            try {
              // 构建历史记录（最近10轮对话，20条消息）
              const currentMessages = this.data.messages
              const recentMessages = currentMessages.slice(-20)
              const history = recentMessages.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
              }))

              // 调用云函数，传入 base64 图片
              const result = await wx.cloud.callFunction({
                name: 'aiChat',
                data: {
                  message: '请帮我分析这张图片是否存在诈骗风险',
                  imageBase64: base64Image,
                  history,
                  stream: true  // 启用流式处理
                }
              })

              wx.hideLoading()

              if (result.result.success) {
                const reply = result.result.data.reply
                const actionData = result.result.data.actionData

                // 处理 actionData
                if (actionData) {
                  if (typeof actionData.updatedCount === 'number') {
                    wx.setStorageSync('chatTimes', actionData.updatedCount)
                  }
                  if (typeof actionData.userPoints === 'number') {
                    wx.setStorageSync('points', actionData.userPoints)
                  } else if (actionData.totalPoints) {
                    const points = wx.getStorageSync('points') || 0
                    wx.setStorageSync('points', points + actionData.totalPoints)
                  }
                  if (Array.isArray(actionData.newAchievements) && actionData.newAchievements.length > 0) {
                    const achievementIds = actionData.newAchievements
                      .map(item => item.achievementId)
                      .filter(Boolean)
                    const userInfo = wx.getStorageSync('userInfo') || {}

                    if (Array.isArray(userInfo.achievements) && achievementIds.length > 0) {
                      const merged = Array.from(new Set([...userInfo.achievements, ...achievementIds]))
                      userInfo.achievements = merged
                      wx.setStorageSync('userInfo', userInfo)
                      wx.setStorageSync('achievements', merged.length)
                    } else {
                      const achievements = wx.getStorageSync('achievements') || 0
                      wx.setStorageSync('achievements', achievements + actionData.newAchievements.length)
                    }
                  }
                }

                const botMsg = {
                  id: Date.now() + 1,
                  role: 'bot',
                  content: reply
                }

                const newMessages = [...this.data.messages, botMsg]
                this.setData({
                  messages: newMessages,
                  loading: false,
                  scrollToView: `msg-${newMessages.length - 1}`
                })

                this.saveLocalMessages(newMessages)
                this.syncUserInfoFromCloud()
              } else {
                throw new Error(result.result.errMsg || '识别失败')
              }
            } catch (err) {
              wx.hideLoading()

              const botMsg = {
                id: Date.now() + 1,
                role: 'bot',
                content: '抱歉，图片分析失败，请稍后再试。\n\n如需紧急帮助，请拨打反诈专线：96110'
              }

              const newMessages = [...this.data.messages, botMsg]
              this.setData({
                messages: newMessages,
                loading: false,
                scrollToView: `msg-${newMessages.length - 1}`
              })

              this.saveLocalMessages(newMessages)
            }
          },
          fail: (err) => {
            wx.hideLoading()
            wx.showModal({
              title: '读取图片失败',
              content: '无法读取图片文件，请尝试重新选择图片。',
              showCancel: false
            })
          }
        })
      },
      fail: (err) => {
        if (err.errMsg && !err.errMsg.includes('cancel')) {
          wx.showToast({
            title: '选择图片失败',
            icon: 'none'
          })
        }
      }
    })
  }
})
