/**
 * 历史订单页（pages/order/list）
 * 功能：
 * 1. 按状态标签分页查询历史订单（全部/待付款/待接单/已接单/派送中/已完成/已取消）；
 * 2. 订单卡片展示状态、菜品明细、金额、下单时间；
 * 3. 按状态提供操作：
 *    - 待付款：去支付（后端为模拟支付，直接标记已支付）、取消订单
 *    - 待接单：催单、取消订单
 *    - 已接单/派送中：催单
 *    - 已完成/已取消：再来一单
 *
 * 接口来源：外卖-用户端接口.openapi.json
 * - GET  /user/order/historyOrders  分页查询
 * - GET  /user/order/reminder/{id}  催单
 * - PUT  /user/order/payment        支付（模拟）
 * - PUT  /user/order/cancel/{id}    取消
 * - POST /user/order/repetition/{id} 再来一单
 */
const api = require('../../api/index')

/** 每页条数 */
const PAGE_SIZE = 10

/** 订单状态：与后端 Orders 常量对应 */
const STATUS_MAP = {
  1: '待付款',
  2: '待接单',
  3: '已接单',
  4: '派送中',
  5: '已完成',
  6: '已取消'
}

/** 状态标签页 */
const TABS = [
  { label: '全部', value: 0 },
  { label: '待付款', value: 1 },
  { label: '待接单', value: 2 },
  { label: '已接单', value: 3 },
  { label: '派送中', value: 4 },
  { label: '已完成', value: 5 },
  { label: '已取消', value: 6 }
]

/**
 * 格式化订单时间：2026-09-17T22:20:00 → 2026-09-17 22:20
 */
function formatOrderTime(time) {
  if (!time) {
    return ''
  }
  return String(time).replace('T', ' ').slice(0, 16)
}

/**
 * 将后端订单 VO 转换为页面渲染结构
 */
function normalizeOrder(order, index) {
  const details = order.orderDetailList || []
  const summary = details.length > 0
    ? details.map((d) => d.name).join('、')
    : (order.orderDishes || '')

  const status = Number(order.status)

  return {
    index,
    id: order.id,
    orderNumber: order.orderNumber || '',
    status,
    statusText: STATUS_MAP[status] || '',
    amountText: Number(order.amount) ? Number(order.amount).toFixed(2) : '0.00',
    orderTimeText: formatOrderTime(order.orderTime),
    remark: order.remark || '',
    dishSummary: summary,
    // 按状态决定按钮显示
    canPay: status === 1,
    canCancel: status === 1 || status === 2,
    canRemind: status === 2 || status === 3 || status === 4,
    canRepeat: status === 5 || status === 6
  }
}

Page({
  data: {
    /** 状态标签页 */
    tabs: TABS,

    /** 当前选中的状态（0 = 全部） */
    currentStatus: 0,

    /** 订单列表 */
    orderList: [],

    /** 是否还有下一页 */
    hasMore: true,

    /** 是否正在加载 */
    loading: false,

    /** 加载失败 */
    loadError: false
  },

  /** 分页参数 */
  _page: 1,

  /** 页面是否已卸载 */
  _destroyed: false,

  /** 是否正在执行订单操作（防重复点击） */
  _acting: false,

  onLoad() {
    this.reload()
  },

  onUnload() {
    this._destroyed = true
  },

  /**
   * 点击订单卡片 → 进入订单详情页
   * （操作按钮均用 catchtap 阻止冒泡，不会误触）
   */
  onCardTap(event) {
    const id = event.currentTarget.dataset.id
    if (!id) {
      return
    }
    wx.navigateTo({ url: `/pages/order/detail?id=${id}` })
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.reload().finally(() => wx.stopPullDownRefresh())
  },

  /**
   * 上拉加载下一页
   */
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadPage()
    }
  },

  /**
   * 切换状态标签
   */
  onTabChange(event) {
    const status = Number(event.currentTarget.dataset.value)
    if (status === this.data.currentStatus) {
      return
    }
    this.setData({ currentStatus: status })
    this.reload()
  },

  /**
   * 重置并重新加载
   */
  async reload() {
    this._page = 1
    this.setData({ orderList: [], hasMore: true, loadError: false })
    await this.loadPage()
  },

  /**
   * 加载一页订单
   */
  async loadPage() {
    if (this.data.loading) {
      return
    }
    this.setData({ loading: true })

    try {
      const params = {
        page: this._page,
        pageSize: PAGE_SIZE
      }
      // 后端 status 不传查全部，传 0 会匹配不到，需过滤
      if (this.data.currentStatus > 0) {
        params.status = this.data.currentStatus
      }

      const pageData = await api.orderApi.historyOrders(params)
      if (this._destroyed) {
        return
      }

      const records = (pageData && pageData.records) || []
      const normalized = records.map(normalizeOrder)

      this.setData({
        orderList: this.data.orderList.concat(normalized),
        hasMore: normalized.length >= PAGE_SIZE,
        loadError: false
      })
      this._page += 1
    } catch (err) {
      // 请求层已统一 toast，这里只负责页面错误态
      if (!this._destroyed && this.data.orderList.length === 0) {
        this.setData({ loadError: true })
      }
    } finally {
      if (!this._destroyed) {
        this.setData({ loading: false })
      }
    }
  },

  /**
   * 通用订单操作：防止重复点击，完成后刷新列表
   * @param {Function} task - 返回 Promise 的请求
   * @param {string} [successText] - 成功提示
   */
  async runOrderAction(task, successText) {
    if (this._acting) {
      return
    }
    this._acting = true

    try {
      await task()
      if (successText) {
        wx.showToast({ title: successText, icon: 'success' })
      }
      // 操作后状态会变化，重置列表重新加载
      await this.reload()
    } catch (err) {
      // 请求层已统一 toast
    } finally {
      this._acting = false
    }
  },

  /**
   * 去支付（待付款订单；后端为模拟支付，直接标记已支付）
   */
  onPay(event) {
    const order = this.data.orderList[event.currentTarget.dataset.index]
    if (!order || !order.canPay) {
      return
    }
    this.runOrderAction(
      () => api.orderApi.payment({ orderNumber: order.orderNumber, payMethod: 1 }),
      '支付成功'
    )
  },

  /**
   * 取消订单（带二次确认）
   */
  onCancel(event) {
    const order = this.data.orderList[event.currentTarget.dataset.index]
    if (!order || !order.canCancel) {
      return
    }

    wx.showModal({
      title: '提示',
      content: '确定要取消该订单吗？',
      confirmColor: '#ff8c00',
      success: (res) => {
        if (!res.confirm) {
          return
        }
        this.runOrderAction(() => api.orderApi.cancel(order.id), '已取消')
      }
    })
  },

  /**
   * 催单
   */
  onRemind(event) {
    const order = this.data.orderList[event.currentTarget.dataset.index]
    if (!order || !order.canRemind) {
      return
    }
    this.runOrderAction(() => api.orderApi.reminder(order.id), '已收到您的催单')
  },

  /**
   * 再来一单：把订单明细重新加入购物车
   */
  onRepeat(event) {
    const order = this.data.orderList[event.currentTarget.dataset.index]
    if (!order || !order.canRepeat) {
      return
    }
    this.runOrderAction(() => api.orderApi.repetition(order.id), '已加入购物车')
      .then(() => {
        // 再来一单后跳转购物车查看
        wx.switchTab({ url: '/pages/cart/cart' })
      })
  },

  /**
   * 空列表引导去点餐
   */
  onGoMenu() {
    wx.switchTab({ url: '/pages/menu/index' })
  }
})
