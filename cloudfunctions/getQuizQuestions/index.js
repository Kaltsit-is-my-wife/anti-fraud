const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

async function ensureCollection(collectionName) {
  try {
    await db.collection(collectionName).limit(1).get()
  } catch (err) {
    if (err.errCode === -502005) {
      try {
        await db.createCollection(collectionName)
      } catch (createErr) {
        console.error(`create collection ${collectionName} failed:`, createErr.message)
      }
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

function sanitizeCount(count) {
  const n = Number(count)
  if (!Number.isFinite(n)) return 10
  return Math.max(1, Math.min(20, Math.floor(n)))
}

function normalizeText(value, maxLen = 200) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLen)
}

function normalizeBankId(bankId) {
  return normalizeText(bankId, 64)
}

function isPreviewMode(value) {
  return value === true || value === '1' || value === 1
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

function isQuestionInBank(question, bankId) {
  const bankIds = extractBankIds(question)
  if (!bankId) return true
  if (bankId === '__unassigned__') return bankIds.length === 0
  return bankIds.includes(bankId)
}

function shuffle(list) {
  const arr = list.slice()
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = arr[i]
    arr[i] = arr[j]
    arr[j] = temp
  }
  return arr
}

exports.main = async (event) => {
  try {
    await ensureCollection('quiz_questions')

    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const count = sanitizeCount(event?.count ?? 10)
    const bankId = normalizeBankId(event?.bankId)
    const preview = isPreviewMode(event?.preview)

    if (preview) {
      await ensureCollection('users')
      const user = await getCurrentUser(openid)
      if (!hasAdminAccess(user)) {
        return { success: false, errMsg: '无管理权限，不能预览题库' }
      }
    }

    const allRes = await db.collection('quiz_questions')
      .where({ isActive: true })
      .get()

    let source = (allRes.data || []).filter(question => isQuestionInBank(question, bankId))

    const questions = shuffle(source)
      .slice(0, count)
      .map(item => ({
        questionId: item.questionId,
        question: item.question,
        options: item.options,
        difficulty: item.difficulty || 1,
        tags: item.tags || [],
        bankIds: extractBankIds(item),
        ...(preview
          ? {
              answerIndex: Number(item.answerIndex) || 0,
              explanation: item.explanation || ''
            }
          : {})
      }))

    return {
      success: true,
      data: {
        questions,
        count: questions.length,
        bankId: bankId || '',
        preview
      }
    }
  } catch (err) {
    console.error('getQuizQuestions failed:', err)
    return { success: false, errMsg: err.message }
  }
}
