/**
 * 搜索资讯云函数 - 搜索模块 (v3)
 *
 * 上游依赖：articles
 * 入口：exports.main
 * 主要功能：按关键词搜索文章（title/tag/summary/content）
 * 输出：articles（简要字段）
 *
 * 注意：使用 RegExp 进行模糊查询，数据量大时需升级到全文检索服务
 *
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

// CMS 约定：status = 1 草稿、status = 2 已发布
const PUBLISHED_STATUS = 2

function sanitizeKeyword(s) {
  if (typeof s !== 'string') return ''
  return s.trim().slice(0, 30)
}

function sanitizeLimit(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return 20
  return Math.max(1, Math.min(50, Math.floor(v)))
}

exports.main = async (event) => {
  try {
    const keyword = sanitizeKeyword(event?.keyword)
    const limit = sanitizeLimit(event?.limit)
    if (!keyword) return { success: true, data: { articles: [] } }

    const reg = db.RegExp({ regexp: keyword, options: 'i' })

    const where = _.and([
      { status: _.in([PUBLISHED_STATUS, String(PUBLISHED_STATUS)]) },
      _.or([
        { title: reg },
        { tag: reg },
        { summary: reg },
        { content: reg }
      ])
    ])

    const res = await db.collection('articles')
      .where(where)
      .limit(limit)
      .get()

    const articles = (res.data || []).map(a => ({
      id: a._id,
      title: a.title,
      tag: a.tag || '',
      tagType: a.tagType || 'info',
      category: a.category || '',
      timestamp: a.timestamp || a.publishTime || a.createdAt || null,
      views: a.views ?? a.viewCount ?? 0
    }))

    return { success: true, data: { articles } }
  } catch (err) {
    console.error('searchArticles failed:', err)
    return { success: false, errMsg: err.message }
  }
}

