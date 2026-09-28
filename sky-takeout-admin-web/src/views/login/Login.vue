<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-brand">
        <div class="brand-icon">☁</div>
        <h1 class="brand-title">外卖管理端</h1>
        <p class="brand-subtitle">Sky Take-out Admin System</p>
      </div>

      <el-form
        ref="loginFormRef"
        :model="loginForm"
        :rules="loginRules"
        size="large"
        @keyup.enter="handleLogin"
      >
        <el-form-item prop="username">
          <el-input
            v-model="loginForm.username"
            placeholder="请输入用户名"
            :prefix-icon="User"
            clearable
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="loginForm.password"
            type="password"
            show-password
            placeholder="请输入密码"
            :prefix-icon="Lock"
          />
        </el-form-item>
        <el-button
          type="primary"
          size="large"
          class="login-button"
          :loading="loading"
          @click="handleLogin"
        >
          登 录
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Lock, User } from '@element-plus/icons-vue'

import { login } from '@/api/employee'
import { setLocalUser, setToken } from '@/utils/auth'

const route = useRoute()
const router = useRouter()
const loginFormRef = ref()
const loading = ref(false)

const loginForm = reactive({
  username: '',
  password: ''
})

const loginRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function handleLogin() {
  const valid = await loginFormRef.value.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    const res = await login(loginForm)
    const { token, ...userInfo } = res.data
    setToken(token)
    setLocalUser(userInfo)
    ElMessage.success('登录成功')
    router.replace(route.query.redirect || '/')
  } catch {
    // 错误提示已在请求拦截器中统一处理
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1f6feb 0%, #5b8def 45%, #8fb7ff 100%);
  position: relative;
  overflow: hidden;
}

.login-page::before,
.login-page::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
}

.login-page::before {
  width: 480px;
  height: 480px;
  top: -160px;
  left: -120px;
}

.login-page::after {
  width: 360px;
  height: 360px;
  right: -100px;
  bottom: -140px;
}

.login-card {
  position: relative;
  z-index: 1;
  width: 400px;
  padding: 40px 36px 28px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}

.login-brand {
  text-align: center;
  margin-bottom: 30px;
}

.brand-icon {
  width: 62px;
  height: 62px;
  margin: 0 auto 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34px;
  color: #ffd04b;
  background: #001529;
  border-radius: 16px;
}

.brand-title {
  margin: 0;
  font-size: 22px;
  color: #001529;
}

.brand-subtitle {
  margin: 8px 0 0;
  font-size: 12px;
  color: #a0a8b5;
  letter-spacing: 0.5px;
}

.login-button {
  width: 100%;
  margin-top: 6px;
  letter-spacing: 6px;
  font-weight: 600;
}
</style>
