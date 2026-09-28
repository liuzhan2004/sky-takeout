<template>
  <div class="report-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-row">
        <div class="date-picker-wrap">
          <span class="filter-label">统计区间</span>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            :shortcuts="shortcuts"
            :disabled-date="disabledDate"
            style="width: 320px"
          />
        </div>
        <div>
          <el-button type="primary" :icon="Search" :loading="loading" @click="loadReport">
            查询
          </el-button>
          <el-button :icon="Download" @click="handleExport">导出报表</el-button>
        </div>
      </div>
    </el-card>

    <el-row :gutter="16" class="metric-row">
      <el-col :xs="12" :sm="12" :md="6">
        <el-card shadow="hover" class="metric-card">
          <div class="metric-label">区间营业额(元)</div>
          <div class="metric-value">{{ formatMoney(totalTurnover) }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="12" :md="6">
        <el-card shadow="hover" class="metric-card">
          <div class="metric-label">总用户数</div>
          <div class="metric-value">{{ totalUsers }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="12" :md="6">
        <el-card shadow="hover" class="metric-card">
          <div class="metric-label">订单总数</div>
          <div class="metric-value">{{ orderData.totalOrderCount ?? '-' }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="12" :md="6">
        <el-card shadow="hover" class="metric-card">
          <div class="metric-label">订单完成率</div>
          <div class="metric-value">
            {{ rate(orderData.orderCompletionRate) }}
          </div>
          <div class="metric-sub">有效订单 {{ orderData.validOrderCount ?? '-' }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="chart-card">
          <template #header>营业额统计</template>
          <div ref="turnoverChartRef" class="chart-box" />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="chart-card">
          <template #header>用户统计</template>
          <div ref="userChartRef" class="chart-box" />
        </el-card>
      </el-col>
    </el-row>
    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="chart-card">
          <template #header>订单统计</template>
          <div ref="orderChartRef" class="chart-box" />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="chart-card">
          <template #header>销量排名 Top10</template>
          <div ref="topChartRef" class="chart-box" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import dayjs from 'dayjs'
import { Download, Search } from '@element-plus/icons-vue'

import {
  exportReport,
  ordersStatistics,
  salesTop10,
  turnoverStatistics,
  userStatistics
} from '@/api/report'
import { formatMoney, splitNumberList, splitStringList } from '@/utils/format'

const loading = ref(false)
const dateRange = ref([])

const shortcuts = [
  {
    text: '最近 7 天',
    value: () => [dayjs().subtract(6, 'day'), dayjs()]
  },
  {
    text: '最近 30 天',
    value: () => [dayjs().subtract(29, 'day'), dayjs()]
  },
  {
    text: '本月',
    value: () => [dayjs().startOf('month'), dayjs()]
  }
]

function disabledDate(date) {
  return date.getTime() > dayjs().endOf('day').valueOf()
}

const turnoverData = ref({})
const userData = ref({})
const orderData = ref({})
const topData = ref({})

const totalTurnover = computed(() => {
  const list = splitNumberList(turnoverData.value.turnoverList)
  return list.reduce((sum, value) => sum + value, 0)
})

const totalUsers = computed(() => {
  const list = splitNumberList(userData.value.totalUserList)
  return list.length ? list[list.length - 1] : '-'
})

function rate(value) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '-'
  return `${(Number(value) * 100).toFixed(1)}%`
}

async function loadReport() {
  if (!dateRange.value?.length) {
    ElMessage.warning('请先选择统计区间')
    return
  }
  const [begin, end] = dateRange.value
  loading.value = true
  try {
    const [turnoverRes, userRes, orderRes, topRes] = await Promise.all([
      turnoverStatistics({ begin, end }),
      userStatistics({ begin, end }),
      ordersStatistics({ begin, end }),
      salesTop10({ begin, end })
    ])
    turnoverData.value = turnoverRes.data || {}
    userData.value = userRes.data || {}
    orderData.value = orderRes.data || {}
    topData.value = topRes.data || {}
    await nextTick()
    renderCharts()
  } finally {
    loading.value = false
  }
}

const turnoverChartRef = ref()
const userChartRef = ref()
const orderChartRef = ref()
const topChartRef = ref()
const chartInstances = []

function initChart(el) {
  if (!el) return null
  const instance = echarts.getInstanceByDom(el) || echarts.init(el)
  chartInstances.push(instance)
  return instance
}

function baseTooltip() {
  return { trigger: 'axis' }
}

function gridOption() {
  return { left: 16, right: 24, top: 36, bottom: 10, containLabel: true }
}

function renderCharts() {
  const dates = splitStringList(turnoverData.value.dateList)

  // 营业额
  const turnoverChart = initChart(turnoverChartRef.value)
  if (turnoverChart) {
    turnoverChart.setOption({
      tooltip: baseTooltip(),
      legend: { top: 0 },
      grid: gridOption(),
      xAxis: { type: 'category', data: dates },
      yAxis: { type: 'value', name: '元' },
      series: [
        {
          name: '营业额',
          type: 'line',
          smooth: true,
          areaStyle: { opacity: 0.12 },
          data: splitNumberList(turnoverData.value.turnoverList),
          itemStyle: { color: '#ff9a56' }
        }
      ]
    })
  }

  // 用户
  const userChart = initChart(userChartRef.value)
  if (userChart) {
    userChart.setOption({
      tooltip: baseTooltip(),
      legend: { top: 0 },
      grid: gridOption(),
      xAxis: { type: 'category', data: dates },
      yAxis: { type: 'value' },
      series: [
        {
          name: '总用户数',
          type: 'line',
          smooth: true,
          data: splitNumberList(userData.value.totalUserList)
        },
        {
          name: '新增用户',
          type: 'line',
          smooth: true,
          areaStyle: { opacity: 0.1 },
          data: splitNumberList(userData.value.newUserList)
        }
      ]
    })
  }

  // 订单
  const orderChart = initChart(orderChartRef.value)
  if (orderChart) {
    orderChart.setOption({
      tooltip: baseTooltip(),
      legend: { top: 0 },
      grid: gridOption(),
      xAxis: { type: 'category', data: dates },
      yAxis: { type: 'value' },
      series: [
        {
          name: '订单数',
          type: 'line',
          smooth: true,
          data: splitNumberList(orderData.value.orderCountList)
        },
        {
          name: '有效订单',
          type: 'line',
          smooth: true,
          data: splitNumberList(orderData.value.validOrderCountList)
        }
      ]
    })
  }

  // 销量 Top10（横向条形图）
  const topChart = initChart(topChartRef.value)
  if (topChart) {
    const names = splitStringList(topData.value.nameList).slice(0, 10).reverse()
    const numbers = splitNumberList(topData.value.numberList).slice(0, 10).reverse()
    topChart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 16, right: 36, top: 16, bottom: 10, containLabel: true },
      xAxis: { type: 'value', minInterval: 1 },
      yAxis: { type: 'category', data: names },
      series: [
        {
          name: '销量',
          type: 'bar',
          barWidth: 14,
          data: numbers,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#409eff' },
              { offset: 1, color: '#36cfc9' }
            ])
          },
          label: { show: true, position: 'right' }
        }
      ]
    })
  }
}

async function handleExport() {
  try {
    const blob = await exportReport()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `运营数据报表_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    ElMessage.success('报表导出成功')
  } catch {
    ElMessage.error('报表导出失败')
  }
}

function onResize() {
  chartInstances.forEach((instance) => instance?.resize())
}

onMounted(() => {
  dateRange.value = [
    dayjs().subtract(6, 'day').format('YYYY-MM-DD'),
    dayjs().format('YYYY-MM-DD')
  ]
  loadReport()
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  chartInstances.forEach((instance) => instance?.dispose())
  chartInstances.length = 0
})
</script>

<style scoped>
.report-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-card :deep(.el-card__body) {
  padding: 16px 18px;
}

.filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.date-picker-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.filter-label {
  font-size: 14px;
  color: #606266;
}

.metric-row {
  row-gap: 16px;
}

.metric-card {
  text-align: center;
}

.metric-label {
  color: #909399;
  font-size: 13px;
}

.metric-value {
  font-size: 26px;
  font-weight: 700;
  margin-top: 8px;
  color: #303133;
}

.metric-sub {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.chart-row {
  row-gap: 16px;
}

.chart-card :deep(.el-card__header) {
  font-weight: 600;
}

.chart-box {
  width: 100%;
  height: 320px;
}
</style>
