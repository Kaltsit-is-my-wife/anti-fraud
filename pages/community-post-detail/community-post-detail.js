/**
 * 帖子详情页面 - 社区模块 (v3)
 *
 * 上游依赖：云函数(getPostDetail/getComments/createComment)
 * 入口：通过帖子列表跳转携带 id
 * 主要功能：加载帖子详情、评论列表；发表评论与回复；跳转个人主页
 * 输出：渲染帖子与评论区
 *
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */

const { formatDateTimeLocal } = require('../../utils/util')

Page({
  data: {
    postId: '',
    post: null,
    comments: [],
    inputText: '',
    commentSubmitting: false,
    replyTo: null, // { parentId, replyToUid, replyToNickName }
    replyPlaceholder: '发表评论...'
  },

  onLoad(options) {
    const id = options.id
    this.setData({ postId: id })
    this.loadPost()
    this.loadComments()
  },

  async loadPost() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getPostDetail',
        data: { postId: this.data.postId }
      })
      if (res.result && res.result.success) {
        const post = res.result.data.post
        this.setData({
          post: {
            ...post,
            createdAtText: post.createdAt ? formatDateTimeLocal(new Date(post.createdAt)) : ''
          }
        })
      } else {
        wx.showToast({ title: res.result?.errMsg || '加载失败', icon: 'none' })
      }
    } catch (err) {
      console.error('loadPost failed:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  async loadComments() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getComments',
        data: { targetType: 'post', targetId: this.data.postId, pageSize: 200 }
      })
      if (res.result && res.result.success) {
        const list = res.result.data.comments || []
        const byId = new Map(list.map(c => [c._id, c]))
        const normalized = list.map(c => {
          const replyToNickName = c.replyToUid ? (byId.get(c.parentId)?.authorNickName || '') : ''
          return {
            ...c,
            createdAtText: c.createdAt ? formatDateTimeLocal(new Date(c.createdAt)) : '',
            replyToNickName
          }
        })
        this.setData({ comments: normalized })
      }
    } catch (err) {
      console.error('loadComments failed:', err)
    }
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value })
  },

  startReply(e) {
    const parentId = e.currentTarget.dataset.id
    const replyToUid = e.currentTarget.dataset.uid
    const replyToNickName = e.currentTarget.dataset.name || ''
    this.setData({
      replyTo: { parentId, replyToUid, replyToNickName },
      replyPlaceholder: replyToNickName ? `回复 ${replyToNickName}...` : '回复...'
    })
  },

  async submitComment() {
    const content = (this.data.inputText || '').trim()
    if (!content) return
    if (this.data.commentSubmitting) return

    const replyTo = this.data.replyTo
    const data = {
      targetType: 'post',
      targetId: this.data.postId,
      content
    }
    if (replyTo && replyTo.parentId) {
      data.parentId = replyTo.parentId
      data.replyToUid = replyTo.replyToUid
    }

    try {
      this.setData({ commentSubmitting: true })
      const res = await wx.cloud.callFunction({ name: 'createComment', data })
      if (res.result && res.result.success) {
        this.setData({
          inputText: '',
          replyTo: null,
          replyPlaceholder: '发表评论...'
        })
        await this.loadComments()
      } else {
        wx.showToast({ title: res.result?.errMsg || '发送失败', icon: 'none' })
      }
    } catch (err) {
      console.error('createComment failed:', err)
      wx.showToast({ title: '发送失败', icon: 'none' })
    } finally {
      this.setData({ commentSubmitting: false })
    }
  },

  goProfile(e) {
    const uid = e.currentTarget.dataset.uid
    if (!uid) return
    wx.navigateTo({ url: `/pages/profile/profile?uid=${uid}` })
  },

  goBack() {
    wx.navigateBack()
  }
})

