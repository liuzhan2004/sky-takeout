import request from '@/utils/request'

// 套餐分页查询
export function pageSetmeal(params) {
  return request.get('/admin/setmeal/page', { params })
}

// 根据 id 查询套餐
export function getSetmealById(id) {
  return request.get(`/admin/setmeal/${id}`)
}

// 新增套餐
export function addSetmeal(data) {
  return request.post('/admin/setmeal', data)
}

// 修改套餐
export function updateSetmeal(data) {
  return request.put('/admin/setmeal', data)
}

// 批量删除套餐（ids 逗号分隔）
export function deleteSetmeal(ids) {
  const params = { ids: Array.isArray(ids) ? ids.join(',') : ids }
  return request.delete('/admin/setmeal', { params })
}

// 套餐起售 / 停售
export function updateSetmealStatus(id, status) {
  return request.post(`/admin/setmeal/status/${status}`, null, {
    params: { id }
  })
}
