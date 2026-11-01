/**
 * 获取文章详情云函数 - 内容管理模块
 * 
 * 上游依赖：微信云开发环境，articles, users, read_records数据库集合
 * 入口：exports.main函数，处理文章详情请求
 * 主要功能：获取文章详情、增加浏览量、记录用户阅读历史、更新阅读统计
 * 输出：文章详情数据和相关文章列表
 * 
 * 重要：每当所属的代码发生变化时，必须对相应的文档进行更新操作！
 */

// 云函数：getArticleDetail
// 获取文章详情，并增加浏览量
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// CMS 约定：status = 1 草稿、status = 2 已发布
const PUBLISHED_STATUS = 2

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

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  console.log('getArticleDetail 收到的参数:', event)
  console.log('openid:', openid)
  
  try {
    const { articleId } = event
    
    if (!articleId) {
      return {
        success: false,
        errMsg: '文章ID不能为空'
      }
    }
    
    // 确保必要的集合存在
    await ensureCollection('read_records')
    await ensureCollection('points_records')
    
    // 获取文章详情（仅允许已发布文章，草稿/下架文章对用户不可见）
    const articleRes = await db.collection('articles')
      .where({
        _id: articleId,
        status: _.in(PUBLISHED_STATUS_VALUES)
      })
      .limit(1)
      .get()

    const article = articleRes.data && articleRes.data[0]
    if (!article) {
      // 文章不存在、草稿、下架统一返回结构与提示
      return {
        success: false,
        errMsg: '文章不存在或未发布'
      }
    }

    const currentViews = article.views ?? article.viewCount ?? 0
    const viewUpdate = {}
    if (Object.prototype.hasOwnProperty.call(article, 'views')) {
      viewUpdate.views = _.inc(1)
    }
    if (Object.prototype.hasOwnProperty.call(article, 'viewCount')) {
      viewUpdate.viewCount = _.inc(1)
    }
    if (Object.keys(viewUpdate).length === 0) {
      viewUpdate.views = _.inc(1)
    }
    
    // 增加浏览量
    await db.collection('articles').doc(articleId).update({
      data: viewUpdate
    })
    
    // 记录用户阅读历史
    let actionData = null
    if (openid) {
      try {
        // 查找用户ID
        const userResult = await db.collection('users').where({
          _openid: openid
        }).get()
        
        if (userResult.data.length > 0) {
          const userId = userResult.data[0]._id
          
          // 检查是否首次阅读该文章
          const existingRead = await db.collection('read_records')
            .where({
              _openid: openid,
              articleId: articleId
            })
            .count()
          
          const isFirstRead = existingRead.total === 0
          console.log('是否首次阅读该文章:', isFirstRead)
          
          // 保存阅读记录
          await db.collection('read_records').add({
            data: {
              _openid: openid,
              userId,
              articleId,
              articleTitle: article.title,
              articleCategory: article.category,
              isFirstRead,
              readAt: new Date()
            }
          })
          
          // 调用trackAction记录阅读行为，以检查阅读类成就并更新统计
          try {
            console.log('准备调用 trackAction 云函数...')
            console.log('传递的参数:', {
              openid: openid,
              action: 'read',
              increment: 1
            })
            
            const trackActionResult = await cloud.callFunction({
              name: 'trackAction',
              data: {
                openid: openid,
                action: 'read',
                increment: 1
              }
            })
           
           if (trackActionResult.result && trackActionResult.result.success) {
             actionData = trackActionResult.result.data
             console.log('trackAction 返回的数据:', actionData)
           } else {
             console.warn('trackAction 调用失败:', trackActionResult.result?.errMsg)
           }
           
           console.log('Track read action result:', trackActionResult)
         } catch (trackErr) {
           console.error('Track read action failed:', trackErr.message)
           // 不影响获取文章详情成功，继续执行
           
           // 保持原有的阅读次数更新作为备用
           await db.collection('users').doc(userId).update({
             data: {
               totalReadCount: _.inc(1)
             }
           })
         }
        }
      } catch (err) {
        console.error('记录阅读历史失败：', err)
      }
    }
    
    // 获取相关文章（仅推荐已发布文章，避免草稿出现在相关推荐）
    const relatedResult = await db.collection('articles')
      .where({
        category: article.category,
        _id: _.neq(articleId),
        status: PUBLISHED_STATUS
      })
      .limit(3)
      .get()
    
    return {
      success: true,
      data: {
        article: {
          ...article,
          status: (article.status === undefined || article.status === null) ? article.status : Number(article.status),
          views: currentViews + 1
        },
        relatedArticles: relatedResult.data,
        actionData
      }
    }
  } catch (err) {
    console.error('获取文章详情失败：', err)
    return {
      success: false,
      errMsg: err.message
    }
  }
}

