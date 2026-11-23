/**
 * 保存视频云函数 - 视频管理模块
 *
 * 上游依赖：users、videos、storage_cleanup_tasks 集合
 * 入口：exports.main({ id, payload })
 * 主要功能：管理员新增/编辑视频；发布时写入 publishedAt；替换视频或封面时把旧云存储文件加入清理队列
 * 输出：{ success: true, data: { id } } 或 { success: false, errMsg }
 *
 * 边界：
 * - 不直接删除云存储文件，只登记清理任务，由 cleanupStorageFiles 统一处理
 * - 编辑已发布视频时保留原 publishedAt，避免修改标题/封面导致发布时间排序变化
 *
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 云函数目录独立部署，清理登记逻辑与 deleteVideo 中的同名实现保持同步
const CLEANUP_TASK_COLLECTION = 'storage_cleanup_tasks'
const CLEANUP_GRACE_DAYS = Math.max(1, Math.min(Number(process.env.STORAGE_CLEANUP_GRACE_DAYS) || 7, 30))
const CLEANUP_GRACE_MS = CLEANUP_GRACE_DAYS * 24 * 60 * 60 * 1000

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

function normalizeText(value, maxLen = 500) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLen)
}

function normalizeArray(value) {
  if (!Array.isArray(value)) return []
  return value.map(item => String(item || '').trim()).filter(Boolean)
}

function isCloudFileId(value) {
  return typeof value === 'string' && value.startsWith('cloud://')
}

async function getVideoById(id) {
  if (!id) return null
  const res = await db.collection('videos').where({ _id: id }).limit(1).get()
  return res.data && res.data[0]
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
      reason: meta.reason || 'replaced',
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
    // 清理任务失败不应阻断视频保存；文件保留在云存储中，后续可人工处理
    console.warn(`[saveVideo] ${JSON.stringify({
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

  if (!openid) return { success: false, errMsg: '无管理权限' }

  try {
    await Promise.all([
      ensureCollection('users'),
      ensureCollection('videos'),
      ensureCollection(CLEANUP_TASK_COLLECTION)
    ])
    const user = await getCurrentUser(openid)
    if (!hasAdminAccess(user)) return { success: false, errMsg: '无管理权限' }

    const id = normalizeText(event?.id, 64)
    const payload = event?.payload || {}
    const status = ['draft', 'published', 'offline'].includes(payload.status) ? payload.status : 'draft'
    const now = new Date()
    const existingVideo = await getVideoById(id)

    if (id && !existingVideo) return { success: false, errMsg: '视频不存在或已删除' }

    const data = {
      title: normalizeText(payload.title, 100),
      summary: normalizeText(payload.summary, 500),
      coverImage: normalizeText(payload.coverImage, 500),
      videoUrl: normalizeText(payload.videoUrl, 1000),
      duration: Math.max(0, Number(payload.duration) || 0),
      category: normalizeText(payload.category, 50),
      status,
      sort: Number(payload.sort) || 0,
      relatedArticleIds: normalizeArray(payload.relatedArticleIds),
      relatedTopicIds: normalizeArray(payload.relatedTopicIds),
      updatedAt: now
    }

    if (!data.title) return { success: false, errMsg: '标题不能为空' }
    if (!data.videoUrl) return { success: false, errMsg: '视频地址不能为空' }
    if (status === 'published') {
      // 编辑已发布视频时保留原发布时间；下线后重新发布则写入新的发布时间
      const keepPublishedAt = existingVideo &&
        existingVideo.status === 'published' &&
        existingVideo.publishedAt
      data.publishedAt = keepPublishedAt || (payload.publishedAt ? new Date(payload.publishedAt) : now)
    }

    if (id) {
      // 先登记旧文件再更新：如果更新失败，清理函数会发现文件仍被当前文档引用并跳过
      if (existingVideo) {
        const previousVideoUrl = normalizeText(existingVideo.videoUrl, 1000)
        const previousCoverImage = normalizeText(existingVideo.coverImage, 500)

        if (previousVideoUrl && previousVideoUrl !== data.videoUrl) {
          await enqueueCleanupSafely(previousVideoUrl, {
            fileType: 'video',
            sourceCollection: 'videos',
            sourceField: 'videoUrl',
            sourceId: id,
            reason: 'replaced'
          })
        }
        if (previousCoverImage && previousCoverImage !== data.coverImage) {
          await enqueueCleanupSafely(previousCoverImage, {
            fileType: 'cover',
            sourceCollection: 'videos',
            sourceField: 'coverImage',
            sourceId: id,
            reason: 'replaced'
          })
        }
      }

      await db.collection('videos').doc(id).update({ data })

      return { success: true, data: { id } }
    }

    data.createdAt = now
    const res = await db.collection('videos').add({ data })
    return { success: true, data: { id: res._id } }
  } catch (err) {
    console.error('saveVideo failed:', err)
    return { success: false, errMsg: err.message }
  }
}
