import request from '@/utils/request'

// 订单搜索
export function searchOrders(params) {
  return request.get('/admin/order/conditionSearch', { params })
}

// 订单详情
export function getOrderDetail(id) {
  return request.get(`/admin/order/details/${id}`)
}

// 订单状态数量统计
export function getOrderStatistics() {
  return request.get('/admin/order/statistics')
}

// 接单
export function confirmOrder(id) {
  return request.put('/admin/order/confirm', { id })
}

// 拒单
export function rejectOrder(id, rejectionReason) {
  return request.put('/admin/order/rejection', { id, rejectionReason })
}

// 取消订单
export function cancelOrder(id, cancelReason) {
  return request.put('/admin/order/cancel', { id, cancelReason })
}

// 派送订单
export function deliveryOrder(id) {
  return request.put(`/admin/order/delivery/${id}`)
}

// 完成订单
export function completeOrder(id) {
  return request.put(`/admin/order/complete/${id}`)
}
