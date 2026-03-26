import 'dotenv/config'
import Fastify from 'fastify'
import websocketPlugin from '@fastify/websocket'
import staticPlugin from '@fastify/static'
import { createClient } from 'redis'
import { nanoid } from 'nanoid'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PORT = process.env.PORT || 3000
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const CODE_TTL = parseInt(process.env.CODE_TTL || '60')
const ROOM_TTL = parseInt(process.env.ROOM_TTL || '3600')

// ── Redis 客户端 ──────────────────────────────────────────────
let redis = null
let redisSub = null
let redisReady = false

try {
  // 创建 Redis 客户端但不自动重连
  redis = createClient({ 
    url: REDIS_URL,
    socket: { 
      reconnectStrategy: () => false // 禁用自动重连
    } 
  })
  redisSub = redis.duplicate()

  // 只监听错误一次，避免重复错误信息
  let redisErrorHandled = false
  redis.on('error', err => {
    if (!redisErrorHandled) {
      console.error('[Redis pub]', err)
      redisErrorHandled = true
    }
  })
  
  let redisSubErrorHandled = false
  redisSub.on('error', err => {
    if (!redisSubErrorHandled) {
      console.error('[Redis sub]', err)
      redisSubErrorHandled = true
    }
  })

  await redis.connect()
  await redisSub.connect()
  redisReady = true
  console.log('[Redis] 连接成功')
} catch (err) {
  console.error('[Redis] 连接失败，将在内存中运行:', err.message)
  // 创建内存模拟 Redis 客户端
  const memoryStore = new Map()
  redis = {
    isReady: false,
    async get(key) { return memoryStore.get(key) },
    async set(key, value, { EX } = {}) { memoryStore.set(key, value); return 'OK' },
    async del(key) { return memoryStore.delete(key) ? 1 : 0 },
    async exists(key) { return memoryStore.has(key) ? 1 : 0 },
    async publish(channel, message) { /* 内存模式下发布消息不做处理 */ },
    async subscribe(channel, listener) { /* 内存模式下订阅不做处理 */ },
    async connect() { /* 内存模式下连接不做处理 */ },
  }
  redisSub = { ...redis }
}

// ── 房间管理（内存） ──────────────────────────────────────────
// roomId → { a: WebSocket|null, b: WebSocket|null }
const rooms = new Map()

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, { a: null, b: null })
  return rooms.get(roomId)
}

function cleanRoom(roomId) {
  const room = rooms.get(roomId)
  if (!room) return
  if (!room.a && !room.b) rooms.delete(roomId)
}

function send(socket, payload) {
  if (socket?.readyState === 1) socket.send(JSON.stringify(payload))
}

// ── Fastify ───────────────────────────────────────────────────
const app = Fastify({ logger: false })

await app.register(websocketPlugin)
await app.register(staticPlugin, {
  root: __dirname,
  prefix: '/',
})

// ── WebSocket 主逻辑 ──────────────────────────────────────────
app.get('/ws', { websocket: true }, async (socket, req) => {
  const role = req.query.role  // 'host' | 'guest'
  let roomId = null
  let side = null  // 'a' | 'b'

  // ── HOST（设备 A）接入 ──────────────────────────────────────
  if (role === 'host') {
    // 生成6位不重复配对码
    let code, key
    for (let i = 0; i < 10; i++) {
      code = String(Math.floor(100000 + Math.random() * 900000))
      key = `code:${code}`
      if (!(await redis.exists(key))) break
    }

    roomId = `room:${nanoid(10)}`
    side = 'a'

    await redis.set(key, roomId, { EX: CODE_TTL })

    getOrCreateRoom(roomId).a = socket
    send(socket, { event: 'code', code, ttl: CODE_TTL })

    // 订阅房间频道（转发给 host）
    await redisSub.subscribe(roomId, (msg) => {
      try {
        const data = JSON.parse(msg)
        if (data._from !== 'a') send(socket, data)
      } catch {}
    })

    console.log(`[Host] 新连接，房间 ${roomId}，配对码 ${code}`)
  }

  // ── GUEST（设备 B）─────────────────────────────────────────
  if (role === 'guest') {
    socket.on('message', async (raw) => {
      let msg
      try { msg = JSON.parse(raw) } catch { return }

      // 配对握手
      if (msg.event === 'pair') {
        const code = String(msg.code).trim()
        const codeKey = `code:${code}`
        const rid = await redis.get(codeKey)

        if (!rid) {
          send(socket, { event: 'error', code: 'INVALID_CODE', msg: '配对码无效或已过期' })
          return
        }

        await redis.del(codeKey)
        roomId = rid
        side = 'b'

        const room = getOrCreateRoom(roomId)
        room.b = socket

        // 恢复上次内容
        const lastContent = await redis.get(`${roomId}:content`) || ''

        send(socket, { event: 'paired', last: lastContent })

        // 通知 host
        await redis.publish(roomId, JSON.stringify({ event: 'paired', _from: 'b' }))

        // 订阅房间（转发给 guest）
        await redisSub.subscribe(roomId, (pubMsg) => {
          try {
            const data = JSON.parse(pubMsg)
            if (data._from !== 'b') send(socket, data)
          } catch {}
        })

        console.log(`[Guest] 配对成功，房间 ${roomId}`)
        return
      }

      // 内容同步（已配对后）
      if (msg.event === 'sync' && roomId) {
        const text = String(msg.text ?? '')
        await redis.set(`${roomId}:content`, text, { EX: ROOM_TTL })
        await redis.publish(roomId, JSON.stringify({ event: 'sync', text, _from: 'b' }))
      }
    })
  }

  // ── HOST 的消息监听（配对完成后的同步）────────────────────
  if (role === 'host') {
    socket.on('message', async (raw) => {
      let msg
      try { msg = JSON.parse(raw) } catch { return }

      if (msg.event === 'sync' && roomId) {
        const text = String(msg.text ?? '')
        await redis.set(`${roomId}:content`, text, { EX: ROOM_TTL })
        await redis.publish(roomId, JSON.stringify({ event: 'sync', text, _from: 'a' }))
      }
    })
  }

  // ── 断线处理 ─────────────────────────────────────────────
  socket.on('close', async () => {
    if (!roomId) return
    const room = rooms.get(roomId)
    if (room && side) {
      room[side] = null
      // 通知对方断线
      const other = side === 'a' ? 'b' : 'a'
      send(room[other], { event: 'disconnected', side })
      await redis.publish(roomId, JSON.stringify({ event: 'disconnected', side, _from: side }))
    }
    cleanRoom(roomId)
    console.log(`[${side?.toUpperCase()}] 断开，房间 ${roomId}`)
  })
})

// ── 健康检查 ─────────────────────────────────────────────────
app.get('/health', async () => ({
  status: 'ok',
  rooms: rooms.size,
  redis: redisReady ? 'connected' : 'disconnected',
}))

await app.listen({ port: PORT, host: '0.0.0.0' })
console.log(`[Server] 运行在 http://0.0.0.0:${PORT}`)
