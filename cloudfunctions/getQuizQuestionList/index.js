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

    const bankId = typeof event?.bankId === 'string' ? event.bankId.trim() : ''
    const list = (await db.collection('quiz_questions').get()).data || []
    const filtered = list.filter(item => {
      if (item.isActive === false) return false
      if (!bankId) return true
      if (bankId === 'default_bank') return !item.bankId || item.bankId === 'default_bank'
      return String(item.bankId || '') === bankId
    })

    filtered.sort((a, b) => String(a.questionId || '').localeCompare(String(b.questionId || '')))
    return { success: true, data: { list: filtered } }
  } catch (err) {
    console.error('getQuizQuestionList failed:', err)
    return { success: false, errMsg: err.message }
  }
}
