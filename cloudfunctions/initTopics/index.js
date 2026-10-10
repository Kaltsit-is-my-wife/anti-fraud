const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const topics = [
  { title: '大学生常见诈骗识别指南', summary: '了解刷单、冒充客服、虚假贷款等高发诈骗套路，提升识别和防范能力。', contentText: '本专题整理大学生群体常见诈骗类型与应对方法。遇到可疑情况时，请停止转账并通过官方渠道核实。', sort: 1 },
  { title: '兼职刷单诈骗专项提醒', summary: '警惕“先垫付、后返利”的兼职陷阱，任何刷单返利都可能是诈骗。', contentText: '正规兼职不会要求先交钱、垫资或提供验证码。发现异常请保存证据并及时报警。', sort: 2 },
  { title: '冒充公检法诈骗防范', summary: '公检法不会电话要求转账到安全账户，也不会索要短信验证码。', contentText: '遇到自称公检法的来电，请立即挂断，通过110或官方公开电话核实。', sort: 3 },
  { title: '网络交友与投资诈骗', summary: '网络交友后诱导投资、博彩或借款，通常是精心设计的骗局。', contentText: '不要向陌生平台充值投资，不要因情感关系透露银行卡和验证码。', sort: 4 },
  { title: '个人信息保护专题', summary: '保护身份证、银行卡、验证码和人脸信息，减少被精准诈骗的风险。', contentText: '不点击陌生链接，不安装陌生应用，不向任何人提供短信验证码。', sort: 5 }
]
exports.main = async () => {
  const now = new Date()
  let inserted = 0; let updated = 0
  for (const item of topics) {
    const existing = await db.collection('topics').where({ title: item.title }).limit(1).get()
    const data = { ...item, status: 'published', publishedAt: existing.data?.[0]?.publishedAt || now, startAt: null, endAt: null, contentBlocks: [{ id: 'intro', type: 'text', text: item.contentText, sort: 1 }], updatedAt: now }
    delete data.contentText
    if (existing.data?.[0]) { await db.collection('topics').doc(existing.data[0]._id).update({ data }); updated++ }
    else { await db.collection('topics').add({ data: { ...data, createdAt: now } }); inserted++ }
  }
  return { success: true, message: `话题初始化完成，新增 ${inserted} 个，更新 ${updated} 个`, data: { inserted, updated } }
}
