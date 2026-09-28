/**
 * 订单确认页（pages/order/confirm）
 * 功能：
 * 1. 展示收货地址（无地址时内联表单快速新增）；
 * 2. 展示购物车商品明细、打包费与合计金额；
 * 3. 提交订单（POST /user/order/submit）；
 * 4. 发起支付（PUT /user/order/payment，后端已改为模拟支付，无需商户号）；
 * 5. 支付成功后引导回首页。
 *
 * 接口来源：外卖-用户端接口.openapi.json
 * - GET /user/shoppingCart/list        购物车明细
 * - GET /user/addressBook/list         地址簿列表
 * - POST /user/addressBook             新增地址
 * - PUT /user/addressBook/default      设置默认地址
 * - POST /user/order/submit            提交订单
 * - PUT /user/order/payment            订单支付
 */
const api = require('../../api/index')
const { resolveImage } = require('../../utils/image')

/** 配送费（固定 2 元，提交时传给后端 packAmount 字段，后端同样按 2 元校验） */
const PACK_AMOUNT = 2

/** 立即送出时预计送达的分钟数 */
const ESTIMATED_DELIVERY_MINUTES = 40

/**
 * 将后端购物车条目转换为页面渲染结构（与购物车页保持一致）
 */
function normalizeCartItem(item, index) {
  const unitPrice = Number(item.amount) || 0
  const number = Number(item.number) || 0

  return {
    index,
    name: item.name || '',
    image: resolveImage(item.image),
    dishFlavor: item.dishFlavor || '',
    number,
    unitPrice,
    subtotalText: (unitPrice * number).toFixed(2)
  }
}

/**
 * 汇总件数与商品总金额（金额统一转成分计算，避免浮点误差）
 */
function calcSummary(cartList) {
  let count = 0
  let totalCents = 0

  cartList.forEach((item) => {
    count += item.number
    totalCents += Math.round(item.unitPrice * item.number * 100)
  })

  return {
    count,
    goodsCents: totalCents
  }
}

/**
 * 格式化日期为 yyyy-MM-dd HH:mm:ss（后端 JsonFormat 约定格式）
 */
function formatDateTime(date) {
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

Page({
  data: {
    /** 购物车商品明细 */
    cartList: [],

    /** 商品件数 */
    cartCount: 0,

    /** 商品合计（两位小数字符串） */
    goodsAmount: '0.00',

    /** 配送费 */
    packAmount: PACK_AMOUNT,

    /** 应付合计 = 商品合计 + 打包费 */
    totalAmount: '0.00',

    /** 收货地址（为 null 时展示新增地址表单） */
    address: null,

    /** 新增地址表单 */
    addressForm: {
      consignee: '',
      phone: '',
      detail: ''
    },

    /** 订单备注 */
    remark: '',

    /** 是否正在提交订单（防重复点击） */
    submitting: false,

    /** 页面加载状态 */
    pageLoading: true,

    /** 加载失败状态 */
    loadError: false
  },

  /** 页面是否已卸载 */
  _destroyed: false,

  /** 是否正在保存地址 */
  _savingAddress: false,

  onLoad() {
    this.initPage()
  },

  onUnload() {
    this._destroyed = true
  },

  /**
   * 初始化页面：并行加载购物车与收货地址
   */
  async initPage() {
    this.setData({ loadError: false })

    try {
      await Promise.all([this.loadCart(), this.loadAddress()])

      if (!this._destroyed) {
        this.setData({ pageLoading: false })
      }
    } catch (err) {
      // 请求层已统一 toast，这里只负责页面错误态
      if (!this._destroyed) {
        this.setData({ pageLoading: false, loadError: true })
      }
    }
  },

  /**
   * 加载购物车明细并计算金额
   */
  async loadCart() {
    const list = await api.cartApi.list()
    if (this._destroyed) {
      return
    }

    const cartList = (list || []).map(normalizeCartItem)
    const summary = calcSummary(cartList)
    const totalCents = summary.goodsCents + PACK_AMOUNT * 100

    this.setData({
      cartList,
      cartCount: summary.count,
      goodsAmount: (summary.goodsCents / 100).toFixed(2),
      totalAmount: (totalCents / 100).toFixed(2)
    })
  },

  /**
   * 加载收货地址：优先默认地址，否则取第一条；没有地址展示新增表单
   */
  async loadAddress() {
    // 地址簿为空时接口返回空数组，不会报错，比 getDefault 免去异常分支
    const list = await api.addressApi.list()
    if (this._destroyed) {
      return
    }

    const books = list || []
    if (books.length === 0) {
      this.setData({ address: null })
      return
    }

    const defaultBook = books.find((item) => Number(item.isDefault) === 1)
    const book = defaultBook || books[0]

      this.setData({
        address: {
          id: book.id,
          consignee: book.consignee || '',
          // 地址展示：城市 + 区县 + 详细地址（后端 AddressBook 字段）
          phone: book.phone || '',
          detail: `${book.cityName || ''}${book.districtName || ''}${book.detail || ''}`
        }
      })
  },

  /** 新增地址表单：收货人 */
  onConsigneeInput(event) {
    this.setData({ 'addressForm.consignee': event.detail.value })
  },

  /** 新增地址表单：手机号 */
  onPhoneInput(event) {
    this.setData({ 'addressForm.phone': event.detail.value })
  },

  /** 新增地址表单：详细地址 */
  onDetailInput(event) {
    this.setData({ 'addressForm.detail': event.detail.value })
  },

  /**
   * 保存新增地址并设为默认地址
   */
  async onSaveAddress() {
    const { consignee, phone, detail } = this.data.addressForm

    if (!consignee.trim()) {
      wx.showToast({ title: '请填写收货人姓名', icon: 'none' })
      return
    }
    if (!/^1\d{10}$/.test(phone.trim())) {
      wx.showToast({ title: '请填写正确的手机号', icon: 'none' })
      return
    }
    if (!detail.trim()) {
      wx.showToast({ title: '请填写详细地址', icon: 'none' })
      return
    }

    if (this._savingAddress) {
      return
    }
    this._savingAddress = true

    try {
      // 后端 save 接口不返回地址 id，保存后重新拉取列表取最新一条
      await api.addressApi.add({
        consignee: consignee.trim(),
        phone: phone.trim(),
        detail: detail.trim(),
        sex: '1',
        label: '公司'
      })

      const list = await api.addressApi.list().catch(() => [])
      const books = list || []
      if (books.length > 0) {
        const newest = books.reduce((a, b) => (Number(a.id) > Number(b.id) ? a : b))
        // 设为默认地址（失败不影响下单，地址已存在）
        if (newest && newest.id) {
          await api.addressApi.setDefault(newest.id).catch(() => {})
        }
      }

      // 清空表单并重新加载地址
      this.setData({
        addressForm: { consignee: '', phone: '', detail: '' }
      })
      await this.loadAddress()
      wx.showToast({ title: '地址已保存', icon: 'success' })
    } catch (err) {
      // 请求层已统一 toast
    } finally {
      this._savingAddress = false
    }
  },

  /** 备注输入 */
  onRemarkInput(event) {
    this.setData({ remark: event.detail.value })
  },

  /**
   * 提交订单并发起支付
   */
  async onSubmitOrder() {
    if (this.data.cartCount === 0) {
      wx.showToast({ title: '购物车是空的，先去点餐吧', icon: 'none' })
      return
    }

    const address = this.data.address
    if (!address || !address.id) {
      wx.showToast({ title: '请先填写收货地址', icon: 'none' })
      return
    }

    if (this.data.submitting) {
      return
    }
    this.setData({ submitting: true })

    try {
      // 1. 提交订单
      const estimated = new Date(Date.now() + ESTIMATED_DELIVERY_MINUTES * 60 * 1000)
      const submitVO = await api.orderApi.submit({
        addressBookId: address.id,
        amount: Number(this.data.totalAmount),
        payMethod: 1,
        remark: this.data.remark.trim(),
        deliveryStatus: 1,
        estimatedDeliveryTime: formatDateTime(estimated),
        tablewareStatus: 1,
        tablewareNumber: 0,
        packAmount: PACK_AMOUNT
      })

      // 2. 发起支付（后端已改为模拟支付，直接返回成功并标记订单已支付）
      await api.orderApi.payment({
        orderNumber: submitVO.orderNumber,
        payMethod: 1
      })

      if (this._destroyed) {
        return
      }

      // 3. 支付成功提示并回首页
      wx.showModal({
        title: '支付成功',
        content: `订单号 ${submitVO.orderNumber} 已提交，等待商家接单`,
        showCancel: false,
        confirmText: '好的',
        confirmColor: '#ff8c00',
        success: () => {
          wx.switchTab({ url: '/pages/index/index' })
        }
      })
    } catch (err) {
      // 请求层已统一 toast；下单成功但支付失败时提示用户到"我的"页查看订单
      // （购物车已被后端清空，订单保留在待支付状态）
    } finally {
      if (!this._destroyed) {
        this.setData({ submitting: false })
      }
    }
  },

  /**
   * 加载失败重试
   */
  onRetry() {
    this.setData({ pageLoading: true })
    this.initPage()
  }
})
