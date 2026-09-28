/**
 * 地址管理页（pages/address/list）
 * 功能：
 * 1. 展示当前用户的所有收货地址（默认地址带标签）；
 * 2. 设为默认地址；
 * 3. 删除地址（二次确认）；
 * 4. 跳转编辑页新增/修改地址。
 *
 * 接口来源：外卖-用户端接口.openapi.json
 * - GET    /user/addressBook/list      地址列表
 * - PUT    /user/addressBook/default   设为默认
 * - DELETE /user/addressBook?id=       删除
 */
const api = require('../../api/index')

Page({
  data: {
    /** 地址列表 */
    addressList: [],

    /** 页面加载状态 */
    pageLoading: true,

    /** 加载失败 */
    loadError: false
  },

  /** 页面是否已卸载 */
  _destroyed: false,

  /** 是否正在执行操作（防重复点击） */
  _acting: false,

  onLoad() {
    this.loadAddress()
  },

  onShow() {
    // 从编辑页返回时刷新列表
    if (!this.data.pageLoading) {
      this.loadAddress()
    }
  },

  onUnload() {
    this._destroyed = true
  },

  /**
   * 加载地址列表
   */
  async loadAddress() {
    this.setData({ loadError: false })

    try {
      const list = await api.addressApi.list()
      if (this._destroyed) {
        return
      }

      const addressList = (list || []).map((item) => ({
        id: item.id,
        consignee: item.consignee || '',
        phone: item.phone || '',
        detail: `${item.cityName || ''}${item.districtName || ''}${item.detail || ''}`,
        isDefault: Number(item.isDefault) === 1
      }))

      this.setData({ addressList, pageLoading: false, loadError: false })
    } catch (err) {
      // 请求层已统一 toast，这里只负责页面错误态
      if (!this._destroyed) {
        this.setData({ pageLoading: false, loadError: true })
      }
    }
  },

  /**
   * 新增地址
   */
  onAdd() {
    wx.navigateTo({ url: '/pages/address/edit' })
  },

  /**
   * 编辑地址
   */
  onEdit(event) {
    const id = event.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/address/edit?id=${id}` })
  },

  /**
   * 设为默认地址
   */
  async onSetDefault(event) {
    const id = event.currentTarget.dataset.id
    if (this._acting) {
      return
    }
    this._acting = true

    try {
      await api.addressApi.setDefault(id)
      wx.showToast({ title: '已设为默认', icon: 'success' })
      await this.loadAddress()
    } catch (err) {
      // 请求层已统一 toast
    } finally {
      this._acting = false
    }
  },

  /**
   * 删除地址（二次确认）
   */
  onDelete(event) {
    const id = event.currentTarget.dataset.id

    wx.showModal({
      title: '提示',
      content: '确定要删除该地址吗？',
      confirmColor: '#ff8c00',
      success: async (res) => {
        if (!res.confirm || this._acting) {
          return
        }
        this._acting = true

        try {
          await api.addressApi.deleteById(id)
          wx.showToast({ title: '已删除', icon: 'success' })
          await this.loadAddress()
        } catch (err) {
          // 请求层已统一 toast
        } finally {
          this._acting = false
        }
      }
    })
  },

  /**
   * 加载失败重试
   */
  onRetry() {
    this.setData({ pageLoading: true })
    this.loadAddress()
  }
})
