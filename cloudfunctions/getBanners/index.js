/**
 * 获取首页 Banner - 内容展示模块 (v1)
 *
 * 上游依赖：云数据库 banners 集合（由 CMS 维护）
 * 入口：exports.main
 * 主要功能：查询启用状态的 Banner，按 sort 升序返回展示字段
 * 输出：{ success: true, data: { list, total, emptyReason } }
 *
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

const COLLECTION_NAME = 'banners'
// 云数据库单次 get 的最大条数是 100，首页轮播不需要分页
const MAX_BANNERS = 100
// 集合不存在时云数据库返回的错误码
const COLLECTION_NOT_EXIST_CODE = -502005

function toTimestamp(value) {
  if (!value) return 0
  const date = value instanceof Date ? value : new Date(value)
  const time = date.getTime()
  return Number.isNaN(time) ? 0 : time
}

function toText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function toSortValue(value) {
  const sort = Number(value)
  return Number.isFinite(sort) ? sort : 0
}

/**
 * 只有 status 严格等于 true 的 Banner 才对用户可见，避免把草稿/下架数据带出去
 */
function isEnabled(banner) {
  return !!banner && banner.status === true
}

/**
 * sort 升序；sort 相同时按更新时间、创建时间倒序
 */
function compareBanner(a, b) {
  const sortDiff = toSortValue(a.sort) - toSortValue(b.sort)
  if (sortDiff !== 0) return sortDiff

  const timeA = toTimestamp(a.updatedAt || a.createdAt)
  const timeB = toTimestamp(b.updatedAt || b.createdAt)
  return timeB - timeA
}

/**
 * 只返回展示需要的字段，不把 CMS 内部字段透给用户侧
 */
function pickBanner(banner, index) {
  return {
    _id: banner._id || `banner-${index}`,
    title: toText(banner.title),
    desc: toText(banner.desc),
    icon: toText(banner.icon),
    // 图片可能是 cloud:// 文件 ID 或 HTTPS 地址，仍交由小程序端转换
    image: toText(banner.image),
    bgColor: toText(banner.bgColor),
    link: toText(banner.link),
    sort: toSortValue(banner.sort)
  }
}

exports.main = async () => {
  try {
    const result = await db.collection(COLLECTION_NAME)
      .where({ status: true })
      .limit(MAX_BANNERS)
      .get()

    const list = (result.data || [])
      .filter(isEnabled)
      .sort(compareBanner)
      .map(pickBanner)

    return {
      success: true,
      data: {
        list,
        total: list.length,
        // 空列表是正常结果，但仍给出可识别的原因，便于首页区分空态
        emptyReason: list.length ? '' : 'no_enabled_banner'
      }
    }
  } catch (err) {
    console.error('getBanners failed:', err)

    // 集合尚未创建属于“空集合”场景，不应当被当成故障，也不用让首页降级
    if (err && err.errCode === COLLECTION_NOT_EXIST_CODE) {
      return {
        success: true,
        data: {
          list: [],
          total: 0,
          emptyReason: 'collection_not_exist'
        }
      }
    }

    return {
      success: false,
      errCode: 'BANNERS_QUERY_FAILED',
      errMsg: '轮播图加载失败'
    }
  }
}
