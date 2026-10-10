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

function normalizeText(value, maxLen = 64) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLen)
}

function normalizeAction(value) {
  const action = normalizeText(value, 16)
  return ['offline', 'delete'].includes(action) ? action : ''
}

function extractBankIds(question) {
  if (Array.isArray(question.bankIds) && question.bankIds.length > 0) {
    return Array.from(new Set(
      question.bankIds
        .map(item => normalizeText(String(item || ''), 64))
        .filter(item => item && !['default_bank', '__all__', '__unassigned__'].includes(item))
    ))
  }

  const legacyBankId = normalizeText(question.bankId, 64)
  if (legacyBankId && !['default_bank', '__all__', '__unassigned__'].includes(legacyBankId)) {
    return [legacyBankId]
  }

  return []
}

async function getBank(id) {
  const res = await db.collection('question_banks').where({ _id: id }).limit(1).get()
  return res.data && res.data[0]
}

async function countQuestions(bankId) {
  const res = await db.collection('quiz_questions').get()
  return (res.data || []).filter(question => extractBankIds(question).includes(bankId)).length
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    await Promise.all([
      ensureCollection('users'),
      ensureCollection('question_banks'),
      ensureCollection('quiz_questions')
    ])

    const user = await getCurrentUser(openid)
    if (!hasAdminAccess(user)) return { success: false, errMsg: '无管理权限' }

    const id = normalizeText(event?.id)
    const action = normalizeAction(event?.action)

    if (!id) return { success: false, errMsg: '题库ID不能为空' }
    if (!action) return { success: false, errMsg: '操作类型不合法' }

    const bank = await getBank(id)
    if (!bank) return { success: false, errMsg: '题库不存在' }

    if (action === 'offline') {
      await db.collection('question_banks').doc(id).update({
        data: {
          status: 'offline',
          updatedAt: new Date()
        }
      })
      return { success: true, data: { id, action } }
    }

    const questionCount = await countQuestions(id)
    if (questionCount > 0) {
      return { success: false, errMsg: `题库下仍有 ${questionCount} 道题目，请先从题库中移除后再删除` }
    }

    await db.collection('question_banks').doc(id).remove()
    return { success: true, data: { id, action } }
  } catch (err) {
    console.error('deleteQuestionBank failed:', err)
    return { success: false, errMsg: err.message }
  }
}
