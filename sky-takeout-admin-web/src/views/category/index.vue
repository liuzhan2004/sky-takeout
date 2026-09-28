<template>
  <div class="page-card">
    <el-radio-group v-model="query.type" class="type-tabs" @change="handleSearch">
      <el-radio-button :value="1">菜品分类</el-radio-button>
      <el-radio-button :value="2">套餐分类</el-radio-button>
    </el-radio-group>

    <el-form inline class="search-form" @submit.prevent>
      <el-form-item label="分类名称">
        <el-input
          v-model="query.name"
          placeholder="请输入分类名称"
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
      <span class="toolbar-title">
        {{ query.type === 1 ? '菜品分类' : '套餐分类' }}列表
      </span>
      <el-button type="primary" :icon="Plus" @click="openAddDialog">
        新增分类
      </el-button>
    </div>

    <el-table v-loading="loading" :data="list" border stripe>
      <el-table-column label="分类名称" prop="name" min-width="160" />
      <el-table-column label="分类类型" width="110" align="center">
        <template #default="{ row }">
          {{ row.type === 1 ? '菜品分类' : '套餐分类' }}
        </template>
      </el-table-column>
      <el-table-column label="排序" prop="sort" width="80" align="center" />
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
          <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
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

  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="480px"
    :close-on-click-modal="false"
    @closed="resetForm"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="formRules"
      label-width="90px"
    >
      <el-form-item label="分类类型">
        <el-tag :type="form.type === 1 ? 'primary' : 'success'">
          {{ form.type === 1 ? '菜品分类' : '套餐分类' }}
        </el-tag>
      </el-form-item>
      <el-form-item label="分类名称" prop="name">
        <el-input
          v-model="form.name"
          placeholder="请输入分类名称"
          maxlength="20"
        />
      </el-form-item>
      <el-form-item label="排序" prop="sort">
        <el-input-number
          v-model="form.sort"
          :min="0"
          :max="999"
          controls-position="right"
          style="width: 100%"
        />
      </el-form-item>
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
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Search } from '@element-plus/icons-vue'

import {
  addCategory,
  deleteCategory,
  pageCategory,
  updateCategory,
  updateCategoryStatus
} from '@/api/category'
import { formatDateTime } from '@/utils/format'

const loading = ref(false)
const list = ref([])
const total = ref(0)
const query = reactive({
  name: '',
  type: 1,
  page: 1,
  pageSize: 10
})

async function fetchList() {
  loading.value = true
  try {
    const res = await pageCategory({
      page: query.page,
      pageSize: query.pageSize,
      type: query.type,
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
    await updateCategoryStatus(row.id, next)
    ElMessage.success(next === 1 ? '分类已启用' : '分类已禁用')
    return true
  } catch {
    return false
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定要删除分类「${row.name}」吗？分类下有菜品/套餐时无法删除。`,
      '删除提示',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  await deleteCategory(row.id)
  ElMessage.success('删除成功')
  if (list.value.length === 1 && query.page > 1) query.page -= 1
  fetchList()
}

const dialogVisible = ref(false)
const dialogTitle = computed(() => (isEdit.value ? '编辑分类' : '新增分类'))
const formRef = ref()
const saving = ref(false)
const isEdit = ref(false)

const defaultForm = () => ({
  id: null,
  name: '',
  sort: 1,
  type: 1
})

const form = reactive(defaultForm())

const formRules = {
  name: [{ required: true, message: '请输入分类名称', trigger: 'blur' }],
  sort: [{ required: true, message: '请输入排序值', trigger: 'change' }]
}

function openAddDialog() {
  isEdit.value = false
  Object.assign(form, defaultForm(), { type: query.type })
  dialogVisible.value = true
}

function openEditDialog(row) {
  isEdit.value = true
  Object.assign(form, defaultForm(), {
    id: row.id,
    name: row.name,
    sort: row.sort,
    type: row.type
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
      await updateCategory({ ...form })
      ElMessage.success('分类修改成功')
    } else {
      await addCategory({ ...form })
      ElMessage.success('分类新增成功')
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
.type-tabs {
  margin-bottom: 14px;
}

.search-form {
  margin-top: 2px;
}

.toolbar-title {
  font-weight: 600;
  font-size: 15px;
}
</style>
