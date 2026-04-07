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
    }
  }
}

exports.main = async (event) => {
  try {
    await ensureCollection('videos')
    const pageSize = Math.max(1, Math.min(Number(event?.pageSize) || 20, 50))
    const res = await db.collection('videos')
      .where({ status: 'published' })
      .get()

    const list = (res.data || [])
      .sort((a, b) => {
        const sortDiff = (a.sort || 0) - (b.sort || 0)
        if (sortDiff !== 0) return sortDiff
        return new Date(b.publishedAt || b.createdAt || 0).getTime() - new Date(a.publishedAt || a.createdAt || 0).getTime()
      })
      .slice(0, pageSize)
      .map(item => ({
        _id: item._id,
        title: item.title || '',
        summary: item.summary || '',
        coverImage: item.coverImage || '',
        duration: item.duration || 0,
        category: item.category || '',
        publishedAt: item.publishedAt || item.createdAt || null
      }))

    return {
      success: true,
      data: { list }
    }
  } catch (err) {
    console.error('getVideos failed:', err)
    return { success: false, errMsg: err.message }
  }
}
