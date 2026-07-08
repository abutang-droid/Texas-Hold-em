# Texas Hold'em — 联网多人德州扑克

跨端（iOS / Android / Web）实时德州扑克应用。

## 当前阶段

**Phase 3 进行中** — 私人场 v1.0.5 + Admin Web UI

| 模块 | 状态 |
|---|---|
| `poker-engine` | ✅ 16 单测通过 |
| `packages/db` | ✅ PostgreSQL + Redis |
| `apps/api` | ✅ 官方场 + 私人场 + Admin API |
| `apps/room` | ✅ 官方/私人桌 + 房主管理 |
| `apps/mobile` | ✅ 大厅 / 牌桌 / 私人场 |
| `apps/admin` | ✅ 运营后台 Web UI |

## 快速开始

```bash
pnpm install
pnpm build

# 基础设施
docker compose up -d

# 服务（各开终端）
pnpm dev:api      # http://localhost:3000
pnpm dev:room     # http://localhost:3001
pnpm dev:mobile   # Expo
pnpm dev:admin    # http://localhost:5173

cp .env.example .env
pnpm smoke
```

## Admin 后台

1. 启动 `pnpm dev:api` 与 `pnpm dev:admin`
2. 浏览器打开 http://localhost:5173
3. 使用 `.env` 中 `ADMIN_API_KEY` 登录

功能：用户查询/封禁/调账、手牌只读、私人场开关、举报工单、经济看板

## 私人场（v1.0.5）

客户端大厅 →「私人场」：

1. 支付 100 筹码开通权限（协议存证）
2. 建房：配置人数/带入上限，获取 6 位房间号 + 分享文案
3. 加入：输入房间号进入牌桌

API：`POST /api/v1/private/grant-permission` · `create-room` · `join-room`

## 项目结构

```
apps/
  api/          REST API
  room/         Socket.io 房间服务
  mobile/       Expo 客户端
  admin/        运营后台 (Vite + React)
packages/
  poker-engine/ 扑克引擎
  db/           数据访问层
  shared/       共享类型 + Design Tokens
infra/migrations/
docs/
```

## 权威文档

| 文档 | 说明 |
|---|---|
| [PRD-完整版-v2.1.md](docs/PRD-完整版-v2.1.md) | 产品主文档 |
| [07-开发里程碑与任务拆分.md](docs/07-开发里程碑与任务拆分.md) | Phase 1–5 |
| [10-版本范围规划.md](docs/10-版本范围规划.md) | v1.0 / v1.0.5 / v1.1 |
