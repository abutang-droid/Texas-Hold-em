# 本机测试环境搭建

## 前置条件

- Node.js ≥ 20
- pnpm ≥ 10
- Docker + Docker Compose（PostgreSQL 16 + Redis 7）

## 一键启动基础设施

```bash
pnpm install
pnpm local:up
```

该命令会：

1. 从 `.env.example` 复制 `.env`（若不存在）
2. `docker compose up -d` 启动 PostgreSQL 与 Redis
3. 等待服务就绪
4. 执行 `infra/migrations/*.sql`

## 启动应用服务

在**独立终端**分别运行：

```bash
pnpm dev:api      # REST API  → http://localhost:3000/health
pnpm dev:room     # Room WS   → http://localhost:3001/health
pnpm dev:admin    # 运营后台  → http://localhost:5173
pnpm dev:mobile   # Expo 客户端
```

## 验证

```bash
# API 冒烟（游客登录 / 充值 / 快速开始 / 周榜）
pnpm smoke

# 完整本地测试（需 api 已启动）
pnpm local:test
```

## Admin 后台

1. 打开 http://localhost:5173
2. 使用 `.env` 中 `ADMIN_API_KEY`（默认 `dev-admin-key-change-in-production`）登录
3. 可管理用户、查手牌、配置私人场开关、处理举报、查看经济看板与风控告警

## 环境变量

见 `.env.example`：

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | PostgreSQL 连接串 |
| `REDIS_URL` | Redis 连接串 |
| `JWT_SECRET` | 玩家 JWT 签名 |
| `ADMIN_API_KEY` | 运营后台 API Key |
| `PAYMENT_MODE=mock` | 模拟支付 |

## 停止

```bash
pnpm local:down
```

## 常见问题

**PostgreSQL 连接失败**：确认 `docker compose ps` 中 `th-postgres` 为 healthy。

**Migration 重复执行报错**：`002_phase3_private_rooms.sql` 使用 `IF NOT EXISTS`，可安全重跑 `pnpm migrate`。

**Room 连接 401**：客户端需携带有效 JWT（先调用 guest login）。
