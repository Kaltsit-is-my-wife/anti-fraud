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

async function getCurrentUser(openid) {
  const res = await db.collection('users').where({ _openid: openid }).limit(1).get()
  return res.data && res.data[0]
}

function hasReviewPermission(user) {
  if (!user) return false
  if (user.isAdmin === true) return true
  const roles = Array.isArray(user.roles) ? user.roles : []
  return roles.includes('reviewer') || roles.includes('operator')
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    await Promise.all([ensureCollection('users'), ensureCollection('review_tasks')])
    const user = await getCurrentUser(openid)
    if (!hasReviewPermission(user)) {
      return { success: false, errMsg: '无审核权限' }
    }

    const status = typeof event?.status === 'string' ? event.status.trim() : 'pending_review'
    const targetType = typeof event?.targetType === 'string' ? event.targetType.trim() : ''
    const pageSize = Math.max(1, Math.min(Number(event?.pageSize) || 20, 50))

    const where = {}
    if (status) where.reviewStatus = status
    if (targetType) where.targetType = targetType

    const res = await db.collection('review_tasks')
      .where(where)
      .orderBy('createdAt', 'desc')
      .limit(pageSize)
      .get()

    return {
      success: true,
      data: {
        list: res.data || []
      }
    }
  } catch (err) {
    console.error('getReviewTasks failed:', err)
    return { success: false, errMsg: err.message }
  }
}
