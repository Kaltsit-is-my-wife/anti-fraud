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

function buildTextContentBlocks(contentText) {
  const paragraphs = contentText
    .split(/\n{2,}/)
    .map(item => normalizeText(item, 1000))
    .filter(Boolean)

  return paragraphs.map((text, index) => ({
    id: `blk_text_${index + 1}`,
    type: 'text',
    text,
    sort: index + 1
  }))
}

function keepNonTextBlocks(blocks) {
  if (!Array.isArray(blocks)) return []
  return blocks.filter(block => block && !['text', 'paragraph'].includes(block.type))
}

async function getExistingTopic(id) {
  if (!id) return null
  const res = await db.collection('topics').where({ _id: id }).limit(1).get()
  return res.data && res.data[0]
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    await Promise.all([ensureCollection('users'), ensureCollection('topics')])
    const user = await getCurrentUser(openid)
    if (!hasAdminAccess(user)) return { success: false, errMsg: '无管理权限' }

    const id = normalizeText(event?.id, 64)
    const payload = event?.payload || {}
    const status = ['draft', 'published', 'offline'].includes(payload.status) ? payload.status : 'draft'
    const contentText = normalizeText(payload.contentText, 3000)
    const now = new Date()
    const existingTopic = await getExistingTopic(id)
    if (id && !existingTopic) return { success: false, errMsg: '话题不存在' }

    const textBlocks = buildTextContentBlocks(contentText)
    const preservedBlocks = keepNonTextBlocks(existingTopic?.contentBlocks)
      .map((block, index) => ({
        ...block,
        sort: textBlocks.length + index + 1
      }))

    const data = {
      title: normalizeText(payload.title, 100),
      summary: normalizeText(payload.summary, 300),
      coverImage: normalizeText(payload.coverImage, 500),
      status,
      sort: Number(payload.sort) || 0,
      startAt: payload.startAt ? new Date(payload.startAt) : null,
      endAt: payload.endAt ? new Date(payload.endAt) : null,
      relatedArticleIds: normalizeArray(payload.relatedArticleIds),
      relatedVideoIds: normalizeArray(payload.relatedVideoIds),
      contentBlocks: [...textBlocks, ...preservedBlocks],
      updatedAt: now
    }

    if (!data.title) return { success: false, errMsg: '标题不能为空' }
    if (status === 'published') {
      data.publishedAt = payload.publishedAt
        ? new Date(payload.publishedAt)
        : (existingTopic?.publishedAt || now)
    } else if (existingTopic?.publishedAt) {
      data.publishedAt = existingTopic.publishedAt
    }

    if (id) {
      await db.collection('topics').doc(id).update({ data })
      return { success: true, data: { id } }
    }

    data.createdAt = now
    const res = await db.collection('topics').add({ data })
    return { success: true, data: { id: res._id } }
  } catch (err) {
    console.error('saveTopic failed:', err)
    return { success: false, errMsg: err.message }
  }
}
