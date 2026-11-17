/**
 * 获取视频列表云函数 - 视频模块
 *
 * 上游依赖：videos 集合
 * 入口：exports.main({ page, pageSize })
 * 主要功能：按分页返回已发布视频，按 sort 升序、发布时间倒序排列
 * 输出：{ success: true, data: { list, page, pageSize, hasMore } }
 *
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50
const MAX_PAGE = 500

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

function sanitizePage(value) {
  const page = Number(value)
  if (!Number.isFinite(page)) return 1
  return Math.max(1, Math.min(Math.floor(page), MAX_PAGE))
}

function sanitizePageSize(value) {
  const pageSize = Number(value)
  if (!Number.isFinite(pageSize)) return DEFAULT_PAGE_SIZE
  return Math.max(1, Math.min(Math.floor(pageSize), MAX_PAGE_SIZE))
}

exports.main = async (event) => {
  try {
    await ensureCollection('videos')

    const page = sanitizePage(event?.page)
    const pageSize = sanitizePageSize(event?.pageSize)

    // 多取一条用于判断是否还有下一页，避免额外的 count 查询
    const res = await db.collection('videos')
      .where({ status: 'published' })
      .orderBy('sort', 'asc')
      .orderBy('publishedAt', 'desc')
      .orderBy('_id', 'asc')
      .skip((page - 1) * pageSize)
      .limit(pageSize + 1)
      .get()

    const rows = res.data || []
    const hasMore = rows.length > pageSize
    const list = rows.slice(0, pageSize).map(item => ({
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
      data: {
        list,
        page,
        pageSize,
        hasMore
      }
    }
  } catch (err) {
    console.error('getVideos failed:', err)
    return { success: false, errMsg: err.message }
  }
}
