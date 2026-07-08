# Texas Hold'em — 联网多人德州扑克

跨端（iOS / Android / Web）实时德州扑克应用。

## 当前阶段

**Phase 1 已启动** — Monorepo + `poker-engine` 核心引擎可用。

## 快速开始

```bash
# 安装依赖
pnpm install

# 运行扑克引擎单元测试（16 tests）
pnpm --filter @texas-holdem/poker-engine test

# 9 人桌 CLI 演示
pnpm demo

# 构建所有包
pnpm build

# 启动基础设施（PostgreSQL + Redis）
docker compose up -d

# 启动 API / Room 服务
pnpm dev:api   # http://localhost:3000/health
pnpm dev:room  # http://localhost:3001/health
```

## 项目结构

```
apps/
  api/          REST API 服务（NestJS）
  room/         实时房间服务（NestJS，Phase 2 接 WebSocket）
packages/
  poker-engine/ 核心扑克引擎（洗牌/比牌/边池/抽水/Bot/状态机）
  shared/       共享类型 + Design Tokens
infra/
  migrations/   PostgreSQL DDL
docs/           产品与技术文档
```

## 权威文档（请优先阅读）

| 文档 | 说明 |
|---|---|
| **[PRD-完整版-v2.1.md](docs/PRD-完整版-v2.1.md)** | **产品单一事实来源（主文档）** |
| [11-统一设计规范.md](docs/11-统一设计规范.md) | 视觉 / 组件 / 动效规范 |
| [12-多语言规划.md](docs/12-多语言规划.md) | 中英双语 i18n |
| [10-版本范围规划.md](docs/10-版本范围规划.md) | v1.0 / v1.0.5 / v1.1 切分 |

## 技术规格

| 文档 | 说明 |
|---|---|
| [03-数据库设计完整版.md](docs/03-数据库设计完整版.md) | **PostgreSQL 16** + Redis Schema |
| [04-WebSocket协议规范.md](docs/04-WebSocket协议规范.md) | 实时通信协议 |
| [06-架构补充修订-v1.2.md](docs/06-架构补充修订-v1.2.md) | 技术架构（最新） |
| [07-开发里程碑与任务拆分.md](docs/07-开发里程碑与任务拆分.md) | 研发 Phase 1–5 |

## v2.1 关键决策摘要

| 项 | 决策 |
|---|---|
| 官方场 | 9 人桌 |
| 数据库 | **PostgreSQL 16**（非 MySQL） |
| 语言 | **zh-CN + en-US** 首期双语 |
| 设计 | 拟物化 Design Tokens（见 11-统一设计规范） |
| 私人场 | v1.0.5 上线 |
| 支付 | v1.0 模拟；v1.1 真实 IAP |
| Bot | v1.0 规则型；v1.5 GTO |

## 下一步

**Phase 2**：Room Server WebSocket + 官方场联网对局 + 客户端牌桌 UI
