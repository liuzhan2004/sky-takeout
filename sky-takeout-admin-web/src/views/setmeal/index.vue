<template>
  <div class="page-card">
    <el-form inline @submit.prevent>
      <el-form-item label="套餐名称">
        <el-input
          v-model="query.name"
          placeholder="请输入套餐名称"
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
          新增套餐
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
      <el-table-column label="图片" width="100" align="center">
        <template #default="{ row }">
          <el-image
            v-if="row.image"
            :src="toFileUrl(row.image)"
            :preview-src-list="[toFileUrl(row.image)]"
            fit="cover"
            class="setmeal-image"
            preview-teleported
          />
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="套餐名称" prop="name" min-width="150" />
      <el-table-column label="分类" prop="categoryName" width="120" />
      <el-table-column label="价格(元)" width="110" align="center">
        <template #default="{ row }">
          {{ formatMoney(row.price) }}
        </template>
      </el-table-column>
      <el-table-column label="描述" prop="description" min-width="150" show-overflow-tooltip />
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

  <!-- 新增 / 编辑套餐 -->
  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="720px"
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
          <el-form-item label="套餐名称" prop="name">
            <el-input v-model="form.name" placeholder="请输入套餐名称" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="套餐分类" prop="categoryId">
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
          <el-form-item label="套餐价格" prop="price">
            <el-input-number
              v-model="form.price"
              :min="0"
              :max="99999"
              :precision="2"
              controls-position="right"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="套餐状态" prop="status">
            <el-radio-group v-model="form.status">
              <el-radio :value="1">起售</el-radio>
              <el-radio :value="0">停售</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="套餐图片" prop="image">
        <ImageUpload v-model="form.image" />
      </el-form-item>
      <el-form-item label="套餐描述" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="2"
          maxlength="100"
          show-word-limit
          placeholder="请输入套餐描述"
        />
      </el-form-item>
      <el-form-item label="包含菜品" required>
        <div class="setmeal-dishes">
          <div
            v-for="(item, index) in form.setmealDishes"
            :key="index"
            class="dish-row"
          >
            <el-select
              v-model="item.dishId"
              placeholder="请选择菜品"
              filterable
              class="dish-select"
              @change="handleDishChange(item)"
            >
              <el-option
                v-for="dish in dishOptions"
                :key="dish.id"
                :label="dish.name"
                :value="dish.id"
              >
                <span>{{ dish.name }}</span>
                <span class="dish-price">¥{{ formatMoney(dish.price) }}</span>
              </el-option>
            </el-select>
            <el-input-number
              v-model="item.copies"
              :min="1"
              :max="99"
              controls-position="right"
              class="copies-input"
            />
            <el-button
              :icon="Delete"
              circle
              plain
              type="danger"
              @click="removeDish(index)"
            />
          </div>
          <el-button :icon="Plus" plain type="primary" @click="addDishRow">
            添加菜品
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
import { listCategory } from '@/api/category'
import { listDishByCategory } from '@/api/dish'
import {
  addSetmeal,
  deleteSetmeal,
  getSetmealById,
  pageSetmeal,
  updateSetmeal
} from '@/api/setmeal'
import { formatMoney, toFileUrl } from '@/utils/format'

const loading = ref(false)
const list = ref([])
const total = ref(0)
const categories = ref([])
const dishOptions = ref([])
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
    const res = await pageSetmeal({
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
    const res = await listCategory(2)
    categories.value = res.data || []
  } catch {
    categories.value = []
  }
}

async function loadDishOptions() {
  try {
    const categoryRes = await listCategory(1)
    const dishCategoryList = categoryRes.data || []
    const options = []
    for (const category of dishCategoryList) {
      const res = await listDishByCategory(category.id)
      options.push(...(res.data || []))
    }
    dishOptions.value = options
  } catch {
    dishOptions.value = []
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
      `确定要删除套餐「${row.name}」吗？`,
      '删除提示',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  await deleteSetmeal([row.id])
  ElMessage.success('删除成功')
  afterDelete()
}

async function handleBatchDelete() {
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedIds.value.length} 个套餐吗？`,
      '批量删除',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  await deleteSetmeal(selectedIds.value)
  ElMessage.success('批量删除成功')
  afterDelete()
}

function afterDelete() {
  if (list.value.length === 1 && query.page > 1) query.page -= 1
  fetchList()
}

const dialogVisible = ref(false)
const dialogLoading = ref(false)
const dialogTitle = computed(() => (isEdit.value ? '编辑套餐' : '新增套餐'))
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
  setmealDishes: []
})

const form = reactive(defaultForm())

const formRules = {
  name: [{ required: true, message: '请输入套餐名称', trigger: 'blur' }],
  categoryId: [{ required: true, message: '请选择套餐分类', trigger: 'change' }],
  price: [{ required: true, message: '请输入套餐价格', trigger: 'change' }],
  image: [{ required: true, message: '请上传套餐图片', trigger: 'change' }],
  status: [{ required: true, message: '请选择套餐状态', trigger: 'change' }]
}

function addDishRow() {
  form.setmealDishes.push({ dishId: null, copies: 1 })
}

function removeDish(index) {
  form.setmealDishes.splice(index, 1)
}

function handleDishChange(item) {
  const dish = dishOptions.value.find((option) => option.id === item.dishId)
  if (dish) item.name = dish.name
}

function openAddDialog() {
  isEdit.value = false
  if (!form.setmealDishes.length) addDishRow()
  dialogVisible.value = true
}

async function openEditDialog(row) {
  isEdit.value = true
  dialogVisible.value = true
  dialogLoading.value = true
  try {
    const res = await getSetmealById(row.id)
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
    const rows = (data.setmealDishes || []).map((dish) => ({
      dishId: dish.dishId,
      copies: dish.copies || 1,
      name: dish.name || ''
    }))
    form.setmealDishes = rows.length ? rows : [{ dishId: null, copies: 1 }]
  } catch {
    dialogVisible.value = false
  } finally {
    dialogLoading.value = false
  }
}

function resetForm() {
  formRef.value?.resetFields()
  Object.assign(form, defaultForm())
}

async function handleSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  if (!form.setmealDishes.some((item) => item.dishId)) {
    ElMessage.warning('请为套餐添加至少一种菜品')
    return
  }
  const payload = {
    name: form.name.trim(),
    categoryId: form.categoryId,
    price: form.price,
    image: form.image,
    description: form.description,
    status: form.status,
    setmealDishes: form.setmealDishes
      .filter((item) => item.dishId)
      .map((item) => ({ dishId: item.dishId, copies: item.copies || 1 }))
  }
  if (isEdit.value) payload.id = form.id

  saving.value = true
  try {
    if (isEdit.value) {
      await updateSetmeal(payload)
      ElMessage.success('套餐修改成功')
    } else {
      await addSetmeal(payload)
      ElMessage.success('套餐新增成功')
    }
    dialogVisible.value = false
    fetchList()
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadCategories()
  loadDishOptions()
  fetchList()
})
</script>

<style scoped>
.setmeal-image {
  width: 72px;
  height: 48px;
  border-radius: 4px;
}

.setmeal-dishes {
  width: 100%;
}

.dish-row {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.dish-select {
  flex: 1;
}

.copies-input {
  width: 140px;
  flex-shrink: 0;
}

.dish-price {
  float: right;
  color: #8492a6;
  font-size: 13px;
}
</style>
