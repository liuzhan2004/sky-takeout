<template>
  <div class="order-page">
    <el-card shadow="never" class="page-card status-card">
      <div class="status-stat">
        <div class="status-title">待接单</div>
        <el-button link type="primary" class="status-count" @click="quickSearch(2)">
          {{ statistics.toBeConfirmed ?? '-' }}
        </el-button>
      </div>
      <el-divider direction="vertical" />
      <div class="status-stat">
        <div class="status-title">待派送</div>
        <el-button link type="primary" class="status-count" @click="quickSearch(3)">
          {{ statistics.confirmed ?? '-' }}
        </el-button>
      </div>
      <el-divider direction="vertical" />
      <div class="status-stat">
        <div class="status-title">派送中</div>
        <el-button link type="primary" class="status-count" @click="quickSearch(4)">
          {{ statistics.deliveryInProgress ?? '-' }}
        </el-button>
      </div>
    </el-card>

    <div class="page-card">
      <el-form inline @submit.prevent>
        <el-form-item label="订单号">
          <el-input
            v-model="query.number"
            placeholder="请输入订单号"
            clearable
            style="width: 190px"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input
            v-model="query.phone"
            placeholder="请输入手机号"
            clearable
            maxlength="11"
            style="width: 160px"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
        </el-form-item>
        <el-form-item label="订单状态">
          <el-select
            v-model="query.status"
            placeholder="全部状态"
            clearable
            style="width: 140px"
            @change="handleSearch"
          >
            <el-option
              v-for="item in statusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="下单时间">
          <el-date-picker
            v-model="dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 360px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">
            查询
          </el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="loading" :data="list" border stripe>
        <el-table-column label="订单号" prop="number" min-width="170" show-overflow-tooltip />
        <el-table-column label="下单时间" width="170">
          <template #default="{ row }">
            {{ formatDateTime(row.orderTime) }}
          </template>
        </el-table-column>
        <el-table-column label="金额(元)" width="110" align="center">
          <template #default="{ row }">
            <span class="amount-text">{{ formatMoney(row.amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="用户信息" min-width="190">
          <template #default="{ row }">
            <div>{{ row.userName || '-' }}</div>
            <div class="phone-text">{{ row.phone || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="订单状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" effect="light">
              {{ statusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="270" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">详情</el-button>
            <el-button
              v-if="row.status === 2"
              link
              type="success"
              @click="handleConfirm(row)"
            >
              接单
            </el-button>
            <el-button
              v-if="row.status === 2"
              link
              type="danger"
              @click="handleReject(row)"
            >
              拒单
            </el-button>
            <el-button
              v-if="row.status === 3"
              link
              type="primary"
              @click="handleDelivery(row)"
            >
              派送
            </el-button>
            <el-button
              v-if="row.status === 4"
              link
              type="success"
              @click="handleComplete(row)"
            >
              完成
            </el-button>
            <el-button
              v-if="[1, 2].includes(row.status)"
              link
              type="warning"
              @click="handleCancel(row)"
            >
              取消
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
  </div>

  <!-- 订单详情 -->
  <el-drawer
    v-model="detailVisible"
    title="订单详情"
    size="560px"
    :destroy-on-close="true"
  >
    <div v-loading="detailLoading" class="detail-body">
      <template v-if="detail">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="订单号">
            {{ detail.number }}
          </el-descriptions-item>
          <el-descriptions-item label="订单状态">
            <el-tag :type="statusType(detail.status)">
              {{ statusText(detail.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="下单时间">
            {{ formatDateTime(detail.orderTime) }}
          </el-descriptions-item>
          <el-descriptions-item label="结账时间">
            {{ formatDateTime(detail.checkoutTime) }}
          </el-descriptions-item>
          <el-descriptions-item label="收货人">
            {{ detail.consignee || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="联系电话">
            {{ detail.phone || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="收货地址">
            {{ detail.address || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="订单金额">
            <span class="amount-text">¥{{ formatMoney(detail.amount) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="备注">
            {{ detail.remark || '-' }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="detail.rejectionReason || detail.cancelReason"
            label="拒/退原因"
          >
            {{ detail.rejectionReason || detail.cancelReason || '-' }}
          </el-descriptions-item>
        </el-descriptions>

        <div class="detail-section-title">订单商品</div>
        <el-table :data="detail.orderDetailList || []" size="small" border>
          <el-table-column label="商品" min-width="180">
            <template #default="{ row }">
              <div class="goods-cell">
                <el-image
                  v-if="row.image"
                  :src="toFileUrl(row.image)"
                  fit="cover"
                  class="goods-image"
                />
                <div>
                  <div>{{ row.name }}</div>
                  <div v-if="row.dishFlavor" class="flavor-text">
                    {{ row.dishFlavor }}
                  </div>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="单价" width="90" align="right">
            <template #default="{ row }">
              {{ formatMoney(row.amount) }}
            </template>
          </el-table-column>
          <el-table-column label="数量" prop="number" width="70" align="center" />
          <el-table-column label="小计" width="90" align="right">
            <template #default="{ row }">
              {{ formatMoney((row.amount || 0) * (row.number || 0)) }}
            </template>
          </el-table-column>
        </el-table>

        <div v-if="detailActionVisible" class="detail-actions">
          <el-button
            v-if="detail.status === 2"
            type="success"
            @click="handleConfirm(detail)"
          >
            接单
          </el-button>
          <el-button
            v-if="detail.status === 2"
            type="danger"
            @click="handleReject(detail)"
          >
            拒单
          </el-button>
          <el-button
            v-if="detail.status === 3"
            type="primary"
            @click="handleDelivery(detail)"
          >
            派送订单
          </el-button>
          <el-button
            v-if="detail.status === 4"
            type="success"
            @click="handleComplete(detail)"
          >
            完成订单
          </el-button>
          <el-button
            v-if="[1, 2].includes(detail.status)"
            type="warning"
            @click="handleCancel(detail)"
          >
            取消订单
          </el-button>
        </div>
      </template>
    </div>
  </el-drawer>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Search } from '@element-plus/icons-vue'

import {
  cancelOrder,
  completeOrder,
  confirmOrder,
  deliveryOrder,
  getOrderDetail,
  getOrderStatistics,
  rejectOrder,
  searchOrders
} from '@/api/order'
import { formatDateTime, formatMoney, toFileUrl } from '@/utils/format'

const loading = ref(false)
const list = ref([])
const total = ref(0)
const dateRange = ref([])
const statistics = reactive({})

const statusOptions = [
  { value: 1, label: '待付款' },
  { value: 2, label: '待接单' },
  { value: 3, label: '待派送' },
  { value: 4, label: '派送中' },
  { value: 5, label: '已完成' },
  { value: 6, label: '已取消' }
]

const statusMap = Object.fromEntries(statusOptions.map((item) => [item.value, item.label]))

function statusText(status) {
  return statusMap[status] || `未知(${status})`
}

function statusType(status) {
  const typeMap = {
    1: 'warning',
    2: 'danger',
    3: 'primary',
    4: 'info',
    5: 'success',
    6: 'info'
  }
  return typeMap[status] || 'info'
}

const query = reactive({
  number: '',
  phone: '',
  status: null,
  page: 1,
  pageSize: 10
})

async function fetchList() {
  loading.value = true
  try {
    const [start, end] = dateRange.value || []
    const res = await searchOrders({
      page: query.page,
      pageSize: query.pageSize,
      number: query.number || undefined,
      phone: query.phone || undefined,
      status: query.status ?? undefined,
      beginTime: start || undefined,
      endTime: end || undefined
    })
    list.value = res.data.records || []
    total.value = res.data.total || 0
  } finally {
    loading.value = false
  }
}

async function fetchStatistics() {
  try {
    const res = await getOrderStatistics()
    Object.assign(statistics, res.data || {})
  } catch {
    // 统计失败不阻塞列表
  }
}

function handleSearch() {
  query.page = 1
  fetchList()
}

function handleReset() {
  query.number = ''
  query.phone = ''
  query.status = null
  dateRange.value = []
  query.page = 1
  fetchList()
}

function quickSearch(status) {
  query.status = status
  handleSearch()
}

// 订单操作
async function handleConfirm(order) {
  try {
    await ElMessageBox.confirm('确定接受该订单吗？', '接单确认', {
      type: 'warning',
      confirmButtonText: '接单',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  await confirmOrder(order.id)
  ElMessage.success('已接单，请及时派送')
  refreshAfterAction()
}

async function handleReject(order) {
  const { value } = await ElMessageBox.prompt('请输入拒单原因', '拒单', {
    inputPlaceholder: '请输入拒单原因',
    inputValidator: (input) => (input && input.trim() ? true : '请输入拒单原因'),
    confirmButtonText: '确定拒单',
    cancelButtonText: '取消'
  }).catch(() => ({}))
  if (value === undefined) return
  await rejectOrder(order.id, value.trim())
  ElMessage.success('拒单成功')
  refreshAfterAction()
}

async function handleCancel(order) {
  const { value } = await ElMessageBox.prompt('请输入取消原因', '取消订单', {
    inputPlaceholder: '请输入取消原因',
    inputValidator: (input) => (input && input.trim() ? true : '请输入取消原因'),
    confirmButtonText: '确定取消',
    cancelButtonText: '再想想'
  }).catch(() => ({}))
  if (value === undefined) return
  await cancelOrder(order.id, value.trim())
  ElMessage.success('订单已取消')
  refreshAfterAction()
}

async function handleDelivery(order) {
  try {
    await ElMessageBox.confirm('确定开始派送该订单吗？', '派送确认', {
      type: 'warning',
      confirmButtonText: '派送',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  await deliveryOrder(order.id)
  ElMessage.success('订单派送中')
  refreshAfterAction()
}

async function handleComplete(order) {
  try {
    await ElMessageBox.confirm('确定该订单已送达并完成吗？', '完成确认', {
      type: 'warning',
      confirmButtonText: '完成订单',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  await completeOrder(order.id)
  ElMessage.success('订单已完成')
  refreshAfterAction()
}

function refreshAfterAction() {
  detailVisible.value = false
  fetchList()
  fetchStatistics()
}

// 详情
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref(null)

const detailActionVisible = computed(() => [1, 2, 3, 4].includes(detail.value?.status))

async function openDetail(row) {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    const res = await getOrderDetail(row.id)
    detail.value = res.data
  } finally {
    detailLoading.value = false
  }
}

onMounted(() => {
  fetchList()
  fetchStatistics()
})
</script>

<style scoped>
.order-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-card {
  padding: 16px;
}

.status-card {
  display: flex;
  align-items: center;
}

.status-card :deep(.el-card__body) {
  display: flex;
  align-items: center;
  padding: 14px 20px;
}

.status-stat {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex: 1;
  justify-content: center;
}

.status-title {
  font-size: 14px;
  color: #606266;
}

.status-count {
  font-size: 26px;
  font-weight: 700;
}

.amount-text {
  color: #f56c6c;
  font-weight: 600;
}

.phone-text {
  color: #909399;
  font-size: 12px;
}

.detail-body {
  min-height: 200px;
}

.detail-section-title {
  font-weight: 600;
  margin: 18px 0 10px;
}

.goods-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.goods-image {
  width: 46px;
  height: 38px;
  border-radius: 4px;
  flex-shrink: 0;
}

.flavor-text {
  color: #909399;
  font-size: 12px;
  margin-top: 2px;
}

.detail-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}
</style>
