# Clipboard Sync

> 基于 WebSocket + Redis 的跨设备剪贴板同步工具

![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)
![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)
![WebSocket](https://img.shields.io/badge/WebSocket-supported-orange.svg)

## ✨ 功能特性

- 🔄 **实时同步**: 基于 WebSocket 的实时剪贴板内容同步
- 🔒 **安全配对**: 6位数字配对码，60秒自动过期
- 💾 **数据持久化**: Redis 存储配对信息和同步内容
- 🛡️ **容错机制**: Redis 连接失败时自动降级为内存模式
- 🚀 **高性能**: 基于 Fastify 框架，性能优异
- 📱 **跨平台**: 支持所有支持 WebSocket 的设备
- 🏥 **健康检查**: 内置健康检查端点
- 📊 **进程管理**: 支持 PM2 进程守护

## 🏗️ 技术栈

### 后端
- **Node.js** 20+ - 运行时环境
- **Fastify** 4.x - 高性能 Web 框架
- **@fastify/websocket** - WebSocket 支持
- **@fastify/static** - 静态文件服务
- **Redis** 4.x - 数据存储和消息队列
- **nanoid** - 唯一 ID 生成
- **dotenv** - 环境变量管理

### 前端
- 原生 HTML/CSS/JavaScript
- WebSocket API
- Clipboard API

## 📁 项目结构

```
clipboard-sync/
├── server.js              # 后端主逻辑
├── index.html             # 前端页面（单文件）
├── package.json           # 项目配置和依赖
├── ecosystem.config.js    # PM2 进程管理配置
├── .env.example           # 环境变量示例
├── .env                   # 环境变量（需自行创建）
└── README.md             # 项目说明文档
```

## 🚀 快速开始

### 环境要求

- Node.js 20.0.0 或更高版本
- Redis 6.0 或更高版本（可选）
- npm 或 yarn

### 安装步骤

#### 1. 克隆项目

```bash
git clone https://github.com/t-aest/clipboard-sync.git
cd clipboard-sync
```

#### 2. 安装依赖

```bash
npm install
```

#### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 服务器端口
PORT=3000

# Redis 连接地址（可选，不配置则使用内存模式）
REDIS_URL=redis://:yourpassword@127.0.0.1:6379

# 配对码有效期（秒）
CODE_TTL=60

# 房间内容有效期（秒）
ROOM_TTL=3600
```

#### 4. 启动服务

```bash
# 生产环境
npm start

# 开发环境（支持热重载）
npm run dev
```

服务启动后访问：`http://localhost:3000`

## 📖 使用说明

### 配对流程

1. **设备 A（Host）**：
   - 打开应用，点击"创建配对"
   - 获取6位配对码
   - 等待设备 B 连接

2. **设备 B（Guest）**：
   - 打开应用，点击"加入配对"
   - 输入设备 A 的配对码
   - 配对成功后即可开始同步

### 同步内容

- 在任一设备复制文本内容
- 内容会自动同步到另一设备
- 支持多行文本和特殊字符

### 断开连接

- 关闭浏览器标签页或点击"断开连接"
- 配对码失效，需要重新配对

## 🔧 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 | 必填 |
|--------|------|--------|------|
| `PORT` | 服务器监听端口 | `3000` | 否 |
| `REDIS_URL` | Redis 连接地址 | `redis://localhost:6379` | 否 |
| `CODE_TTL` | 配对码有效期（秒） | `60` | 否 |
| `ROOM_TTL` | 房间内容有效期（秒） | `3600` | 否 |

### Redis 配置

#### 使用本地 Redis

```env
REDIS_URL=redis://localhost:6379
```

#### 使用带密码的 Redis

```env
REDIS_URL=redis://:password@localhost:6379
```

#### 使用远程 Redis

```env
REDIS_URL=redis://:password@remote-host:6379
```

#### 使用特定数据库

```env
REDIS_URL=redis://:password@localhost:6379/8
```

## 🌐 部署指南

### 使用 PM2 部署（推荐）

#### 1. 安装 PM2

```bash
npm install -g pm2
```

#### 2. 启动应用

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 3. PM2 常用命令

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs clipboard-sync

# 重启应用
pm2 restart clipboard-sync

# 停止应用
pm2 stop clipboard-sync

# 删除应用
pm2 delete clipboard-sync
```

### 使用 Nginx 反向代理

#### 基础配置

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 静态文件
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # 健康检查
    location /health {
        proxy_pass http://127.0.0.1:3000;
        access_log off;
    }
}
```

#### HTTPS 配置

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 其他配置同上...
}
```

### Docker 部署

#### Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY server.js index.html ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
```

#### 构建和运行

```bash
# 构建镜像
docker build -t clipboard-sync .

# 运行容器
docker run -d \
  --name clipboard-sync \
  -p 3000:3000 \
  -e PORT=3000 \
  -e REDIS_URL=redis://:password@redis:6379 \
  clipboard-sync
```

## 📡 API 文档

### WebSocket 连接

#### 连接地址

```
ws://localhost:3000/ws?role=host
ws://localhost:3000/ws?role=guest
```

#### 消息格式

所有消息均为 JSON 格式：

```json
{
  "event": "事件名称",
  "其他字段": "值"
}
```

### 事件类型

#### Host 端事件

| 事件 | 方向 | 说明 |
|------|------|------|
| `code` | 服务器 → 客户端 | 返回配对码 |
| `paired` | 服务器 → 客户端 | 配对成功 |
| `sync` | 双向 | 同步内容 |
| `disconnected` | 服务器 → 客户端 | 对方断开连接 |

#### Guest 端事件

| 事件 | 方向 | 说明 |
|------|------|------|
| `pair` | 客户端 → 服务器 | 发送配对码 |
| `paired` | 服务器 → 客户端 | 配对成功 |
| `error` | 服务器 → 客户端 | 错误信息 |
| `sync` | 双向 | 同步内容 |
| `disconnected` | 服务器 → 客户端 | 对方断开连接 |

#### 消息示例

**配对码响应**

```json
{
  "event": "code",
  "code": "123456",
  "ttl": 60
}
```

**配对请求**

```json
{
  "event": "pair",
  "code": "123456"
}
```

**配对成功**

```json
{
  "event": "paired",
  "last": "上次同步的内容"
}
```

**内容同步**

```json
{
  "event": "sync",
  "text": "要同步的文本内容"
}
```

**错误信息**

```json
{
  "event": "error",
  "code": "INVALID_CODE",
  "msg": "配对码无效或已过期"
}
```

### HTTP 端点

#### 健康检查

```
GET /health
```

**响应**

```json
{
  "status": "ok",
  "rooms": 2,
  "redis": "connected"
}
```

## 💾 数据存储

### Redis 数据结构

| Key | 类型 | TTL | 说明 |
|-----|------|-----|------|
| `code:{6位数字}` | String | 60s | 配对码 → roomId |
| `room:{id}:content` | String | 1h | 最近一次同步内容 |

### Pub/Sub 频道

- `room:{id}` - 实时消息转发（不持久化）

### 内存模式

当 Redis 连接失败时，系统会自动降级为内存模式：

- 配对码和房间内容存储在内存中
- 不支持跨进程通信
- 适合单机开发和测试

## 🔍 故障排除

### 常见问题

#### 1. 无法连接到 Redis

**错误信息**：`[Redis] 连接失败，将在内存中运行`

**解决方案**：
- 检查 Redis 服务是否启动
- 验证 `REDIS_URL` 配置是否正确
- 确认 Redis 密码是否正确
- 检查防火墙设置

#### 2. 配对码无效

**错误信息**：`配对码无效或已过期`

**解决方案**：
- 确认配对码输入正确
- 检查配对码是否过期（默认60秒）
- 重新获取配对码

#### 3. WebSocket 连接失败

**解决方案**：
- 检查服务器是否正常运行
- 确认防火墙开放了对应端口
- 检查 Nginx 配置是否正确
- 查看浏览器控制台错误信息

#### 4. 内容同步延迟

**解决方案**：
- 检查网络连接质量
- 确认 Redis 性能是否正常
- 查看服务器日志排查问题

### 日志查看

#### PM2 日志

```bash
pm2 logs clipboard-sync
```

#### Docker 日志

```bash
docker logs clipboard-sync
```

#### 应用日志

```bash
# 查看实时日志
tail -f logs/out.log

# 查看错误日志
tail -f logs/err.log
```

## 🛡️ 安全建议

1. **使用 HTTPS**：生产环境务必配置 SSL 证书
2. **Redis 密码**：为 Redis 设置强密码
3. **访问控制**：限制 API 访问频率
4. **日志监控**：定期检查异常访问日志
5. **定期更新**：及时更新依赖包版本
6. **防火墙配置**：只开放必要的端口

## 📊 性能优化

### 服务器端

- 使用 PM2 集群模式提高并发能力
- 配置 Redis 持久化保证数据安全
- 使用 CDN 加速静态资源
- 启用 Gzip 压缩

### 客户端

- 使用 WebSocket 心跳保持连接
- 实现断线重连机制
- 优化消息传输频率

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📝 开发计划

- [ ] 支持文件传输
- [ ] 支持多设备同时连接
- [ ] 添加用户认证
- [ ] 实现历史记录功能
- [ ] 支持富文本同步
- [ ] 添加端到端加密

## 📄 许可证

本项目采用 Apache License 2.0 许可证 - 详见 [LICENSE](LICENSE) 文件

## 👨‍💻 作者

- **t-aest** - *Initial work* - [GitHub](https://github.com/t-aest)

## 🙏 致谢

- [Fastify](https://www.fastify.io/) - 高性能 Web 框架
- [Redis](https://redis.io/) - 内存数据结构存储
- [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) - 实时通信协议

## 📞 联系方式

- 项目主页：[https://github.com/t-aest/clipboard-sync](https://github.com/t-aest/clipboard-sync)
- 问题反馈：[Issues](https://github.com/t-aest/clipboard-sync/issues)

---

⭐ 如果这个项目对你有帮助，请给个 Star！
