/**
 * 创建评论云函数 - 评论模块 (v3)
 *
 * 上游依赖：users、comments、notifications、review_tasks、posts（可选更新 commentCount）
 * 入口：exports.main
 * 主要功能：创建评论或回复；文章评论进入 pending_review 并创建审核任务，帖子评论保持直接发布；回复时给被回复者发送站内通知
 * 输出：commentId、status
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

async function createCommentReviewTask(commentData, reviewTaskData) {
  const run = async (txDb) => {
    const commentRes = await txDb.collection('comments').add({ data: commentData })
    const commentId = commentRes._id || commentRes.id
    if (!commentId) throw new Error('评论写入失败：未返回评论ID')

    const reviewTaskRes = await txDb.collection('review_tasks').add({
      data: {
        ...reviewTaskData,
        targetId: commentId,
        sourceId: commentId
      }
    })
    const reviewTaskId = reviewTaskRes._id || reviewTaskRes.id
    if (!reviewTaskId) throw new Error('审核任务写入失败：未返回任务ID')

    await txDb.collection('comments').doc(commentId).update({
      data: {
        reviewTaskId,
        updatedAt: commentData.updatedAt
      }
    })

    return { commentId, reviewTaskId }
  }

  if (typeof db.runTransaction === 'function') {
    return await db.runTransaction(async (transaction) => {
      const txDb = transaction || db
      return await run(txDb)
    })
  }

  return await run(db)
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    await Promise.all([
      ensureCollection('comments'),
      ensureCollection('notifications'),
      ensureCollection('users'),
      ensureCollection('review_tasks')
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

    const isArticleComment = targetType === 'article'
    const initialStatus = isArticleComment ? 'pending_review' : 'published'

    const duplicate = duplicateRes.data && duplicateRes.data[0]
    if (duplicate) {
      const duplicateStatus = duplicate.status || initialStatus
      return {
        success: true,
        data: {
          commentId: duplicate._id,
          duplicate: true,
          status: duplicateStatus,
          message: duplicateStatus === 'pending_review'
            ? '评论已提交，审核通过后显示'
            : '评论已提交，请勿重复点击'
        }
      }
    }

    const commentData = {
      targetType,
      targetId,
      authorUid: user.uid,
      authorNickName: user.nickName || '',
      authorAvatarUrl: user.avatarUrl || '',
      content,
      parentId,
      replyToUid,
      status: initialStatus,
      reviewTaskId: isArticleComment ? '' : null,
      createdAt: now,
      updatedAt: now
    }

    let commentId
    if (isArticleComment) {
      const writeResult = await createCommentReviewTask(commentData, {
        targetType: 'article_comment',
        sourceType: 'article_comment',
        sourceCollection: 'comments',
        submitterUid: user.uid,
        submitterNickName: user.nickName || '',
        submitterAvatarUrl: user.avatarUrl || '',
        contentText: content,
        contentSnapshot: content,
        sourceMeta: {
          targetType,
          targetId,
          parentId: parentId || '',
          replyToUid: replyToUid || ''
        },
        keywordHits: [],
        matchedKeywords: [],
        keywordHitLevel: 'none',
        autoReviewResult: 'pending_review',
        autoResult: 'pending_review',
        reviewStatus: 'pending_review',
        status: 'pending_review',
        reviewReason: '',
        reviewerRemark: '',
        reviewedBy: '',
        reviewerUid: '',
        reviewedAt: null,
        createdAt: now,
        updatedAt: now
      })
      commentId = writeResult.commentId
    } else {
      const addRes = await db.collection('comments').add({ data: commentData })
      commentId = addRes._id
    }

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

    return {
      success: true,
      data: {
        commentId,
        status: initialStatus,
        duplicate: false,
        message: isArticleComment ? '评论已提交，审核通过后显示' : '评论已提交'
      }
    }
  } catch (err) {
    console.error('createComment failed:', err)
    return { success: false, errMsg: err.message }
  }
}

