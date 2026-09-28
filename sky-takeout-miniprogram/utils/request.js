/**
 * utils/request.js
 * 全局网络请求封装（基于 wx.request 的 Promise 化实现）。
 *
 * 设计目标：
 * 1. 请求拦截器：自动从本地缓存读取 token，并写入请求头 authentication；
 * 2. 响应拦截器：统一处理 HTTP 状态码与业务错误码；
 * 3. 401 处理：清除本地登录态并统一跳转登录页，避免每个页面各自处理；
 * 4. 页面统一使用 Promise 语法调用，不再重复封装 wx.request。
 */
const auth = require('./auth')
const env = require('../config/env')

/** 默认请求超时时间（毫秒） */
const DEFAULT_TIMEOUT = 10000

/**
 * 业务成功码
 * 苍穹外卖接口约定：code = 1 表示业务成功。
 * TODO: Swagger 文档确认后，若成功码不同，只需修改这里。
 */
const SUCCESS_CODE = 1

/** 防止多个请求同时 401 时重复跳转登录页 */
let redirectingToLogin = false

/**
 * 拼接完整请求地址
 * 支持两种 url 写法：
 * - 相对路径：'/user/user/login'
 * - 绝对地址：'https://xxx.com/yyy'（多用于 H5/CDN 资源，不经过业务拦截）
 */
function buildFullUrl(url) {
  if (/^https?:\/\//.test(url)) {
    return url
  }

  const prefix = env.baseUrl.replace(/\/$/, '')
  const path = url.startsWith('/') ? url : `/${url}`
  return `${prefix}${path}`
}

/**
 * 组装请求头（请求拦截器核心逻辑）
 * @param {object} [customHeader] - 调用方自定义请求头
 * @returns {object} 最终请求头
 */
function buildHeader(customHeader) {
  const header = Object.assign(
    {
      'Content-Type': 'application/json'
    },
    customHeader
  )

  // 自动注入登录凭证；苍穹外卖用户端 JWT 拦截器约定的 Header 键名为 authentication
  // （对应后端配置 sky.jwt.user-token-name: authentication，不能写成 authorization）
  const token = auth.getToken()
  if (token) {
    header.authentication = token
  }

  return header
}

/**
 * 跳转登录页
 * 使用 reLaunch 清空页面栈；通过 redirect 参数记录来源页，登录成功后可回跳。
 */
function redirectToLoginPage() {
  if (redirectingToLogin) {
    return
  }
  redirectingToLogin = true

  let redirectQuery = ''
  try {
    const pages = getCurrentPages()
    const currentPage = pages[pages.length - 1]

    // 当前不在登录页时，才记录回跳地址
    if (currentPage && currentPage.route && currentPage.route !== 'pages/login/login') {
      const redirectPath = `/${currentPage.route}`
      redirectQuery = `?redirect=${encodeURIComponent(redirectPath)}`
    }
  } catch (e) {
    // 获取页面栈失败时忽略，仅跳转登录页
  }

  wx.reLaunch({
    url: `${auth.LOGIN_PAGE_PATH}${redirectQuery}`,
    complete: () => {
      redirectingToLogin = false
    }
  })
}

/**
 * 处理 401 未授权
 * 清除本地 token，并将全局登录态置空，然后跳转登录页。
 */
function handleUnauthorized() {
  auth.clearAuth()

  const app = getApp()
  if (app && app.globalData) {
    app.globalData.token = ''
    app.globalData.userInfo = null
  }

  redirectToLoginPage()
}

/**
 * 构造统一错误对象
 * @param {string} message - 错误描述
 * @param {number|string} [code] - 错误码
 */
function createError(message, code) {
  const error = new Error(message)
  error.code = code
  return error
}

/**
 * 通用错误提示
 * 默认弹出轻提示；业务侧可通过 options.showError 关闭，自行处理错误。
 */
function showErrorTip(message) {
  wx.showToast({
    title: message || '请求失败，请稍后重试',
    icon: 'none',
    duration: 2000
  })
}

/**
 * 从接口响应体中提取错误描述
 * 兼容 msg / message / errorMsg 等常见字段命名
 */
function extractErrorMessage(body, fallback) {
  if (!body || typeof body !== 'object') {
    return fallback
  }

  return body.msg || body.message || body.errorMsg || fallback
}

/**
 * 核心请求方法（响应拦截器逻辑集中在 success 回调中）
 * @param {object} options
 * @param {string} options.url - 接口路径（相对路径）
 * @param {string} [options.method='GET'] - 请求方法：GET / POST / PUT / DELETE
 * @param {object} [options.data] - 请求参数
 * @param {object} [options.header] - 自定义请求头
 * @param {number} [options.timeout] - 超时时间
 * @param {boolean} [options.loading=false] - 是否显示全局 loading
 * @param {string} [options.loadingText='加载中...'] - loading 文案
 * @param {boolean} [options.showError=true] - 业务失败时是否自动 toast
 * @returns {Promise<any>} 成功时 resolve 业务数据（body.data），失败时 reject
 */
function request(options = {}) {
  const {
    url,
    method = 'GET',
    data = {},
    header,
    timeout = env.timeout || DEFAULT_TIMEOUT,
    loading = false,
    loadingText = '加载中...',
    showError = true
  } = options

  if (!url) {
    return Promise.reject(createError('接口地址不能为空'))
  }

  if (loading) {
    wx.showLoading({
      title: loadingText,
      mask: true
    })
  }

  // GET 请求追加时间戳参数：微信开发者工具对相同 URL 的 GET 响应有缓存，
  // 会导致购物车等接口读到旧数据，加 _t 参数强制每次真实请求后端
  const fullUrl =
    method === 'GET'
      ? `${buildFullUrl(url)}${url.indexOf('?') > -1 ? '&' : '?'}_t=${Date.now()}`
      : buildFullUrl(url)

  return new Promise((resolve, reject) => {
    wx.request({
      url: fullUrl,
      method,
      data,
      // 请求拦截器：注入统一请求头与 token
      header: buildHeader(header),
      timeout,

      success: (res) => {
        const { statusCode, data: body } = res

        // 未授权：token 缺失/过期/被篡改
        if (statusCode === 401) {
          handleUnauthorized()
          reject(createError('登录已过期，请重新登录', 401))
          return
        }

        // 非 2xx HTTP 状态码
        if (statusCode < 200 || statusCode >= 300) {
          const message = extractErrorMessage(body, `请求失败（${statusCode}）`)
          if (showError) {
            showErrorTip(message)
          }
          reject(createError(message, statusCode))
          return
        }

        // HTTP 2xx：继续判断业务错误码
        if (body && typeof body === 'object' && body.code !== undefined) {
          // 业务层返回 401，与 HTTP 401 同等处理
          if (Number(body.code) === 401) {
            handleUnauthorized()
            reject(createError('登录已过期，请重新登录', 401))
            return
          }

          // 业务成功：只把 data 字段抛给业务层
          if (Number(body.code) === SUCCESS_CODE) {
            resolve(body.data)
            return
          }

          // 业务失败：提示 msg 并 reject
          const message = extractErrorMessage(body, '业务处理失败')
          if (showError) {
            showErrorTip(message)
          }
          reject(createError(message, body.code))
          return
        }

        // 非标准结构（如纯 HTML / 文件流），直接原样返回
        resolve(body)
      },

      fail: (err) => {
        // 网络异常/超时
        const errMsg = (err && err.errMsg) || ''
        const isTimeout = errMsg.indexOf('timeout') > -1
        const message = isTimeout ? '请求超时，请稍后重试' : '网络异常，请检查网络设置'
        if (showError) {
          showErrorTip(message)
        }
        reject(createError(message, -1))
      },

      complete: () => {
        if (loading) {
          wx.hideLoading()
        }
      }
    })
  })
}

/**
 * 请求方法快捷封装
 * 统一 data 参数位置，页面调用更简洁：
 * request.get('/xxx', { page: 1 })
 * request.post('/xxx', { name: '张三' })
 */
module.exports = {
  request,

  /** GET 请求 */
  get(url, data, options) {
    return request(Object.assign({}, options, { url, data, method: 'GET' }))
  },

  /** POST 请求 */
  post(url, data, options) {
    return request(Object.assign({}, options, { url, data, method: 'POST' }))
  },

  /** PUT 请求 */
  put(url, data, options) {
    return request(Object.assign({}, options, { url, data, method: 'PUT' }))
  },

  /** DELETE 请求 */
  del(url, data, options) {
    return request(Object.assign({}, options, { url, data, method: 'DELETE' }))
  }
}
