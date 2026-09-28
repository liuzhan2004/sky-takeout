/**
 * 点餐页（pages/menu/index）
 * 功能：
 * 1. 左侧分类 / 右侧商品分组，支持双向联动滚动；
 * 2. 商品支持加入购物车与数量增减；
 * 3. 底部悬浮购物车栏展示已选数量、合计金额并提供"去结算"入口。
 *
 * 接口来源：外卖-用户端接口.openapi.json
 * - GET  /user/category/list          分类列表
 * - GET  /user/dish/list              按分类查菜品
 * - GET  /user/setmeal/list           按分类查套餐
 * - GET  /user/shoppingCart/list      查看购物车
 * - POST /user/shoppingCart/add       加购
 * - POST /user/shoppingCart/sub       减购
 * - GET  /user/shop/status            店铺营业状态
 */
const api = require('../../api/index')

/** 同一时间最大并发商品分组请求数，避免瞬间打爆后端 */
const GROUP_REQUEST_LIMIT = 4

/** 分类类型：1 菜品分类，2 套餐分类 */
const CATEGORY_TYPE_DISH = 1
const CATEGORY_TYPE_SETMEAL = 2

/**
 * 带并发上限的数组遍历
 * @param {Array} items - 待处理数组
 * @param {number} limit - 最大并发数
 * @param {Function} mapper - 异步处理函数
 */
async function mapWithLimit(items, limit, mapper) {
  const results = []
  let cursor = 0

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(items[index])
    }
  })

  await Promise.all(workers)
  return results
}

/**
 * 合并并排序菜品/套餐分类
 * 两个分类查询可能返回 type 相同的数据，这里做去重，保证每个分类只展示一次。
 */
function mergeCategories(dishCategories, setmealCategories) {
  const source = (dishCategories || []).concat(setmealCategories || [])
  const seen = {}
  const result = []

  source.forEach((category) => {
    if (!category || category.id === undefined) {
      return
    }

    const id = Number(category.id)
    const type = Number(category.type)
    // 只保留上架分类（后端未返回 status 时视为上架）
    if (seen[id] || (category.status !== undefined && Number(category.status) !== 1)) {
      return
    }

    seen[id] = true
    result.push({
      id,
      type,
      name: category.name || '',
      sort: Number(category.sort) || 0
    })
  })

  return result.sort((a, b) => a.sort - b.sort)
}

/**
 * 将后端返回的菜品/套餐统一成页面商品结构
 * key 约定：dish_{id} 表示菜品，setmeal_{id} 表示套餐，购物车接口也按此映射。
 */
function normalizeGoods(item, category) {
  const id = Number(item.id)
  const isSetmeal = category.type === CATEGORY_TYPE_SETMEAL
  const price = Number(item.price) || 0

  return {
    key: isSetmeal ? `setmeal_${id}` : `dish_${id}`,
    id,
    type: category.type,
    name: item.name || '',
    description: item.description || '',
    image: item.image || '',
    price,
    priceText: price.toFixed(2),
    count: 0,
    // 是否上架：后端返回 0 表示停售
    status: item.status === undefined ? 1 : Number(item.status)
  }
}

/**
 * 将购物车列表转换成 { key: 数量 } 的映射
 * 同一种商品在购物车中可能出现多条（不同口味），按商品维度求和。
 */
function buildCartQuantityMap(cartList) {
  const map = {}

  ;(cartList || []).forEach((cartItem) => {
    const key = cartItem.setmealId
      ? `setmeal_${cartItem.setmealId}`
      : cartItem.dishId
        ? `dish_${cartItem.dishId}`
        : ''

    if (!key) {
      return
    }

    map[key] = (map[key] || 0) + (Number(cartItem.number) || 0)
  })

  return map
}

/**
 * 汇总购物车选中件数与总金额
 * 金额计算统一转成分，避免浮点数误差。
 */
function calcSummary(goodsGroups) {
  let cartCount = 0
  let totalCents = 0

  goodsGroups.forEach((group) => {
    group.list.forEach((goods) => {
      if (goods.count > 0) {
        cartCount += goods.count
        totalCents += Math.round(goods.price * goods.count * 100)
      }
    })
  })

  return {
    cartCount,
    totalPrice: (totalCents / 100).toFixed(2)
  }
}

/**
 * 从商品分组中提取有数量的商品，生成购物车面板列表
 */
function buildCartItems(goodsGroups) {
  const items = []

  goodsGroups.forEach((group) => {
    group.list.forEach((goods) => {
      if (goods.count > 0) {
        items.push({
          key: goods.key,
          name: goods.name,
          description: goods.description,
          image: goods.image,
          priceText: goods.priceText,
          count: goods.count
        })
      }
    })
  })

  return items
}

Page({
  data: {
    /** 左侧分类列表 */
    categories: [],

    /** 右侧分组数据：{ categoryId, categoryName, type, list: [] } */
    goodsGroups: [],

    /** 左侧高亮的分类下标 */
    activeIndex: 0,

    /** 左侧分类滚动定位目标 */
    leftScrollIntoView: '',

    /** 右侧商品分组滚动定位目标 */
    scrollIntoView: '',

    /** 已选商品总件数 */
    cartCount: 0,

    /** 已选商品总价（两位小数字符串） */
    totalPrice: '0.00',

    /** 购物车面板是否展开 */
    cartExpanded: false,

    /** 购物车面板商品列表（有数量的商品） */
    cartItems: [],

    /** 店铺营业状态：1 营业中，0 打烊 */
    shopStatus: 1,
    shopStatusText: '营业中',

    /** 首屏加载状态 */
    pageLoading: true,

    /** 加载失败状态 */
    loadError: false
  },

  /** 页面是否已卸载，异步回调里用于防止 setData 报错 */
  _destroyed: false,

  /** 是否正在首屏加载 */
  _loading: false,

  /** key -> { groupIndex, itemIndex } 索引，加减购时快速定位商品 */
  _keyIndexMap: {},

  /** 每个商品是否正在提交购物车请求，防止重复点击 */
  _busyKeys: {},

  /** 是否正在从服务端同步购物车 */
  _syncingCart: false,

  /** 右侧分组内容坐标：用于滚动时计算当前应高亮的分类 */
  _sectionOffsets: [],

  /** 右侧可视区高度 */
  _panelHeight: 0,

  /** 右侧可滚动内容总高度 */
  _contentHeight: 0,

  /** 页面是否已加载完首屏 */
  _loaded: false,

  onLoad() {
    this.loadPage()
  },

  /**
   * 每次切回点餐 Tab 都以服务端购物车为准刷新数量角标。
   * （下单支付后后端会清空购物车，必须重新拉取，不能沿用旧数据）
   */
  onShow() {
    this.syncCartFromServer()
  },

  onUnload() {
    this._destroyed = true
  },

  /**
   * 首屏加载：
   * 分类 -> 各分类商品 -> 购物车数量，全部就绪后再渲染。
   */
  async loadPage() {
    if (this._loading) {
      return
    }

    this._loading = true
    this.setData({
      pageLoading: true,
      loadError: false
    })

    try {
      // 分类按菜品/套餐分两次查询，后端返回空分类时也能保证另一边正常展示
      const [dishCategories, setmealCategories] = await Promise.all([
        api.categoryApi.list({ type: CATEGORY_TYPE_DISH }),
        api.categoryApi.list({ type: CATEGORY_TYPE_SETMEAL })
      ])

      // 营业状态与购物车不阻塞分类加载，失败时使用默认值
      const statusPromise = api.shopApi.getStatus().catch(() => 1)
      const cartPromise = api.cartApi.list().catch(() => [])

      const categories = mergeCategories(dishCategories, setmealCategories)
      const goodsGroups = await this.loadGoodsGroups(categories)
      const shopStatus = Number(await statusPromise) || 1
      const cartList = await cartPromise

      if (this._destroyed) {
        return
      }

      // 把服务端购物车数量回填到每个商品上
      const quantityMap = buildCartQuantityMap(cartList)
      goodsGroups.forEach((group) => {
        group.list.forEach((goods) => {
          goods.count = quantityMap[goods.key] || 0
        })
      })

      const summary = calcSummary(goodsGroups)
      const open = shopStatus === 1

      this._keyIndexMap = {}
      goodsGroups.forEach((group, groupIndex) => {
        group.list.forEach((goods, goodsIndex) => {
          this._keyIndexMap[goods.key] = {
            groupIndex,
            itemIndex: goodsIndex
          }
        })
      })

      this.setData({
        categories,
        goodsGroups,
        cartCount: summary.cartCount,
        totalPrice: summary.totalPrice,
        cartItems: buildCartItems(goodsGroups),
        shopStatus,
        shopStatusText: open ? '营业中' : '已打烊',
        pageLoading: false,
        loadError: false,
        activeIndex: 0,
        leftScrollIntoView: '',
        scrollIntoView: ''
      })

      this._loaded = true

      // 首屏渲染完成后测量各分组的滚动坐标
      this.setData({}, () => {
        wx.nextTick(() => {
          this.measureSections()
        })
      })
    } catch (err) {
      // 请求层已经统一 toast，这里只负责页面错误态
      if (!this._destroyed) {
        this.setData({
          pageLoading: false,
          loadError: true
        })
      }
    } finally {
      this._loading = false
    }
  },

  /**
   * 按分类加载商品，并组合成右侧分组数据。
   * 使用并发上限控制请求数量，避免分类过多时瞬间发出大量请求。
   */
  async loadGoodsGroups(categories) {
    return mapWithLimit(categories, GROUP_REQUEST_LIMIT, async (category) => {
      let rawList = []

      try {
        rawList =
          category.type === CATEGORY_TYPE_SETMEAL
            ? await api.setmealApi.listByCategory(category.id)
            : await api.dishApi.listByCategory(category.id)
      } catch (err) {
        // 单个分类加载失败时不阻塞整页，等待重新加载按钮
        rawList = []
      }

      const list = (rawList || [])
        // status 为 0 表示停售；后端未返回 status 时视为在售
        .filter((goods) => goods && (goods.status === undefined || Number(goods.status) === 1))
        .map((goods) => normalizeGoods(goods, category))

      return {
        categoryId: category.id,
        categoryName: category.name,
        type: category.type,
        list
      }
    })
  },

  /**
   * 点击左侧分类：右侧滚动到对应分组。
   */
  onCategoryTap(event) {
    const index = Number(event.currentTarget.dataset.index)
    const group = this.data.goodsGroups[index]

    if (!group) {
      return
    }

    this.setData({
      activeIndex: index,
      scrollIntoView: `group-${group.categoryId}`,
      leftScrollIntoView: `cat-${group.categoryId}`
    })
  },

  /**
   * 右侧滚动监听：根据当前滚动位置高亮左侧分类。
   */
  onGoodsScroll(event) {
    const scrollTop = Number(event.detail.scrollTop) || 0
    this.updateActiveCategoryByScrollTop(scrollTop)
  },

  /**
   * 测量右侧各分组在内容坐标系中的位置。
   * 只测量一次，分组位置在数据不变时保持稳定。
   */
  measureSections() {
    if (this._destroyed) {
      return
    }

    const query = wx.createSelectorQuery().in(this)
    query.select('.goods-panel').boundingClientRect()
    query.selectAll('.goods-group').boundingClientRect()
    query.select('.scroll-bottom-space').boundingClientRect()
    query.select('.goods-panel').scrollOffset()
    query.exec((res) => {
      if (!res || !res[0]) {
        return
      }

      const panelRect = res[0]
      const groupRects = res[1] || []
      const bottomRect = res[2]
      const panelScroll = (res[3] && res[3].scrollTop) || 0

      this._panelHeight = panelRect.height || 0
      // 通过滚动内容的最后一个底部占位元素计算内容总高度
      this._contentHeight = bottomRect
        ? bottomRect.bottom - (panelRect.top || 0) + panelScroll
        : (this._contentHeight || 0)

      // group 的 top 是相对视口的，需要加上当前 scrollTop 换算成内容坐标
      this._sectionOffsets = groupRects.map((rect) => {
        const top = rect.top - (panelRect.top || 0) + panelScroll
        return Math.max(0, top)
      })

      // 首次测量后立即校准一次高亮（兼容页面不是从顶部开始的情况）
      this.updateActiveCategoryByScrollTop(panelScroll)
    })
  },

  /**
   * 根据右侧 scrollTop 计算当前应高亮的分类。
   */
  updateActiveCategoryByScrollTop(scrollTop) {
    const offsets = this._sectionOffsets
    const count = offsets.length

    if (!count || this._loading || this.data.pageLoading) {
      return
    }

    const maxScrollTop = Math.max(0, this._contentHeight - this._panelHeight)
    let nextActiveIndex = 0

    // 内容可滚动且已滚到底时，强制高亮最后一个分类
    const atBottom = maxScrollTop > 0 && scrollTop >= maxScrollTop - 1
    if (atBottom) {
      nextActiveIndex = count - 1
    } else {
      for (let i = 0; i < count; i += 1) {
        if (scrollTop + 1 >= offsets[i]) {
          nextActiveIndex = i
        } else {
          break
        }
      }
    }

    if (nextActiveIndex === this.data.activeIndex) {
      return
    }

    const group = this.data.goodsGroups[nextActiveIndex]
    this.setData({
      activeIndex: nextActiveIndex,
      leftScrollIntoView: group ? `cat-${group.categoryId}` : this.data.leftScrollIntoView
    })
  },

  /**
   * 加购
   */
  onAddGoods(event) {
    this.changeQuantity(event.currentTarget.dataset.key, 1)
  },

  /**
   * 减购
   */
  onSubGoods(event) {
    this.changeQuantity(event.currentTarget.dataset.key, -1)
  },

  /**
   * 商品数量变更：先调服务端购物车接口，成功后再更新本地 UI。
   * @param {string} key - 商品 key，如 dish_101 / setmeal_102
   * @param {number} delta - 变化量：1 或 -1
   */
  async changeQuantity(key, delta) {
    if (!key || this._busyKeys[key]) {
      return
    }

    if (this.data.shopStatus !== 1) {
      wx.showToast({
        title: '店铺已打烊，暂无法点餐',
        icon: 'none'
      })
      return
    }

    const location = this._keyIndexMap[key]
    if (!location) {
      return
    }

    const group = this.data.goodsGroups[location.groupIndex]
    const goods = group.list[location.itemIndex]

    // 数量已经为 0 时不能再减
    if (delta < 0 && goods.count <= 0) {
      return
    }

    this._busyKeys[key] = true

    // 菜品与套餐通过不同字段标识
    const payload =
      goods.type === CATEGORY_TYPE_SETMEAL
        ? { setmealId: goods.id }
        : { dishId: goods.id }

    const task = delta > 0 ? api.cartApi.add(payload) : api.cartApi.sub(payload)

    try {
      await task

      if (this._destroyed) {
        return
      }

      // 成功后更新本地数量与购物车栏汇总
      const nextCount = Math.max(0, goods.count + delta)
      goods.count = nextCount

      const summary = calcSummary(this.data.goodsGroups)
      this.setData({
        [`goodsGroups[${location.groupIndex}].list[${location.itemIndex}].count`]: nextCount,
        cartCount: summary.cartCount,
        totalPrice: summary.totalPrice
      })
      this.refreshCartPanel()
    } catch (err) {
      // 请求层已统一提示；失败后以服务端数据为准做一次校正
      this.syncCartFromServer()
    } finally {
      delete this._busyKeys[key]
    }
  },

  /**
   * 从服务端重新拉取购物车，校准本地数量与汇总金额。
   * 用于：加购失败校正、从购物车页返回后同步。
   */
  async syncCartFromServer() {
    if (this._syncingCart || !this._loaded || this._destroyed) {
      return
    }

    this._syncingCart = true

    try {
      const cartList = await api.cartApi.list()

      if (this._destroyed) {
        return
      }

      const quantityMap = buildCartQuantityMap(cartList)
      const groups = this.data.goodsGroups

      groups.forEach((group) => {
        group.list.forEach((goods) => {
          goods.count = quantityMap[goods.key] || 0
        })
      })

      const summary = calcSummary(groups)
      this.setData({
        goodsGroups: groups,
        cartCount: summary.cartCount,
        totalPrice: summary.totalPrice
      })
      this.refreshCartPanel()
    } catch (err) {
      // 同步失败不影响页面浏览，请求层已统一提示
    } finally {
      this._syncingCart = false
    }
  },

  /**
   * 购物车面板数据与展开状态联动：
   * 数量为 0 时自动收起面板。
   */
  refreshCartPanel() {
    const summary = calcSummary(this.data.goodsGroups)
    const patch = {
      cartItems: buildCartItems(this.data.goodsGroups)
    }

    if (summary.cartCount === 0 && this.data.cartExpanded) {
      patch.cartExpanded = false
    }

    this.setData(patch)
  },

  /**
   * 点击购物车栏左侧信息区：展开/收起购物车面板
   */
  onCartToggle() {
    if (this.data.cartCount === 0) {
      wx.showToast({
        title: '先挑点好吃的吧~',
        icon: 'none'
      })
      return
    }

    this.setData({
      cartExpanded: !this.data.cartExpanded
    })
  },

  /**
   * 关闭购物车面板
   */
  onCartClose() {
    this.setData({
      cartExpanded: false
    })
  },

  /**
   * 清空购物车
   */
  onClearCart() {
    if (this.data.cartCount === 0) {
      return
    }

    wx.showModal({
      title: '提示',
      content: '确定要清空购物车吗？',
      success: async (res) => {
        if (!res.confirm) {
          return
        }

        try {
          await api.cartApi.clean()

          if (this._destroyed) {
            return
          }

          const groups = this.data.goodsGroups
          groups.forEach((group) => {
            group.list.forEach((goods) => {
              goods.count = 0
            })
          })

          this.setData({
            goodsGroups: groups,
            cartCount: 0,
            totalPrice: '0.00',
            cartItems: [],
            cartExpanded: false
          })
        } catch (err) {
          // 请求层已统一提示，失败后以服务端数据校正
          this.syncCartFromServer()
        }
      }
    })
  },

  /**
   * 去结算：切到购物车 Tab，由购物车页继续完成下单前确认。
   */
  onCheckout() {
    wx.switchTab({
      url: '/pages/cart/cart'
    })
  },

  /**
   * 加载失败后重试
   */
  onRetry() {
    this.loadPage()
  }
})
