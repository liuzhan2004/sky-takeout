/**
 * utils/auth.js
 * 登录态本地缓存管理：token、用户信息的统一读写入口。
 * 页面与请求层只依赖本模块，不直接散落缓存 key。
 */

/** token 在本地缓存中的存储 key */
const TOKEN_STORAGE_KEY = 'token'

/** 用户信息在本地缓存中的存储 key */
const USER_INFO_STORAGE_KEY = 'userInfo'

/** 登录页路由，供 app.js 与 request.js 统一跳转使用 */
const LOGIN_PAGE_PATH = '/pages/login/login'

/**
 * 获取本地 token
 * @returns {string} 未登录时返回空字符串
 */
function getToken() {
  return wx.getStorageSync(TOKEN_STORAGE_KEY) || ''
}

/**
 * 写入 token
 * @param {string} token - 后端下发的登录凭证
 */
function setToken(token) {
  if (!token) {
    return
  }
  wx.setStorageSync(TOKEN_STORAGE_KEY, token)
}

/**
 * 获取本地缓存的用户信息
 * @returns {object|null}
 */
function getUserInfo() {
  const userInfo = wx.getStorageSync(USER_INFO_STORAGE_KEY)
  return userInfo || null
}

/**
 * 写入用户信息
 * @param {object} userInfo
 */
function setUserInfo(userInfo) {
  if (!userInfo) {
    return
  }
  wx.setStorageSync(USER_INFO_STORAGE_KEY, userInfo)
}

/**
 * 判断当前是否已登录
 * 以本地 token 是否存在为判断依据
 * @returns {boolean}
 */
function isLoggedIn() {
  return !!getToken()
}

/**
 * 清理登录相关缓存
 * 在退出登录、401 失效等场景统一调用
 */
function clearAuth() {
  wx.removeStorageSync(TOKEN_STORAGE_KEY)
  wx.removeStorageSync(USER_INFO_STORAGE_KEY)
}

module.exports = {
  TOKEN_STORAGE_KEY,
  USER_INFO_STORAGE_KEY,
  LOGIN_PAGE_PATH,
  getToken,
  setToken,
  getUserInfo,
  setUserInfo,
  isLoggedIn,
  clearAuth
}
