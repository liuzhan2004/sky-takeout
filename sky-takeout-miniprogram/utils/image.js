/**
 * utils/image.js
 * 图片地址处理工具。
 * 后端接口（菜品/套餐/购物车等）返回的 image 字段可能是：
 * 1. 完整 http(s) 地址 —— 直接使用；
 * 2. 相对路径（如 "/common/download?name=xxx.png"）—— 需要拼接接口基础地址。
 * 页面渲染前统一调用 resolveImage 处理，避免相对路径图片无法显示。
 */
const env = require('../config/env')

/**
 * 解析后端返回的图片路径为可展示的完整地址
 * @param {string} url - 后端返回的图片路径
 * @returns {string} 空路径返回空字符串
 */
function resolveImage(url) {
  if (!url) {
    return ''
  }

  if (/^https?:\/\//.test(url)) {
    return url
  }

  const base = env.baseUrl.replace(/\/$/, '')
  const path = url.startsWith('/') ? url : `/${url}`
  return `${base}${path}`
}

module.exports = {
  resolveImage
}
