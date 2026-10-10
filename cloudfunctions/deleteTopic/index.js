const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

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
  const res = await db.collection('users').where({ _openid: openid }).limit(1).get()
  return res.data && res.data[0]
}

function hasAdminAccess(user) {
  if (!user) return false
  if (user.isAdmin === true) return true
  const roles = Array.isArray(user.roles) ? user.roles : []
  return roles.includes('operator')
}

function normalizeText(value, maxLen = 64) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLen)
}

async function removeTopicCommentsAndReviewTasks(topicId) {
  let removedComments = 0
  let removedReviewTasks = 0

  while (true) {
    const commentRes = await db.collection('comments')
      .where({
        targetType: 'topic',
        targetId: topicId
      })
      .limit(100)
      .get()

    const comments = commentRes.data || []
    if (!comments.length) break

    const commentIds = comments.map(item => item._id).filter(Boolean)
    if (!commentIds.length) break

    const reviewTaskRes = await db.collection('review_tasks')
      .where({
        sourceId: _.in(commentIds)
      })
      .remove()

    const removeCommentRes = await db.collection('comments')
      .where({
        _id: _.in(commentIds)
      })
      .remove()

    removedReviewTasks += reviewTaskRes.stats?.removed || 0
    removedComments += removeCommentRes.stats?.removed || 0
  }

  return { removedComments, removedReviewTasks }
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    await Promise.all([
      ensureCollection('users'),
      ensureCollection('topics'),
      ensureCollection('comments'),
      ensureCollection('review_tasks')
    ])

    const user = await getCurrentUser(openid)
    if (!hasAdminAccess(user)) return { success: false, errMsg: '无管理权限' }

    const id = normalizeText(event?.id)
    if (!id) return { success: false, errMsg: '话题ID不能为空' }

    const topicRes = await db.collection('topics').where({ _id: id }).limit(1).get()
    const topic = topicRes.data && topicRes.data[0]
    if (!topic) return { success: false, errMsg: '话题不存在' }

    const cleanupResult = await removeTopicCommentsAndReviewTasks(id)
    const removeTopicRes = await db.collection('topics').doc(id).remove()

    return {
      success: true,
      data: {
        id,
        removedTopics: removeTopicRes.stats?.removed || 0,
        removedComments: cleanupResult.removedComments,
        removedReviewTasks: cleanupResult.removedReviewTasks
      }
    }
  } catch (err) {
    console.error('deleteTopic failed:', err)
    return { success: false, errMsg: err.message }
  }
}
