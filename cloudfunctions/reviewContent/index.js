const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

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

function hasReviewPermission(user) {
  if (!user) return false
  if (user.isAdmin === true) return true
  const roles = Array.isArray(user.roles) ? user.roles : []
  return roles.includes('reviewer') || roles.includes('operator')
}

function getTargetMeta(targetType) {
  if (targetType === 'topic_comment') return { collection: 'comments', statusField: 'status' }
  if (targetType === 'feedback') return { collection: 'feedback_records', statusField: 'status' }
  if (targetType === 'scam_report') return { collection: 'scam_reports', statusField: 'status' }
  return null
}

function getTaskTargetType(task) {
  if (typeof task?.targetType === 'string' && task.targetType) return task.targetType
  if (typeof task?.sourceType === 'string' && task.sourceType) return task.sourceType
  return ''
}

function normalizeAction(action) {
  if (action === 'approve') return 'approved'
  if (action === 'reject') return 'rejected'
  if (action === 'hide') return 'hidden'
  return ''
}

function getSourceId(task) {
  if (typeof task?.sourceId === 'string' && task.sourceId) return task.sourceId
  if (typeof task?.targetId === 'string' && task.targetId) return task.targetId
  return ''
}

function getCurrentReviewStatus(task) {
  return task.reviewStatus || task.status || 'pending_review'
}

function buildTaskUpdateData(action, remark, reviewerName, reviewerUid, now) {
  return {
    reviewStatus: action,
    status: action,
    reviewReason: remark,
    reviewerRemark: remark,
    reviewedBy: reviewerName,
    reviewerUid,
    reviewedAt: now,
    updatedAt: now
  }
}

function buildSourceUpdateData(meta, taskId, action, remark, reviewerName, reviewerUid, now) {
  return {
    [meta.statusField]: action,
    reviewTaskId: taskId,
    reviewReason: remark,
    reviewerRemark: remark,
    reviewedBy: reviewerName,
    reviewerUid,
    reviewedAt: now,
    updatedAt: now
  }
}

async function getSourceRecord(collection, sourceId, txDb) {
  const database = txDb || db
  const res = await database.collection(collection).where({ _id: sourceId }).limit(1).get()
  return res.data && res.data[0]
}

async function applyReviewDecision(task, meta, action, remark, reviewerName, reviewerUid, now) {
  const sourceId = getSourceId(task)
  if (!sourceId) throw new Error('审核任务缺少源记录ID')

  const taskUpdate = buildTaskUpdateData(action, remark, reviewerName, reviewerUid, now)
  const sourceUpdate = buildSourceUpdateData(meta, task._id, action, remark, reviewerName, reviewerUid, now)

  const run = async (txDb) => {
    const sourceRecord = await getSourceRecord(meta.collection, sourceId, txDb)
    if (!sourceRecord) throw new Error('原始内容不存在，无法审核')

    await txDb.collection(meta.collection).doc(sourceId).update({
      data: sourceUpdate
    })

    await txDb.collection('review_tasks').doc(task._id).update({
      data: taskUpdate
    })
  }

  if (typeof db.runTransaction === 'function') {
    await db.runTransaction(async (transaction) => {
      const txDb = transaction || db
      await run(txDb)
    })
    return
  }

  await run(db)
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    await Promise.all([ensureCollection('users'), ensureCollection('review_tasks')])
    const user = await getCurrentUser(openid)
    if (!hasReviewPermission(user)) {
      return { success: false, errMsg: '无审核权限' }
    }

    const taskId = typeof event?.taskId === 'string' ? event.taskId.trim() : ''
    const action = normalizeAction(event?.action)
    const remark = typeof event?.remark === 'string' ? event.remark.trim().slice(0, 200) : ''

    if (!taskId) return { success: false, errMsg: 'taskId不能为空' }
    if (!action) return { success: false, errMsg: 'action不合法' }
    if ((action === 'rejected' || action === 'hidden') && !remark) {
      return { success: false, errMsg: '驳回或隐藏时请填写审核说明' }
    }

    const taskRes = await db.collection('review_tasks').where({ _id: taskId }).limit(1).get()
    const task = taskRes.data && taskRes.data[0]
    if (!task) return { success: false, errMsg: '审核任务不存在' }

    const currentStatus = getCurrentReviewStatus(task)
    if (currentStatus !== 'pending_review') {
      if (currentStatus === action) {
        return {
          success: true,
          data: {
            taskId,
            status: currentStatus,
            repeated: true
          }
        }
      }
      return { success: false, errMsg: '审核任务已处理' }
    }

    const meta = getTargetMeta(getTaskTargetType(task))
    if (!meta) return { success: false, errMsg: '暂不支持该审核类型' }

    await ensureCollection(meta.collection)
    const now = new Date()
    const reviewerUid = user.uid || ''
    const reviewerName = user.nickName || reviewerUid || openid

    await applyReviewDecision(task, meta, action, remark, reviewerName, reviewerUid, now)

    return {
      success: true,
      data: {
        taskId,
        status: action
      }
    }
  } catch (err) {
    console.error('reviewContent failed:', err)
    return { success: false, errMsg: err.message }
  }
}
