/**
 * 首页（pages/index/index）
 * 功能：
 * 1. 展示店铺营业状态（营业中 / 已打烊）；
 * 2. 提供点餐、购物车等业务入口；
 * 3. 下拉刷新可重新获取营业状态。
 *
 * 接口来源：外卖-用户端接口.openapi.json
 * - GET /user/shop/status   获取营业状态（1 营业，0 打烊）
 */
const api = require('../../api/index')

Page({
  data: {
    /** 店铺营业状态：1 营业中，0 打烊；未知时为 -1 */
    shopStatus: -1,
    shopStatusText: '',
    shopStatusDesc: '',

    /** 快捷入口配置（渲染用，不参与业务逻辑） */
    entries: [
      { key: 'menu', name: '去点餐', desc: '今日菜单', icon: '🍽' },
      { key: 'cart', name: '购物车', desc: '已选商品', icon: '🛒' },
      { key: 'order', name: '历史订单', desc: '查看过往订单', icon: '📋' },
      { key: 'address', name: '收货地址', desc: '管理配送地址', icon: '📍' }
    ],

    /** 首屏加载状态 */
    pageLoading: true,

    /** 加载失败状态 */
    loadError: false
  },

  onLoad() {
    this.loadShopStatus()
  },

  /**
   * 每次进入页面刷新营业状态，从其他 Tab 返回时保持最新
   */
  onShow() {
    if (!this.data.pageLoading) {
      this.loadShopStatus()
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadShopStatus().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 加载店铺营业状态
   * 失败时展示错误态，支持重试
   */
  async loadShopStatus() {
    this.setData({ loadError: false })

    try {
      const status = await api.shopApi.getStatus()
      const open = Number(status) === 1

      this.setData({
        shopStatus: open ? 1 : 0,
        shopStatusText: open ? '营业中' : '已打烊',
        shopStatusDesc: open ? '欢迎光临，现在可以点餐啦' : '店铺休息中，营业时间再来哦',
        pageLoading: false,
        loadError: false
      })
    } catch (err) {
      // 请求层已统一 toast，这里只负责页面错误态
      this.setData({
        shopStatus: -1,
        shopStatusText: '',
        shopStatusDesc: '',
        pageLoading: false,
        loadError: true
      })
    }
  },

  /**
   * 快捷入口点击分发
   */
  onEntryTap(event) {
    const key = event.currentTarget.dataset.key

    switch (key) {
      case 'menu':
        wx.switchTab({ url: '/pages/menu/index' })
        break
      case 'cart':
        wx.switchTab({ url: '/pages/cart/cart' })
        break
      case 'order':
        wx.navigateTo({ url: '/pages/order/list' })
        break
      case 'address':
        wx.navigateTo({ url: '/pages/address/list' })
        break
      default:
        break
    }
  },

  /**
   * 加载失败重试
   */
  onRetry() {
    this.setData({ pageLoading: true })
    this.loadShopStatus()
  }
})
