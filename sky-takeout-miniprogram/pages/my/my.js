/**
 * 我的页（pages/my/my）
 * 功能：
 * 1. 展示当前登录用户信息（用户 id、openid 脱敏展示）；
 * 2. 提供历史订单、收货地址等业务入口；
 * 3. 退出登录（服务端登出 + 清理本地登录态）。
 *
 * 接口来源：外卖-用户端接口.openapi.json
 * - POST /user/user/logout   退出登录
 */
const api = require('../../api/index')
const auth = require('../../utils/auth')

/**
 * openid 脱敏展示：保留前 4 位与后 4 位，中间用 * 代替
 */
function maskOpenid(openid) {
  if (!openid || openid.length <= 8) {
    return openid || ''
  }

  return `${openid.slice(0, 4)}****${openid.slice(-4)}`
}

Page({
  data: {
    /** 是否已登录 */
    loggedIn: false,

    /** 用户 id（后端 UserLoginVO.id） */
    userId: '',

    /** 脱敏后的 openid */
    openidText: '',

    /** 功能入口配置（渲染用，不参与业务逻辑） */
    menus: [
      { key: 'order', name: '历史订单', icon: '📋' },
      { key: 'address', name: '收货地址', icon: '📍' },
      { key: 'about', name: '关于吃了么', icon: 'ℹ️' }
    ]
  },

  onShow() {
    this.refreshUserInfo()
  },

  /**
   * 从本地缓存读取登录用户信息并刷新视图
   * 登录页写入、401 清理后回到本页时，均能拿到最新状态
   */
  refreshUserInfo() {
    const userInfo = auth.getUserInfo()

    this.setData({
      loggedIn: auth.isLoggedIn(),
      userId: userInfo && userInfo.id !== undefined ? String(userInfo.id) : '',
      openidText: maskOpenid(userInfo ? userInfo.openid : '')
    })
  },

  /**
   * 功能入口点击分发
   */
  onMenuTap(event) {
    const key = event.currentTarget.dataset.key

    switch (key) {
      case 'order':
        wx.navigateTo({ url: '/pages/order/list' })
        break
      case 'address':
        wx.navigateTo({ url: '/pages/address/list' })
        break
      case 'about':
        wx.showModal({
          title: '关于苍穹外卖',
          content: '苍穹外卖用户端小程序\n基于微信小程序 + Spring Boot 前后端分离架构',
          showCancel: false,
          confirmColor: '#ff8c00'
        })
        break
      default:
        break
    }
  },

  /**
   * 未登录时引导去登录
   */
  onGoLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  /**
   * 退出登录（二次确认）
   * 先调服务端登出接口（失败不阻塞本地清理），再清理本地登录态并回登录页
   */
  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      confirmColor: '#ff8c00',
      success: async (res) => {
        if (!res.confirm) {
          return
        }

        try {
          // 服务端登出失败（如 token 已过期）不阻塞本地清理
          await api.authApi.logout().catch(() => {})
        } finally {
          const app = getApp()
          app.clearLoginState()
          wx.showToast({ title: '已退出登录', icon: 'success' })
        }
      }
    })
  }
})
