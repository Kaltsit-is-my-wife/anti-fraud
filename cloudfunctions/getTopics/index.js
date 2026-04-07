/**
 * 获取官方话题列表云函数 - 二期社区模块
 *
 * 上游依赖：topics
 * 入口：exports.main
 * 主要功能：获取已发布的官方话题列表
 * 输出：话题列表
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

async function ensureCollection(name) {
  try {
    await db.collection(name).limit(1).get()
  } catch (err) {
    if (err.errCode === -502005) {
      try {
        await db.createCollection(name)
      } catch (createErr) {
        console.error(`create collection ${name} failed:`, createErr.message)
      }
    } else {
      throw err
    }
  }
}

function toTimestamp(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.getTime()
}

function getTopicStage(topic) {
  const now = Date.now()
  const startAt = toTimestamp(topic.startAt)
  const endAt = toTimestamp(topic.endAt)

  if (startAt && startAt > now) {
    return { code: 'upcoming', label: '即将开始' }
  }
  if (endAt && endAt < now) {
    return { code: 'ended', label: '已结束' }
  }
  return { code: 'ongoing', label: '进行中' }
}

exports.main = async (event) => {
  try {
    await ensureCollection('topics')

    const pageSize = Math.max(1, Math.min(Number(event?.pageSize) || 20, 50))
    const result = await db.collection('topics')
      .where({ status: 'published' })
      .get()

    const list = (result.data || [])
      .sort((a, b) => {
        const sortDiff = (a.sort || 0) - (b.sort || 0)
        if (sortDiff !== 0) return sortDiff

        const timeA = toTimestamp(a.publishedAt || a.createdAt) || 0
        const timeB = toTimestamp(b.publishedAt || b.createdAt) || 0
        return timeB - timeA
      })
      .slice(0, pageSize)
      .map(item => {
        const stage = getTopicStage(item)
        return {
          _id: item._id,
          title: item.title || '未命名话题',
        summary: item.summary || '',
        coverImage: item.coverImage || '',
        startAt: item.startAt || null,
        endAt: item.endAt || null,
        publishedAt: item.publishedAt || item.createdAt || null,
        topicStage: stage.code,
        topicStageLabel: stage.label,
        sort: item.sort || 0
      }
      })

    return {
      success: true,
      data: { list }
    }
  } catch (err) {
    console.error('getTopics failed:', err)
    return {
      success: false,
      errMsg: err.message
    }
  }
}
