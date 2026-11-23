/**
 * 创建评论云函数 - 评论模块 (v3)
 *
 * 上游依赖：users、comments、review_tasks
 * 入口：exports.main
 * 主要功能：创建评论或回复；文章和帖子评论统一进入 pending_review 并创建审核任务；回复通知由 reviewContent 在审核通过后发送
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

  if (!openid) return { success: false, errMsg: '用户不存在' }

  try {
    await Promise.all([
      ensureCollection('comments'),
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

    const reviewTargetType = targetType === 'article' ? 'article_comment' : 'post_comment'
    const initialStatus = 'pending_review'

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
      reviewTaskId: '',
      createdAt: now,
      updatedAt: now
    }

    const writeResult = await createCommentReviewTask(commentData, {
      targetType: reviewTargetType,
      sourceType: reviewTargetType,
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
    const commentId = writeResult.commentId

    return {
      success: true,
      data: {
        commentId,
        status: initialStatus,
        duplicate: false,
        message: '评论已提交，审核通过后显示'
      }
    }
  } catch (err) {
    console.error('createComment failed:', err)
    return { success: false, errMsg: err.message }
  }
}

