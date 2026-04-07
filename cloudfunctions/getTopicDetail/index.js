/**
 * 获取官方话题详情云函数 - 二期社区模块
 *
 * 上游依赖：topics, articles, videos
 * 入口：exports.main
 * 主要功能：获取单个话题详情及关联内容
 * 输出：话题详情、相关文章、相关视频
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

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

function normalizeContentBlocks(topic) {
  if (Array.isArray(topic.contentBlocks) && topic.contentBlocks.length > 0) {
    return topic.contentBlocks
  }

  if (topic.summary) {
    return [
      {
        id: 'summary',
        type: 'text',
        text: topic.summary,
        sort: 1
      }
    ]
  }

  return []
}

function extractIds(blocks, type, key) {
  return blocks
    .filter(block => block && block.type === type && block[key])
    .map(block => String(block[key]))
}

async function listByIds(collectionName, ids, filter = {}) {
  if (!ids.length) return []

  try {
    const result = await db.collection(collectionName)
      .where({
        _id: _.in(ids),
        ...filter
      })
      .get()

    const map = new Map((result.data || []).map(item => [String(item._id), item]))
    return ids.map(id => map.get(String(id))).filter(Boolean)
  } catch (err) {
    if (err.errCode === -502005) return []
    throw err
  }
}

exports.main = async (event) => {
  try {
    const topicId = event?.topicId
    if (!topicId) {
      return { success: false, errMsg: '话题ID不能为空' }
    }

    await ensureCollection('topics')

    const topicRes = await db.collection('topics').where({ _id: String(topicId) }).limit(1).get()
    const topic = topicRes.data && topicRes.data[0]
    if (!topic) {
      return { success: false, errMsg: '话题不存在' }
    }
    if (topic.status !== 'published') {
      return { success: false, errMsg: '话题暂未发布' }
    }

    const contentBlocks = normalizeContentBlocks(topic)
    const relatedArticleIds = [
      ...(Array.isArray(topic.relatedArticleIds) ? topic.relatedArticleIds.map(String) : []),
      ...extractIds(contentBlocks, 'article_link', 'articleId')
    ]
    const relatedVideoIds = [
      ...(Array.isArray(topic.relatedVideoIds) ? topic.relatedVideoIds.map(String) : []),
      ...extractIds(contentBlocks, 'video_link', 'videoId')
    ]

    const [relatedArticles, relatedVideos] = await Promise.all([
      listByIds('articles', [...new Set(relatedArticleIds)]),
      listByIds('videos', [...new Set(relatedVideoIds)], { status: 'published' })
    ])

    return {
      success: true,
      data: {
        topic: {
          _id: topic._id,
          title: topic.title || '未命名话题',
          summary: topic.summary || '',
          coverImage: topic.coverImage || '',
          contentBlocks,
          startAt: topic.startAt || null,
          endAt: topic.endAt || null,
          publishedAt: topic.publishedAt || topic.createdAt || null
        },
        relatedArticles: relatedArticles.map(item => ({
          _id: item._id,
          title: item.title || '',
          summary: item.summary || '',
          coverImage: item.coverImage || ''
        })),
        relatedVideos: relatedVideos.map(item => ({
          _id: item._id,
          title: item.title || '',
          summary: item.summary || '',
          coverImage: item.coverImage || '',
          duration: item.duration || 0
        }))
      }
    }
  } catch (err) {
    console.error('getTopicDetail failed:', err)
    return {
      success: false,
      errMsg: err.message
    }
  }
}
