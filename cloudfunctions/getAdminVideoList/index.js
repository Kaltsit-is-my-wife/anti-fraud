/**
 * 管理端查询视频列表云函数 - 视频管理模块
 *
 * 上游依赖：users、videos 集合
 * 入口：exports.main({ page, pageSize })
 * 主要功能：管理员分页读取全部视频，按 sort 升序、更新时间倒序排列
 * 输出：{ success: true, data: { list, page, pageSize, hasMore } }
 *
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50
const MAX_PAGE = 500

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

function hasAdminAccess(user) {
  if (!user) return false
  if (user.isAdmin === true) return true
  const roles = Array.isArray(user.roles) ? user.roles : []
  return roles.includes('operator')
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
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    await Promise.all([ensureCollection('users'), ensureCollection('videos')])

    const user = await getCurrentUser(openid)
    if (!hasAdminAccess(user)) return { success: false, errMsg: '无管理权限' }

    const page = sanitizePage(event?.page)
    const pageSize = sanitizePageSize(event?.pageSize)

    const res = await db.collection('videos')
      .orderBy('sort', 'asc')
      .orderBy('updatedAt', 'desc')
      .orderBy('_id', 'asc')
      .skip((page - 1) * pageSize)
      .limit(pageSize + 1)
      .get()

    const rows = res.data || []
    const hasMore = rows.length > pageSize

    return {
      success: true,
      data: {
        list: rows.slice(0, pageSize),
        page,
        pageSize,
        hasMore
      }
    }
  } catch (err) {
    console.error('getAdminVideoList failed:', err)
    return { success: false, errMsg: err.message }
  }
}
