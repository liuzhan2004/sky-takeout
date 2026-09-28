import dayjs from 'dayjs'

export const API_BASE_URL = import.meta.env.VITE_APP_BASE_URL || ''

export function formatDateTime(value, template = 'YYYY-MM-DD HH:mm:ss') {
  if (!value) return '-'
  const d = dayjs(value)
  return d.isValid() ? d.format(template) : String(value)
}

export function formatDate(value) {
  return formatDateTime(value, 'YYYY-MM-DD')
}

export function formatMoney(value) {
  const num = Number(value)
  if (Number.isNaN(num)) return '-'
  return num.toFixed(2)
}

export function toFileUrl(url) {
  if (!url) return ''
  if (/^(https?:|data:|blob:)/.test(url)) return url
  const base = (API_BASE_URL || '').replace(/\/$/, '')
  return `${base}/${String(url).replace(/^\/+/, '')}`
}

export function splitNumberList(str) {
  if (!str) return []
  return String(str)
    .split(',')
    .filter((item) => item !== '')
    .map((item) => Number(item))
}

export function splitStringList(str) {
  if (!str) return []
  return String(str).split(',').filter(Boolean)
}
