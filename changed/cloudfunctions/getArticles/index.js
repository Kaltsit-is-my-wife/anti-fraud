/**
 * 获取文章列表云函数 - 内容管理模块
 * 
 * 上游依赖：微信云开发环境，articles数据库集合
 * 入口：exports.main函数，处理文章列表请求
 * 主要功能：文章列表获取、分类筛选、分页、关键词搜索
 * 输出：文章列表数据，包含总数和分页信息
 * 
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */

// 云函数：getArticles
// 获取文章列表，支持分类筛选、分页、搜索
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// CMS 约定：status = 1 草稿、status = 2 已发布
const PUBLISHED_STATUS = 2
// 兼容存储类型：微信云开发 CMS 控制台枚举可能以字符串（'2'）落库，旧数据可能为数字（2）。
// 查询与返回统一兼容两种类型，避免已发布文章（字符串 '2'）被数字 2 匹配不到而全部消失
const PUBLISHED_STATUS_VALUES = [PUBLISHED_STATUS, String(PUBLISHED_STATUS)]

exports.main = async (event, context) => {
  try {
    const {
      category = '全部',  // 分类
      page = 1,           // 页码
      pageSize = 10,      // 每页数量
      keyword = ''        // 搜索关键词
    } = event

    console.log('========== getArticles 云函数调用 ==========')
    console.log('接收参数：', JSON.stringify({ category, page, pageSize, keyword }))
    console.log('category 类型：', typeof category)
    console.log('category 长度：', category.length)
    console.log('category 字节码：', Array.from(category).map(c => c.charCodeAt(0)))

    // 构建查询条件
    let query = {}

    // 只返回已发布文章，草稿（status=1）与下架文章对用户不可见
    // 兼容数字 2 与字符串 '2' 两种存储类型
    query.status = _.in(PUBLISHED_STATUS_VALUES)

    // 分类筛选 - 去除前后空格，确保精确匹配
    const trimmedCategory = category ? category.trim() : '全部'
    if (trimmedCategory && trimmedCategory !== '全部') {
      query.category = trimmedCategory
      console.log('添加分类筛选：', trimmedCategory)
      console.log('筛选条件字节码：', Array.from(trimmedCategory).map(c => c.charCodeAt(0)))
    }

    // 关键词搜索
    if (keyword) {
      query.title = db.RegExp({
        regexp: keyword,
        options: 'i'  // 不区分大小写
      })
      console.log('添加关键词搜索：', keyword)
    }

    console.log('最终查询条件：', JSON.stringify(query))

    // 先查询总数，用于调试
    const countResult = await db.collection('articles')
      .where(query)
      .count()

    console.log(`数据库查询总数：${countResult.total} 篇`)

    // 如果总数为0，尝试查询该分类的所有文章（调试用）
    if (countResult.total === 0 && trimmedCategory !== '全部') {
      console.log('⚠️ 该分类下没有文章，开始调试...')
      
      // 查询所有已发布文章的分类字段（调试兜底同样只统计已发布文章）
      const allArticles = await db.collection('articles')
        .where({ status: PUBLISHED_STATUS })
        .field({ category: true, title: true })
        .limit(100)
        .get()
      
      console.log(`数据库中共有 ${allArticles.data.length} 篇文章`)
      
      // 统计各分类的文章数量
      const categoryCount = {}
      allArticles.data.forEach(article => {
        const cat = article.category || '(无分类)'
        categoryCount[cat] = (categoryCount[cat] || 0) + 1
      })
      
      console.log('各分类文章数量统计：', JSON.stringify(categoryCount, null, 2))
      
      // 查找与目标分类相似的分类
      const similarCategories = Object.keys(categoryCount).filter(cat => {
        return cat.includes(trimmedCategory) || trimmedCategory.includes(cat)
      })
      
      if (similarCategories.length > 0) {
        console.log('⚠️ 发现相似分类：', similarCategories)
        console.log('可能原因：分类名称不完全匹配')
      }
    }

    // 查询文章列表（使用 timestamp 或 publishTime 排序）
    const result = await db.collection('articles')
      .where(query)
      .orderBy('timestamp', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    console.log(`查询结果：返回 ${result.data.length} 篇文章`)

    // 兼容转换：把 status 统一规范化为数字（字符串 '2' -> 2），
    // 确保返回给客户端的每篇文章 status 字段值可靠，客户端过滤逻辑（=== 2）可正常生效
    result.data.forEach(article => {
      if (article.status !== undefined && article.status !== null) {
        article.status = Number(article.status)
      }
    })

    if (result.data.length > 0) {
      console.log('返回文章示例：')
      result.data.slice(0, 3).forEach((article, index) => {
        console.log(`  ${index + 1}. ${article.title}`)
        console.log(`     category: "${article.category || '(无)'}"`)
        console.log(`     tag: "${article.tag || '(无)'}"`)
      })
    }

    console.log('==========================================')

    return {
      success: true,
      data: {
        list: result.data,
        total: countResult.total,
        page,
        pageSize,
        hasMore: page * pageSize < countResult.total
      }
    }
  } catch (err) {
    console.error('========== 获取文章列表失败 ==========')
    console.error('错误类型：', err.name)
    console.error('错误消息：', err.message)
    console.error('错误堆栈：', err.stack)
    console.error('==========================================')
    
    return {
      success: false,
      errMsg: err.message
    }
  }
}

