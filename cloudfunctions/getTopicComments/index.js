const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

async function ensureCollection(name) {
  try {
    await db.collection(name).limit(1).get()
  } catch (err) {
    if (err.errCode === -502005) {
      try { await db.createCollection(name) } catch (e) {}
    }
  }
}

function sanitizePageSize(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return 50
  return Math.max(10, Math.min(100, Math.floor(v)))
}

exports.main = async (event) => {
  try {
    await ensureCollection('comments')
    const topicId = typeof event?.topicId === 'string' ? event.topicId.trim() : ''
    if (!topicId) return { success: false, errMsg: '话题ID不能为空' }

    const pageSize = sanitizePageSize(event?.pageSize)
    const res = await db.collection('comments')
      .where({
        targetType: 'topic',
        targetId: topicId,
        status: 'approved'
      })
      .orderBy('createdAt', 'asc')
      .limit(pageSize)
      .get()

    return {
      success: true,
      data: {
        comments: res.data || []
      }
    }
  } catch (err) {
    console.error('getTopicComments failed:', err)
    return { success: false, errMsg: err.message }
  }
}
