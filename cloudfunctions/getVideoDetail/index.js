const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

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

async function listByIds(collectionName, ids, filter = {}) {
  if (!ids.length) return []
  try {
    const res = await db.collection(collectionName)
      .where({
        _id: _.in(ids),
        ...filter
      })
      .get()
    const map = new Map((res.data || []).map(item => [String(item._id), item]))
    return ids.map(id => map.get(String(id))).filter(Boolean)
  } catch (err) {
    if (err.errCode === -502005) return []
    throw err
  }
}

exports.main = async (event) => {
  try {
    await ensureCollection('videos')

    const videoId = typeof event?.videoId === 'string' ? event.videoId.trim() : ''
    if (!videoId) return { success: false, errMsg: '视频ID不能为空' }

    const videoRes = await db.collection('videos').where({ _id: videoId, status: 'published' }).limit(1).get()
    const video = videoRes.data && videoRes.data[0]
    if (!video) return { success: false, errMsg: '视频不存在或未发布' }

    const relatedArticleIds = Array.isArray(video.relatedArticleIds) ? video.relatedArticleIds.map(String) : []
    const relatedTopicIds = Array.isArray(video.relatedTopicIds) ? video.relatedTopicIds.map(String) : []

    const [relatedArticles, relatedTopics] = await Promise.all([
      listByIds('articles', relatedArticleIds),
      listByIds('topics', relatedTopicIds, { status: 'published' })
    ])

    return {
      success: true,
      data: {
        video: {
          _id: video._id,
          title: video.title || '',
          summary: video.summary || '',
          coverImage: video.coverImage || '',
          videoUrl: video.videoUrl || '',
          duration: video.duration || 0,
          category: video.category || '',
          publishedAt: video.publishedAt || video.createdAt || null
        },
        relatedArticles: relatedArticles.map(item => ({
          _id: item._id,
          title: item.title || '',
          summary: item.summary || '',
          coverImage: item.coverImage || ''
        })),
        relatedTopics: relatedTopics.map(item => ({
          _id: item._id,
          title: item.title || '',
          summary: item.summary || '',
          coverImage: item.coverImage || ''
        }))
      }
    }
  } catch (err) {
    console.error('getVideoDetail failed:', err)
    return { success: false, errMsg: err.message }
  }
}
