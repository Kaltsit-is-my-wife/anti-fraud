/**
 * 获取积分记录云函数
 *
 * 上游依赖：points_records
 * 入口：exports.main
 * 主要功能：按当前用户读取积分流水，避免前端直接查询数据库
 * 输出：records, pagination
 */

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
    } else {
      console.error(`检查集合 ${collectionName} 失败:`, err.message)
    }
  }
}

function sanitizePositiveInt(value, fallback, max) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.min(max, Math.floor(parsed)))
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    if (!openid) {
      return {
        success: false,
        errMsg: '用户未登录'
      }
    }

    await ensureCollection('points_records')

    const page = sanitizePositiveInt(event?.page, 1, 1000)
    const pageSize = sanitizePositiveInt(event?.pageSize, 20, 100)
    const skip = (page - 1) * pageSize

    const where = { _openid: openid }

    const [countResult, recordsResult] = await Promise.all([
      db.collection('points_records')
        .where(where)
        .count(),
      db.collection('points_records')
        .where(where)
        .orderBy('createdAt', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get()
    ])

    return {
      success: true,
      data: {
        records: recordsResult.data || [],
        pagination: {
          page,
          pageSize,
          total: countResult.total || 0,
          totalPages: Math.ceil((countResult.total || 0) / pageSize)
        }
      }
    }
  } catch (err) {
    console.error('getPointsRecords failed:', err)
    return {
      success: false,
      errMsg: err.message
    }
  }
}
