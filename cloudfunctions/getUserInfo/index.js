/**
 * Cloud function: getUserInfo.
 *
 * Sync achievements based on user stats and return user profile data.
 */

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

async function ensureCollection(collectionName) {
  try {
    await db.collection(collectionName).limit(1).get()
  } catch (err) {
    if (err.errCode === -502005) {
      console.log(`集合 ${collectionName} 不存在，尝试创建...`)
      try {
        await db.createCollection(collectionName)
        console.log(`集合 ${collectionName} 创建成功`)
      } catch (createErr) {
        console.error(`创建集合 ${collectionName} 失败:`, createErr.message)
      }
    } else {
      console.error(`检查集合 ${collectionName} 失败:`, err.message)
    }
  }
}

async function ensureAchievementsData() {
  try {
    const result = await db.collection('achievements').limit(1).get()
    if (result.data.length === 0) {
      console.log('achievements 集合为空，尝试初始化...')
      try {
        const initResult = await cloud.callFunction({
          name: 'initAchievements',
          data: {}
        })
        if (initResult.result && initResult.result.success) {
          console.log('achievements 集合初始化成功:', initResult.result.message)
        } else {
          console.warn('achievements 集合初始化失败:', initResult.result?.message || initResult.result?.errMsg)
        }
      } catch (err) {
        console.error('调用 initAchievements 云函数失败:', err.message)
      }
    }
  } catch (err) {
    console.error('检查 achievements 集合失败:', err.message)
  }
}

const formatDateLocal = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function calculateConsecutiveDays(signDates) {
  if (!Array.isArray(signDates) || signDates.length === 0) return 0

  const now = new Date()
  const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000))
  const today = formatDateLocal(beijingTime)
  const sortedDates = [...signDates].sort()

  if (!sortedDates.includes(today)) {
    const yesterdayDate = new Date(beijingTime.getTime() - 24 * 60 * 60 * 1000)
    const yesterday = formatDateLocal(yesterdayDate)
    if (!sortedDates.includes(yesterday)) {
      return 0
    }
  }

  let consecutiveDays = 0
  let checkDate = beijingTime

  while (true) {
    const dateStr = formatDateLocal(checkDate)
    if (sortedDates.includes(dateStr)) {
      consecutiveDays++
      checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000)
    } else {
      break
    }
  }

  return consecutiveDays
}

async function getRewardTitleNameMap(achievements) {
  const rewardTitleIds = [...new Set(
    achievements
      .map(item => item.rewardTitleId)
      .filter(Boolean)
  )]

  if (rewardTitleIds.length === 0) {
    return new Map()
  }

  console.log('查询称号:', rewardTitleIds)

  const titlesResult = await db.collection('titles')
    .where({ titleId: _.in(rewardTitleIds) })
    .get()

  console.log('查询到称号数量:', titlesResult.data.length)

  return new Map((titlesResult.data || []).map(title => [title.titleId, title.name]))
}

async function syncAchievements(user, stats) {
  await ensureCollection('achievements')
  await ensureAchievementsData()
  await ensureCollection('user_achievements')
  await ensureCollection('points_records')
  
  const [achievementsResult, userAchievementsResult] = await Promise.all([
    db.collection('achievements').where({ isActive: true }).get(),
    db.collection('user_achievements').where({ userId: user._id }).get()
  ])

  const allAchievements = achievementsResult.data || []
  const userAchievementRecords = userAchievementsResult.data || []
  const earnedMap = new Map(userAchievementRecords.map(item => [item.achievementId, item]))
  const userAchievementIds = Array.isArray(user.achievements) ? user.achievements : []
  const earnedAchievementIds = userAchievementRecords.map(item => item.achievementId)

  for (const achievementId of userAchievementIds) {
    if (!earnedMap.has(achievementId)) {
      earnedMap.set(achievementId, { achievementId, earnedAt: null })
    }
  }

  const rewardTitleNameMap = await getRewardTitleNameMap(allAchievements)

  const newAchievementIds = []
  const newRewardTitleIds = []
  const newAchievementRecords = []
  let rewardPoints = 0
  const basePoints = stats.points || 0

  const processAchievements = async (items) => {
    for (const achievement of items) {
      const current = stats[achievement.type] || 0
      const target = Number(achievement.target) || 0
      const unlocked = current >= target

      if (!unlocked) continue

      const achievementId = achievement.achievementId
      if (earnedMap.has(achievementId)) continue
      const pointsValue = Number(achievement.points) || 0

const earnedAt = new Date()
      const record = {
        _openid: user._openid,
        userId: user._id,
        uid: user.uid,
        nickName: user.nickName,
        achievementId: achievementId,
        achievementName: achievement.name,
        earnedAt,
        rewardTitleId: achievement.rewardTitleId || null,
        pointsEarned: pointsValue
      }

      try {
        await db.collection('user_achievements').add({ data: record })
      } catch (err) {
        console.error('添加 user_achievements 记录失败:', err.message)
      }

      earnedMap.set(achievementId, record)
      newAchievementRecords.push(record)
      newAchievementIds.push(achievementId)

      if (achievement.rewardTitleId) {
        newRewardTitleIds.push(achievement.rewardTitleId)
      }

      rewardPoints += pointsValue
    }
  }

  const pointsAchievements = []
  const otherAchievements = []

  for (const achievement of allAchievements) {
    if (achievement.type === 'points') {
      pointsAchievements.push(achievement)
    } else {
      otherAchievements.push(achievement)
    }
  }

  await processAchievements(otherAchievements)
  stats.points = basePoints + rewardPoints
  await processAchievements(pointsAchievements)
  stats.points = basePoints + rewardPoints

  const updateData = {}
  if (rewardPoints > 0) {
    updateData.points = _.inc(rewardPoints)
  }

const missingAchievementIds = earnedAchievementIds
    .filter(id => !userAchievementIds.includes(id))
  const achievementsToSync = [...new Set([...missingAchievementIds, ...newAchievementIds])]

  if (achievementsToSync.length > 0) {
    const mergedAchievements = [...new Set([...userAchievementIds, ...achievementsToSync])]
    updateData.achievements = mergedAchievements
  }

  const existingTitleIds = Array.isArray(user.titles) ? user.titles : []
  const uniqueRewardTitleIds = [...new Set(newRewardTitleIds)]
    .filter(id => !existingTitleIds.includes(id))

  if (uniqueRewardTitleIds.length > 0) {
    const mergedTitles = [...new Set([...existingTitleIds, ...uniqueRewardTitleIds])]
    updateData.titles = mergedTitles
  }

  if ((user.signDays || 0) !== stats.sign) {
    updateData.signDays = stats.sign
  }

  if (Object.keys(updateData).length > 0) {
    updateData.updatedAt = new Date()
    await db.collection('users').doc(user._id).update({ data: updateData })
  }

  if (rewardPoints > 0) {
    try {
      await db.collection('points_records').add({
        data: {
          _openid: user._openid,
          userId: user._id,
          uid: user.uid,
          nickName: user.nickName,
          type: 'earn',
          points: rewardPoints,
          reason: 'Achievement reward',
          relatedId: `achievement_${newAchievementIds.join(',')}`,
          createdAt: new Date()
        }
      })
    } catch (err) {
      console.log('Failed to write points record:', err.message)
    }
  }

const updatedUser = {
    ...user,
    points: basePoints + rewardPoints,
    totalReadCount: stats.read,
    totalChatCount: stats.chat,
    continuousLearnDays: stats.learn,
    achievements: [...new Set([...userAchievementIds, ...earnedAchievementIds, ...newAchievementIds])],
    titles: [...new Set([...existingTitleIds, ...uniqueRewardTitleIds])],
    signDays: stats.sign
  }

  const achievementList = allAchievements.map(achievement => {
    const current = stats[achievement.type] || 0
    const target = Number(achievement.target) || 0
    const pointsValue = Number(achievement.points) || 0
    const achievementId = achievement.achievementId
    const record = earnedMap.get(achievementId)
    const earned = Boolean(record)
    const unlocked = earned || current >= target
    const earnedAt = record && record.earnedAt ? new Date(record.earnedAt).getTime() : null

    return {
      id: achievementId,
      title: achievement.name,
      desc: achievement.desc,
      icon: achievement.icon,
      type: achievement.type,
      target,
      current,
      points: pointsValue,
      rewardTitleId: achievement.rewardTitleId || null,
      rewardTitleName: achievement.rewardTitleId
        ? (rewardTitleNameMap.get(achievement.rewardTitleId) || '')
        : '',
      unlocked,
      earnedAt
    }
  })

  return {
    achievementList,
    userAchievements: [...userAchievementRecords, ...newAchievementRecords],
    updatedUser
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    // Load user
    const userResult = await db.collection('users')
      .where({ _openid: openid })
      .get()

    if (userResult.data.length === 0) {
      return {
        success: false,
        errMsg: 'User not found'
      }
    }

    const user = userResult.data[0]
    const signDates = Array.isArray(user.signDates) ? user.signDates : []
    const signDays = calculateConsecutiveDays(signDates)

    const stats = {
      sign: signDays,
      read: user.totalReadCount || 0,
      chat: user.totalChatCount || 0,
      learn: user.continuousLearnDays || 0,
      points: user.points || 0,
      // 趣味答题（v3新增）
      quiz_attempts: user.quizTotalAttempts || 0,
      quiz_correct_total: user.quizTotalCorrect || 0,
      quiz_max_correct: user.quizMaxCorrect || 0,
      quiz_points: user.quizPoints || 0
    }

    const achievementSyncResult = await syncAchievements(user, stats)
    const syncedUser = achievementSyncResult.updatedUser
    const userTitles = syncedUser.titles || []
    const equippedTitleId = syncedUser.equippedTitleId || null

    return {
      success: true,
      data: {
        openid,
        userInfo: {
          _id: syncedUser._id,
          nickName: syncedUser.nickName || 'Unnamed',
          avatarUrl: syncedUser.avatarUrl || '',
          studentId: syncedUser.studentId || '',
          schoolName: syncedUser.schoolName || '',
          collegeName: syncedUser.collegeName || '',
          majorName: syncedUser.majorName || '',
          grade: syncedUser.grade || '',
          isBound: syncedUser.isBound || false,
          points: syncedUser.points || 0,
          // v3: 趣味答题与展示位
          quizPoints: syncedUser.quizPoints || 0,
          quizTotalAttempts: syncedUser.quizTotalAttempts || 0,
          quizTotalCorrect: syncedUser.quizTotalCorrect || 0,
          quizMaxCorrect: syncedUser.quizMaxCorrect || 0,
          lastQuizAt: syncedUser.lastQuizAt || null,
          quizRewardDailyDate: syncedUser.quizRewardDailyDate || '',
          quizRewardDailyAwarded: syncedUser.quizRewardDailyAwarded || 0,
          displayAchievementIds: syncedUser.displayAchievementIds || [],
          roles: syncedUser.roles || [],
          isAdmin: syncedUser.isAdmin || false,
          signDays: signDays,
          signDates: signDates,
          totalChatCount: syncedUser.totalChatCount || 0,
          totalReadCount: syncedUser.totalReadCount || 0,
          continuousLearnDays: syncedUser.continuousLearnDays || 0,
          achievements: syncedUser.achievements || [],
          titles: userTitles,
          equippedTitleId: equippedTitleId,
          createdAt: syncedUser.createdAt,
          updatedAt: syncedUser.updatedAt
        },
        achievements: achievementSyncResult.userAchievements,
        achievementList: achievementSyncResult.achievementList,
        titles: userTitles,
        equippedTitleId: equippedTitleId
      }
    }
  } catch (err) {
    console.error('getUserInfo failed:', err)
    return {
      success: false,
      errMsg: err.message || 'Failed to get user info'
    }
  }
}
