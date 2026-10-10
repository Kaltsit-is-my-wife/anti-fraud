function normalizeUserInfo(userInfo) {
  return userInfo && typeof userInfo === 'object' ? userInfo : {}
}

function buildPermissionSnapshot(userInfo) {
  const safeUserInfo = normalizeUserInfo(userInfo)
  const roles = Array.isArray(safeUserInfo.roles)
    ? safeUserInfo.roles.filter(role => typeof role === 'string' && role)
    : []
  const isAdmin = safeUserInfo.isAdmin === true

  return {
    userInfo: safeUserInfo,
    roles,
    isAdmin,
    hasReviewAccess: isAdmin || roles.includes('reviewer') || roles.includes('operator'),
    hasAdminAccess: isAdmin || roles.includes('operator')
  }
}

function readStoredPermissionSnapshot() {
  try {
    return buildPermissionSnapshot(wx.getStorageSync('userInfo') || {})
  } catch (err) {
    console.error('readStoredPermissionSnapshot failed:', err)
    return buildPermissionSnapshot({})
  }
}

async function syncPermissionSnapshotFromCloud() {
  if (!wx.cloud || typeof wx.cloud.callFunction !== 'function') return null

  try {
    const result = await wx.cloud.callFunction({
      name: 'getUserInfo',
      data: {}
    })

    if (!(result.result && result.result.success)) {
      return null
    }

    const userInfo = result.result.data?.userInfo || {}
    try {
      wx.setStorageSync('userInfo', userInfo)
    } catch (storageErr) {
      console.warn('cache userInfo failed:', storageErr)
    }

    return buildPermissionSnapshot(userInfo)
  } catch (err) {
    console.warn('syncPermissionSnapshotFromCloud failed:', err)
    return null
  }
}

async function loadPermissionSnapshot(options = {}) {
  const preferCloud = options.preferCloud !== false
  const stored = readStoredPermissionSnapshot()

  if (!preferCloud) return stored

  const synced = await syncPermissionSnapshotFromCloud()
  return synced || stored
}

function hasScopeAccess(snapshot, scope) {
  if (scope === 'review') return snapshot.hasReviewAccess
  return snapshot.hasAdminAccess
}

function getAccessDeniedMessage(scope) {
  if (scope === 'review') return '无审核权限'
  return '无管理权限'
}

async function ensurePagePermission(page, scope, options = {}) {
  const snapshot = await loadPermissionSnapshot({ preferCloud: options.preferCloud !== false })
  const allowed = hasScopeAccess(snapshot, scope)

  if (page && typeof page.setData === 'function') {
    page.setData({
      permissionLoading: false,
      hasPageAccess: allowed,
      permissionInfo: snapshot
    })
  }

  if (allowed || options.redirect === false) {
    return { allowed, snapshot }
  }

  if (options.showToast !== false) {
    wx.showToast({
      title: getAccessDeniedMessage(scope),
      icon: 'none'
    })
  }

  setTimeout(() => {
    const redirectTo = options.redirectTo || '/pages/settings/settings'
    if (redirectTo) {
      wx.redirectTo({ url: redirectTo })
      return
    }

    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 })
      return
    }

    wx.switchTab({ url: '/pages/user/user' })
  }, options.delayMs || 300)

  return { allowed, snapshot }
}

module.exports = {
  buildPermissionSnapshot,
  loadPermissionSnapshot,
  hasScopeAccess,
  ensurePagePermission
}
