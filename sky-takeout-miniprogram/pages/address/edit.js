/**
 * 地址编辑页（pages/address/edit）
 * 功能：
 * 1. 新增地址（无参数进入）；
 * 2. 编辑地址（带 ?id= 进入，回显表单）；
 * 3. 可勾选"设为默认地址"，保存后调用默认地址接口。
 *
 * 接口来源：外卖-用户端接口.openapi.json
 * - GET /user/addressBook/{id}     查询地址（编辑回显）
 * - POST /user/addressBook         新增
 * - PUT  /user/addressBook         修改
 * - PUT  /user/addressBook/default 设为默认
 */
const api = require('../../api/index')

/** 常用标签 */
const LABELS = ['公司', '家', '学校']

Page({
  data: {
    /** 是否编辑模式 */
    isEdit: false,

    /** 表单 */
    form: {
      consignee: '',
      phone: '',
      sex: '1',
      detail: '',
      label: '公司'
    },

    /** 标签候选项 */
    labels: LABELS,

    /** 设为默认地址 */
    setDefault: false,

    /** 是否正在保存 */
    saving: false
  },

  /** 编辑的地址 id */
  _editId: null,

  /** 页面是否已卸载 */
  _destroyed: false,

  onLoad(options) {
    if (options && options.id) {
      this._editId = options.id
      this.setData({ isEdit: true })
      wx.setNavigationBarTitle({ title: '修改地址' })
      this.loadDetail(options.id)
    }
  },

  onUnload() {
    this._destroyed = true
  },

  /**
   * 编辑模式：加载地址详情回显表单
   */
  async loadDetail(id) {
    try {
      const book = await api.addressApi.getById(id)
      if (this._destroyed || !book) {
        return
      }

      this.setData({
        form: {
          consignee: book.consignee || '',
          phone: book.phone || '',
          sex: book.sex ? String(book.sex) : '1',
          detail: book.detail || '',
          label: book.label || '公司'
        },
        setDefault: Number(book.isDefault) === 1
      })
    } catch (err) {
      // 请求层已统一 toast，失败时返回列表页
      setTimeout(() => wx.navigateBack(), 1500)
    }
  },

  /** 收货人输入 */
  onConsigneeInput(event) {
    this.setData({ 'form.consignee': event.detail.value })
  },

  /** 手机号输入 */
  onPhoneInput(event) {
    this.setData({ 'form.phone': event.detail.value })
  },

  /** 详细地址输入 */
  onDetailInput(event) {
    this.setData({ 'form.detail': event.detail.value })
  },

  /** 性别选择 */
  onSexChange(event) {
    this.setData({ 'form.sex': event.currentTarget.dataset.value })
  },

  /** 标签选择 */
  onLabelChange(event) {
    this.setData({ 'form.label': event.currentTarget.dataset.value })
  },

  /** 是否设为默认 */
  onDefaultChange(event) {
    this.setData({ setDefault: event.detail.value.length > 0 })
  },

  /**
   * 校验表单
   */
  validate() {
    const { consignee, phone, detail } = this.data.form

    if (!consignee.trim()) {
      wx.showToast({ title: '请填写收货人姓名', icon: 'none' })
      return false
    }
    if (!/^1\d{10}$/.test(phone.trim())) {
      wx.showToast({ title: '请填写正确的手机号', icon: 'none' })
      return false
    }
    if (!detail.trim()) {
      wx.showToast({ title: '请填写详细地址', icon: 'none' })
      return false
    }
    return true
  },

  /**
   * 保存地址
   */
  async onSave() {
    if (!this.validate() || this.data.saving) {
      return
    }
    this.setData({ saving: true })

    const { consignee, phone, sex, detail, label } = this.data.form

    try {
      if (this.data.isEdit) {
        // 修改：须带 id
        await api.addressApi.update({
          id: this._editId,
          consignee: consignee.trim(),
          phone: phone.trim(),
          sex,
          detail: detail.trim(),
          label
        })

        // 编辑时若勾选默认，同样生效
        if (this.data.setDefault) {
          await api.addressApi.setDefault(this._editId).catch(() => {})
        }
      } else {
        // 新增
        await api.addressApi.add({
          consignee: consignee.trim(),
          phone: phone.trim(),
          sex,
          detail: detail.trim(),
          label
        })

        // 新增后重新拉列表，把刚保存的地址设为默认
        if (this.data.setDefault) {
          const list = await api.addressApi.list().catch(() => [])
          const books = list || []
          if (books.length > 0) {
            // 后端 save 不返回 id，取 id 最大的（刚插入的一条）
            const newest = books.reduce((a, b) => (Number(a.id) > Number(b.id) ? a : b))
            if (newest && newest.id) {
              await api.addressApi.setDefault(newest.id).catch(() => {})
            }
          }
        }
      }

      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 800)
    } catch (err) {
      // 请求层已统一 toast
    } finally {
      if (!this._destroyed) {
        this.setData({ saving: false })
      }
    }
  }
})
