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
        console.error(`创建集合 ${collectionName} 失败:`, createErr.message)
      }
    }
  }
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

    const questions = questionsRes.data || []
    const publishedBanks = (banksRes.data || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0))
    const countMap = new Map()
    let unassignedCount = 0

    questions.forEach(question => {
      const bankId = typeof question.bankId === 'string' ? question.bankId.trim() : ''
      if (!bankId) {
        unassignedCount += 1
        return
      }
      countMap.set(bankId, (countMap.get(bankId) || 0) + 1)
    })

    const list = publishedBanks.map(bank => ({
      _id: bank._id,
      name: bank.name || '未命名题库',
      summary: bank.summary || '',
      coverImage: bank.coverImage || '',
      questionCount: countMap.get(bank._id) || 0,
      defaultQuestionCount: bank.defaultQuestionCount || 10,
      sort: bank.sort || 0
    }))

    if (unassignedCount > 0 || list.length === 0) {
      list.unshift({
        _id: 'default_bank',
        name: '基础题库',
        summary: '当前系统默认题库，收录现有启用题目。',
        coverImage: '',
        questionCount: unassignedCount > 0 ? unassignedCount : questions.length,
        defaultQuestionCount: 10,
        sort: -1
      })
    }

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
