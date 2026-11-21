const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

const BATCH_SIZE = 100
const MAX_FETCH = 100000

async function fetchAll(collectionName, where = null) {
  const list = []
  let offset = 0

  while (offset < MAX_FETCH) {
    let query = db.collection(collectionName)
    if (where) query = query.where(where)
    const res = await query
      .orderBy('_id', 'asc')
      .skip(offset)
      .limit(BATCH_SIZE)
      .get()
    const batch = res.data || []
    list.push(...batch)
    if (batch.length < BATCH_SIZE) break
    offset += batch.length
  }

  return list
}

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

function normalizeText(value, maxLen = 300) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLen)
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

exports.main = async () => {
  try {
    await Promise.all([
      ensureCollection('question_banks'),
      ensureCollection('quiz_questions')
    ])

    const [banks, questions] = await Promise.all([
      fetchAll('question_banks', { status: 'published' }),
      fetchAll('quiz_questions', { isActive: true })
    ])

    const countMap = new Map()
    questions.forEach(question => {
      if (typeof question.questionId !== 'string' || !question.questionId.trim()) return
      const options = Array.isArray(question.options) ? question.options : []
      const answerIndex = Number(question.answerIndex)
      const validAnswer = Number.isInteger(answerIndex) &&
        answerIndex >= 0 &&
        answerIndex < options.length
      if (options.length < 2 || options.length > 6 || !validAnswer) return
      extractBankIds(question).forEach(bankId => {
        countMap.set(bankId, (countMap.get(bankId) || 0) + 1)
      })
    })

    const list = banks
      .map(bank => ({
        _id: bank._id,
        name: bank.name || '未命名题库',
        summary: bank.summary || '',
        coverImage: bank.coverImage || '',
        questionCount: countMap.get(bank._id) || 0,
        defaultQuestionCount: bank.defaultQuestionCount || 10,
        sort: bank.sort || 0
      }))
      .sort((a, b) => (a.sort || 0) - (b.sort || 0))

    return {
      success: true,
      data: {
        list
      }
    }
  } catch (err) {
    console.error('getQuestionBanks failed:', err)
    return {
      success: false,
      errMsg: err.message
    }
  }
}
