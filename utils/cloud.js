const { readCacheData, writeCacheData } = require('./cache')

const TEMP_URL_CACHE_TTL_MS = 30 * 60 * 1000

function normalizeMessage(err) {
  if (!err) return ''
  if (typeof err === 'string') return err
  return err.errMsg || err.message || ''
}

async function resolveCloudFileUrls(urls) {
  const fileList = [...new Set((Array.isArray(urls) ? urls : [])
    .filter(url => typeof url === 'string' && url.startsWith('cloud://')))]

  if (!fileList.length) return {}
  if (!wx.cloud || typeof wx.cloud.getTempFileURL !== 'function') return {}

  const cachedMap = {}
  const pendingFileList = []
  fileList.forEach(fileId => {
    const cached = readCacheData(`temp-url:${fileId}`, TEMP_URL_CACHE_TTL_MS)
    if (cached && cached.isFresh && cached.data) {
      cachedMap[fileId] = cached.data
      return
    }
    pendingFileList.push(fileId)
  })

  if (!pendingFileList.length) {
    return cachedMap
  }

  try {
    const res = await wx.cloud.getTempFileURL({ fileList: pendingFileList })
    const map = { ...cachedMap }
    ;(res.fileList || []).forEach(item => {
      if (item.status === 0 && item.fileID && item.tempFileURL) {
        map[item.fileID] = item.tempFileURL
        writeCacheData(`temp-url:${item.fileID}`, item.tempFileURL)
      }
    })
    return map
  } catch (err) {
    console.error('resolveCloudFileUrls failed:', err)
    return cachedMap
  }
}

function getCloudFunctionErrorMessage(err, functionName, fallback = '操作失败') {
  const message = normalizeMessage(err)
  if (!message) return fallback

  if (message.includes('FunctionName parameter could not be found') || message.includes('FUNCTION_NOT_FOUND')) {
    return functionName ? `请先部署 ${functionName} 云函数` : '请先部署缺失的云函数'
  }

  if (message.includes('无管理权限') || message.includes('无审核权限')) {
    return message
  }

  return fallback
}

module.exports = {
  resolveCloudFileUrls,
  getCloudFunctionErrorMessage
}
