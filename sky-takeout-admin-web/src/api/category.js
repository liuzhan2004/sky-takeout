import request from '@/utils/request'

// 分类分页查询
export function pageCategory(params) {
  return request.get('/admin/category/page', { params })
}

// 根据类型查询分类
export function listCategory(type) {
  return request.get('/admin/category/list', { params: { type } })
}

// 新增分类
export function addCategory(data) {
  return request.post('/admin/category', data)
}

// 修改分类
export function updateCategory(data) {
  return request.put('/admin/category', data)
}

// 删除分类
export function deleteCategory(id) {
  return request.delete('/admin/category', { params: { id } })
}

// 启用 / 禁用分类
export function updateCategoryStatus(id, status) {
  return request.post(`/admin/category/status/${status}`, null, {
    params: { id }
  })
}
