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

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    await Promise.all([ensureCollection('users'), ensureCollection('quiz_questions')])
    const user = await getCurrentUser(openid)
    if (!hasAdminAccess(user)) return { success: false, errMsg: '无管理权限' }

    const id = typeof event?.id === 'string' ? event.id.trim() : ''
    if (!id) return { success: false, errMsg: '题目ID不能为空' }

    await db.collection('quiz_questions').doc(id).update({
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    })

    return { success: true, data: { id } }
  } catch (err) {
    console.error('deleteQuizQuestion failed:', err)
    return { success: false, errMsg: err.message }
  }
}
