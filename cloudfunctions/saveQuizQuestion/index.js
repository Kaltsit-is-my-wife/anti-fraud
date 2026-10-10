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

function normalizeQuestionKey(value) {
  return normalizeText(value, 500).toLowerCase().replace(/\s+/g, '')
}

function normalizeOptions(value) {
  if (!Array.isArray(value)) return []
  return value.map(item => normalizeText(item, 200)).filter(Boolean)
}

function normalizeTags(value) {
  const raw = Array.isArray(value)
    ? value.map(item => normalizeText(String(item || ''), 50))
    : normalizeText(value, 500).split(/[，,\n]/).map(item => item.trim())

  return Array.from(new Set(raw.filter(Boolean))).slice(0, 10)
}

function normalizeBankIds(value) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(
    value
      .map(item => normalizeText(String(item || ''), 64))
      .filter(item => item && !['default_bank', '__all__', '__unassigned__'].includes(item))
  ))
}

function normalizeInitialBankId(value) {
  const bankId = normalizeText(value, 64)
  if (!bankId || ['default_bank', '__all__', '__unassigned__'].includes(bankId)) return ''
  return bankId
}

function extractBankIds(question) {
  const fromArray = normalizeBankIds(question?.bankIds)
  if (fromArray.length > 0) return fromArray

  const legacyBankId = normalizeInitialBankId(question?.bankId)
  return legacyBankId ? [legacyBankId] : []
}

function buildLegacyBankId(bankIds) {
  return bankIds[0] || 'default_bank'
}

async function getExistingQuestion(id) {
  if (!id) return null
  const res = await db.collection('quiz_questions').where({ _id: id }).limit(1).get()
  return res.data && res.data[0]
}

async function findDuplicateQuestion(normalizedQuestion, excludeId) {
  if (!normalizedQuestion) return null
  const listRes = await db.collection('quiz_questions').get()
  const list = listRes.data || []

  return list.find(item => {
    const sameQuestion = normalizeQuestionKey(item.normalizedQuestion || item.question) === normalizedQuestion
    const notSelf = !excludeId || item._id !== excludeId
    return sameQuestion && notSelf
  }) || null
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
    const question = normalizeText(payload.question, 500)
    const normalizedQuestion = normalizeQuestionKey(question)
    const isActive = payload.isActive !== false
    const existingQuestion = await getExistingQuestion(id)

    if (id && !existingQuestion) return { success: false, errMsg: '题目不存在' }
    if (!question) return { success: false, errMsg: '题目不能为空' }
    if (options.length < 2) return { success: false, errMsg: '至少需要两个选项' }
    if (!Number.isFinite(answerIndex) || answerIndex < 0 || answerIndex >= options.length) {
      return { success: false, errMsg: '正确答案索引不合法' }
    }

    const explanation = normalizeText(payload.explanation, 1000)
    if (isActive && !explanation) {
      return { success: false, errMsg: '启用题目必须填写解析' }
    }

    const duplicate = await findDuplicateQuestion(normalizedQuestion, id)
    if (duplicate) {
      return {
        success: false,
        errMsg: `题目池中已存在重复题目：${normalizeText(duplicate.question, 80)}`
      }
    }

    let bankIds = []
    if (Array.isArray(payload.bankIds)) {
      bankIds = normalizeBankIds(payload.bankIds)
    } else if (existingQuestion) {
      bankIds = extractBankIds(existingQuestion)
    } else {
      const initialBankId = normalizeInitialBankId(payload.initialBankId)
      bankIds = initialBankId ? [initialBankId] : []
    }

    const data = {
      bankIds,
      bankId: buildLegacyBankId(bankIds),
      question,
      normalizedQuestion,
      options,
      answerIndex,
      explanation,
      difficulty: Math.max(1, Math.min(Number(payload.difficulty) || 1, 5)),
      tags: normalizeTags(payload.tags),
      isActive,
      updatedAt: now
    }

    if (id) {
      await db.collection('quiz_questions').doc(id).update({ data })
      return { success: true, data: { id, bankIds } }
    }

    data.questionId = `q${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    data.createdAt = now
    const res = await db.collection('quiz_questions').add({ data })
    return { success: true, data: { id: res._id, bankIds } }
  } catch (err) {
    console.error('saveQuizQuestion failed:', err)
    return { success: false, errMsg: err.message }
  }
}
