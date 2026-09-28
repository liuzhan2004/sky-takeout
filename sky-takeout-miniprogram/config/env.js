/**
 * config/env.js
 * 环境配置：小程序端所有接口地址统一从这里读取，
 * 切换测试/生产环境时只需修改本文件。
 */

module.exports = {
  /**
   * 接口基础地址
   * TODO: Swagger 文档确认后，替换为真实的 HTTPS 接口域名。
   * 注意：正式环境域名必须在微信公众平台配置到 request 合法域名。
   */
  // baseUrl: 'https://api.example.com',
  baseUrl: 'http://localhost:8080',

  /**
   * 默认请求超时时间（毫秒）
   */
  timeout: 10000
}
