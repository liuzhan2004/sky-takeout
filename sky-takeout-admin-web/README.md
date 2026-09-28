# 苍穹外卖管理端（Vue3 前端）

基于后端 OpenAPI 接口文档生成的餐饮外卖后台管理系统前端，技术栈为 **Vue3 + Vite + Element Plus + Axios + Vue Router 4 + ECharts**。

## 功能页面

| 页面 | 路由 | 说明 |
| --- | --- | --- |
| 登录 | `/login` | 员工账号密码登录，保存 JWT 至 localStorage |
| 工作台 | `/workspace` | 今日营业额、有效订单、客单价、新增用户、订单/菜品/套餐总览 |
| 员工管理 | `/employee` | 分页查询、新增/编辑员工、启用/禁用账号、修改个人密码 |
| 分类管理 | `/category` | 菜品/套餐分类增删改查、排序、启用/禁用 |
| 菜品管理 | `/dish` | 分页/按分类查询、图片上传、口味维护、启停售、单删/批量删除 |
| 套餐管理 | `/setmeal` | 分页/按分类查询、图片上传、套餐关联菜品与份数、启停售、批量删除 |
| 订单管理 | `/order` | 多条件查询、状态数量看板、订单详情、接单/拒单/派送/完成/取消 |
| 数据统计 | `/report` | 营业额、用户、订单、销量 Top10 图表，导出 Excel 报表 |

店铺营业状态开关位于系统顶栏右侧，对应 `/admin/shop/status` 与 `/admin/shop/{status}`。

## 目录结构

```text
.
├── .env.development / .env.production   # 后端接口地址
├── index.html
├── package.json
├── vite.config.js                       # Vite + @ 别名 + dev 代理
└── src
    ├── main.js                          # Element Plus 中文环境、图标全局注册
    ├── App.vue
    ├── api                              # 按业务域拆分接口函数
    │   ├── category.js  dish.js  setmeal.js
    │   ├── employee.js  order.js  report.js
    │   ├── common.js    shop.js  workspace.js
    ├── components/ImageUpload.vue       # 图片上传组件
    ├── layout/Layout.vue                # 侧边栏 + 顶栏 + 店铺状态 + 改密/退出
    ├── router/index.js                  # 路由与登录守卫
    ├── utils
    │   ├── request.js                   # Axios 封装（Bearer Token/Result 解包/401 处理）
    │   ├── auth.js                      # token 与用户信息 localStorage 管理
    │   └── format.js                    # 日期、金额、图片地址工具
    └── views
        ├── login / workspace / employee
        ├── category / dish / setmeal
        ├── order / report
```

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器（默认 http://localhost:5173）
npm run dev

# 3. 生产构建
npm run build

# 4. 本地预览构建产物
npm run preview
```

## 接口配置

- 后端地址默认 `http://localhost:8080`，可在 `.env.development`、`.env.production` 中修改 `VITE_APP_BASE_URL`。
- 后端需允许跨域，或在 `vite.config.js` 中启用 dev 代理后把请求地址改为同源地址。

## 鉴权与响应约定

- 登录成功后调用 `/admin/employee/login`，将返回的 `token` 与用户信息保存到 `localStorage`（key：`sky_admin_token` / `sky_admin_user`）。
- `src/utils/request.js` 请求拦截器自动为每个请求添加 `Authorization: Bearer ${token}`。
- 响应拦截器按后端统一格式 `Result{ code, msg, data }` 解包：`code === 1` 视为成功并返回 `data` 所在的整个 result；其他 code 自动弹出错误提示并 reject。
- 收到 401 时自动清除登录态并跳转登录页。

## 默认账号

登录账号由后端初始化决定，常规为 `admin / 123456`。

## 补充说明

- 新增员工初始密码通常为后端默认值 `123456`，可在员工管理中编辑账号基本信息。
- 数据统计页默认查询最近 7 天，可自行选择任意区间并导出 Excel。
- 上传接口返回图片地址，若返回相对路径会自动拼接 `VITE_APP_BASE_URL` 展示；若为完整 URL 则直接展示。
