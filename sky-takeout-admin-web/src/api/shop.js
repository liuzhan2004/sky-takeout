import request from '@/utils/request'

// 获取营业状态：1 营业，0 打烊
export function getShopStatus() {
  return request.get('/admin/shop/status')
}

// 设置营业状态
export function setShopStatus(status) {
  return request.put(`/admin/shop/${status}`)
}
