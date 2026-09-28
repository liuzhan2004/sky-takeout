/**
 * utils/websocket.js
 * 管理端 WebSocket 客户端。
 *
 * 后端推送两种消息（JSON 字符串）：
 * - type=1 来单提醒：{ type, orderId, content }
 * - type=2 客户催单：{ type, orderId, content }
 *
 * 连接地址：ws://localhost:8080/ws/{sid}（对应后端 @ServerEndpoint("/ws/{sid}")）
 * 特性：
 * - 心跳：每 25 秒发送一次 ping，保持连接活跃；
 * - 断线重连：连接关闭后 5 秒自动重连（手动关闭时不重连）；
 * - 收到消息后用 ElNotification 弹出提醒。
 */
import { ElNotification } from 'element-plus'

/** 后端 WebSocket 地址（SkyApplication 端口 8080） */
const WS_BASE_URL = 'ws://localhost:8080/ws'

/** 心跳间隔（毫秒） */
const HEARTBEAT_INTERVAL = 25000

/** 断线重连间隔（毫秒） */
const RECONNECT_INTERVAL = 5000

let socket = null
let heartbeatTimer = null
let reconnectTimer = null
/** 是否为主动关闭（退出登录），主动关闭不重连 */
let manualClosed = false

/**
 * 提示音（课程提供的音频文件，位于 public/audio/ 下）
 * - preview.mp3：来单提醒（type=1）
 * - reminder.mp3：客户催单（type=2）
 */
const soundNewOrder = new Audio('/audio/preview.mp3')
const soundReminder = new Audio('/audio/reminder.mp3')

/** 浏览器自动播放策略：用户首次点击页面后解除限制 */
let audioUnlocked = false

function unlockAudio() {
  if (audioUnlocked) {
    return
  }
  audioUnlocked = true
  ;[soundNewOrder, soundReminder].forEach((audio) => {
    // 空播一次拿到播放权限，随后立即静音复位
    audio.volume = 0
    const promise = audio.play()
    if (promise) {
      promise
        .then(() => {
          audio.pause()
          audio.currentTime = 0
          audio.volume = 1
        })
        .catch(() => {
          audio.volume = 1
        })
    }
  })
}

// 登录进入管理端后，用户任意一次点击即可解锁音频
document.addEventListener('click', unlockAudio, { once: true })

/**
 * 播放指定提示音
 * @param {HTMLAudioElement} audio
 */
function playAlertSound(audio) {
  try {
    audio.currentTime = 0
    const promise = audio.play()
    if (promise) {
      promise.catch(() => {
        // 自动播放被浏览器拦截时静默忽略（解锁后即可正常出声）
      })
    }
  } catch {
    // 音频不可用时静默忽略
  }
}

/**
 * 处理后端推送的消息
 */
function handleMessage(event) {
  let message
  try {
    message = JSON.parse(event.data)
  } catch {
    // 心跳/非 JSON 消息忽略
    return
  }

  if (Number(message.type) === 1) {
    // 来单提醒
    playAlertSound(soundNewOrder)
    ElNotification({
      title: '🔔 来单提醒',
      message: message.content || '您有新的外卖订单，请及时处理',
      type: 'success',
      duration: 10000
    })
  } else if (Number(message.type) === 2) {
    // 客户催单
    playAlertSound(soundReminder)
    ElNotification({
      title: '⏰ 客户催单',
      message: message.content || '有客户催单，请尽快处理',
      type: 'warning',
      duration: 10000
    })
  }
}

/**
 * 建立连接（含心跳与自动重连）
 */
export function connectWebSocket() {
  // 避免重复连接
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return
  }

  manualClosed = false

  // 随机 sid 标识本次会话
  const sid = `admin_${Date.now()}_${Math.floor(Math.random() * 1000)}`
  socket = new WebSocket(`${WS_BASE_URL}/${sid}`)

  socket.onopen = () => {
    // 心跳：定时发 ping，防止连接被中间层断开
    clearInterval(heartbeatTimer)
    heartbeatTimer = setInterval(() => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send('ping')
      }
    }, HEARTBEAT_INTERVAL)
  }

  socket.onmessage = handleMessage

  socket.onclose = () => {
    clearInterval(heartbeatTimer)
    // 非主动关闭时自动重连
    if (!manualClosed) {
      clearTimeout(reconnectTimer)
      reconnectTimer = setTimeout(connectWebSocket, RECONNECT_INTERVAL)
    }
  }

  socket.onerror = () => {
    // 错误交给 onclose 统一处理（后端未启动时会触发重连）
  }
}

/**
 * 关闭连接（退出登录 / 页面卸载时调用）
 */
export function closeWebSocket() {
  manualClosed = true
  clearInterval(heartbeatTimer)
  clearTimeout(reconnectTimer)
  if (socket) {
    socket.close()
    socket = null
  }
}
