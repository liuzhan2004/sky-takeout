import request from '@/utils/request'

// 员工登录
export function login(data) {
  return request.post('/admin/employee/login', data)
}

// 退出登录
export function logout() {
  return request.post('/admin/employee/logout')
}

// 员工分页查询
export function pageEmployee(params) {
  return request.get('/admin/employee/page', { params })
}

// 新增员工
export function addEmployee(data) {
  return request.post('/admin/employee', data)
}

// 编辑员工信息
export function updateEmployee(data) {
  return request.put('/admin/employee', data)
}

// 根据 id 查询员工
export function getEmployeeById(id) {
  return request.get(`/admin/employee/${id}`)
}

// 启用 / 禁用员工账号
export function updateEmployeeStatus(id, status) {
  return request.post(`/admin/employee/status/${status}`, null, {
    params: { id }
  })
}

// 修改密码
export function editPassword(data) {
  return request.put('/admin/employee/editPassword', data)
}
