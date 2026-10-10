const BUILTIN_VIDEO_ID = 'builtin-anti-fraud-video-20260411'

const BUILTIN_VIDEOS = [
  {
    _id: BUILTIN_VIDEO_ID,
    title: '反诈骗主题宣传短片',
    summary: '通过情景演示快速了解常见诈骗套路，建立转账前先核验的基本意识。',
    coverImage: '',
    videoUrl: '',
    duration: 0,
    durationText: '精选短片',
    category: '反诈视频',
    publishedAt: '2026-04-11T00:00:00+08:00'
  }
]

function cloneVideo(item) {
  return item ? { ...item } : null
}

function getBuiltinVideos() {
  return BUILTIN_VIDEOS.map(cloneVideo)
}

function getBuiltinVideoById(id) {
  const target = String(id || '').trim()
  const video = BUILTIN_VIDEOS.find(item => item._id === target)
  return cloneVideo(video)
}

function mergeBuiltinVideos(list) {
  const builtin = getBuiltinVideos()
  const cloudList = Array.isArray(list) ? list : []

  if (!cloudList.length) {
    return builtin
  }

  const existingIds = new Set(cloudList.map(item => String((item && item._id) || '')))
  const existingUrls = new Set(cloudList.map(item => String((item && item.videoUrl) || '')))
  const merged = [...builtin.filter(item => !existingIds.has(item._id) && !existingUrls.has(item.videoUrl))]

  return merged.concat(cloudList.map(item => ({ ...item })))
}

module.exports = {
  BUILTIN_VIDEO_ID,
  getBuiltinVideos,
  getBuiltinVideoById,
  mergeBuiltinVideos
}
