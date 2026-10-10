const CACHE_PREFIX = 'perf_cache:'

function buildKey(key) {
  return `${CACHE_PREFIX}${key}`
}

function readCacheEntry(key) {
  try {
    const entry = wx.getStorageSync(buildKey(key))
    if (!entry || typeof entry !== 'object') return null
    if (typeof entry.updatedAt !== 'number') return null
    return entry
  } catch (err) {
    return null
  }
}

function readCacheData(key, maxAgeMs = 0) {
  const entry = readCacheEntry(key)
  if (!entry) return null

  const age = Date.now() - entry.updatedAt
  return {
    data: entry.data,
    updatedAt: entry.updatedAt,
    age,
    isFresh: maxAgeMs <= 0 || age <= maxAgeMs
  }
}

function writeCacheData(key, data) {
  try {
    wx.setStorageSync(buildKey(key), {
      data,
      updatedAt: Date.now()
    })
    return true
  } catch (err) {
    return false
  }
}

function removeCacheData(key) {
  try {
    wx.removeStorageSync(buildKey(key))
    return true
  } catch (err) {
    return false
  }
}

function shouldRefresh(key, maxAgeMs = 0) {
  if (maxAgeMs <= 0) return true
  const entry = readCacheEntry(key)
  if (!entry) return true
  return (Date.now() - entry.updatedAt) > maxAgeMs
}

module.exports = {
  readCacheData,
  writeCacheData,
  removeCacheData,
  shouldRefresh
}
