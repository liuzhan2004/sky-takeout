/**
 * api/index.js
 * API 接口统一出口。
 * 所有接口方法均返回 Promise，内部只调用 utils/request.js。
 *
 * 已按《外卖-用户端接口.openapi.json》实现：
 * - 分类、菜品、套餐、购物车、店铺营业状态；
 * - 登录、订单、地址等模块待后续页面实现时继续补全。
 */
const request = require('../utils/request')

module.exports = {
  /**
   * 登录 / 授权模块
   */
  authApi: {
    /**
     * 微信登录：用 wx.login 获取的 code 换取 token
     * @param {string} code - 微信临时授权码
     */
    login(code) {
      return request.post('/user/user/login', { code })
    },

    /**
     * 退出登录
     */
    logout() {
      return request.post('/user/user/logout', {})
    }
  },

  /**
   * 菜品分类模块
   */
  categoryApi: {
    /**
     * 查询分类列表
     * @param {object} params
     * @param {number} [params.type] - 1 菜品分类，2 套餐分类；不传查询全部分类
     */
    list(params) {
      return request.get('/user/category/list', params)
    }
  },

  /**
   * 菜品模块
   */
  dishApi: {
    /**
     * 根据分类 id 查询菜品
     * @param {number|string} categoryId - 菜品分类 id
     */
    listByCategory(categoryId) {
      return request.get('/user/dish/list', { categoryId })
    }
  },

  /**
   * 套餐模块
   */
  setmealApi: {
    /**
     * 根据分类 id 查询套餐
     * @param {number|string} categoryId - 套餐分类 id
     */
    listByCategory(categoryId) {
      return request.get('/user/setmeal/list', { categoryId })
    },

    /**
     * 根据套餐 id 查询套餐包含的菜品（详情/弹层展示用）
     * @param {number|string} id - 套餐 id
     */
    listDishesBySetmeal(id) {
      return request.get(`/user/setmeal/dish/${id}`)
    }
  },

  /**
   * 购物车模块
   */
  cartApi: {
    /**
     * 查看购物车
     */
    list() {
      return request.get('/user/shoppingCart/list')
    },

    /**
     * 添加购物车
     * @param {object} data
     * @param {number} [data.dishId] - 菜品 id
     * @param {number} [data.setmealId] - 套餐 id
     * @param {string} [data.dishFlavor] - 菜品口味
     */
    add(data) {
      return request.post('/user/shoppingCart/add', data)
    },

    /**
     * 从购物车中减少一个商品
     * @param {object} data
     * @param {number} [data.dishId] - 菜品 id
     * @param {number} [data.setmealId] - 套餐 id
     * @param {string} [data.dishFlavor] - 菜品口味
     */
    sub(data) {
      return request.post('/user/shoppingCart/sub', data)
    },

    /**
     * 清空购物车
     */
    clean() {
      return request.del('/user/shoppingCart/clean')
    }
  },

  /**
   * 店铺模块
   */
  shopApi: {
    /**
     * 获取店铺营业状态
     * @returns {Promise<number>} 1 营业中，0 打烊
     */
    getStatus() {
      return request.get('/user/shop/status')
    }
  },

  /**
   * 订单模块
   * 对应《外卖-用户端接口.openapi.json》"C端-订单接口" 分组
   */
  orderApi: {
    /**
     * 用户下单
     * @param {object} data - OrdersSubmitDTO
     * @param {number} data.addressBookId - 地址簿 id（必填）
     * @param {number} data.amount - 总金额（必填）
     * @param {number} data.payMethod - 付款方式（必填）
     * @param {number} data.remark - 备注
     * @param {number} data.packAmount - 打包费
     * @param {number} data.tablewareStatus - 餐具数量状态：1 按餐量提供 0 选择具体数量
     * @param {number} data.tablewareNumber - 餐具数量
     * @param {number} data.deliveryStatus - 配送状态：1 立即送出 0 选择具体时间
     * @param {string} data.estimatedDeliveryTime - 预计送达时间 yyyy-MM-dd HH:mm:ss
     */
    submit(data) {
      return request.post('/user/order/submit', data)
    },

    /**
     * 订单支付
     * @param {object} data - OrdersPaymentDTO
     * @param {string} data.orderNumber - 订单号
     * @param {number} data.payMethod - 支付方式：1 微信支付 2 支付宝支付
     */
    payment(data) {
      return request.put('/user/order/payment', data)
    },

    /**
     * 历史订单分页查询
     * @param {object} params
     * @param {number|string} params.page - 页码
     * @param {number|string} params.pageSize - 每页记录数
     * @param {number|string} [params.status] - 订单状态
     */
    historyOrders(params) {
      return request.get('/user/order/historyOrders', params)
    },

    /**
     * 查询订单详情
     * @param {number|string} id - 订单 id
     */
    orderDetail(id) {
      return request.get(`/user/order/orderDetail/${id}`)
    },

    /**
     * 取消订单
     * @param {number|string} id - 订单 id
     */
    cancel(id) {
      return request.put(`/user/order/cancel/${id}`)
    },

    /**
     * 再来一单
     * @param {number|string} id - 订单 id
     */
    repetition(id) {
      return request.post(`/user/order/repetition/${id}`)
    },

    /**
     * 催单
     * @param {number|string} id - 订单 id
     */
    reminder(id) {
      return request.get(`/user/order/reminder/${id}`)
    }
  },

  /**
   * 收货地址模块
   * 对应《外卖-用户端接口.openapi.json》"C端-地址簿接口" 分组
   */
  addressApi: {
    /**
     * 查询当前登录用户的所有地址信息
     */
    list() {
      return request.get('/user/addressBook/list')
    },

    /**
     * 查询默认地址
     */
    getDefault() {
      return request.get('/user/addressBook/default')
    },

    /**
     * 根据 id 查询地址
     * @param {number|string} id - 地址 id
     */
    getById(id) {
      return request.get(`/user/addressBook/${id}`)
    },

    /**
     * 新增地址
     * @param {object} data - AddressBook
     */
    add(data) {
      return request.post('/user/addressBook', data)
    },

    /**
     * 根据 id 修改地址
     * @param {object} data - AddressBook（须含 id）
     */
    update(data) {
      return request.put('/user/addressBook', data)
    },

    /**
     * 根据 id 删除地址
     * @param {number|string} id - 地址 id
     */
    deleteById(id) {
      return request.del('/user/addressBook', { id })
    },

    /**
     * 设置默认地址
     * @param {number|string} id - 地址 id
     */
    setDefault(id) {
      return request.put('/user/addressBook/default', { id })
    }
  },

  /**
   * 用户信息模块（个人中心页面实现时补全）
   */
  userApi: {}
}
