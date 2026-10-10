const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
exports.main = async () => {
  const now = new Date()
  const existing = await db.collection('question_banks').where({ name: '大学生反诈基础题库' }).limit(1).get()
  let bankId = existing.data?.[0]?._id
  let inserted = false
  if (!bankId) {
    const res = await db.collection('question_banks').add({ data: { name: '大学生反诈基础题库', summary: '覆盖刷单、冒充客服、网络贷款、公检法诈骗等大学生常见反诈知识。', status: 'published', sort: 1, defaultQuestionCount: 10, createdAt: now, updatedAt: now } })
    bankId = res._id
    inserted = true
  }
  const questions = await db.collection('quiz_questions').where({ isActive: true }).get()
  let linked = 0
  for (const question of questions.data || []) {
    const ids = Array.isArray(question.bankIds) ? question.bankIds : []
    if (ids.length === 0 || question.bankId === 'default_bank') {
      await db.collection('quiz_questions').doc(question._id).update({ data: { bankIds: [bankId], bankId, updatedAt: now } })
      linked++
    }
  }
  return { success: true, data: { id: bankId, inserted, linked }, message: `默认题库处理完成，${inserted ? '已创建' : '已存在'}，关联 ${linked} 道题` }
}
