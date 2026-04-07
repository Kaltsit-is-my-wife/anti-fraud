/**
 * 创建社区帖子云函数 - 社区模块 (v3)
 *
 * 上游依赖：users, public_profiles, posts, follows, notifications
 * 入口：exports.main
 * 主要功能：发帖；默认进入待审核状态
 * 输出：postId, status
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
        console.error(`创建集合 ${name} 失败:`, e.message)
      }
    }
  }
}

async function getCurrentUser(openid) {
  const res = await db.collection('users').where({ _openid: openid }).get()
  return res.data && res.data[0]
}

function sanitizeText(s, maxLen) {
  if (typeof s !== 'string') return ''
  const v = s.trim()
  if (!v) return ''
  return v.slice(0, maxLen)
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const defaultStatus = 'pending_review'

  try {
    const collectionsToEnsure = [
      ensureCollection('posts'),
      ensureCollection('users'),
      ensureCollection('public_profiles')
    ]
    if (defaultStatus === 'published') {
      collectionsToEnsure.push(ensureCollection('follows'))
      collectionsToEnsure.push(ensureCollection('notifications'))
    }
    await Promise.all(collectionsToEnsure)

    const user = await getCurrentUser(openid)
    if (!user) return { success: false, errMsg: '用户不存在' }
    if (!user.uid) return { success: false, errMsg: '用户UID缺失' }

    const content = sanitizeText(event?.content, 1000)
    const images = Array.isArray(event?.images) ? event.images.slice(0, 9) : []

    if (!content && images.length === 0) {
      return { success: false, errMsg: '内容不能为空' }
    }

    const now = new Date()

    const postRes = await db.collection('posts').add({
      data: {
        authorUid: user.uid,
        authorNickName: user.nickName || '',
        authorAvatarUrl: user.avatarUrl || '',
        content,
        images,
        status: defaultStatus,
        commentCount: 0,
        likeCount: 0,
        createdAt: now,
        updatedAt: now
      }
    })

    const postId = postRes._id

    // 审核通过前不进入公开流，也不向关注者推送通知。
    if (defaultStatus === 'published') {
      try {
        const followersRes = await db.collection('follows')
          .where({ followeeUid: user.uid })
          .limit(200)
          .get()

        const followers = followersRes.data || []
        const previewText = content ? content.slice(0, 50) : '[图片]'

        for (const f of followers) {
          const toUid = f.followerUid
          if (!toUid || toUid === user.uid) continue
          await db.collection('notifications').add({
            data: {
              toUid,
              fromUid: user.uid,
              type: 'new_post',
              payload: {
                postId,
                previewText
              },
              isRead: false,
              createdAt: new Date()
            }
          })
        }
      } catch (err) {
        console.warn('notify followers failed:', err.message)
      }
    }

    return {
      success: true,
      data: {
        postId,
        status: defaultStatus,
        message: '帖子已提交审核，审核通过后会显示在社区'
      }
    }
  } catch (err) {
    console.error('createPost failed:', err)
    return { success: false, errMsg: err.message }
  }
}

