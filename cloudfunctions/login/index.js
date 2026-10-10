/**
 * 用户登录云函数 - 用户认证模块
 * 
 * 上游依赖：微信云开发环境，users数据库集合
 * 入口：exports.main函数，处理用户登录请求
 * 主要功能：用户身份验证、用户信息管理、新用户创建
 * 输出：用户信息和openid，创建或更新用户数据
 * 
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */

// 云函数：login
// 用于获取用户的 openid 和管理用户信息
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

function generateUID() {
  const timestamp = Date.now().toString().slice(-6)
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return timestamp + random
}

function sanitizeInput(input) {
  if (typeof input !== 'string') return ''
  return input.replace(/[<>\"'%;()&+]/g, '').trim().slice(0, 20)
}

async function checkNicknameExists(nickname, excludeOpenid = null) {
  try {
    const whereCondition = {
      nickName: nickname
    }
    
    if (excludeOpenid) {
      whereCondition._openid = db.command.neq(excludeOpenid)
    }
    
    const result = await db.collection('users').where(whereCondition).count()
    return result.total > 0
  } catch (err) {
    console.error('检查昵称重复失败：', err)
    return false
  }
}

async function ensureCollection(collectionName) {
  try {
    await db.collection(collectionName).limit(1).get()
  } catch (err) {
    if (err.errCode === -502005) {
      try {
        await db.createCollection(collectionName)
      } catch (createErr) {
        console.error(`创建集合 ${collectionName} 失败:`, createErr.message)
      }
    } else {
      console.error(`检查集合 ${collectionName} 失败:`, err.message)
    }
  }
}

async function syncPublicProfile(userData) {
  if (!userData || !userData.uid) return
  await ensureCollection('public_profiles')
  const docId = userData.uid
  const now = new Date()

  let existing = null
  try {
    const res = await db.collection('public_profiles').doc(docId).get()
    existing = res.data
  } catch (err) {}

  const payload = {
    _id: docId,
    uid: docId,
    nickName: userData.nickName || '',
    avatarUrl: userData.avatarUrl || '',
    equippedTitleIds: Array.isArray(userData.equippedTitles) ? userData.equippedTitles : [],
    displayAchievementIds: Array.isArray(userData.displayAchievementIds) ? userData.displayAchievementIds : [],
    quizPoints: userData.quizPoints || 0,
    quizTotalAttempts: userData.quizTotalAttempts || 0,
    quizTotalCorrect: userData.quizTotalCorrect || 0,
    quizMaxCorrect: userData.quizMaxCorrect || 0,
    lastQuizAt: userData.lastQuizAt || null,
    followerCount: existing?.followerCount || 0,
    followingCount: existing?.followingCount || 0,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  }

  await db.collection('public_profiles').doc(docId).set({ data: payload })
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    const openid = wxContext.OPENID
    const rawNickname = typeof event.nickName === 'string'
      ? event.nickName
      : event.nickname
    const nickname = rawNickname ? sanitizeInput(rawNickname) : null
    const avatarUrl = event.avatarUrl || ''
    
    const userResult = await db.collection('users').where({
      _openid: openid
    }).get()
    
    let userData = null
    
    if (userResult.data.length === 0) {
      const uid = generateUID()
      const defaultNickname = nickname || `反诈先锋${uid}`
      
      if (nickname) {
        const exists = await checkNicknameExists(nickname)
        if (exists) {
          return {
            success: false,
            errMsg: '该昵称已被使用，请更换其他昵称'
          }
        }
      }
      
      const now = new Date()
      const newUser = {
        _openid: openid,
        uid: uid,
        nickName: defaultNickname,
        avatarUrl: avatarUrl,
        
        studentId: '',
        realName: '',
        schoolId: '',
        schoolName: '',
        collegeId: '',
        collegeName: '',
        majorId: '',
        majorName: '',
        grade: '',
        className: '',
        phone: '',
        
        isVerified: false,
        verifiedAt: null,
        isBound: false,
        roles: [],
        isAdmin: false,
        
        signDates: [],
        points: 0,
        achievements: [],
        titles: [],
        equippedTitles: [],
        displayAchievementIds: [],
        // 趣味答题（v3新增，答题排行榜与每日奖励）
        quizRewardDailyDate: '',
        quizRewardDailyAwarded: 0,
        quizPoints: 0,
        quizTotalAttempts: 0,
        quizTotalCorrect: 0,
        quizMaxCorrect: 0,
        lastQuizAt: null,
        continuousLearnDays: 0,
        lastLearnDate: null,
        totalReadCount: 0,
        totalChatCount: 0,
        lastChatDate: null,
        lastReadDate: null,
        createdAt: now,
        updatedAt: now
      }
      
      const addResult = await db.collection('users').add({
        data: newUser
      })
      
      userData = {
        ...newUser,
        _id: addResult._id
      }
    } else {
      userData = userResult.data[0]
      
      if (nickname || avatarUrl) {
        if (nickname && nickname !== userData.nickName) {
          const exists = await checkNicknameExists(nickname, openid)
          if (exists) {
            return {
              success: false,
              errMsg: '该昵称已被使用，请更换其他昵称'
            }
          }
        }
        
        await db.collection('users').doc(userData._id).update({
          data: {
            nickName: nickname || userData.nickName,
            avatarUrl: avatarUrl || userData.avatarUrl,
            updatedAt: new Date()
          }
        })
        
        userData.nickName = nickname || userData.nickName
        userData.avatarUrl = avatarUrl || userData.avatarUrl
      }

      // v3字段兜底：老用户缺字段时补齐（不破坏已有数据）
      const patch = {}
      if (!Array.isArray(userData.roles)) patch.roles = []
      if (typeof userData.isAdmin !== 'boolean') patch.isAdmin = false
      if (!Array.isArray(userData.displayAchievementIds)) patch.displayAchievementIds = []
      if (typeof userData.quizRewardDailyDate !== 'string') patch.quizRewardDailyDate = ''
      if (typeof userData.quizRewardDailyAwarded !== 'number') patch.quizRewardDailyAwarded = 0
      if (typeof userData.quizPoints !== 'number') patch.quizPoints = 0
      if (typeof userData.quizTotalAttempts !== 'number') patch.quizTotalAttempts = 0
      if (typeof userData.quizTotalCorrect !== 'number') patch.quizTotalCorrect = 0
      if (typeof userData.quizMaxCorrect !== 'number') patch.quizMaxCorrect = 0
      if (!Object.prototype.hasOwnProperty.call(userData, 'lastQuizAt')) patch.lastQuizAt = null
      if (Object.keys(patch).length > 0) {
        await db.collection('users').doc(userData._id).update({
          data: { ...patch, updatedAt: new Date() }
        })
        Object.assign(userData, patch)
      }
    }

    // 同步公共资料（昵称/头像/称号展示/答题积分等）
    try {
      await syncPublicProfile(userData)
    } catch (err) {
      console.warn('syncPublicProfile failed:', err.message)
    }
    
    return {
      success: true,
      data: {
        openid,
        userInfo: userData
      }
    }
  } catch (err) {
    console.error('登录失败：', err)
    return {
      success: false,
      errMsg: err.message
    }
  }
}
