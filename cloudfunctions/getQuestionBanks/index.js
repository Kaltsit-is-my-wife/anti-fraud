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

    const [banksRes, questionsRes] = await Promise.all([
      db.collection('question_banks')
        .where({ status: 'published' })
        .get(),
      db.collection('quiz_questions')
        .where({ isActive: true })
        .get()
    ])

    const countMap = new Map()
    ;(questionsRes.data || []).forEach(question => {
      extractBankIds(question).forEach(bankId => {
        countMap.set(bankId, (countMap.get(bankId) || 0) + 1)
      })
    })

    const list = (banksRes.data || [])
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
