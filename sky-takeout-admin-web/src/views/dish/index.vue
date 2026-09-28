<template>
  <div class="page-card">
    <el-form inline @submit.prevent>
      <el-form-item label="菜品名称">
        <el-input
          v-model="query.name"
          placeholder="请输入菜品名称"
          clearable
          style="width: 190px"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />
      </el-form-item>
      <el-form-item label="分类">
        <el-select
          v-model="query.categoryId"
          placeholder="请选择分类"
          clearable
          style="width: 170px"
          @change="handleSearch"
        >
          <el-option
            v-for="item in categories"
            :key="item.id"
            :label="item.name"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select
          v-model="query.status"
          placeholder="全部"
          clearable
          style="width: 140px"
          @change="handleSearch"
        >
          <el-option label="起售" :value="1" />
          <el-option label="停售" :value="0" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :icon="Search" @click="handleSearch">
          查询
        </el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </el-form-item>
    </el-form>

    <div class="table-toolbar">
      <div>
        <el-button type="primary" :icon="Plus" @click="openAddDialog">
          新增菜品
        </el-button>
        <el-button
          type="danger"
          :icon="Delete"
          :disabled="!selectedIds.length"
          @click="handleBatchDelete"
        >
          批量删除
        </el-button>
      </div>
    </div>

    <el-table
      v-loading="loading"
      :data="list"
      border
      stripe
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="46" />
      <el-table-column label="图片" width="90" align="center">
        <template #default="{ row }">
          <el-image
            v-if="row.image"
            :src="toFileUrl(row.image)"
            :preview-src-list="[toFileUrl(row.image)]"
            fit="cover"
            class="dish-image"
            preview-teleported
          />
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="菜品名称" prop="name" min-width="140" />
      <el-table-column label="分类" prop="categoryName" width="110" />
      <el-table-column label="售价(元)" width="110" align="center">
        <template #default="{ row }">
          {{ formatMoney(row.price) }}
        </template>
      </el-table-column>
      <el-table-column label="描述" prop="description" min-width="160" show-overflow-tooltip />
      <el-table-column label="状态" width="95" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'">
            {{ row.status === 1 ? '起售' : '停售' }}
          </el-tag>
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

  <!-- 新增 / 编辑菜品 -->
  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="680px"
    :close-on-click-modal="false"
    @closed="resetForm"
  >
    <el-form
      v-loading="dialogLoading"
      ref="formRef"
      :model="form"
      :rules="formRules"
      label-width="90px"
    >
      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="菜品名称" prop="name">
            <el-input v-model="form.name" placeholder="请输入菜品名称" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="菜品分类" prop="categoryId">
            <el-select
              v-model="form.categoryId"
              placeholder="请选择分类"
              style="width: 100%"
            >
              <el-option
                v-for="item in categories"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="菜品价格" prop="price">
            <el-input-number
              v-model="form.price"
              :min="0"
              :max="99999"
              :precision="2"
              :step="1"
              controls-position="right"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="菜品状态" prop="status">
            <el-radio-group v-model="form.status">
              <el-radio :value="1">起售</el-radio>
              <el-radio :value="0">停售</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="菜品图片" prop="image">
        <ImageUpload v-model="form.image" />
      </el-form-item>
      <el-form-item label="菜品描述" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="2"
          maxlength="100"
          show-word-limit
          placeholder="请输入菜品描述"
        />
      </el-form-item>
      <el-form-item label="口味">
        <div class="flavor-editor">
          <div
            v-for="(item, index) in form.flavors"
            :key="index"
            class="flavor-row"
          >
            <el-input
              v-model="item.name"
              placeholder="口味名称，如：辣度"
              class="flavor-name"
            />
            <el-input
              v-model="item.valueText"
              placeholder="口味选项，多个用英文逗号分隔，如：不辣,微辣,中辣"
              class="flavor-value"
            />
            <el-button
              :icon="Delete"
              circle
              plain
              type="danger"
              @click="removeFlavor(index)"
            />
          </div>
          <el-button :icon="Plus" plain type="primary" @click="addFlavor">
            添加口味
          </el-button>
        </div>
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
import { Delete, Plus, Refresh, Search } from '@element-plus/icons-vue'

import ImageUpload from '@/components/ImageUpload.vue'
import {
  addDish,
  deleteDish,
  getDishById,
  pageDish,
  updateDish
} from '@/api/dish'
import { listCategory } from '@/api/category'
import { formatMoney, toFileUrl } from '@/utils/format'

const loading = ref(false)
const list = ref([])
const total = ref(0)
const categories = ref([])
const selectedIds = ref([])

const query = reactive({
  name: '',
  categoryId: null,
  status: null,
  page: 1,
  pageSize: 10
})

async function fetchList() {
  loading.value = true
  try {
    const res = await pageDish({
      page: query.page,
      pageSize: query.pageSize,
      name: query.name || undefined,
      categoryId: query.categoryId ?? undefined,
      status: query.status ?? undefined
    })
    list.value = res.data.records || []
    total.value = res.data.total || 0
  } finally {
    loading.value = false
  }
}

async function loadCategories() {
  try {
    const res = await listCategory(1)
    categories.value = res.data || []
  } catch {
    categories.value = []
  }
}

function handleSearch() {
  query.page = 1
  fetchList()
}

function handleReset() {
  query.name = ''
  query.categoryId = null
  query.status = null
  query.page = 1
  fetchList()
}

function handleSelectionChange(rows) {
  selectedIds.value = rows.map((row) => row.id)
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定要删除菜品「${row.name}」吗？`,
      '删除提示',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  await deleteDish([row.id])
  ElMessage.success('删除成功')
  afterDelete()
}

async function handleBatchDelete() {
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedIds.value.length} 个菜品吗？`,
      '批量删除',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  await deleteDish(selectedIds.value)
  ElMessage.success('批量删除成功')
  afterDelete()
}

function afterDelete() {
  if (list.value.length === 1 && query.page > 1) query.page -= 1
  fetchList()
}

const dialogVisible = ref(false)
const dialogLoading = ref(false)
const dialogTitle = computed(() => (isEdit.value ? '编辑菜品' : '新增菜品'))
const formRef = ref()
const saving = ref(false)
const isEdit = ref(false)

const defaultForm = () => ({
  id: null,
  name: '',
  categoryId: null,
  price: null,
  image: '',
  description: '',
  status: 1,
  flavors: []
})

const form = reactive(defaultForm())

const formRules = {
  name: [{ required: true, message: '请输入菜品名称', trigger: 'blur' }],
  categoryId: [{ required: true, message: '请选择菜品分类', trigger: 'change' }],
  price: [{ required: true, message: '请输入菜品价格', trigger: 'change' }],
  image: [{ required: true, message: '请上传菜品图片', trigger: 'change' }],
  status: [{ required: true, message: '请选择菜品状态', trigger: 'change' }]
}

function openAddDialog() {
  isEdit.value = false
  dialogVisible.value = true
}

async function openEditDialog(row) {
  isEdit.value = true
  dialogVisible.value = true
  dialogLoading.value = true
  try {
    const res = await getDishById(row.id)
    const data = res.data || {}
    Object.assign(form, defaultForm(), {
      id: data.id,
      name: data.name,
      categoryId: data.categoryId,
      price: data.price,
      image: data.image,
      description: data.description,
      status: data.status
    })
    form.flavors = (data.flavors || []).map((flavor) => ({
      name: flavor.name,
      valueText: parseFlavorValue(flavor.value)
    }))
  } catch {
    dialogVisible.value = false
  } finally {
    dialogLoading.value = false
  }
}

function parseFlavorValue(value) {
  if (!value) return ''
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed.join(',')
  } catch {
    // 保留原始值
  }
  return String(value)
}

function addFlavor() {
  form.flavors.push({ name: '', valueText: '' })
}

function removeFlavor(index) {
  form.flavors.splice(index, 1)
}

function resetForm() {
  formRef.value?.resetFields()
  Object.assign(form, defaultForm())
}

async function handleSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  const flavors = form.flavors
    .filter((item) => item.name.trim() || item.valueText.trim())
    .map((item) => {
      const values = item.valueText
        .split(/[,，]/)
        .map((value) => value.trim())
        .filter(Boolean)
      return {
        name: item.name.trim(),
        value: values.length ? JSON.stringify(values) : item.valueText.trim()
      }
    })

  const payload = {
    name: form.name.trim(),
    categoryId: form.categoryId,
    price: form.price,
    image: form.image,
    description: form.description,
    status: form.status,
    flavors
  }
  if (isEdit.value) payload.id = form.id

  saving.value = true
  try {
    if (isEdit.value) {
      await updateDish(payload)
      ElMessage.success('菜品修改成功')
    } else {
      await addDish(payload)
      ElMessage.success('菜品新增成功')
    }
    dialogVisible.value = false
    fetchList()
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadCategories()
  fetchList()
})
</script>

<style scoped>
.dish-image {
  width: 58px;
  height: 42px;
  border-radius: 4px;
}

.flavor-editor {
  width: 100%;
}

.flavor-row {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.flavor-name {
  width: 180px;
  flex-shrink: 0;
}

.flavor-value {
  flex: 1;
}
</style>
