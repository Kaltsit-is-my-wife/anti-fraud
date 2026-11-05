/**
 * 删除视频记录云函数 - 视频管理模块
 *
 * 上游依赖：微信云开发环境，users、videos 集合
 * 入口：exports.main
 * 主要功能：管理员删除非已发布视频的数据库记录
 * 输出：{ success: true, data: { id, removed } } 或 { success: false, errMsg }
 *
 * 边界：
 * - 仅删除 videos 集合中的文档，不删除云存储中的视频/封面文件
 * - 已发布视频必须先下线，避免用户端内容被直接移除
 *
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
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
      } catch (e) {
        // 集合创建失败时交给后续查询报错
      }
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

function normalizeText(value, maxLen = 64) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLen)
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    await Promise.all([
      ensureCollection('users'),
      ensureCollection('videos')
    ])

    const user = await getCurrentUser(openid)
    if (!hasAdminAccess(user)) {
      return { success: false, errMsg: '无管理权限' }
    }

    const id = normalizeText(event?.id)
    if (!id) {
      return { success: false, errMsg: '视频ID不能为空' }
    }

    const videoRes = await db.collection('videos').where({ _id: id }).limit(1).get()
    const video = videoRes.data && videoRes.data[0]
    if (!video) {
      return { success: false, errMsg: '视频不存在或已删除' }
    }

    if (video.status === 'published') {
      return { success: false, errMsg: '已发布视频不能删除，请先下线' }
    }

    const removeRes = await db.collection('videos').doc(id).remove()
    const removed = removeRes.stats?.removed || 0
    if (!removed) {
      return { success: false, errMsg: '视频不存在或已删除' }
    }

    console.log('deleteVideo:', { id, status: video.status })

    return {
      success: true,
      data: { id, removed }
    }
  } catch (err) {
    console.error('deleteVideo failed:', err)
    return { success: false, errMsg: err.message }
  }
}
