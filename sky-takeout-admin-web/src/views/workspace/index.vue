<template>
  <div class="workspace">
    <el-row :gutter="16" class="stat-row">
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-item turnover">
            <div class="stat-icon">¥</div>
            <div class="stat-body">
              <div class="stat-label">今日营业额</div>
              <div class="stat-value">{{ formatMoney(businessData.turnover) }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-item order">
            <div class="stat-icon">单</div>
            <div class="stat-body">
              <div class="stat-label">有效订单</div>
              <div class="stat-value">{{ businessData.validOrderCount ?? '-' }}</div>
              <div class="stat-extra">
                完成率 {{ rate(businessData.orderCompletionRate) }}
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-item price">
            <div class="stat-icon">均</div>
            <div class="stat-body">
              <div class="stat-label">平均客单价</div>
              <div class="stat-value">{{ formatMoney(businessData.unitPrice) }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-item user">
            <div class="stat-icon">新</div>
            <div class="stat-body">
              <div class="stat-label">新增用户</div>
              <div class="stat-value">{{ businessData.newUsers ?? '-' }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="stat-row">
      <el-col :xs="24" :lg="12">
        <el-card shadow="never">
          <template #header>
            <div class="card-header">
              <span>订单总览</span>
              <el-link type="primary" @click="router.push('/order')">
                查看订单 →
              </el-link>
            </div>
          </template>
          <div class="overview-grid">
            <div
              v-for="item in orderOverview"
              :key="item.label"
              class="overview-item"
              :class="item.type"
            >
              <div class="overview-value">{{ item.value }}</div>
              <div class="overview-label">{{ item.label }}</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="12">
        <el-card shadow="never">
          <template #header>
            <span>商品总览</span>
          </template>
          <div class="goods-overview">
            <div class="goods-block">
              <div class="goods-title">菜品</div>
              <div class="goods-row">
                <div class="goods-cell">
                  <div class="cell-value sold">{{ overviewDishes.sold ?? '-' }}</div>
                  <div class="cell-label">已启售</div>
                </div>
                <div class="goods-cell">
                  <div class="cell-value stopped">
                    {{ overviewDishes.discontinued ?? '-' }}
                  </div>
                  <div class="cell-label">已停售</div>
                </div>
                <el-button
                  type="primary"
                  plain
                  class="goods-button"
                  @click="router.push('/dish')"
                >
                  菜品管理
                </el-button>
              </div>
            </div>
            <el-divider />
            <div class="goods-block">
              <div class="goods-title">套餐</div>
              <div class="goods-row">
                <div class="goods-cell">
                  <div class="cell-value sold">{{ overviewSetmeals.sold ?? '-' }}</div>
                  <div class="cell-label">已启售</div>
                </div>
                <div class="goods-cell">
                  <div class="cell-value stopped">
                    {{ overviewSetmeals.discontinued ?? '-' }}
                  </div>
                  <div class="cell-label">已停售</div>
                </div>
                <el-button
                  type="warning"
                  plain
                  class="goods-button"
                  @click="router.push('/setmeal')"
                >
                  套餐管理
                </el-button>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import {
  getBusinessData,
  getOverviewDishes,
  getOverviewOrders,
  getOverviewSetmeals
} from '@/api/workspace'
import { formatMoney } from '@/utils/format'

const router = useRouter()

const businessData = reactive({
  turnover: null,
  validOrderCount: null,
  orderCompletionRate: null,
  unitPrice: null,
  newUsers: null
})

const overviewDishes = reactive({ sold: null, discontinued: null })
const overviewSetmeals = reactive({ sold: null, discontinued: null })

const orderOverview = computed(() => [
  { label: '待接单', value: orders.waitingOrders, type: 'waiting' },
  { label: '待派送', value: orders.deliveredOrders, type: 'delivered' },
  { label: '已完成', value: orders.completedOrders, type: 'completed' },
  { label: '已取消', value: orders.cancelledOrders, type: 'cancelled' }
])

const orders = reactive({
  waitingOrders: null,
  deliveredOrders: null,
  completedOrders: null,
  cancelledOrders: null
})

onMounted(async () => {
  try {
    const [businessRes, orderRes, dishRes, setmealRes] = await Promise.all([
      getBusinessData(),
      getOverviewOrders(),
      getOverviewDishes(),
      getOverviewSetmeals()
    ])
    Object.assign(businessData, businessRes.data || {})
    Object.assign(orders, orderRes.data || {})
    Object.assign(overviewDishes, dishRes.data || {})
    Object.assign(overviewSetmeals, setmealRes.data || {})
  } catch {
    ElMessage.warning('工作台数据加载失败，请检查网络或稍后重试')
  }
})

function rate(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return `${(Number(value) * 100).toFixed(1)}%`
}
</script>

<style scoped>
.workspace {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stat-row {
  row-gap: 16px;
}

.stat-card :deep(.el-card__body) {
  padding: 18px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 14px;
}

.stat-icon {
  width: 54px;
  height: 54px;
  border-radius: 12px;
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.turnover .stat-icon {
  background: linear-gradient(135deg, #ff9a56, #f65d3b);
}

.order .stat-icon {
  background: linear-gradient(135deg, #38bdf8, #1d6fe0);
}

.price .stat-icon {
  background: linear-gradient(135deg, #34d399, #0a9d6e);
}

.user .stat-icon {
  background: linear-gradient(135deg, #a78bfa, #6d28d9);
}

.stat-body {
  min-width: 0;
}

.stat-label {
  font-size: 13px;
  color: #909399;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
  margin-top: 4px;
}

.stat-extra {
  font-size: 12px;
  color: #909399;
  margin-top: 3px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.overview-item {
  text-align: center;
  padding: 12px 4px;
  border-radius: 8px;
}

.overview-item.waiting {
  background: #ecf5ff;
}

.overview-item.delivered {
  background: #fdf6ec;
}

.overview-item.delivering {
  background: #f4f4f5;
}

.overview-item.completed {
  background: #f0f9eb;
}

.overview-item.cancelled {
  background: #fef0f0;
}

.overview-value {
  font-size: 22px;
  font-weight: 700;
}

.overview-label {
  margin-top: 4px;
  font-size: 13px;
  color: #606266;
}

.goods-block {
  padding: 0 4px;
}

.goods-title {
  font-weight: 600;
  margin-bottom: 14px;
}

.goods-row {
  display: flex;
  align-items: center;
  gap: 30px;
}

.goods-cell {
  text-align: center;
  min-width: 64px;
}

.cell-value {
  font-size: 20px;
  font-weight: 700;
}

.cell-value.sold {
  color: #67c23a;
}

.cell-value.stopped {
  color: #f56c6c;
}

.cell-label {
  margin-top: 4px;
  font-size: 13px;
  color: #909399;
}

.goods-button {
  margin-left: auto;
}
</style>
