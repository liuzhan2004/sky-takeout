import request from '@/utils/request'

// 菜品分页查询
export function pageDish(params) {
  return request.get('/admin/dish/page', { params })
}

// 根据分类 id 查询菜品
export function listDishByCategory(categoryId) {
  return request.get('/admin/dish/list', { params: { categoryId } })
}

// 根据 id 查询菜品
export function getDishById(id) {
  return request.get(`/admin/dish/${id}`)
}

// 新增菜品
export function addDish(data) {
  return request.post('/admin/dish', data)
}

// 修改菜品
export function updateDish(data) {
  return request.put('/admin/dish', data)
}

// 批量删除菜品（ids 逗号分隔）
export function deleteDish(ids) {
  const params = { ids: Array.isArray(ids) ? ids.join(',') : ids }
  return request.delete('/admin/dish', { params })
}

// 菜品起售 / 停售
export function updateDishStatus(id, status) {
  return request.post(`/admin/dish/status/${status}`, null, {
    params: { id }
  })
}
