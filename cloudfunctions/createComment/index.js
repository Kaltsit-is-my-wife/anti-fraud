/**
 * 创建评论云函数 - 评论模块 (v3)
 *
 * 上游依赖：users, comments, notifications, posts/articles(可选更新commentCount)
 * 入口：exports.main
 * 主要功能：创建评论或回复；回复时给被回复者发送站内通知
 * 输出：commentId
 *
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const DUPLICATE_WINDOW_MS = 5000

async function ensureCollection(name) {
  try {
    await db.collection(name).limit(1).get()
  } catch (err) {
    if (err.errCode === -502005) {
      try { await db.createCollection(name) } catch (e) {}
    }
  }
}

async function getCurrentUser(openid) {
  const res = await db.collection('users').where({ _openid: openid }).get()
  return res.data && res.data[0]
}

function sanitizeText(s, maxLen) {
  if (typeof s !== 'string') return ''
  return s.trim().slice(0, maxLen)
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    await Promise.all([
      ensureCollection('comments'),
      ensureCollection('notifications'),
      ensureCollection('users')
    ])

    const user = await getCurrentUser(openid)
    if (!user) return { success: false, errMsg: '用户不存在' }
    if (!user.uid) return { success: false, errMsg: '用户UID缺失' }

    const targetType = event?.targetType
    const targetId = event?.targetId
    const content = sanitizeText(event?.content, 300)
    const parentId = event?.parentId || null
    const replyToUid = event?.replyToUid || null

    if (!['article', 'post'].includes(targetType)) {
      return { success: false, errMsg: 'targetType不合法' }
    }
    if (!targetId) return { success: false, errMsg: 'targetId不能为空' }
    if (!content) return { success: false, errMsg: '评论内容不能为空' }

    const now = new Date()
    const duplicateRes = await db.collection('comments').where({
      targetType,
      targetId,
      authorUid: user.uid,
      content,
      parentId,
      replyToUid,
      createdAt: _.gte(new Date(now.getTime() - DUPLICATE_WINDOW_MS))
    }).limit(1).get()

    const duplicate = duplicateRes.data && duplicateRes.data[0]
    if (duplicate) {
      return {
        success: true,
        data: {
          commentId: duplicate._id,
          duplicate: true,
          message: '评论已提交，请勿重复点击'
        }
      }
    }

    const addRes = await db.collection('comments').add({
      data: {
        targetType,
        targetId,
        authorUid: user.uid,
        authorNickName: user.nickName || '',
        authorAvatarUrl: user.avatarUrl || '',
        content,
        parentId,
        replyToUid,
        status: 'published',
        createdAt: now,
        updatedAt: now
      }
    })

    const commentId = addRes._id

    // Best-effort: update commentCount on post
    if (targetType === 'post') {
      try {
        await ensureCollection('posts')
        await db.collection('posts').doc(targetId).update({
          data: { commentCount: _.inc(1), updatedAt: new Date() }
        })
      } catch (err) {
        console.warn('update post.commentCount failed:', err.message)
      }
    }

    // Notify reply target
    if (replyToUid && replyToUid !== user.uid) {
      try {
        await db.collection('notifications').add({
          data: {
            toUid: replyToUid,
            fromUid: user.uid,
            type: 'reply',
            payload: {
              targetType,
              targetId,
              commentId,
              previewText: content.slice(0, 50)
            },
            isRead: false,
            createdAt: new Date()
          }
        })
      } catch (err) {
        console.warn('write reply notification failed:', err.message)
      }
    }

    return { success: true, data: { commentId, duplicate: false } }
  } catch (err) {
    console.error('createComment failed:', err)
    return { success: false, errMsg: err.message }
  }
}

