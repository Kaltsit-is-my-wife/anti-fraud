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
  return ['add', 'remove'].includes(action) ? action : ''
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

function buildLegacyBankId(bankIds) {
  return bankIds[0] || 'default_bank'
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    await Promise.all([
      ensureCollection('users'),
      ensureCollection('quiz_questions'),
      ensureCollection('question_banks')
    ])
    const user = await getCurrentUser(openid)
    if (!hasAdminAccess(user)) return { success: false, errMsg: '无管理权限' }

    const questionId = normalizeText(event?.questionId)
    const bankId = normalizeText(event?.bankId)
    const action = normalizeAction(event?.action)

    if (!questionId) return { success: false, errMsg: '题目ID不能为空' }
    if (!bankId || ['default_bank', '__all__', '__unassigned__'].includes(bankId)) {
      return { success: false, errMsg: '题库ID不合法' }
    }
    if (!action) return { success: false, errMsg: '操作类型不合法' }

    const [questionRes, bankRes] = await Promise.all([
      db.collection('quiz_questions').where({ _id: questionId }).limit(1).get(),
      db.collection('question_banks').where({ _id: bankId }).limit(1).get()
    ])

    const question = questionRes.data && questionRes.data[0]
    if (!question) return { success: false, errMsg: '题目不存在' }
    if (!bankRes.data || !bankRes.data[0]) return { success: false, errMsg: '题库不存在' }

    let bankIds = extractBankIds(question)
    if (action === 'add') {
      if (!bankIds.includes(bankId)) bankIds.push(bankId)
    } else {
      bankIds = bankIds.filter(item => item !== bankId)
    }

    bankIds = Array.from(new Set(bankIds))

    await db.collection('quiz_questions').doc(questionId).update({
      data: {
        bankIds,
        bankId: buildLegacyBankId(bankIds),
        updatedAt: new Date()
      }
    })

    return { success: true, data: { questionId, bankId, action, bankIds } }
  } catch (err) {
    console.error('updateQuestionBankRelation failed:', err)
    return { success: false, errMsg: err.message }
  }
}
