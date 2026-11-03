// utils/article-tags.js
// 文章标签（tag/tagType）枚举映射工具
//
// 背景：微信云开发 CMS 内容模型的枚举字段可能以编号落库（字符串 '1'/'2' 或数字 1/2），
// 与 CMS使用文档.md 约定的文本值（紧急预警 / danger 等）不一致。
// 前端若直接渲染数据库原始 tag 值，会看到"1"等编号，而非"紧急预警"等文本标签。
// 本工具提供防御性映射：命中编号键时转为文档约定文本/颜色值，已是文本则原样透传，
// 兼容字符串与数字两种枚举存储类型。

// tag 枚举（CMS使用文档.md「字段 2：文章标签」，按选项顺序）：
//   选项1=紧急预警 选项2=案例分析 选项3=防骗知识 选项4=知识科普 选项5=视频教程
const TAG_TEXT_MAP = {
  1: '紧急预警',
  2: '案例分析',
  3: '防骗知识',
  4: '知识科普',
  5: '视频教程'
}

// tagType 枚举（CMS使用文档.md「字段 3：标签类型」，按选项顺序）：
//   选项1=danger（红色/紧急） 选项2=warning（橙色/警示） 选项3=info（蓝色/普通）
const TAG_TYPE_MAP = {
  1: 'danger',
  2: 'warning',
  3: 'info'
}

function resolveEnum(raw, map, fallback) {
  if (raw === undefined || raw === null || raw === '') return fallback
  const key = String(raw)
  if (Object.prototype.hasOwnProperty.call(map, key)) return map[key]
  return raw
}

// 解析 tag 显示文本：编号 -> 文本；文本原样返回；空值用默认值
function resolveTag(raw, fallback = '知识科普') {
  return resolveEnum(raw, TAG_TEXT_MAP, fallback)
}

// 解析 tagType 颜色值：编号 -> danger/warning/info；文本原样返回；空值用默认值
function resolveTagType(raw, fallback = 'info') {
  return resolveEnum(raw, TAG_TYPE_MAP, fallback)
}

module.exports = {
  TAG_TEXT_MAP,
  TAG_TYPE_MAP,
  resolveTag,
  resolveTagType
}
