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

function hasAdminAccess(user) {
  if (!user) return false
  if (user.isAdmin === true) return true
  const roles = Array.isArray(user.roles) ? user.roles : []
  return roles.includes('operator')
}

function normalizeText(value, maxLen = 300) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLen)
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    await Promise.all([ensureCollection('users'), ensureCollection('question_banks')])
    const user = await getCurrentUser(openid)
    if (!hasAdminAccess(user)) return { success: false, errMsg: '无管理权限' }

    const id = normalizeText(event?.id, 64)
    const payload = event?.payload || {}
    const status = ['draft', 'published', 'offline'].includes(payload.status) ? payload.status : 'draft'
    const now = new Date()
    const data = {
      name: normalizeText(payload.name, 100),
      summary: normalizeText(payload.summary, 300),
      coverImage: normalizeText(payload.coverImage, 500),
      status,
      sort: Number(payload.sort) || 0,
      defaultQuestionCount: Math.max(1, Math.min(Number(payload.defaultQuestionCount) || 10, 20)),
      updatedAt: now
    }

    if (!data.name) return { success: false, errMsg: '题库名称不能为空' }
    if (status === 'published') {
      data.publishedAt = payload.publishedAt ? new Date(payload.publishedAt) : now
    }

    if (id) {
      await db.collection('question_banks').doc(id).update({ data })
      return { success: true, data: { id } }
    }

    data.createdAt = now
    const res = await db.collection('question_banks').add({ data })
    return { success: true, data: { id: res._id } }
  } catch (err) {
    console.error('saveQuestionBank failed:', err)
    return { success: false, errMsg: err.message }
  }
}
