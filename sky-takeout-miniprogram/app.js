/**
 * app.js
 * 小程序全局入口文件：
 * 1. 维护全局变量 globalData；
 * 2. 启动时校验本地登录态，未登录则统一跳转登录页；
 * 3. 提供登录态写入/清理的全局方法，供后续页面复用。
 */
const auth = require('./utils/auth')

App({
  /**
   * 全局共享数据
   * - token：当前登录凭证（持久化副本存放在本地缓存中）
   * - userInfo：用户基础信息
   * - cartCount：购物车角标数量，登录后由购物车接口刷新
   */
  globalData: {
    token: '',
    userInfo: null,
    cartCount: 0
  },

  /**
   * 小程序启动生命周期
   * 在 onLaunch 中先做环境初始化与登录态检查。
   */
  onLaunch() {
    this.initLoginState()
  },

  /**
   * 启动时检查本地登录态
   * 说明：本地存在 token 只代表"曾登录过"，是否真正有效由接口 401 兜底；
   *       没有 token 时直接进入登录页，避免未登录用户看到受限业务数据。
   */
  initLoginState() {
    const token = auth.getToken()

    if (token) {
      // 已有登录态：同步到全局，后续页面可直接使用
      this.globalData.token = token
      return
    }

    // 无登录态：清除可能残留的本地数据并跳转登录页
    this.clearLoginState()
  },

  /**
   * 写入登录态（登录成功后由登录页调用）
   * @param {object} payload
   * @param {string} payload.token - 后端下发的登录凭证
   * @param {object} [payload.userInfo] - 后端返回的用户信息
   */
  setLoginState({ token, userInfo }) {
    auth.setToken(token)

    if (userInfo) {
      auth.setUserInfo(userInfo)
      this.globalData.userInfo = userInfo
    }

    this.globalData.token = token
  },

  /**
   * 清理登录态并跳转登录页
   * @param {boolean} [redirect=true] - 是否跳转登录页；启动初始化时传 false，仅做本地清理
   */
  clearLoginState(redirect = true) {
    auth.clearAuth()
    this.globalData.token = ''
    this.globalData.userInfo = null

    if (redirect) {
      this.navigateToLoginPage()
    }
  },

  /**
   * 跳转登录页
   * 使用 reLaunch 清空页面栈，避免登录页被业务页面压栈，保证返回键不会退回受限页面。
   */
  navigateToLoginPage() {
    // 防止多个请求同时 401 时重复触发跳转
    if (this._redirectingToLogin) {
      return
    }

    this._redirectingToLogin = true
    wx.reLaunch({
      url: auth.LOGIN_PAGE_PATH,
      complete: () => {
        this._redirectingToLogin = false
      }
    })
  }
})
