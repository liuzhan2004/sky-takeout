import request from '@/utils/request'

// 营业额统计
export function turnoverStatistics(params) {
  return request.get('/admin/report/turnoverStatistics', { params })
}

// 用户统计
export function userStatistics(params) {
  return request.get('/admin/report/userStatistics', { params })
}

// 订单统计
export function ordersStatistics(params) {
  return request.get('/admin/report/ordersStatistics', { params })
}

// 销量排名 top10
export function salesTop10(params) {
  return request.get('/admin/report/top10', { params })
}

// 导出 Excel 报表（返回文件流）
export function exportReport() {
  return request.get('/admin/report/export', { responseType: 'blob' })
}
