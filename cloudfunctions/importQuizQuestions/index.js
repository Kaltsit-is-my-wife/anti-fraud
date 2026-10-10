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

function normalizeTags(value) {
  const raw = Array.isArray(value)
    ? value.map(item => normalizeText(String(item || ''), 50))
    : normalizeText(value, 500).split(/[，,\n]/).map(item => item.trim())
  return Array.from(new Set(raw.filter(Boolean))).slice(0, 10)
}

function normalizeInitialBankId(value) {
  const bankId = normalizeText(value, 64)
  if (!bankId || ['default_bank', '__all__', '__unassigned__'].includes(bankId)) return ''
  return bankId
}

function buildOptions(record) {
  if (Array.isArray(record.options)) {
    return record.options.map(item => normalizeText(String(item || ''), 200)).filter(Boolean)
  }

  const optionKeys = ['optionA', 'optionB', 'optionC', 'optionD', 'optionE', 'optionF', 'option1', 'option2', 'option3', 'option4', 'option5', 'option6']
  return optionKeys
    .map(key => normalizeText(String(record[key] || ''), 200))
    .filter(Boolean)
}

function parseAnswerIndex(record, options) {
  const direct = Number(record.answerIndex)
  if (Number.isFinite(direct)) return Math.floor(direct)

  const answer = normalizeText(String(record.answer || record.correctAnswer || record.correctOption || ''), 200)
  if (!answer) return -1

  const upper = answer.toUpperCase()
  if (/^[A-F]$/.test(upper)) {
    return upper.charCodeAt(0) - 65
  }

  return options.findIndex(item => item === answer)
}

function parsePayload(rawText) {
  const parsed = JSON.parse(rawText)
  if (Array.isArray(parsed)) return parsed
  if (parsed && Array.isArray(parsed.questions)) return parsed.questions
  if (parsed && Array.isArray(parsed.list)) return parsed.list
  return []
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    await Promise.all([ensureCollection('users'), ensureCollection('quiz_questions')])
    const user = await getCurrentUser(openid)
    if (!hasAdminAccess(user)) return { success: false, errMsg: '无管理权限' }

    const initialBankId = normalizeInitialBankId(event?.initialBankId)
    const rawText = normalizeText(event?.rawText, 120000)
    if (!rawText) return { success: false, errMsg: '导入内容不能为空' }

    let records
    try {
      records = parsePayload(rawText)
    } catch (err) {
      return { success: false, errMsg: '导入内容不是合法 JSON' }
    }

    if (!Array.isArray(records) || records.length === 0) {
      return { success: false, errMsg: '导入内容为空，或不是题目数组' }
    }
    if (records.length > 100) {
      return { success: false, errMsg: '单次最多导入 100 道题' }
    }

    const existingRes = await db.collection('quiz_questions').get()
    const existingSet = new Set(
      (existingRes.data || [])
        .map(item => normalizeQuestionKey(item.normalizedQuestion || item.question))
        .filter(Boolean)
    )

    const batchSet = new Set()
    const normalizedRecords = []
    const errors = []

    records.forEach((record, index) => {
      const row = index + 1
      const question = normalizeText(record?.question, 500)
      const normalizedQuestion = normalizeQuestionKey(question)
      const options = buildOptions(record || {})
      const answerIndex = parseAnswerIndex(record || {}, options)
      const explanation = normalizeText(record?.explanation, 1000)
      const difficulty = Math.max(1, Math.min(Number(record?.difficulty) || 1, 5))
      const tags = normalizeTags(record?.tags)
      const isActive = record?.isActive !== false

      if (!question) {
        errors.push(`第 ${row} 题缺少题干`)
        return
      }
      if (options.length < 2) {
        errors.push(`第 ${row} 题至少需要两个选项`)
        return
      }
      if (!Number.isFinite(answerIndex) || answerIndex < 0 || answerIndex >= options.length) {
        errors.push(`第 ${row} 题正确答案索引不合法`)
        return
      }
      if (isActive && !explanation) {
        errors.push(`第 ${row} 题为启用状态，但缺少解析`)
        return
      }
      if (existingSet.has(normalizedQuestion)) {
        errors.push(`第 ${row} 题与题目池已有题目重复：${question}`)
        return
      }
      if (batchSet.has(normalizedQuestion)) {
        errors.push(`第 ${row} 题与本次导入内容中的其他题目重复：${question}`)
        return
      }

      batchSet.add(normalizedQuestion)
      normalizedRecords.push({
        bankIds: initialBankId ? [initialBankId] : [],
        bankId: initialBankId || 'default_bank',
        question,
        normalizedQuestion,
        options,
        answerIndex,
        explanation,
        difficulty,
        tags,
        isActive
      })
    })

    if (errors.length > 0) {
      return { success: false, errMsg: errors.slice(0, 5).join('；') }
    }

    const importedIds = []
    for (let index = 0; index < normalizedRecords.length; index += 1) {
      const now = new Date()
      const res = await db.collection('quiz_questions').add({
        data: {
          ...normalizedRecords[index],
          questionId: `q${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
          createdAt: now,
          updatedAt: now
        }
      })
      importedIds.push(res._id)
    }

    return {
      success: true,
      data: {
        importedCount: importedIds.length,
        importedIds,
        linkedBankId: initialBankId || ''
      }
    }
  } catch (err) {
    console.error('importQuizQuestions failed:', err)
    return { success: false, errMsg: err.message }
  }
}
