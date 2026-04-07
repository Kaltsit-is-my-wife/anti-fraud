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

function normalizeAction(action) {
  if (action === 'approve') return 'approved'
  if (action === 'reject') return 'rejected'
  if (action === 'hide') return 'hidden'
  return ''
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

    const taskRes = await db.collection('review_tasks').where({ _id: taskId }).limit(1).get()
    const task = taskRes.data && taskRes.data[0]
    if (!task) return { success: false, errMsg: '审核任务不存在' }

    const meta = getTargetMeta(task.targetType)
    if (!meta) return { success: false, errMsg: '暂不支持该审核类型' }

    await ensureCollection(meta.collection)

    if (task.targetId) {
      await db.collection(meta.collection).doc(task.targetId).update({
        data: {
          [meta.statusField]: action,
          updatedAt: new Date()
        }
      })
    }

    await db.collection('review_tasks').doc(taskId).update({
      data: {
        reviewStatus: action,
        reviewReason: remark,
        reviewedBy: user.uid || user.nickName || openid,
        reviewedAt: new Date()
      }
    })

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
