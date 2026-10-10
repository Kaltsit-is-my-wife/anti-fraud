const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

const DEFAULT_RULES = {
  high: ['辱骂', '色情', '赌博', '裸聊'],
  medium: ['微信', 'vx', 'v信', 'qq', '加群', '下载链接', '点击链接']
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

function sanitizeText(input, maxLen) {
  if (typeof input !== 'string') return ''
  return input.trim().slice(0, maxLen)
}

async function loadRules() {
  try {
    await ensureCollection('review_keyword_rules')
    const res = await db.collection('review_keyword_rules').where({ enabled: true }).get()
    const rules = res.data || []
    if (!rules.length) return DEFAULT_RULES
    const high = []
    const medium = []
    rules.forEach(rule => {
      const keyword = typeof rule.keyword === 'string' ? rule.keyword.trim() : ''
      if (!keyword) return
      if (rule.level === 'high') high.push(keyword)
      if (rule.level === 'medium') medium.push(keyword)
    })
    return {
      high: high.length ? high : DEFAULT_RULES.high,
      medium: medium.length ? medium : DEFAULT_RULES.medium
    }
  } catch (err) {
    return DEFAULT_RULES
  }
}

function matchKeywords(content, keywords) {
  return keywords.filter(keyword => keyword && content.includes(keyword))
}

async function createFeedbackReviewTask(feedbackData, reviewTaskData) {
  const run = async (txDb) => {
    const feedbackRes = await txDb.collection('feedback_records').add({ data: feedbackData })
    const feedbackId = feedbackRes._id

    const reviewTaskRes = await txDb.collection('review_tasks').add({
      data: {
        ...reviewTaskData,
        targetId: feedbackId,
        sourceId: feedbackId
      }
    })
    const reviewTaskId = reviewTaskRes._id

    await txDb.collection('feedback_records').doc(feedbackId).update({
      data: {
        reviewTaskId,
        updatedAt: feedbackData.updatedAt
      }
    })

    return { feedbackId, reviewTaskId }
  }

  if (typeof db.runTransaction === 'function') {
    return await db.runTransaction(async (transaction) => {
      const txDb = transaction || db
      return await run(txDb)
    })
  }

  return await run(db)
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    await Promise.all([
      ensureCollection('users'),
      ensureCollection('feedback_records'),
      ensureCollection('review_tasks')
    ])

    const user = await getCurrentUser(openid)
    if (!user || !user.uid) return { success: false, errMsg: '用户不存在，请先登录' }

    const content = sanitizeText(event?.content, 500)
    const contactInfo = sanitizeText(event?.contactInfo, 120)
    if (!content) return { success: false, errMsg: '请填写反馈内容' }

    const rules = await loadRules()
    const highHits = matchKeywords(content, rules.high)
    const mediumHits = matchKeywords(content, rules.medium)
    if (highHits.length > 0) {
      return { success: false, errMsg: '反馈内容包含敏感信息，无法提交' }
    }

    const now = new Date()
    const writeResult = await createFeedbackReviewTask(
      {
        reporterUid: user.uid,
        reporterNickName: user.nickName || '',
        reporterAvatarUrl: user.avatarUrl || '',
        content,
        contactInfo,
        status: 'pending_review',
        reviewTaskId: '',
        createdAt: now,
        updatedAt: now
      },
      {
        targetType: 'feedback',
        sourceType: 'feedback',
        sourceCollection: 'feedback_records',
        submitterUid: user.uid,
        submitterNickName: user.nickName || '',
        submitterAvatarUrl: user.avatarUrl || '',
        contentText: content,
        contentSnapshot: content,
        sourceMeta: {
          contactInfo
        },
        keywordHits: mediumHits,
        matchedKeywords: mediumHits.map(word => ({ word, riskLevel: 'medium' })),
        keywordHitLevel: mediumHits.length > 0 ? 'medium' : 'none',
        autoReviewResult: 'pending_review',
        autoResult: 'pending_review',
        reviewStatus: 'pending_review',
        status: 'pending_review',
        reviewReason: '',
        reviewerRemark: '',
        reviewedBy: '',
        reviewerUid: '',
        reviewedAt: null,
        createdAt: now,
        updatedAt: now
      }
    )

    return {
      success: true,
      data: {
        feedbackId: writeResult.feedbackId,
        status: 'pending_review',
        message: '反馈已提交，等待审核'
      }
    }
  } catch (err) {
    console.error('submitFeedback failed:', err)
    return { success: false, errMsg: err.message }
  }
}
