const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

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

function normalizeText(value, maxLen = 500) {
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

function buildDefaultStats() {
  return {
    totalQuestionCount: 0,
    activeQuestionCount: 0,
    inactiveQuestionCount: 0,
    missingExplanationCount: 0,
    invalidQuestionCount: 0,
    untaggedActiveQuestionCount: 0,
    duplicateMap: new Map()
  }
}

function buildPublishReview(bank, stats) {
  const requiredCount = Math.max(1, Number(bank.defaultQuestionCount) || 10)
  const issues = []
  const warnings = []

  if (stats.activeQuestionCount <= 0) {
    issues.push('启用题数为 0，不能发布')
  }
  if (stats.activeQuestionCount < requiredCount) {
    issues.push(`启用题数 ${stats.activeQuestionCount} 小于默认抽题数 ${requiredCount}`)
  }
  if (stats.missingExplanationCount > 0) {
    issues.push(`有 ${stats.missingExplanationCount} 道启用题缺少解析`)
  }
  if (stats.invalidQuestionCount > 0) {
    issues.push(`有 ${stats.invalidQuestionCount} 道启用题选项或答案配置异常`)
  }
  if (stats.duplicateQuestionCount > 0) {
    issues.push(`有 ${stats.duplicateQuestionCount} 道启用题重复`)
  }
  if (stats.untaggedActiveQuestionCount > 0) {
    warnings.push(`有 ${stats.untaggedActiveQuestionCount} 道启用题未填写标签`)
  }

  return {
    publishReady: issues.length === 0,
    publishIssue: issues[0] || '',
    publishIssueList: issues,
    publishWarningList: warnings
  }
}

exports.main = async () => {
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

    const [banks, questions] = await Promise.all([
      fetchAll('question_banks'),
      fetchAll('quiz_questions')
    ])

    const statsMap = new Map()
    let unassignedQuestionCount = 0
    const poolQuestionCount = questions.length

    questions.forEach(question => {
      const bankIds = extractBankIds(question)
      if (bankIds.length === 0) {
        unassignedQuestionCount += 1
        return
      }

      bankIds.forEach(bankId => {
        if (!statsMap.has(bankId)) {
          statsMap.set(bankId, buildDefaultStats())
        }

        const stats = statsMap.get(bankId)
        stats.totalQuestionCount += 1
        if (question.isActive === false) {
          stats.inactiveQuestionCount += 1
          return
        }

        stats.activeQuestionCount += 1
        if (!normalizeText(question.explanation, 1000)) {
          stats.missingExplanationCount += 1
        }
        const optionCount = Array.isArray(question.options) ? question.options.length : 0
        const answerIndex = Number(question.answerIndex)
        const validAnswer = Number.isInteger(answerIndex) &&
          answerIndex >= 0 &&
          answerIndex < optionCount
        const hasQuestionId = typeof question.questionId === 'string' && question.questionId.trim()
        if (optionCount < 2 || optionCount > 6 || !validAnswer || !hasQuestionId) {
          stats.invalidQuestionCount += 1
        }
        const tags = Array.isArray(question.tags) ? question.tags.filter(Boolean) : []
        if (!tags.length) {
          stats.untaggedActiveQuestionCount += 1
        }
        const key = normalizeQuestionKey(question.normalizedQuestion || question.question)
        if (key) {
          stats.duplicateMap.set(key, (stats.duplicateMap.get(key) || 0) + 1)
        }
      })
    })

    statsMap.forEach(stats => {
      let duplicateQuestionCount = 0
      stats.duplicateMap.forEach(count => {
        if (count > 1) duplicateQuestionCount += count - 1
      })
      stats.duplicateQuestionCount = duplicateQuestionCount
      delete stats.duplicateMap
    })

    const list = banks.map(bank => {
      const stats = statsMap.get(bank._id) || buildDefaultStats()
      const previewQuestionCount = Math.min(
        Math.max(1, Number(bank.defaultQuestionCount) || 10),
        Math.max(1, stats.activeQuestionCount || 1)
      )

      return {
        ...bank,
        totalQuestionCount: stats.totalQuestionCount,
        activeQuestionCount: stats.activeQuestionCount,
        inactiveQuestionCount: stats.inactiveQuestionCount,
        missingExplanationCount: stats.missingExplanationCount,
        invalidQuestionCount: stats.invalidQuestionCount,
        untaggedActiveQuestionCount: stats.untaggedActiveQuestionCount,
        duplicateQuestionCount: stats.duplicateQuestionCount || 0,
        previewQuestionCount,
        questionCount: stats.activeQuestionCount,
        ...buildPublishReview(bank, stats)
      }
    }).sort((a, b) => {
      const sortDiff = (a.sort || 0) - (b.sort || 0)
      if (sortDiff !== 0) return sortDiff
      return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
    })

    return {
      success: true,
      data: {
        list,
        summary: {
          bankCount: list.length,
          poolQuestionCount,
          unassignedQuestionCount
        }
      }
    }
  } catch (err) {
    console.error('getAdminQuestionBankList failed:', err)
    return { success: false, errMsg: err.message }
  }
}
