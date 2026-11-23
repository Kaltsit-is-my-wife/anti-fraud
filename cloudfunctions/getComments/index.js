/**
 * 获取评论列表云函数 - 评论模块 (v3)
 *
 * 上游依赖：comments
 * 入口：exports.main
 * 主要功能：按 targetType/targetId 拉取已通过评论（approved）和历史评论（published），按 createdAt 升序
 * 输出：comments, nextCursor
 *
 * cursor 约定：毫秒时间戳（number），表示“上一页最后一条 createdAt 的时间”
 *
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
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
      try { await db.createCollection(name) } catch (e) {}
    }
  }
}

function sanitizePageSize(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return 20
  return Math.max(10, Math.min(50, Math.floor(v)))
}

exports.main = async (event) => {
  try {
    await ensureCollection('comments')
    const targetType = event?.targetType
    const targetId = event?.targetId
    if (!['article', 'post'].includes(targetType)) return { success: false, errMsg: 'targetType不合法' }
    if (!targetId) return { success: false, errMsg: 'targetId不能为空' }

    const pageSize = sanitizePageSize(event?.pageSize)
    const cursor = event?.cursor

    const where = {
      targetType,
      targetId,
      // 文章/帖子评论审核通过后为 approved；历史评论为 published
      status: _.in(['approved', 'published'])
    }
    if (cursor) {
      where.createdAt = _.gt(new Date(Number(cursor)))
    }

    const res = await db.collection('comments')
      .where(where)
      .orderBy('createdAt', 'asc')
      .limit(pageSize)
      .get()

    const comments = res.data || []
    const last = comments[comments.length - 1]
    const nextCursor = last?.createdAt ? new Date(last.createdAt).getTime() : null

    return { success: true, data: { comments, nextCursor } }
  } catch (err) {
    console.error('getComments failed:', err)
    return { success: false, errMsg: err.message }
  }
}

