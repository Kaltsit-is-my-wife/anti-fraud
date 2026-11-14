/**
 * 保存话题云函数 - 二期社区模块（成员 A：话题发布主链路）
 *
 * 上游依赖：users（权限）、topics
 * 入口：exports.main
 * 主要功能：管理员/运营创建或编辑话题，支持草稿 / 发布 / 下线
 * 入参：{ id, payload: { title, summary, contentText, contentImages, coverImage, status, sort, startAt, endAt, relatedArticleIds, relatedVideoIds } }
 *   - contentText 按空行拆分为 text 内容块
 *   - contentImages 为正文配图数组 [{ imageUrl, caption }]，最多 9 张；为空数组表示清空配图，缺省表示沿用库内已有配图
 * 输出：{ success, data: { id } }
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

const LOG_MODULE = '[saveTopic]'

/**
 * 统一日志：按 CLAUDE.md「调试日志规范」输出单行 JSON。
 * 云函数目录独立部署，无法跨目录 require utils/logger.js，因此在本文件内实现同名 log()。
 */
function log(level, stage, detail = {}) {
  const safeLevel = ['INFO', 'WARN', 'ERROR'].includes(level) ? level : 'INFO'
  const line = `${LOG_MODULE} ${JSON.stringify({ ...detail, ts: new Date().toISOString(), level: safeLevel, stage })}`
  if (safeLevel === 'ERROR') console.error(line)
  else if (safeLevel === 'WARN') console.warn(line)
  else console.log(line)
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

const MAX_CONTENT_IMAGES = 9
const KNOWN_BLOCK_TYPES = ['text', 'paragraph', 'image', 'article_link', 'video_link']

function normalizeImageBlocks(value) {
  if (!Array.isArray(value)) return null
  return value
    .slice(0, MAX_CONTENT_IMAGES)
    .map(item => ({
      imageUrl: normalizeText(item?.imageUrl, 500),
      caption: normalizeText(item?.caption, 100)
    }))
    .filter(item => item.imageUrl)
}

function buildImageContentBlocks(images) {
  return images.map((image, index) => ({
    id: `blk_image_${index + 1}`,
    type: 'image',
    imageUrl: image.imageUrl,
    caption: image.caption,
    sort: index + 1
  }))
}

function pickBlocksByType(blocks, types) {
  if (!Array.isArray(blocks)) return []
  return blocks.filter(block => block && types.includes(block.type))
}

function keepUnknownBlocks(blocks) {
  if (!Array.isArray(blocks)) return []
  return blocks.filter(block => block && !KNOWN_BLOCK_TYPES.includes(block.type))
}

function buildContentBlocks(contentText, imageBlocksInput, existingTopic) {
  const existingBlocks = Array.isArray(existingTopic?.contentBlocks) ? existingTopic.contentBlocks : []
  const textBlocks = buildTextContentBlocks(contentText)

  // payload 未携带 contentImages（旧版调用方）时沿用库内已有配图；携带时以本次提交为准
  const imageBlocks = imageBlocksInput === null
    ? pickBlocksByType(existingBlocks, ['image'])
    : buildImageContentBlocks(imageBlocksInput)

  const articleLinkBlocks = pickBlocksByType(existingBlocks, ['article_link'])
  const videoLinkBlocks = pickBlocksByType(existingBlocks, ['video_link'])
  const unknownBlocks = keepUnknownBlocks(existingBlocks)

  return [...textBlocks, ...imageBlocks, ...articleLinkBlocks, ...videoLinkBlocks, ...unknownBlocks]
    .map((block, index) => ({
      ...block,
      sort: index + 1
    }))
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
    const contentImages = normalizeImageBlocks(payload.contentImages)
    const now = new Date()
    const existingTopic = await getExistingTopic(id)
    if (id && !existingTopic) return { success: false, errMsg: '话题不存在' }

    const contentBlocks = buildContentBlocks(contentText, contentImages, existingTopic)

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
      contentBlocks,
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
    log('ERROR', 'save:failed', { msg: err && err.message })
    return { success: false, errMsg: err.message }
  }
}
