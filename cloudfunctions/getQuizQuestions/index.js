/**
 * 获取趣味答题题目云函数 - 趣味答题模块 (v3)
 *
 * 上游依赖：quiz_questions
 * 入口：exports.main
 * 主要功能：随机抽取指定数量题目（默认10），不下发正确答案与解析
 * 输出：题目列表（questionId, question, options, difficulty, tags）
 *
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */

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
    } else {
      console.error(`检查集合 ${collectionName} 失败:`, err.message)
    }
  }
}

function sanitizeCount(count) {
  const n = Number(count)
  if (!Number.isFinite(n)) return 10
  return Math.max(1, Math.min(20, Math.floor(n)))
}

function normalizeBankId(bankId) {
  if (typeof bankId !== 'string') return ''
  return bankId.trim()
}

function shuffle(list) {
  const arr = list.slice()
  for (let i = arr.length - 1; i > 0; i--) {
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

    const count = sanitizeCount(event?.count ?? 10)
    const bankId = normalizeBankId(event?.bankId)
    const allRes = await db.collection('quiz_questions')
      .where({ isActive: true })
      .get()

    let source = allRes.data || []
    if (bankId && bankId !== 'default_bank') {
      source = source.filter(item => String(item.bankId || '') === bankId)
    } else if (bankId === 'default_bank') {
      source = source.filter(item => !item.bankId || item.bankId === 'default_bank')
    }

    if (!source || source.length === 0) {
      try {
        await cloud.callFunction({ name: 'initQuizQuestions', data: {} })
        const res = await db.collection('quiz_questions')
          .where({ isActive: true })
          .get()
        source = res.data || []
        if (bankId && bankId !== 'default_bank') {
          source = source.filter(item => String(item.bankId || '') === bankId)
        } else if (bankId === 'default_bank') {
          source = source.filter(item => !item.bankId || item.bankId === 'default_bank')
        }
      } catch (err) {
        console.warn('initQuizQuestions failed:', err?.message || err)
      }
    }

    const questions = shuffle(source)
      .slice(0, count)
      .map(item => ({
        questionId: item.questionId,
        question: item.question,
        options: item.options,
        difficulty: item.difficulty || 1,
        tags: item.tags || [],
        bankId: item.bankId || 'default_bank'
      }))

    return {
      success: true,
      data: { questions, count: questions.length, bankId: bankId || 'default_bank' }
    }
  } catch (err) {
    console.error('getQuizQuestions failed:', err)
    return { success: false, errMsg: err.message }
  }
}

