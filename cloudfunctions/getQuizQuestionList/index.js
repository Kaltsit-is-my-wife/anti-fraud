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

function normalizeText(value, maxLen = 200) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLen)
}

function normalizeBankId(bankId) {
  const value = normalizeText(bankId, 64)
  return value || '__all__'
}

function normalizeStatus(status) {
  const value = normalizeText(status, 16)
  return ['all', 'active', 'inactive'].includes(value) ? value : 'all'
}

function normalizeRelationScope(value) {
  const scope = normalizeText(value, 16)
  return ['all', 'linked', 'unlinked'].includes(scope) ? scope : 'all'
}

function normalizeKeyword(value) {
  return normalizeText(value, 100).toLowerCase()
}

function normalizeTag(value) {
  return normalizeText(value, 50).toLowerCase()
}

function normalizeDifficulty(value) {
  const text = normalizeText(String(value || ''), 8)
  if (!text || text === 'all') return 'all'
  const numberValue = Number(text)
  if (!Number.isFinite(numberValue)) return 'all'
  return String(Math.max(1, Math.min(5, Math.floor(numberValue))))
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

function isLinkedToBank(question, bankId) {
  const bankIds = extractBankIds(question)
  if (bankId === '__all__') return false
  if (bankId === '__unassigned__') return false
  return bankIds.includes(bankId)
}

function matchesKeyword(question, keyword) {
  if (!keyword) return true
  const haystack = [
    question.question,
    question.explanation,
    ...(Array.isArray(question.options) ? question.options : []),
    ...(Array.isArray(question.tags) ? question.tags : [])
  ].join(' ').toLowerCase()
  return haystack.includes(keyword)
}

function matchesTag(question, tag) {
  if (!tag) return true
  const tags = Array.isArray(question.tags) ? question.tags.map(item => String(item).toLowerCase()) : []
  return tags.some(item => item.includes(tag))
}

function matchesDifficulty(question, difficulty) {
  if (difficulty === 'all') return true
  return String(question.difficulty || 1) === difficulty
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    await Promise.all([ensureCollection('users'), ensureCollection('quiz_questions')])
    const user = await getCurrentUser(openid)
    if (!hasAdminAccess(user)) return { success: false, errMsg: '无管理权限' }

    const bankId = normalizeBankId(event?.bankId)
    const status = normalizeStatus(event?.status)
    const relationScope = normalizeRelationScope(event?.relationScope)
    const keyword = normalizeKeyword(event?.keyword)
    const tag = normalizeTag(event?.tag)
    const difficulty = normalizeDifficulty(event?.difficulty)
    const list = (await db.collection('quiz_questions').get()).data || []

    const filtered = list
      .map(question => {
        const bankIds = extractBankIds(question)
        const linked = isLinkedToBank(question, bankId)
        return {
          ...question,
          bankIds,
          bankCount: bankIds.length,
          isInSelectedBank: linked,
          isUnassigned: bankIds.length === 0
        }
      })
      .filter(question => {
        if (status === 'active' && question.isActive === false) return false
        if (status === 'inactive' && question.isActive !== false) return false
        if (bankId === '__all__') {
          // no bank constraint
        } else if (relationScope === 'linked' && !question.isInSelectedBank) {
          return false
        } else if (relationScope === 'unlinked' && question.isInSelectedBank) {
          return false
        } else if (bankId === '__unassigned__' && !question.isUnassigned) {
          return false
        }
        if (!matchesKeyword(question, keyword)) return false
        if (!matchesTag(question, tag)) return false
        if (!matchesDifficulty(question, difficulty)) return false
        return true
      })

    filtered.sort((a, b) => {
      if ((a.isActive === false) !== (b.isActive === false)) {
        return a.isActive === false ? 1 : -1
      }
      return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
    })

    return { success: true, data: { list: filtered } }
  } catch (err) {
    console.error('getQuizQuestionList failed:', err)
    return { success: false, errMsg: err.message }
  }
}
