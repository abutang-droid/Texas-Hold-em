# Texas Hold'em — 联网多人德州扑克

跨端（iOS / Android / Web）实时德州扑克应用。

## 当前阶段

**Phase 2 进行中** — API 认证/支付/匹配 + Room Server Socket.io + Expo 客户端骨架。

| 模块 | 状态 |
|---|---|
| `poker-engine` | ✅ 16 单测通过 |
| `packages/db` | ✅ PostgreSQL + Redis 封装 |
| `apps/api` | ✅ 游客登录 / 模拟充值 / 快速开始 / 周榜 |
| `apps/room` | ✅ Socket.io 9 人桌 + Bot 补位 + DB 买入 |
| `apps/mobile` | ✅ 大厅 / 牌桌 / i18n / Onboarding |

## 快速开始

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm build

# 运行扑克引擎单元测试
pnpm test

# 9 人桌 CLI 演示
pnpm demo

# 启动基础设施（PostgreSQL + Redis）
docker compose up -d

# 启动服务（另开终端）
pnpm dev:api    # http://localhost:3000/health
pnpm dev:room   # http://localhost:3001/health
pnpm dev:mobile # Expo 开发服务器

# API 冒烟测试（需 docker compose 已启动）
cp .env.example .env
pnpm smoke
```

## 项目结构

```
apps/
  api/          REST API（NestJS）
  room/         实时房间服务（Socket.io）
  mobile/       Expo 客户端（iOS / Android / Web）
packages/
  poker-engine/ 核心扑克引擎
  db/           PostgreSQL + Redis 数据访问
  shared/       共享类型 + Design Tokens
infra/
  migrations/   PostgreSQL DDL
docs/           产品与技术文档
```

## 权威文档

| 文档 | 说明 |
|---|---|
| **[PRD-完整版-v2.1.md](docs/PRD-完整版-v2.1.md)** | 产品单一事实来源 |
| [11-统一设计规范.md](docs/11-统一设计规范.md) | 视觉 / 组件规范 |
| [12-多语言规划.md](docs/12-多语言规划.md) | zh-CN + en-US |
| [07-开发里程碑与任务拆分.md](docs/07-开发里程碑与任务拆分.md) | Phase 1–5 |

## v2.1 关键决策

| 项 | 决策 |
|---|---|
| 官方场 | 9 人桌 |
| 数据库 | PostgreSQL 16 + Redis 7 |
| 语言 | zh-CN + en-US |
| 支付 v1.0 | Mock（`PAYMENT_MODE=mock`） |
| Bot v1.0 | 规则型，Room Server 内置 |
| 私人场 | v1.0.5 |

## 下一步

- Phase 2 收尾：断线重连 Snapshot、后台 v1.0、完整 WS 协议对齐
- Phase 3：私人场（v1.0.5）
