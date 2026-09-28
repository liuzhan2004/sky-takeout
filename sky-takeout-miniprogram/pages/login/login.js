/**
 * 登录页（pages/login/login）
 * 功能：
 * 1. 使用 wx.login 获取微信临时授权码 code；
 * 2. 调用后端 POST /user/user/login，用 code 换取 token；
 * 3. 登录成功后写入全局登录态，并按 redirect 参数回跳来源页。
 *
 * 接口来源：外卖-用户端接口.openapi.json
 * - POST /user/user/login   登录（请求体 { code }，返回 { id, openid, token }）
 */
const api = require('../../api/index')
const auth = require('../../utils/auth')

/** tabBar 页面路径集合：回跳时必须使用 switchTab，普通跳转无效 */
const TAB_PAGES = [
  '/pages/index/index',
  '/pages/menu/index',
  '/pages/cart/cart',
  '/pages/my/my'
]

Page({
  data: {
    /** 登录按钮提交状态 */
    loading: false
  },

  onLoad(options) {
    // request.js 在 401 时会追加 ?redirect=来源页，登录成功后回跳
    this.redirect = options && options.redirect ? decodeURIComponent(options.redirect) : ''
  },

  /**
   * 微信一键登录
   * wx.login 获取 code -> 后端换取 token -> 写入登录态 -> 回跳
   */
  async onLogin() {
    if (this.data.loading) {
      return
    }

    this.setData({ loading: true })

    try {
      // 1. 获取微信临时授权码
      // 注意：不传 success/fail/complete 回调时，wx.login 才返回 Promise；
      // 传了回调会走回调模式并返回 undefined，await 后解构会抛 TypeError。
      let code = ''
      try {
        const loginRes = await wx.login()
        code = loginRes && loginRes.code ? loginRes.code : ''
      } catch (e) {
        code = ''
      }

      if (!code) {
        wx.showToast({ title: '微信登录失败，请重试', icon: 'none' })
        return
      }

      // 2. 用 code 换取后端登录凭证
      const loginVO = await api.authApi.login(code)

      if (!loginVO || !loginVO.token) {
        wx.showToast({ title: '登录失败，请稍后重试', icon: 'none' })
        return
      }

      // 3. 写入全局登录态（app.js 提供的统一入口）
      const app = getApp()
      app.setLoginState({
        token: loginVO.token,
        userInfo: {
          id: loginVO.id,
          openid: loginVO.openid
        }
      })

      wx.showToast({ title: '登录成功', icon: 'success' })

      // 4. 回跳来源页
      this.navigateBackToSource()
    } catch (err) {
      // 请求层已统一 toast，这里无需重复提示
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 登录成功后的回跳逻辑：
   * - 带合法 redirect 参数：tabBar 页用 switchTab，其余页面用 reLaunch；
   * - 无 redirect 参数：默认进入首页。
   */
  navigateBackToSource() {
    const target = this.redirect || '/pages/index/index'

    const doRedirect = () => {
      if (TAB_PAGES.indexOf(target) > -1) {
        wx.switchTab({ url: target })
      } else {
        wx.reLaunch({ url: target })
      }
    }

    // 等 toast 展示完再跳转，避免提示一闪而过
    setTimeout(doRedirect, 600)
  }
})
