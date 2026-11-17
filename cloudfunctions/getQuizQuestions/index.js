/**
 * 抽取答题题目云函数 - 趣味答题模块
 *
 * 上游依赖：quiz_questions、question_banks、users 集合
 * 入口：exports.main({ count, bankId, preview })
 * 主要功能：按题库抽取启用题目；用户侧要求题库已发布；管理员预览可查看草稿/下线题库
 * 输出：{ success: true, data: { questions, count, bankId, preview } }
 *
 * 边界：
 * - 非预览模式必须传真实题库 ID，且题库 status 必须为 published
 * - 题目全量读取使用分批拉取，避免云函数单次查询上限导致只看到前 100 条
 *
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

const BATCH_SIZE = 100
const MAX_FETCH = 100000

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

async function getPublishedBank(bankId) {
  const res = await db.collection('question_banks')
    .where({ _id: bankId, status: 'published' })
    .limit(1)
    .get()
  return res.data && res.data[0]
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

function hasValidOptionsAndAnswer(question) {
  if (typeof question.questionId !== 'string' || !question.questionId.trim()) return false
  const options = Array.isArray(question.options) ? question.options : []
  if (options.length < 2 || options.length > 6) return false
  const answerIndex = Number(question.answerIndex)
  return Number.isInteger(answerIndex) && answerIndex >= 0 && answerIndex < options.length
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
    await Promise.all([
      ensureCollection('quiz_questions'),
      ensureCollection('question_banks')
    ])

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
    } else {
      if (!bankId || ['default_bank', '__all__', '__unassigned__'].includes(bankId)) {
        return { success: false, errMsg: '请先选择题库' }
      }
      const bank = await getPublishedBank(bankId)
      if (!bank) {
        return { success: false, errMsg: '题库不存在或未发布' }
      }
    }

    const allQuestions = await fetchAll('quiz_questions', { isActive: true })
    const source = allQuestions
      .filter(question => isQuestionInBank(question, bankId))
      // 只下发选项和答案索引都合法的题，避免历史异常数据在 A-F 界面无法作答
      .filter(hasValidOptionsAndAnswer)

    if (!preview && source.length === 0) {
      return { success: false, errMsg: '当前题库暂无可用题目' }
    }

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
