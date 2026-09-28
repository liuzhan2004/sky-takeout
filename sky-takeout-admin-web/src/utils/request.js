import axios from 'axios'
import { ElMessage } from 'element-plus'

import router from '@/router'
import { getToken, clearAuth } from '@/utils/auth'
import { API_BASE_URL } from '@/utils/format'

const service = axios.create({
  baseURL: '/api',
  timeout: 20000
})

// 请求拦截：自动携带 jwt token（后端约定的请求头名称为 token）
service.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) {
      config.headers.token = token
    }
    return config
  },
  (error) => Promise.reject(error)
)

function showMessage(message) {
  ElMessage({
    type: 'error',
    message: message || '请求失败',
    duration: 2500
  })
}

// 响应拦截：统一处理后端 Result 结构
service.interceptors.response.use(
  async (response) => {
    const config = response.config
    // 文件流（下载 Excel 等）
    if (config.responseType === 'blob' && response.data instanceof Blob) {
      const contentType = response.headers?.['content-type'] || ''
      if (contentType.includes('application/json')) {
        const text = await response.data.text()
        let result
        try {
          result = JSON.parse(text)
        } catch {
          return response.data
        }
        if (result.code === 1) return result
        showMessage(result.msg || '操作失败')
        return Promise.reject(result)
      }
      return response.data
    }

    const result = response.data
    if (result && typeof result === 'object' && 'code' in result) {
      if (result.code === 1) {
        return result
      }
      if (result.code === 401) {
        handleUnauthorized(result.msg)
        return Promise.reject(result)
      }
      showMessage(result.msg || '操作失败')
      return Promise.reject(result)
    }
    return result
  },
  (error) => {
    const status = error.response?.status
    const result = error.response?.data
    if (status === 401) {
      handleUnauthorized(result?.msg)
      return Promise.reject(error)
    }
    if (status === 403) {
      showMessage('没有操作权限')
    } else {
      showMessage(result?.msg || error.message || '网络请求异常')
    }
    return Promise.reject(error)
  }
)

function handleUnauthorized(msg) {
  clearAuth()
  showMessage(msg || '登录状态已失效，请重新登录')
  if (router.currentRoute.value.path !== '/login') {
    router.replace({
      path: '/login',
      query: { redirect: router.currentRoute.value.fullPath }
    })
  }
}

export default service
