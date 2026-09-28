/**
 * 购物车页（pages/cart/cart）
 * 功能：
 * 1. 查看购物车列表，展示图片、名称、口味、单价、数量；
 * 2. 单条商品数量增减（服务端为准）；
 * 3. 清空购物车（带二次确认）；
 * 4. 底部合计栏 + 去结算入口。
 *
 * 接口来源：外卖-用户端接口.openapi.json
 * - GET    /user/shoppingCart/list    查看购物车
 * - POST   /user/shoppingCart/add    添加商品
 * - POST   /user/shoppingCart/sub    删除一个商品
 * - DELETE /user/shoppingCart/clean  清空购物车
 */
const api = require('../../api/index')
const { resolveImage } = require('../../utils/image')

/**
 * 将后端购物车条目转换为页面渲染结构
 * key 约定与点餐页保持一致：dish_{id} / setmeal_{id}，
 * 同一菜品的不同口味会生成多条记录，用 dishId + dishFlavor 唯一标识。
 */
function normalizeCartItem(item, index) {
  const unitPrice = Number(item.amount) || 0
  const number = Number(item.number) || 0

  return {
    index,
    id: Number(item.id),
    name: item.name || '',
    image: resolveImage(item.image),
    dishFlavor: item.dishFlavor || '',
    dishId: item.dishId ? Number(item.dishId) : null,
    setmealId: item.setmealId ? Number(item.setmealId) : null,
    number,
    unitPrice,
    unitPriceText: unitPrice.toFixed(2),
    subtotalText: (unitPrice * number).toFixed(2)
  }
}

/** 配送费（固定 2 元，与订单确认页、后端保持一致） */
const DELIVERY_FEE = 2

/**
 * 汇总件数与总金额（金额统一转成分计算，避免浮点误差）
 * 合计 = 商品合计 + 配送费
 */
function calcSummary(cartList) {
  let count = 0
  let totalCents = 0

  cartList.forEach((item) => {
    count += item.number
    totalCents += Math.round(item.unitPrice * item.number * 100)
  })

  return {
    cartCount: count,
    goodsAmount: (totalCents / 100).toFixed(2),
    totalPrice: ((totalCents + DELIVERY_FEE * 100) / 100).toFixed(2)
  }
}

Page({
  data: {
    /** 购物车列表 */
    cartList: [],

    /** 合计件数 */
    cartCount: 0,

    /** 合计金额（含配送费，两位小数字符串） */
    totalPrice: '0.00',

    /** 商品小计（不含配送费） */
    goodsAmount: '0.00',

    /** 配送费 */
    deliveryFee: DELIVERY_FEE,

    /** 页面加载状态 */
    pageLoading: true,

    /** 加载失败状态 */
    loadError: false
  },

  /** 页面是否已卸载，异步回调里用于防止 setData 报错 */
  _destroyed: false,

  /** 每条商品是否正在提交增减请求，防止重复点击 */
  _busyKeys: {},

  /** 是否正在加载购物车列表 */
  _loadingList: false,

  onLoad() {
    this.loadCart()
  },

  /**
   * 每次切回本 Tab 都强制重新拉取服务端最新购物车
   * （下单支付后后端已清空购物车，这里必须刷新到空列表，不能沿用旧数据）
   */
  onShow() {
    this.loadCart()
  },

  /**
   * 下拉刷新：重新拉取服务端最新购物车
   */
  async onPullDownRefresh() {
    this._pullRefreshing = true
    await this.loadCart()
    if (this._pullRefreshing) {
      this._pullRefreshing = false
      wx.stopPullDownRefresh()
    }
  },

  onUnload() {
    this._destroyed = true
  },

  /**
   * 加载购物车列表
   */
  async loadCart() {
    if (this._loadingList) {
      return
    }

    this._loadingList = true
    this.setData({ loadError: false })

    try {
      const list = await api.cartApi.list()

      if (this._destroyed) {
        return
      }

      const cartList = (list || []).map(normalizeCartItem)
      const summary = calcSummary(cartList)

      this.setData({
        cartList,
        cartCount: summary.cartCount,
        goodsAmount: summary.goodsAmount,
        totalPrice: summary.totalPrice,
        pageLoading: false,
        loadError: false
      })
    } catch (err) {
      // 请求层已统一 toast，这里只负责页面错误态
      if (!this._destroyed) {
        this.setData({
          cartList: [],
          cartCount: 0,
          goodsAmount: '0.00',
          totalPrice: '0.00',
          pageLoading: false,
          loadError: true
        })
      }
    } finally {
      this._loadingList = false
    }
  },

  /**
   * 加购一件
   */
  onAdd(event) {
    this.changeQuantity(event.currentTarget.dataset.index, 1)
  },

  /**
   * 减购一件
   */
  onSub(event) {
    this.changeQuantity(event.currentTarget.dataset.index, -1)
  },

  /**
   * 单条商品数量变更：先调服务端接口，成功后再刷新本地 UI
   * @param {number} index - 商品在 cartList 中的下标
   * @param {number} delta - 变化量：1 或 -1
   */
  async changeQuantity(index, delta) {
    const item = this.data.cartList[index]
    if (!item) {
      return
    }

    // 以 dishId + dishFlavor / setmealId 作为该条目的唯一操作 key
    const key = item.setmealId
      ? `setmeal_${item.setmealId}`
      : `dish_${item.dishId}_${item.dishFlavor || ''}`

    if (this._busyKeys[key]) {
      return
    }

    // 数量为 1 时再减即为删除该条目，交由 loadCart 刷新
    this._busyKeys[key] = true

    try {
      const payload = item.setmealId
        ? { setmealId: item.setmealId }
        : { dishId: item.dishId, dishFlavor: item.dishFlavor }

      const task = delta > 0 ? api.cartApi.add(payload) : api.cartApi.sub(payload)
      await task

      if (this._destroyed) {
        return
      }

      // 以服务端数据为准刷新整页，保证增减/删条目后状态一致
      await this.loadCart()
    } catch (err) {
      // 请求层已统一 toast，失败时重新拉取校正
      this.loadCart()
    } finally {
      delete this._busyKeys[key]
    }
  },

  /**
   * 清空购物车（二次确认）
   */
  onClean() {
    if (this.data.cartCount === 0) {
      return
    }

    wx.showModal({
      title: '提示',
      content: '确定要清空购物车吗？',
      confirmColor: '#ff8c00',
      success: async (res) => {
        if (!res.confirm) {
          return
        }

        try {
          await api.cartApi.clean()
          wx.showToast({ title: '已清空', icon: 'success' })
          this.loadCart()
        } catch (err) {
          // 请求层已统一 toast
        }
      }
    })
  },

  /**
   * 去结算
   * 跳转订单确认页，由确认页完成下单与支付。
   */
  onCheckout() {
    if (this.data.cartCount === 0) {
      wx.showToast({ title: '购物车还是空的，先去选点好吃的吧', icon: 'none' })
      return
    }

    wx.navigateTo({ url: '/pages/order/confirm' })
  },

  /**
   * 空购物车时引导去点餐
   */
  onGoMenu() {
    wx.switchTab({ url: '/pages/menu/index' })
  },

  /**
   * 加载失败重试
   */
  onRetry() {
    this.setData({ pageLoading: true })
    this.loadCart()
  }
})
