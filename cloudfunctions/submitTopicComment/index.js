/**
 * 提交话题评论云函数 - 二期社区模块（成员 A：话题发布主链路）
 *
 * 上游依赖：users、topics、comments、review_tasks、review_keyword_rules
 * 入口：exports.main
 * 主要功能：校验话题可评论 → 敏感词与频率校验 → 事务写入评论与审核任务（pending_review）
 * 入参：{ topicId, content, parentId?, replyToUid? }
 * 输出：{ success, data: { commentId, status } }
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const DUPLICATE_WINDOW_MS = 5000

const LOG_MODULE = '[submitTopicComment]'

/**
 * 统一日志：按 CLAUDE.md「调试日志规范」输出单行 JSON。
 * 云函数目录独立部署，无法跨目录 require utils/logger.js，因此在本文件内实现同名 log()。
 */
function log(level, stage, detail = {}) {
  const safeLevel = ['INFO', 'WARN', 'ERROR'].includes(level) ? level : 'INFO'
  const line = `${LOG_MODULE} ${JSON.stringify({ ...detail, ts: new Date().toISOString(), level: safeLevel, stage })}`
  if (safeLevel === 'ERROR') console.error(line)
  else if (safeLevel === 'WARN') console.warn(line)
  else console.log(line)
}

const DEFAULT_RULES = {
  high: ['辱骂', '色情', '赌博', '买卖账号', '出售银行卡', '裸聊'],
  medium: ['微信', 'vx', 'v信', 'qq', '加群', '下载链接', '点击链接', '转账']
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

async function createCommentReviewTask(commentData, reviewTaskData) {
  const run = async (txDb) => {
    const commentRes = await txDb.collection('comments').add({ data: commentData })
    // 事务内 add 在不同 SDK 版本下可能返回 _id 或 id，两种都兼容
    const commentId = commentRes._id || commentRes.id
    if (!commentId) throw new Error('评论写入失败：未返回评论ID')

    const reviewTaskRes = await txDb.collection('review_tasks').add({
      data: {
        ...reviewTaskData,
        targetId: commentId,
        sourceId: commentId
      }
    })
    const reviewTaskId = reviewTaskRes._id || reviewTaskRes.id
    if (!reviewTaskId) throw new Error('审核任务写入失败：未返回任务ID')

    await txDb.collection('comments').doc(commentId).update({
      data: {
        reviewTaskId,
        updatedAt: commentData.updatedAt
      }
    })

    return { commentId, reviewTaskId }
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
      ensureCollection('comments'),
      ensureCollection('topics'),
      ensureCollection('review_tasks')
    ])

    const user = await getCurrentUser(openid)
    if (!user || !user.uid) return { success: false, errMsg: '用户不存在，请先登录' }

    const topicId = sanitizeText(event?.topicId, 64)
    const content = sanitizeText(event?.content, 300)
    const parentId = sanitizeText(event?.parentId, 64) || null
    const replyToUid = sanitizeText(event?.replyToUid, 64) || null

    if (!topicId) return { success: false, errMsg: '话题ID不能为空' }
    if (!content) return { success: false, errMsg: '评论内容不能为空' }

    const topicRes = await db.collection('topics').where({ _id: topicId, status: 'published' }).limit(1).get()
    const topic = topicRes.data && topicRes.data[0]
    if (!topic) {
      return { success: false, errMsg: '话题不存在或未发布' }
    }

    const rules = await loadRules()
    const highHits = matchKeywords(content, rules.high)
    const mediumHits = matchKeywords(content, rules.medium)

    if (highHits.length > 0) {
      return {
        success: false,
        errMsg: '内容包含敏感信息，无法提交'
      }
    }

    const now = new Date()
    const duplicateRes = await db.collection('comments').where({
      targetType: 'topic',
      targetId: topicId,
      authorUid: user.uid,
      content,
      parentId,
      replyToUid,
      createdAt: _.gte(new Date(now.getTime() - DUPLICATE_WINDOW_MS))
    }).limit(1).get()

    const duplicate = duplicateRes.data && duplicateRes.data[0]
    if (duplicate) {
      return {
        success: true,
        data: {
          commentId: duplicate._id,
          status: duplicate.status || 'pending_review',
          duplicate: true,
          message: '评论已提交，请勿重复点击'
        }
      }
    }

    const writeResult = await createCommentReviewTask(
      {
        targetType: 'topic',
        targetId: topicId,
        authorUid: user.uid,
        authorNickName: user.nickName || '',
        authorAvatarUrl: user.avatarUrl || '',
        content,
        parentId,
        replyToUid,
        status: 'pending_review',
        reviewTaskId: '',
        createdAt: now,
        updatedAt: now
      },
      {
        targetType: 'topic_comment',
        sourceType: 'topic_comment',
        sourceCollection: 'comments',
        submitterUid: user.uid,
        submitterNickName: user.nickName || '',
        submitterAvatarUrl: user.avatarUrl || '',
        contentText: content,
        contentSnapshot: content,
        sourceMeta: {
          topicId,
          topicTitle: topic.title || '',
          parentId: parentId || '',
          replyToUid: replyToUid || ''
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
        commentId: writeResult.commentId,
        status: 'pending_review',
        duplicate: false,
        message: '评论已提交，审核通过后显示'
      }
    }
  } catch (err) {
    log('ERROR', 'submit:failed', { msg: err && err.message })
    return { success: false, errMsg: err.message }
  }
}
