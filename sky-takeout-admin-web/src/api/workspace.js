import request from '@/utils/request'

// 查询今日运营数据
export function getBusinessData() {
  return request.get('/admin/workspace/businessData')
}

// 订单管理数据总览
export function getOverviewOrders() {
  return request.get('/admin/workspace/overviewOrders')
}

// 菜品总览
export function getOverviewDishes() {
  return request.get('/admin/workspace/overviewDishes')
}

// 套餐总览
export function getOverviewSetmeals() {
  return request.get('/admin/workspace/overviewSetmeals')
}
