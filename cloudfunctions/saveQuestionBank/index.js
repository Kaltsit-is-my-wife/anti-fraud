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

function normalizeQuestionKey(value) {
  return normalizeText(value, 500).toLowerCase().replace(/\s+/g, '')
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

async function getExistingBank(id) {
  if (!id) return null
  const res = await db.collection('question_banks').where({ _id: id }).limit(1).get()
  return res.data && res.data[0]
}

async function getQuestionStats(bankId) {
  if (!bankId) {
    return {
      activeQuestionCount: 0,
      missingExplanationCount: 0,
      duplicateQuestionCount: 0
    }
  }

  const res = await db.collection('quiz_questions').get()
  const duplicateMap = new Map()
  let activeQuestionCount = 0
  let missingExplanationCount = 0

  ;(res.data || []).forEach(question => {
    if (!extractBankIds(question).includes(bankId)) return
    if (question.isActive === false) return

    activeQuestionCount += 1
    if (!normalizeText(question.explanation, 1000)) {
      missingExplanationCount += 1
    }
    const key = normalizeQuestionKey(question.normalizedQuestion || question.question)
    if (key) {
      duplicateMap.set(key, (duplicateMap.get(key) || 0) + 1)
    }
  })

  let duplicateQuestionCount = 0
  duplicateMap.forEach(count => {
    if (count > 1) duplicateQuestionCount += count - 1
  })

  return {
    activeQuestionCount,
    missingExplanationCount,
    duplicateQuestionCount
  }
}

function buildPublishValidationMessages(stats, defaultQuestionCount) {
  const messages = []
  if (stats.activeQuestionCount <= 0) {
    messages.push('当前题库没有启用题目，不能发布')
  }
  if (stats.activeQuestionCount < defaultQuestionCount) {
    messages.push(`当前启用题数 ${stats.activeQuestionCount} 小于默认抽题数 ${defaultQuestionCount}，不能发布`)
  }
  if (stats.missingExplanationCount > 0) {
    messages.push(`当前有 ${stats.missingExplanationCount} 道启用题缺少解析，不能发布`)
  }
  if (stats.duplicateQuestionCount > 0) {
    messages.push(`当前有 ${stats.duplicateQuestionCount} 道启用题重复，不能发布`)
  }
  return messages
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

    const id = normalizeText(event?.id, 64)
    const payload = event?.payload || {}
    const status = ['draft', 'published', 'offline'].includes(payload.status) ? payload.status : 'draft'
    const now = new Date()
    const defaultQuestionCount = Math.max(1, Math.min(Number(payload.defaultQuestionCount) || 10, 20))
    const existingBank = await getExistingBank(id)

    if (id && !existingBank) return { success: false, errMsg: '题库不存在' }

    if (status === 'published') {
      const stats = await getQuestionStats(id)
      const validationMessages = buildPublishValidationMessages(stats, defaultQuestionCount)
      if (validationMessages.length > 0) {
        return { success: false, errMsg: validationMessages[0] }
      }
    }

    const data = {
      name: normalizeText(payload.name, 100),
      summary: normalizeText(payload.summary, 300),
      coverImage: normalizeText(payload.coverImage, 500),
      status,
      sort: Number(payload.sort) || 0,
      defaultQuestionCount,
      updatedAt: now
    }

    if (!data.name) return { success: false, errMsg: '题库名称不能为空' }
    if (status === 'published') {
      data.publishedAt = existingBank?.publishedAt || (payload.publishedAt ? new Date(payload.publishedAt) : now)
    } else if (existingBank?.publishedAt) {
      data.publishedAt = existingBank.publishedAt
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
