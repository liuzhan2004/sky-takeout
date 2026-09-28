<template>
  <div class="page-card">
    <!-- 搜索区 -->
    <el-form inline @submit.prevent>
      <el-form-item label="员工姓名">
        <el-input
          v-model="query.name"
          placeholder="请输入员工姓名"
          clearable
          style="width: 220px"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :icon="Search" @click="handleSearch">
          查询
        </el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </el-form-item>
    </el-form>

    <div class="table-toolbar">
      <span class="toolbar-title">员工列表</span>
      <el-button type="primary" :icon="Plus" @click="openAddDialog">
        新增员工
      </el-button>
    </div>

    <el-table v-loading="loading" :data="list" border stripe>
      <el-table-column label="员工账号" prop="username" min-width="130" />
      <el-table-column label="姓名" prop="name" min-width="110" />
      <el-table-column label="手机号" prop="phone" min-width="130" />
      <el-table-column label="性别" width="70" align="center">
        <template #default="{ row }">
          <!-- <el-tag :type="row.sex === '男' ? 'primary' : 'danger'" effect="plain">
            {{ row.sex }}
          </el-tag> -->
          <el-tag :type="row.sex === 1 ? 'primary' : 'danger'" effect="plain">
          {{ row.sex ==="1" ? '男' : '女' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="身份证号" prop="idNumber" min-width="180" show-overflow-tooltip />
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-switch
            v-model="row.status"
            :active-value="1"
            :inactive-value="0"
            :before-change="() => handleStatusChange(row)"
          />
        </template>
      </el-table-column>
      <el-table-column label="创建时间" prop="createTime" width="170">
        <template #default="{ row }">
          {{ formatDateTime(row.createTime) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEditDialog(row)">
            编辑
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @size-change="fetchList"
        @current-change="fetchList"
      />
    </div>
  </div>

  <!-- 新增 / 编辑弹窗 -->
  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="560px"
    :close-on-click-modal="false"
    @closed="resetForm"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="formRules"
      label-width="90px"
    >
      <el-form-item label="员工账号" prop="username">
        <el-input
          v-model="form.username"
          placeholder="请输入员工账号"
          :disabled="isEdit"
          maxlength="20"
        />
      </el-form-item>
      <el-form-item label="姓名" prop="name">
        <el-input v-model="form.name" placeholder="请输入姓名" maxlength="20" />
      </el-form-item>
      <el-form-item label="手机号" prop="phone">
        <el-input v-model="form.phone" placeholder="请输入手机号" maxlength="11" />
      </el-form-item>
      <el-form-item label="性别" prop="sex">
        <el-radio-group v-model="form.sex">
          <el-radio value="1">男</el-radio>
          <el-radio value="0">女</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="身份证号" prop="idNumber">
        <el-input
          v-model="form.idNumber"
          placeholder="请输入身份证号"
          maxlength="18"
        />
      </el-form-item>
      <el-alert
        v-if="!isEdit"
        type="info"
        :closable="false"
        show-icon
        title="新增员工初始密码默认为 123456，创建后请及时修改。"
      />
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">
        确定
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Refresh, Search } from '@element-plus/icons-vue'

import {
  addEmployee,
  pageEmployee,
  updateEmployee,
  updateEmployeeStatus
} from '@/api/employee'
import { formatDateTime } from '@/utils/format'

const loading = ref(false)
const list = ref([])
const total = ref(0)
const query = reactive({
  name: '',
  page: 1,
  pageSize: 10
})

async function fetchList() {
  loading.value = true
  try {
    const res = await pageEmployee({
      page: query.page,
      pageSize: query.pageSize,
      name: query.name || undefined
    })
    list.value = res.data.records || []
    total.value = res.data.total || 0
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  query.page = 1
  fetchList()
}

function handleReset() {
  query.name = ''
  query.page = 1
  fetchList()
}

async function handleStatusChange(row) {
  const next = row.status === 1 ? 0 : 1
  try {
    await updateEmployeeStatus(row.id, next)
    ElMessage.success(next === 1 ? '账号已启用' : '账号已禁用')
    return true
  } catch {
    return false
  }
}

const dialogVisible = ref(false)
const dialogTitle = computed(() => (isEdit.value ? '编辑员工' : '新增员工'))
const formRef = ref()
const saving = ref(false)
const isEdit = ref(false)

const defaultForm = () => ({
  id: null,
  username: '',
  name: '',
  phone: '',
  // sex: '男',
  sex: '',
  idNumber: ''
})

const form = reactive(defaultForm())

const phonePattern = /^1[3-9]\d{9}$/
const idPattern = /(^\d{15}$)|(^\d{17}(\d|X|x)$)/

const formRules = {
  username: [{ required: true, message: '请输入员工账号', trigger: 'blur' }],
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: phonePattern, message: '手机号格式不正确', trigger: 'blur' }
  ],
  sex: [{ required: true, message: '请选择性别', trigger: 'change' }],
  idNumber: [
    { required: true, message: '请输入身份证号', trigger: 'blur' },
    { pattern: idPattern, message: '身份证号格式不正确', trigger: 'blur' }
  ]
}

function openAddDialog() {
  isEdit.value = false
  dialogVisible.value = true
}

function openEditDialog(row) {
  isEdit.value = true
  Object.assign(form, defaultForm(), {
    id: row.id,
    username: row.username,
    name: row.name,
    phone: row.phone,
    sex: row.sex,
    idNumber: row.idNumber
  })
  dialogVisible.value = true
}

function resetForm() {
  formRef.value?.resetFields()
  Object.assign(form, defaultForm())
}

async function handleSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    if (isEdit.value) {
      await updateEmployee({ ...form })
      ElMessage.success('员工信息修改成功')
    } else {
      await addEmployee({ ...form })
      ElMessage.success('员工新增成功')
    }
    dialogVisible.value = false
    fetchList()
  } finally {
    saving.value = false
  }
}

onMounted(fetchList)
</script>

<style scoped>
.toolbar-title {
  font-weight: 600;
  font-size: 15px;
}
</style>
