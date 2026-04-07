/**
 * 提交诈骗反馈云函数 - 诈骗反馈模块 (v3)
 *
 * 上游依赖：users, scam_reports
 * 入口：exports.main
 * 主要功能：保存用户提交的诈骗行为反馈
 * 输出：reportId
 *
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */

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
  const res = await db.collection('users').where({ _openid: openid }).get()
  return res.data && res.data[0]
}

function sanitizeText(s, maxLen) {
  if (typeof s !== 'string') return ''
  return s.trim().slice(0, maxLen)
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

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    await Promise.all([ensureCollection('scam_reports'), ensureCollection('users'), ensureCollection('review_tasks')])
    const user = await getCurrentUser(openid)
    if (!user || !user.uid) return { success: false, errMsg: '用户不存在' }

    const type = sanitizeText(event?.type, 30)
    const channel = sanitizeText(event?.channel, 30)
    const scamAccount = sanitizeText(event?.scamAccount, 80)
    const scamLink = sanitizeText(event?.scamLink, 200)
    const content = sanitizeText(event?.content, 1000)
    const images = Array.isArray(event?.images) ? event.images.slice(0, 9) : []

    if (!content) return { success: false, errMsg: '请填写反馈内容' }

    const rules = await loadRules()
    const highHits = matchKeywords(content, rules.high)
    const mediumHits = matchKeywords(content, rules.medium)
    if (highHits.length > 0) return { success: false, errMsg: '内容包含敏感信息，无法提交' }

    const now = new Date()
    const addRes = await db.collection('scam_reports').add({
      data: {
        reporterUid: user.uid,
        reporterNickName: user.nickName || '',
        reporterAvatarUrl: user.avatarUrl || '',
        type,
        channel,
        scamAccount,
        scamLink,
        content,
        images,
        status: 'pending_review',
        createdAt: now,
        updatedAt: now
      }
    })

    await db.collection('review_tasks').add({
      data: {
        targetType: 'scam_report',
        targetId: addRes._id,
        contentText: content,
        keywordHits: mediumHits,
        keywordHitLevel: mediumHits.length > 0 ? 'medium' : 'none',
        autoReviewResult: 'pending_review',
        reviewStatus: 'pending_review',
        reviewReason: '',
        reviewedBy: '',
        reviewedAt: null,
        createdAt: now
      }
    })

    return {
      success: true,
      data: {
        reportId: addRes._id,
        status: 'pending_review',
        message: '反馈已提交，等待审核'
      }
    }
  } catch (err) {
    console.error('createScamReport failed:', err)
    return { success: false, errMsg: err.message }
  }
}

