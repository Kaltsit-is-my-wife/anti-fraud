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

function getTaskTargetType(task) {
  if (typeof task?.targetType === 'string' && task.targetType) return task.targetType
  if (typeof task?.sourceType === 'string' && task.sourceType) return task.sourceType
  return ''
}

function getTargetMeta(targetType) {
  if (targetType === 'topic_comment') {
    return {
      collection: 'comments',
      submitterUidField: 'authorUid',
      submitterNameField: 'authorNickName',
      submitterAvatarField: 'authorAvatarUrl'
    }
  }

  if (targetType === 'feedback') {
    return {
      collection: 'feedback_records',
      submitterUidField: 'reporterUid',
      submitterNameField: 'reporterNickName',
      submitterAvatarField: 'reporterAvatarUrl'
    }
  }

  if (targetType === 'scam_report') {
    return {
      collection: 'scam_reports',
      submitterUidField: 'reporterUid',
      submitterNameField: 'reporterNickName',
      submitterAvatarField: 'reporterAvatarUrl'
    }
  }

  return null
}

function getSourceId(task) {
  if (typeof task?.sourceId === 'string' && task.sourceId) return task.sourceId
  if (typeof task?.targetId === 'string' && task.targetId) return task.targetId
  return ''
}

function buildSourceMeta(task, sourceRecord) {
  const sourceMeta = task && task.sourceMeta && typeof task.sourceMeta === 'object'
    ? { ...task.sourceMeta }
    : {}
  const targetType = getTaskTargetType(task)

  if (!sourceRecord) return sourceMeta

  if (targetType === 'topic_comment') {
    if (!sourceMeta.topicId && sourceRecord.targetId) sourceMeta.topicId = sourceRecord.targetId
    if (!sourceMeta.parentId && sourceRecord.parentId) sourceMeta.parentId = sourceRecord.parentId
    if (!sourceMeta.replyToUid && sourceRecord.replyToUid) sourceMeta.replyToUid = sourceRecord.replyToUid
    return sourceMeta
  }

  if (targetType === 'feedback') {
    if (!sourceMeta.contactInfo && sourceRecord.contactInfo) sourceMeta.contactInfo = sourceRecord.contactInfo
    return sourceMeta
  }

  if (targetType === 'scam_report') {
    if (!sourceMeta.type && sourceRecord.type) sourceMeta.type = sourceRecord.type
    if (!sourceMeta.channel && sourceRecord.channel) sourceMeta.channel = sourceRecord.channel
    if (!sourceMeta.scamAccount && sourceRecord.scamAccount) sourceMeta.scamAccount = sourceRecord.scamAccount
    if (!sourceMeta.scamLink && sourceRecord.scamLink) sourceMeta.scamLink = sourceRecord.scamLink
    if (!sourceMeta.imageCount && Array.isArray(sourceRecord.images)) sourceMeta.imageCount = sourceRecord.images.length
    return sourceMeta
  }

  return sourceMeta
}

async function getSourceRecordMap(tasks) {
  const idsByCollection = {}

  tasks.forEach(task => {
    const meta = getTargetMeta(getTaskTargetType(task))
    const sourceId = getSourceId(task)
    if (!meta || !sourceId) return

    if (!idsByCollection[meta.collection]) {
      idsByCollection[meta.collection] = new Set()
    }

    idsByCollection[meta.collection].add(sourceId)
  })

  const collectionNames = Object.keys(idsByCollection)
  if (!collectionNames.length) return {}

  const sourceMaps = await Promise.all(collectionNames.map(async collection => {
    const ids = Array.from(idsByCollection[collection])
    if (!ids.length) return {}

    try {
      await ensureCollection(collection)
      const res = await db.collection(collection)
        .where({ _id: _.in(ids) })
        .limit(ids.length)
        .get()

      return (res.data || []).reduce((acc, item) => {
        acc[`${collection}:${item._id}`] = item
        return acc
      }, {})
    } catch (err) {
      console.warn(`getReviewTasks load ${collection} failed:`, err)
      return {}
    }
  }))

  return sourceMaps.reduce((acc, item) => Object.assign(acc, item), {})
}

function enrichTask(task, sourceRecordMap) {
  const targetType = getTaskTargetType(task)
  const meta = getTargetMeta(targetType)
  const sourceId = getSourceId(task)
  const sourceKey = meta && sourceId ? `${meta.collection}:${sourceId}` : ''
  const sourceRecord = sourceKey ? sourceRecordMap[sourceKey] : null
  const keywordHits = Array.isArray(task.keywordHits)
    ? task.keywordHits
    : Array.isArray(task.matchedKeywords)
      ? task.matchedKeywords.map(item => {
        if (typeof item === 'string') return item
        if (item && typeof item.word === 'string') return item.word
        if (item && typeof item.keyword === 'string') return item.keyword
        return ''
      }).filter(Boolean)
      : []

  return {
    ...task,
    targetType,
    sourceId,
    sourceCollection: task.sourceCollection || (meta ? meta.collection : ''),
    submitterUid: task.submitterUid || (sourceRecord && meta ? sourceRecord[meta.submitterUidField] : '') || '',
    submitterNickName: task.submitterNickName || (sourceRecord && meta ? sourceRecord[meta.submitterNameField] : '') || '',
    submitterAvatarUrl: task.submitterAvatarUrl || (sourceRecord && meta ? sourceRecord[meta.submitterAvatarField] : '') || '',
    contentText: task.contentText || task.contentSnapshot || (sourceRecord && sourceRecord.content) || '',
    keywordHits,
    keywordHitLevel: task.keywordHitLevel || 'none',
    reviewStatus: task.reviewStatus || task.status || 'pending_review',
    reviewReason: task.reviewReason || task.reviewerRemark || '',
    reviewedBy: task.reviewedBy || task.reviewerUid || '',
    reviewedAt: task.reviewedAt || null,
    sourceMeta: buildSourceMeta(task, sourceRecord),
    sourceExists: sourceId ? Boolean(sourceRecord) : true
  }
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

    const status = typeof event?.status === 'string' ? event.status.trim() : 'pending_review'
    const targetType = typeof event?.targetType === 'string' ? event.targetType.trim() : ''
    const pageSize = Math.max(1, Math.min(Number(event?.pageSize) || 20, 50))

    let where = {}
    const hasFilter = Boolean(status || targetType)
    if (status && targetType) {
      where = _.or([
        { reviewStatus: status, targetType },
        { reviewStatus: status, sourceType: targetType },
        { status, targetType },
        { status, sourceType: targetType }
      ])
    } else if (status) {
      where = _.or([
        { reviewStatus: status },
        { status }
      ])
    } else if (targetType) {
      where = _.or([
        { targetType },
        { sourceType: targetType }
      ])
    }

    let query = db.collection('review_tasks')
    if (hasFilter) {
      query = query.where(where)
    }

    const res = await query
      .orderBy('createdAt', 'desc')
      .limit(pageSize)
      .get()

    const list = res.data || []
    const sourceRecordMap = await getSourceRecordMap(list)

    return {
      success: true,
      data: {
        list: list.map(task => enrichTask(task, sourceRecordMap))
      }
    }
  } catch (err) {
    console.error('getReviewTasks failed:', err)
    return { success: false, errMsg: err.message }
  }
}
