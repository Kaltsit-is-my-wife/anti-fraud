/**
 * 删除视频记录云函数 - 视频管理模块
 *
 * 上游依赖：users、videos、storage_cleanup_tasks 集合
 * 入口：exports.main({ id })
 * 主要功能：管理员删除非已发布视频的数据库记录，并把原视频/封面云存储文件登记到清理队列
 * 输出：{ success: true, data: { id, removed } } 或 { success: false, errMsg }
 *
 * 边界：
 * - 仅删除 videos 集合中的文档，不直接删除云存储文件
 * - 旧文件由 cleanupStorageFiles 在宽限期后、确认无引用时统一删除
 * - 已发布视频必须先下线，避免用户端内容被直接移除
 *
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 云函数目录独立部署，清理登记逻辑与 saveVideo 中的同名实现保持同步
const CLEANUP_TASK_COLLECTION = 'storage_cleanup_tasks'
const CLEANUP_GRACE_DAYS = Math.max(1, Math.min(Number(process.env.STORAGE_CLEANUP_GRACE_DAYS) || 7, 30))
const CLEANUP_GRACE_MS = CLEANUP_GRACE_DAYS * 24 * 60 * 60 * 1000

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

function isCloudFileId(value) {
  return typeof value === 'string' && value.startsWith('cloud://')
}

async function enqueueCleanupTask(fileId, meta) {
  if (!isCloudFileId(fileId)) return false

  const existing = await db.collection(CLEANUP_TASK_COLLECTION)
    .where({ fileId, status: 'pending' })
    .limit(1)
    .get()
  if (existing.data && existing.data.length) return false

  const now = new Date()
  await db.collection(CLEANUP_TASK_COLLECTION).add({
    data: {
      fileId,
      fileType: meta.fileType || 'unknown',
      sourceCollection: meta.sourceCollection || 'videos',
      sourceField: meta.sourceField || '',
      sourceId: meta.sourceId || '',
      reason: meta.reason || 'record_deleted',
      status: 'pending',
      attempts: 0,
      eligibleAt: new Date(now.getTime() + CLEANUP_GRACE_MS),
      createdAt: now,
      updatedAt: now
    }
  })

  return true
}

async function enqueueCleanupSafely(fileId, meta) {
  try {
    return await enqueueCleanupTask(fileId, meta)
  } catch (err) {
    // 清理任务失败不应阻断视频记录删除；文件保留在云存储中，后续可人工处理
    console.warn(`[deleteVideo] ${JSON.stringify({
      ts: new Date().toISOString(),
      level: 'WARN',
      stage: 'cleanup:enqueue-failed',
      errMsg: err && err.message
    })}`)
    return false
  }
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    await Promise.all([
      ensureCollection('users'),
      ensureCollection('videos'),
      ensureCollection(CLEANUP_TASK_COLLECTION)
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

    // 先登记旧文件，再删记录；如果删除失败，清理函数会发现文件仍被引用并跳过
    await enqueueCleanupSafely(normalizeText(video.videoUrl, 1000), {
      fileType: 'video',
      sourceCollection: 'videos',
      sourceField: 'videoUrl',
      sourceId: id,
      reason: 'record_deleted'
    })
    await enqueueCleanupSafely(normalizeText(video.coverImage, 500), {
      fileType: 'cover',
      sourceCollection: 'videos',
      sourceField: 'coverImage',
      sourceId: id,
      reason: 'record_deleted'
    })

    const removeRes = await db.collection('videos').doc(id).remove()
    const removed = removeRes.stats?.removed || 0
    if (!removed) {
      return { success: false, errMsg: '视频不存在或已删除' }
    }

    console.log(`[deleteVideo] ${JSON.stringify({
      ts: new Date().toISOString(),
      level: 'INFO',
      stage: 'delete:done',
      id,
      status: video.status
    })}`)

    return {
      success: true,
      data: { id, removed }
    }
  } catch (err) {
    console.error('deleteVideo failed:', err)
    return { success: false, errMsg: err.message }
  }
}
