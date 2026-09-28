/**
 * 订单详情页（pages/order/detail）
 * 功能：
 * 1. 通过 /user/order/orderDetail/{id} 查询订单完整信息；
 * 2. 展示订单状态、配送地址、期望送达、备注；
 * 3. 商品明细列表（图片/口味/数量/小计）与费用明细；
 * 4. 订单编号（可复制）、下单时间、支付方式。
 *
 * 入参：?id={订单id}
 */
const api = require('../../api/index')
const { resolveImage } = require('../../utils/image')

/** 订单状态：与后端 Orders 常量对应 */
const STATUS_MAP = {
  1: '待付款',
  2: '待接单',
  3: '已接单',
  4: '派送中',
  5: '已完成',
  6: '已取消'
}

/** 状态说明文案（详情页顶部大字下面的描述） */
const STATUS_DESC = {
  1: '订单待支付，请尽快完成支付',
  2: '商家已接单，正在为您准备餐品',
  3: '商家已接单，正在为您准备餐品',
  4: '骑手正在配送中，请留意来电',
  5: '订单已完成，感谢您的信任',
  6: '订单已取消，期待再次光临'
}

/** 支付方式文案 */
const PAY_METHOD_MAP = {
  1: '微信支付',
  2: '支付宝支付'
}

/**
 * 格式化订单时间：2026-09-17T22:20:00 → 2026-09-17 22:20
 */
function formatTime(time) {
  if (!time) {
    return ''
  }
  return String(time).replace('T', ' ').slice(0, 16)
}

/**
 * 将后端 OrderVO 转换为页面渲染结构
 */
function normalizeOrder(order) {
  const status = Number(order.status)
  const details = (order.orderDetailList || []).map((item) => ({
    name: item.name || '',
    flavor: item.dishFlavor || '',
    image: resolveImage(item.image),
    number: item.number || 1,
    subtotalText: (Number(item.amount) * (item.number || 1)).toFixed(2)
  }))

  const goodsTotal = details.reduce(
    (sum, item) => sum + Number(item.subtotalText),
    0
  )

  return {
    id: order.id,
    orderNumber: order.number || '',
    status,
    statusText: STATUS_MAP[status] || '未知状态',
    statusDesc: STATUS_DESC[status] || '',
    amountText: Number(order.amount) ? Number(order.amount).toFixed(2) : '0.00',
    goodsTotalText: goodsTotal.toFixed(2),
    packAmountText: order.packAmount != null ? Number(order.packAmount).toFixed(2) : '0.00',
    payMethodText: PAY_METHOD_MAP[order.payMethod] || '在线支付',
    orderTimeText: formatTime(order.orderTime),
    estimatedText: formatTime(order.estimatedDeliveryTime),
    consignee: order.consignee || '',
    phone: order.phone || '',
    address: order.address || '',
    remark: order.remark || '',
    tablewareText: Number(order.tablewareNumber) > 0
      ? `${order.tablewareNumber} 份餐具`
      : '无需餐具',
    details
  }
}

Page({
  data: {
    /** 订单渲染数据 */
    order: null,

    /** 页面加载状态 */
    pageLoading: true,

    /** 加载失败 */
    loadError: false
  },

  /** 页面是否已卸载 */
  _destroyed: false,

  onLoad(options) {
    const id = options && options.id
    if (!id) {
      this.setData({ pageLoading: false, loadError: true })
      return
    }
    this._lastId = id
    this.loadDetail(id)
  },

  onUnload() {
    this._destroyed = true
  },

  /**
   * 拉取订单详情
   */
  async loadDetail(id) {
    this.setData({ pageLoading: true, loadError: false })
    try {
      const order = await api.orderApi.orderDetail(id)
      if (this._destroyed) {
        return
      }
      this.setData({
        order: normalizeOrder(order || {}),
        pageLoading: false
      })
    } catch (err) {
      // 请求层已统一 toast，这里只负责页面错误态
      if (!this._destroyed) {
        this.setData({ pageLoading: false, loadError: true })
      }
    }
  },

  /**
   * 加载失败重试
   */
  onRetry() {
    if (this._lastId) {
      this.loadDetail(this._lastId)
    }
  },

  /**
   * 复制订单编号
   */
  onCopyOrderNumber() {
    const number = this.data.order && this.data.order.orderNumber
    if (!number) {
      return
    }
    wx.setClipboardData({
      data: number,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' })
      }
    })
  },

  /**
   * 再来一单：跳回点餐页
   */
  onGoMenu() {
    wx.switchTab({ url: '/pages/menu/index' })
  }
})
