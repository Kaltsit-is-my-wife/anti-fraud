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

function normalizeText(value, maxLen = 1000) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLen)
}

function normalizeOptions(value) {
  if (!Array.isArray(value)) return []
  return value.map(item => normalizeText(item, 200)).filter(Boolean)
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    await Promise.all([ensureCollection('users'), ensureCollection('quiz_questions')])
    const user = await getCurrentUser(openid)
    if (!hasAdminAccess(user)) return { success: false, errMsg: '无管理权限' }

    const id = normalizeText(event?.id, 64)
    const payload = event?.payload || {}
    const now = new Date()
    const options = normalizeOptions(payload.options)
    const answerIndex = Number(payload.answerIndex)
    const bankId = normalizeText(payload.bankId, 64) || 'default_bank'

    if (!normalizeText(payload.question, 500)) return { success: false, errMsg: '题目不能为空' }
    if (options.length < 2) return { success: false, errMsg: '至少需要两个选项' }
    if (!Number.isFinite(answerIndex) || answerIndex < 0 || answerIndex >= options.length) {
      return { success: false, errMsg: '正确答案索引不合法' }
    }

    const data = {
      bankId,
      question: normalizeText(payload.question, 500),
      options,
      answerIndex,
      explanation: normalizeText(payload.explanation, 1000),
      difficulty: Math.max(1, Math.min(Number(payload.difficulty) || 1, 5)),
      tags: normalizeText(payload.tags, 200)
        .split(/[，,]/)
        .map(item => item.trim())
        .filter(Boolean),
      isActive: payload.isActive !== false,
      updatedAt: now
    }

    if (id) {
      await db.collection('quiz_questions').doc(id).update({ data })
      return { success: true, data: { id } }
    }

    data.questionId = `q${Date.now()}`
    data.createdAt = now
    const res = await db.collection('quiz_questions').add({ data })
    return { success: true, data: { id: res._id } }
  } catch (err) {
    console.error('saveQuizQuestion failed:', err)
    return { success: false, errMsg: err.message }
  }
}
