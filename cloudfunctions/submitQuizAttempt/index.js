/**
 * 提交趣味答题云函数 - 趣味答题模块 (v3)
 *
 * 上游依赖：users, quiz_questions, quiz_attempts, public_profiles, points_records
 * 入口：exports.main
 * 主要功能：服务端判分；累计排行榜积分 quizPoints；按北京时间每日上限30发放商城积分；写入答题记录与积分流水
 * 输出：判分结果（含解析）与本次获得积分情况
 *
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
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

function getBeijingDateStr() {
  const now = new Date()
  const beijing = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const y = beijing.getUTCFullYear()
  const m = String(beijing.getUTCMonth() + 1).padStart(2, '0')
  const d = String(beijing.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function sanitizeAnswers(arr) {
  if (!Array.isArray(arr)) return []
  return arr.map(v => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.floor(n) : -1
  })
}

function sanitizeQuestionIds(arr) {
  if (!Array.isArray(arr)) return []
  return arr.map(v => (typeof v === 'string' ? v.trim() : '')).filter(Boolean)
}

function sanitizeBankId(value) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function normalizeText(value, maxLen = 200) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLen)
}

function extractBankIds(question) {
  if (Array.isArray(question.bankIds) && question.bankIds.length > 0) {
    return Array.from(new Set(
      question.bankIds
        .map(item => normalizeText(String(item || ''), 64))
        .filter(item => item && !['default_bank', '__all__', '__unassigned__'].includes(item))
    ))
  }

  const legacyBankId = normalizeText(question.bankId, 64)
  if (legacyBankId && !['default_bank', '__all__', '__unassigned__'].includes(legacyBankId)) {
    return [legacyBankId]
  }

  return []
}

async function getCurrentUser(openid) {
  const userResult = await db.collection('users').where({ _openid: openid }).get()
  if (!userResult.data || userResult.data.length === 0) return null
  return userResult.data[0]
}

async function ensurePublicProfile(user) {
  await ensureCollection('public_profiles')
  const now = new Date()
  const uid = user.uid
  if (!uid) return null
  const docId = uid

  try {
    const existing = await db.collection('public_profiles').doc(docId).get()
    if (existing && existing.data) {
      return existing.data
    }
  } catch (err) {
    // ignore
  }

  const profile = {
    uid: uid,
    nickName: user.nickName || '',
    avatarUrl: user.avatarUrl || '',
    equippedTitleIds: Array.isArray(user.equippedTitles) ? user.equippedTitles : [],
    displayAchievementIds: Array.isArray(user.displayAchievementIds) ? user.displayAchievementIds : [],
    quizPoints: user.quizPoints || 0,
    quizTotalAttempts: user.quizTotalAttempts || 0,
    quizTotalCorrect: user.quizTotalCorrect || 0,
    quizMaxCorrect: user.quizMaxCorrect || 0,
    lastQuizAt: user.lastQuizAt || null,
    followerCount: 0,
    followingCount: 0,
    createdAt: now,
    updatedAt: now
  }

  await db.collection('public_profiles').doc(docId).set({ data: profile })
  return profile
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    await Promise.all([
      ensureCollection('quiz_questions'),
      ensureCollection('quiz_attempts'),
      ensureCollection('points_records'),
      ensureCollection('users'),
      ensureCollection('public_profiles')
    ])

    const bankId = sanitizeBankId(event?.bankId)
    const questionIds = sanitizeQuestionIds(event?.questionIds)
    const answers = sanitizeAnswers(event?.answers)

    if (questionIds.length !== answers.length || questionIds.length === 0 || questionIds.length > 20) {
      return { success: false, errMsg: '题目数量或答案数量不正确' }
    }
    if (new Set(questionIds).size !== questionIds.length) {
      return { success: false, errMsg: '题目ID重复，请重试' }
    }
    for (const a of answers) {
      if (a < 0 || a > 3) {
        return { success: false, errMsg: '答案格式不正确' }
      }
    }

    const user = await getCurrentUser(openid)
    if (!user) return { success: false, errMsg: '用户不存在，请先登录' }

    // Ensure public profile exists (best-effort)
    await ensurePublicProfile(user)

    // Load questions (include answer + explanation for judge)
    const qRes = await db.collection('quiz_questions')
      .where({ questionId: _.in(questionIds), isActive: true })
      .get()

    const qList = qRes.data || []
    if (qList.length !== questionIds.length) {
      return { success: false, errMsg: '题库数据不完整，请重试' }
    }

    if (bankId) {
      const invalidQuestion = qList.find(question => {
        const bankIds = extractBankIds(question)
        if (bankId === '__unassigned__' || bankId === 'default_bank') {
          return bankIds.length > 0
        }
        return !bankIds.includes(bankId)
      })

      if (invalidQuestion) {
        return { success: false, errMsg: '题库题目关系已变化，请重新开始答题' }
      }
    }

    const qMap = new Map(qList.map(q => [q.questionId, q]))

    let correctCount = 0
    const results = questionIds.map((qid, idx) => {
      const q = qMap.get(qid)
      const correctIndex = Number(q?.answerIndex)
      const chosen = answers[idx]
      const correct = chosen === correctIndex
      if (correct) correctCount += 1
      return {
        questionId: qid,
        correct,
        correctIndex,
        explanation: q?.explanation || ''
      }
    })

    const today = getBeijingDateStr()
    const dailyCap = 30

    const attemptDoc = {
      uid: user.uid,
      bankId: bankId || 'default_bank',
      questionIds,
      answers,
      correctCount,
      earnedQuizPoints: correctCount, // leaderboard points
      earnedMallPoints: 0,            // filled later
      createdAt: new Date()
    }

    const attemptAddRes = await db.collection('quiz_attempts').add({ data: attemptDoc })
    const attemptId = attemptAddRes?._id

    // Award points: leaderboard always +correctCount; mall points +min(correctCount, remaining<=30)
    // Use transaction if available; otherwise best-effort with compensation.
    let earnedMallPoints = 0
    let dailyAwardedAfter = 0

    const doAward = async (txDb) => {
      const col = (name) => (txDb && typeof txDb.collection === 'function' ? txDb.collection(name) : db.collection(name))

      const userDoc = await col('users').doc(user._id).get()
      const latestUser = userDoc.data

      const prevDate = latestUser.quizRewardDailyDate || ''
      const prevAwarded = Number(latestUser.quizRewardDailyAwarded) || 0
      const awardedBase = prevDate === today ? prevAwarded : 0
      const remain = Math.max(0, dailyCap - awardedBase)
      const award = Math.min(correctCount, remain)

      const quizPointsBefore = Number(latestUser.quizPoints) || 0
      const quizTotalAttemptsBefore = Number(latestUser.quizTotalAttempts) || 0
      const quizTotalCorrectBefore = Number(latestUser.quizTotalCorrect) || 0
      const quizMaxCorrectBefore = Number(latestUser.quizMaxCorrect) || 0

      const updateUser = {
        quizRewardDailyDate: today,
        quizRewardDailyAwarded: awardedBase + award,
        quizPoints: quizPointsBefore + correctCount,
        quizTotalAttempts: quizTotalAttemptsBefore + 1,
        quizTotalCorrect: quizTotalCorrectBefore + correctCount,
        quizMaxCorrect: Math.max(quizMaxCorrectBefore, correctCount),
        lastQuizAt: new Date(),
        updatedAt: new Date()
      }
      if (award > 0) {
        updateUser.points = _.inc(award)
      }

      // Update users
      await col('users').doc(user._id).update({ data: updateUser })

      // Update public profile (doc id = uid)
      if (latestUser.uid) {
        const profileDocId = latestUser.uid
        let profile = null
        try {
          const profileRes = await col('public_profiles').doc(profileDocId).get()
          profile = profileRes.data
        } catch (err) {
          // ignore
        }
        const profileMax = Math.max(Number(profile?.quizMaxCorrect) || 0, correctCount)
        const baseProfile = {
          uid: profileDocId,
          nickName: latestUser.nickName || '',
          avatarUrl: latestUser.avatarUrl || '',
          equippedTitleIds: Array.isArray(latestUser.equippedTitles) ? latestUser.equippedTitles : [],
          displayAchievementIds: Array.isArray(latestUser.displayAchievementIds) ? latestUser.displayAchievementIds : [],
          quizPoints: (Number(profile?.quizPoints) || 0) + correctCount,
          quizTotalAttempts: (Number(profile?.quizTotalAttempts) || 0) + 1,
          quizTotalCorrect: (Number(profile?.quizTotalCorrect) || 0) + correctCount,
          quizMaxCorrect: profileMax,
          lastQuizAt: new Date(),
          updatedAt: new Date()
        }

        if (profile) {
          await col('public_profiles').doc(profileDocId).update({
            data: baseProfile
          })
        } else {
          await col('public_profiles').doc(profileDocId).set({
            data: {
              followerCount: 0,
              followingCount: 0,
              createdAt: new Date(),
              ...baseProfile
            }
          })
        }
      }

      if (award > 0) {
        try {
          await col('points_records').add({
            data: {
              _openid: openid,
              userId: latestUser._id,
              uid: latestUser.uid,
              nickName: latestUser.nickName,
              type: 'earn',
              points: award,
              reason: 'Quiz reward',
              relatedId: `quiz_attempt_${attemptId || ''}`,
              createdAt: new Date()
            }
          })
        } catch (err) {
          console.warn('write points_records failed:', err.message)
        }
      }

      return {
        award,
        dailyAwardedAfter: awardedBase + award
      }
    }

    const runAward = async () => {
      if (typeof db.runTransaction === 'function') {
        // 微信云开发事务：优先使用事务对象进行读写
        return await db.runTransaction(async (transaction) => {
          const txDb = transaction || db
          return await doAward(txDb)
        })
      }
      return await doAward(db)
    }

    const aRes = await runAward()
    earnedMallPoints = aRes.award
    dailyAwardedAfter = aRes.dailyAwardedAfter

    // Backfill attempt earnedMallPoints
    try {
      if (attemptId) {
        await db.collection('quiz_attempts').doc(attemptId).update({
          data: { earnedMallPoints }
        })
      }
    } catch (err) {
      console.warn('update attempt earnedMallPoints failed:', err.message)
    }

    return {
      success: true,
      data: {
        attemptId,
        correctCount,
        earnedQuizPoints: correctCount,
        earnedMallPoints,
        dailyAwarded: dailyAwardedAfter,
        dailyCap,
        results
      }
    }
  } catch (err) {
    console.error('submitQuizAttempt failed:', err)
    return { success: false, errMsg: err.message }
  }
}
