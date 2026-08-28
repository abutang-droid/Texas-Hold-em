# 本机测试环境搭建

## 前置条件

- Node.js **20 LTS**（推荐；Expo 对 Node 24 支持不稳定）
- pnpm ≥ 10
- 数据库二选一：
  - **Docker Desktop**（`pnpm local:up`）
  - **Homebrew** PostgreSQL 16 + Redis（`pnpm local:mac`，适合 Mac mini）

## 首次安装（Mac mini 推荐流程）

```bash
cd ~/Texas-Hold-em
git checkout cursor/phase4-open-beta-2fc9   # 完整代码 + Staging 脚本
pnpm install
pnpm build                                  # 必须：编译 poker-engine / db 等
cp .env.example .env                        # 若不存在
pnpm local:mac                              # Homebrew 数据库 + 迁移
```

> 使用 Docker 则改为 `pnpm local:up`（需先打开 Docker Desktop）。

## 启动应用服务

在**独立终端**分别运行（自动加载 `.env`）：

```bash
pnpm dev api      # REST API  → http://localhost:3000/health
pnpm dev room     # Room WS   → http://localhost:3001/health
pnpm dev admin    # 运营后台  → http://localhost:5173
pnpm dev mobile   # Expo 客户端 → http://localhost:8081 (Web)
```

等效命令：`bash scripts/dev.sh api` 等。

## 各地址说明

| 地址 | 用途 |
|------|------|
| http://localhost:3000/health | API 健康检查（JSON，无网页） |
| http://localhost:3001/health | Room 健康检查（JSON） |
| http://localhost:5173 | **Admin 运营后台** |
| http://localhost:8081 | **游戏客户端 Web**（`pnpm dev mobile` 后打开） |

## 验证

```bash
# 需 API 已启动
pnpm smoke

# 完整本地测试
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
pnpm local:down          # Docker 方式
brew services stop postgresql@16 redis   # Homebrew 方式
```

## 常见问题

**`pnpm smoke` ECONNREFUSED**：API 未启动。先 `pnpm dev api`，等看到 `listening on :3000`。

**Room 启动报 `poker-engine/dist` 找不到**：执行 `pnpm build`。

**Expo Web 500 / MIME type json**：在项目根执行 `pnpm install && pnpm build`，然后在 `apps/mobile` 运行 `npx expo start --web --clear`。

**`No package.json` 或只有 README**：确认分支为 `cursor/phase4-open-beta-2fc9`。

## Mac mini 连 Staging 服务器（192.168.31.53）

仅跑客户端、后端在 LXC 上时，见 **`docs/MAC-MINI-STAGING.md`**：

```bash
bash scripts/mac-staging-check.sh
bash scripts/mac-staging-mobile.sh
```

**PostgreSQL 连接失败**：`brew services list` 确认 postgresql@16 为 started。

**Migration 重复执行报错**：`002_phase3_private_rooms.sql` 使用 `IF NOT EXISTS`，可安全重跑 `pnpm migrate`。

**Room 连接 401**：客户端需携带有效 JWT（先调用 guest login）。
