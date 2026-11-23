/**
 * 云存储旧文件清理云函数 - 视频模块
 *
 * 上游依赖：storage_cleanup_tasks、videos、articles、topics、question_banks、banners、users、public_profiles、posts、scam_reports、feedback_records、products、notifications、quiz_questions、titles、achievements
 * 入口：exports.main({ dryRun, limit })
 * 主要功能：处理 storage_cleanup_tasks 中已过宽限期的文件；确认未被内容引用后调用 cloud.deleteFile
 * 输出：{ success: true, data: { dryRun, scanned, candidateCount, referencedCount, deletedCount, failedCount, missingCount, hasMore, candidateFileIds } }
 *
 * 安全边界：
 * - 默认 dryRun=true，只检查不删除；必须显式传 dryRun=false 才可能执行删除
 * - 实际删除还必须配置 STORAGE_CLEANUP_ALLOW_REAL_DELETE=true；默认关闭
 * - 小程序端存在 OPENID 时，operator 只能 dry-run，只有 isAdmin 才可能实际删除
 * - 云控制台/定时触发器没有 OPENID；默认仍为 dry-run，配置 STORAGE_CLEANUP_AUTO_DELETE=true 后才默认实际删除
 * - 任一引用查询失败时，本批次文件全部按“仍被引用”处理，宁可少删不可误删
 * - 引用查询按 100 条分批分页，超过扫描上限时按“仍被引用”保守处理
 * - 引用检查覆盖直接字段、话题内容块、文章富文本和通知 payload；实际删除仍默认关闭，需测试环境验证后再开放
 * - 不删除 HTTPS 外部地址，只处理 cloud:// 文件 ID
 *
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const TASK_COLLECTION = 'storage_cleanup_tasks'
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50
const REFERENCE_BATCH_SIZE = 100
const MAX_REFERENCE_SCAN = 10000
const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 24 * 60 * 60 * 1000
// 引用检查尚未覆盖话题正文配图和文章富文本，实际删除默认关闭
const REAL_DELETE_ENABLED = String(
  process.env.STORAGE_CLEANUP_ALLOW_REAL_DELETE || ''
).toLowerCase() === 'true'

// 新增内容形态时，必须同步补充这里的集合和字段，避免误删仍被引用的文件。
// mode 省略 = 直接字段（字符串或字符串数组）；nested = 数组元素的子字段；
// text = 富文本字符串；recursive = 对象/数组内任意字符串。
const REFERENCE_FIELDS = [
  { name: 'videos', field: 'videoUrl' },
  { name: 'videos', field: 'coverImage' },
  { name: 'articles', field: 'coverImage' },
  { name: 'articles', field: 'videoUrl' },
  { name: 'topics', field: 'coverImage' },
  { name: 'question_banks', field: 'coverImage' },
  { name: 'banners', field: 'image' },
  { name: 'users', field: 'avatarUrl' },
  { name: 'public_profiles', field: 'avatarUrl' },
  { name: 'posts', field: 'images' },
  { name: 'posts', field: 'coverImage' },
  { name: 'scam_reports', field: 'images' },
  { name: 'feedback_records', field: 'images' },
  { name: 'feedback_records', field: 'image' },
  { name: 'products', field: 'image' },
  { name: 'products', field: 'images' },
  { name: 'products', field: 'coverImage' },
  { name: 'quiz_questions', field: 'imageUrl' },
  { name: 'quiz_questions', field: 'image' },
  { name: 'titles', field: 'icon' },
  { name: 'achievements', field: 'icon' },
  { name: 'topics', field: 'contentBlocks', mode: 'nested', nestedField: 'imageUrl' },
  { name: 'articles', field: 'content', mode: 'text' },
  { name: 'notifications', field: 'payload', mode: 'recursive' }
]

function log(level, stage, detail = {}) {
  const line = `[cleanupStorageFiles] ${JSON.stringify({
    ts: new Date().toISOString(),
    level,
    stage,
    ...detail
  })}`
  if (level === 'ERROR') {
    console.error(line)
  } else if (level === 'WARN') {
    console.warn(line)
  } else {
    console.log(line)
  }
}

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

function sanitizeLimit(value) {
  const limit = Number(value)
  if (!Number.isFinite(limit)) return DEFAULT_LIMIT
  return Math.max(1, Math.min(Math.floor(limit), MAX_LIMIT))
}

function isCloudFileId(value) {
  return typeof value === 'string' && value.startsWith('cloud://')
}

function normalizeText(value, maxLen = 200) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLen)
}

function isMissingFileError(errMsg) {
  const text = String(errMsg || '').toLowerCase()
  return text.includes('not exist') ||
    text.includes('not found') ||
    text.includes('不存在')
}

async function updateTask(taskId, data) {
  try {
    await db.collection(TASK_COLLECTION).doc(taskId).update({ data })
  } catch (err) {
    log('ERROR', 'task:update-failed', { taskId, errMsg: err && err.message })
  }
}

async function markTaskFailure(task, errMsg, now) {
  const attempts = (Number(task.attempts) || 0) + 1
  const lastError = normalizeText(errMsg, 200)

  if (attempts >= MAX_ATTEMPTS) {
    await updateTask(task._id, {
      status: 'failed',
      attempts,
      lastError,
      checkedAt: now,
      updatedAt: now
    })
    return
  }

  await updateTask(task._id, {
    status: 'pending',
    attempts,
    lastError,
    eligibleAt: new Date(now.getTime() + RETRY_DELAY_MS),
    checkedAt: now,
    updatedAt: now
  })
}

function markAllReferenced(uniqueIds, referenced) {
  uniqueIds.forEach(fileId => referenced.add(fileId))
}

function collectNestedFieldValues(value, nestedField) {
  const values = []
  const walk = (node) => {
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (node && typeof node === 'object') {
      if (typeof node[nestedField] === 'string') {
        values.push(node[nestedField])
      }
      Object.keys(node).forEach(key => walk(node[key]))
    }
  }
  walk(value)
  return values
}

function collectCandidateIdsFromValue(value, idSet, referenced) {
  if (typeof value === 'string') {
    idSet.forEach(fileId => {
      if (value.includes(fileId)) referenced.add(fileId)
    })
    return
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectCandidateIdsFromValue(item, idSet, referenced))
    return
  }
  if (value && typeof value === 'object') {
    Object.keys(value).forEach(key => collectCandidateIdsFromValue(value[key], idSet, referenced))
  }
}

async function scanDirectField(config, uniqueIds, idSet, referenced) {
  let offset = 0
  let scanned = 0
  let truncated = false

  while (offset < MAX_REFERENCE_SCAN) {
    const res = await db.collection(config.name)
      .where({ [config.field]: _.in(uniqueIds) })
      .field({ [config.field]: true })
      .orderBy('_id', 'asc')
      .skip(offset)
      .limit(REFERENCE_BATCH_SIZE)
      .get()

    const docs = res.data || []
    docs.forEach(doc => {
      const value = doc[config.field]
      const values = Array.isArray(value) ? value : [value]
      values.forEach(item => {
        if (typeof item === 'string' && idSet.has(item)) {
          referenced.add(item)
        }
      })
    })

    scanned += docs.length
    if (docs.length < REFERENCE_BATCH_SIZE) break
    offset += docs.length
    if (offset >= MAX_REFERENCE_SCAN) {
      truncated = true
      break
    }
  }

  return { scanned, truncated }
}

async function scanStructuredField(config, idSet, referenced) {
  let offset = 0
  let scanned = 0
  let truncated = false

  while (offset < MAX_REFERENCE_SCAN) {
    const res = await db.collection(config.name)
      .field({ [config.field]: true })
      .orderBy('_id', 'asc')
      .skip(offset)
      .limit(REFERENCE_BATCH_SIZE)
      .get()

    const docs = res.data || []
    docs.forEach(doc => {
      const value = doc[config.field]
      if (config.mode === 'nested') {
        collectNestedFieldValues(value, config.nestedField).forEach(item => {
          if (idSet.has(item)) referenced.add(item)
        })
        return
      }
      collectCandidateIdsFromValue(value, idSet, referenced)
    })

    scanned += docs.length
    if (docs.length < REFERENCE_BATCH_SIZE) break
    offset += docs.length
    if (offset >= MAX_REFERENCE_SCAN) {
      truncated = true
      break
    }
  }

  return { scanned, truncated }
}

/**
 * 查出仍被任一内容集合引用的文件 ID。
 * 任一集合查询失败（非“集合不存在”）或扫描超限时，保守地把本批全部文件视为已引用。
 */
async function findReferencedFileIds(fileIds) {
  const referenced = new Set()
  const uniqueIds = Array.from(new Set(fileIds.filter(isCloudFileId)))
  if (!uniqueIds.length) return referenced

  const idSet = new Set(uniqueIds)

  for (const config of REFERENCE_FIELDS) {
    try {
      const { scanned, truncated } = config.mode
        ? await scanStructuredField(config, idSet, referenced)
        : await scanDirectField(config, uniqueIds, idSet, referenced)

      if (truncated) {
        // 结果超过扫描上限；无法确认时全部按已引用处理
        markAllReferenced(uniqueIds, referenced)
        log('WARN', 'references:truncated', {
          collection: config.name,
          field: config.field,
          scanned,
          maxScan: MAX_REFERENCE_SCAN
        })
      }
    } catch (err) {
      if (err && err.errCode === -502005) continue
      log('ERROR', 'references:query-failed', {
        collection: config.name,
        field: config.field,
        errMsg: err && err.message
      })
      markAllReferenced(uniqueIds, referenced)
    }
  }

  return referenced
}

function emptySummary(dryRun, hasMore) {
  return {
    dryRun,
    scanned: 0,
    candidateCount: 0,
    referencedCount: 0,
    deletedCount: 0,
    failedCount: 0,
    missingCount: 0,
    hasMore: Boolean(hasMore),
    candidateFileIds: []
  }
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  // 小程序端调用默认 dry-run；定时触发器/云控制台可通过环境变量开启自动删除
  const autoDelete = !openid &&
    String(process.env.STORAGE_CLEANUP_AUTO_DELETE || '').toLowerCase() === 'true'
  const dryRun = event?.dryRun === undefined ? !autoDelete : event.dryRun !== false
  const limit = sanitizeLimit(event?.limit)
  const now = new Date()

  try {
    await ensureCollection(TASK_COLLECTION)

    if (openid) {
      await ensureCollection('users')
      const user = await getCurrentUser(openid)
      if (!hasAdminAccess(user)) return { success: false, errMsg: '无管理权限' }
      if (!dryRun && user.isAdmin !== true) {
        return { success: false, errMsg: '仅管理员可以执行实际删除' }
      }
    }

    if (!dryRun && !REAL_DELETE_ENABLED) {
      log('WARN', 'real-delete-disabled', {
        openidPresent: Boolean(openid)
      })
      return {
        success: false,
        errMsg: '引用检查尚未覆盖全部内容，暂不支持实际删除'
      }
    }

    let taskRes
    try {
      taskRes = await db.collection(TASK_COLLECTION)
        .where({ status: 'pending', eligibleAt: _.lte(now) })
        .orderBy('createdAt', 'asc')
        .limit(limit + 1)
        .get()
    } catch (err) {
      if (err && err.errCode === -502005) {
        return { success: true, data: emptySummary(dryRun, false) }
      }
      throw err
    }

    const rows = taskRes.data || []
    const hasMore = rows.length > limit
    const tasks = rows.slice(0, limit)
    if (!tasks.length) {
      return { success: true, data: emptySummary(dryRun, false) }
    }

    const validTasks = tasks.filter(task => isCloudFileId(task.fileId))
    const invalidTasks = tasks.filter(task => !isCloudFileId(task.fileId))
    for (const task of invalidTasks) {
      await updateTask(task._id, {
        status: 'skipped_invalid',
        checkedAt: now,
        updatedAt: now
      })
    }

    const fileIds = Array.from(new Set(validTasks.map(task => task.fileId)))
    const referenced = await findReferencedFileIds(fileIds)
    const candidateIds = fileIds.filter(fileId => !referenced.has(fileId))
    const referencedCount = fileIds.filter(fileId => referenced.has(fileId)).length

    if (dryRun) {
      log('INFO', 'cleanup:dry-run', {
        scanned: tasks.length,
        candidateCount: candidateIds.length,
        referencedCount,
        hasMore
      })
      return {
        success: true,
        data: {
          dryRun: true,
          scanned: tasks.length,
          candidateCount: candidateIds.length,
          referencedCount,
          deletedCount: 0,
          failedCount: 0,
          missingCount: 0,
          hasMore,
          candidateFileIds: candidateIds.slice(0, 10)
        }
      }
    }

    // 实际执行：先处理仍被引用的任务，再统一删除候选文件
    for (const task of validTasks) {
      if (referenced.has(task.fileId)) {
        await updateTask(task._id, {
          status: 'skipped_referenced',
          checkedAt: now,
          updatedAt: now
        })
      }
    }

    let deleteResults = []
    if (candidateIds.length) {
      try {
        const deleteRes = await cloud.deleteFile({ fileList: candidateIds })
        deleteResults = deleteRes.fileList || []
      } catch (err) {
        log('ERROR', 'delete-file:failed', {
          count: candidateIds.length,
          errMsg: err && err.message
        })
        for (const task of validTasks) {
          if (candidateIds.includes(task.fileId)) {
            await markTaskFailure(task, err && err.message, now)
          }
        }
        return {
          success: false,
          errMsg: '云存储删除失败，请稍后重试',
          data: {
            dryRun: false,
            scanned: tasks.length,
            candidateCount: candidateIds.length,
            referencedCount,
            deletedCount: 0,
            failedCount: candidateIds.length,
            missingCount: 0,
            hasMore,
            candidateFileIds: []
          }
        }
      }
    }

    const resultMap = new Map(deleteResults.map(item => [item.fileID, item]))
    const deletedSet = new Set()
    const missingSet = new Set()
    const failedSet = new Set()

    for (const fileId of candidateIds) {
      const result = resultMap.get(fileId)
      if (result && result.status === 0) {
        deletedSet.add(fileId)
        continue
      }
      const errMsg = (result && result.errMsg) || 'unknown error'
      if (isMissingFileError(errMsg)) {
        missingSet.add(fileId)
      } else {
        failedSet.add(fileId)
      }
    }

    for (const task of validTasks) {
      if (!candidateIds.includes(task.fileId)) continue

      if (deletedSet.has(task.fileId)) {
        await updateTask(task._id, {
          status: 'deleted',
          checkedAt: now,
          deletedAt: now,
          updatedAt: now
        })
        continue
      }

      if (missingSet.has(task.fileId)) {
        const result = resultMap.get(task.fileId)
        await updateTask(task._id, {
          status: 'missing',
          lastError: normalizeText((result && result.errMsg) || 'file not found', 200),
          checkedAt: now,
          updatedAt: now
        })
        continue
      }

      const result = resultMap.get(task.fileId)
      await markTaskFailure(task, (result && result.errMsg) || 'unknown error', now)
    }

    const deletedCount = deletedSet.size
    const failedCount = failedSet.size
    const missingCount = missingSet.size

    log('INFO', 'cleanup:done', {
      scanned: tasks.length,
      candidateCount: candidateIds.length,
      referencedCount,
      deletedCount,
      failedCount,
      missingCount,
      hasMore
    })

    return {
      success: true,
      data: {
        dryRun: false,
        scanned: tasks.length,
        candidateCount: candidateIds.length,
        referencedCount,
        deletedCount,
        failedCount,
        missingCount,
        hasMore,
        candidateFileIds: []
      }
    }
  } catch (err) {
    log('ERROR', 'cleanup:failed', { errMsg: err && err.message })
    return { success: false, errMsg: err.message }
  }
}
