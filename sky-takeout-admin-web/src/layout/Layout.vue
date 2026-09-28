<template>
  <el-container class="layout">
    <el-aside width="220px" class="layout-aside">
      <div class="logo">
        <span class="logo-icon">☁</span>
        <span class="logo-text">吃了么</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        background-color="#001529"
        text-color="rgba(255,255,255,0.68)"
        active-text-color="#fff"
        class="layout-menu"
      >
        <el-menu-item index="/workspace">
          <el-icon><Odometer /></el-icon>
          <span>工作台</span>
        </el-menu-item>
        <el-menu-item index="/employee">
          <el-icon><User /></el-icon>
          <span>员工管理</span>
        </el-menu-item>
        <el-menu-item index="/category">
          <el-icon><Menu /></el-icon>
          <span>分类管理</span>
        </el-menu-item>
        <el-menu-item index="/dish">
          <el-icon><Dish /></el-icon>
          <span>菜品管理</span>
        </el-menu-item>
        <el-menu-item index="/setmeal">
          <el-icon><Food /></el-icon>
          <span>套餐管理</span>
        </el-menu-item>
        <el-menu-item index="/order">
          <el-icon><Tickets /></el-icon>
          <span>订单管理</span>
        </el-menu-item>
        <el-menu-item index="/report">
          <el-icon><DataAnalysis /></el-icon>
          <span>数据统计</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container class="layout-body">
      <el-header class="layout-header" height="60px">
        <div class="header-title">{{ route.meta.title || '外卖管理端' }}</div>
        <div class="header-right">
          <div class="shop-status">
            <span class="status-label">店铺状态</span>
            <el-switch
              v-model="shopStatus"
              :active-value="1"
              :inactive-value="0"
              inline-prompt
              active-text="营业中"
              inactive-text="打烊"
              style="--el-switch-on-color: #13ce66"
              @change="handleShopStatusChange"
            />
          </div>
          <el-dropdown trigger="click" @command="handleCommand">
            <div class="user-info">
              <el-avatar :size="30" class="user-avatar">
                {{ avatarText }}
              </el-avatar>
              <span class="user-name">{{ user?.name || user?.userName || '管理员' }}</span>
              <el-icon><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="password">
                  <el-icon><Lock /></el-icon>
                  修改密码
                </el-dropdown-item>
                <el-dropdown-item command="logout" divided>
                  <el-icon><SwitchButton /></el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="layout-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>

  <el-dialog
    v-model="passwordVisible"
    title="修改密码"
    width="440px"
    :close-on-click-modal="false"
  >
    <el-form
      ref="passwordFormRef"
      :model="passwordForm"
      :rules="passwordRules"
      label-width="90px"
    >
      <el-form-item label="原密码" prop="oldPassword">
        <el-input
          v-model="passwordForm.oldPassword"
          type="password"
          show-password
          placeholder="请输入原密码"
        />
      </el-form-item>
      <el-form-item label="新密码" prop="newPassword">
        <el-input
          v-model="passwordForm.newPassword"
          type="password"
          show-password
          placeholder="请输入新密码"
        />
      </el-form-item>
      <el-form-item label="确认密码" prop="confirmPassword">
        <el-input
          v-model="passwordForm.confirmPassword"
          type="password"
          show-password
          placeholder="请再次输入新密码"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="passwordVisible = false">取消</el-button>
      <el-button type="primary" :loading="savingPassword" @click="submitPassword">
        确定
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

import { getShopStatus, setShopStatus } from '@/api/shop'
import { editPassword, logout } from '@/api/employee'
import { clearAuth, getLocalUser } from '@/utils/auth'
import { connectWebSocket, closeWebSocket } from '@/utils/websocket'

const route = useRoute()
const router = useRouter()

const activeMenu = computed(() => route.path)
const user = getLocalUser()
const avatarText = computed(() => {
  const name = user?.name || user?.userName || '管'
  return name.slice(0, 1).toUpperCase()
})

const shopStatus = ref(1)

onMounted(async () => {
  try {
    const res = await getShopStatus()
    shopStatus.value = res.data
  } catch {
    shopStatus.value = 1
  }

  // 登录后建立 WebSocket 连接，接收来单提醒 / 客户催单推送
  connectWebSocket()
})

onUnmounted(() => {
  closeWebSocket()
})

async function handleShopStatusChange(value) {
  try {
    await setShopStatus(value)
    ElMessage.success(value === 1 ? '店铺已开始营业' : '店铺已打烊')
  } catch {
    shopStatus.value = value === 1 ? 0 : 1
  }
}

function handleCommand(command) {
  if (command === 'password') {
    passwordVisible.value = true
  } else if (command === 'logout') {
    handleLogout()
  }
}

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      type: 'warning',
      confirmButtonText: '退出',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  try {
    await logout()
  } catch {
    // 接口失败也允许本地退出
  }
  clearAuth()
  ElMessage.success('已退出登录')
  router.replace('/login')
}

const passwordVisible = ref(false)
const passwordFormRef = ref()
const savingPassword = ref(false)
const passwordForm = reactive({
  empId: user?.id,
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const validateConfirm = (rule, value, callback) => {
  if (value !== passwordForm.newPassword) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const passwordRules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度为 6-20 位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    { validator: validateConfirm, trigger: 'blur' }
  ]
}

async function submitPassword() {
  const valid = await passwordFormRef.value.validate().catch(() => false)
  if (!valid) return
  savingPassword.value = true
  try {
    const { confirmPassword, ...payload } = passwordForm
    await editPassword(payload)
    ElMessage.success('密码修改成功')
    passwordVisible.value = false
    Object.assign(passwordForm, {
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    })
    passwordFormRef.value.resetFields()
  } finally {
    savingPassword.value = false
  }
}
</script>

<style scoped>
.layout {
  height: 100%;
}

.layout-aside {
  background: var(--app-sidebar-bg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.logo {
  height: var(--app-header-height);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #fff;
  flex-shrink: 0;
  background: #002140;
}

.logo-icon {
  font-size: 26px;
  color: #ffd04b;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 1px;
}

.layout-menu {
  flex: 1;
  border-right: none;
  overflow-y: auto;
}

.layout-menu :deep(.el-menu-item.is-active) {
  background: #409eff !important;
}

.layout-menu :deep(.el-menu-item:hover) {
  background: #1e3a5f;
}

.layout-body {
  min-width: 0;
}

.layout-header {
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  z-index: 2;
}

.header-title {
  font-size: 17px;
  font-weight: 600;
  color: #303133;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 24px;
}

.shop-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-label {
  font-size: 13px;
  color: #606266;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  outline: none;
}

.user-avatar {
  background: #409eff;
  color: #fff;
  font-weight: 600;
}

.user-name {
  font-size: 14px;
  color: #303133;
}

.layout-main {
  background: #f0f2f5;
  overflow-y: auto;
  padding: 16px;
}
</style>
