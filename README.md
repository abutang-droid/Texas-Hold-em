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

# 启动基础设施（MySQL + Redis）
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
  shared/       共享类型
infra/
  migrations/   MySQL DDL
docs/           产品与技术文档
```

## 权威文档（请优先阅读）

| 文档 | 说明 |
|---|---|
| **[PRD-完整版-v2.0.md](docs/PRD-完整版-v2.0.md)** | **产品单一事实来源（主文档）** |
| [10-版本范围规划.md](docs/10-版本范围规划.md) | v1.0 / v1.0.5 / v1.1 切分 |
| [09-产品运营评审报告.md](docs/09-产品运营评审报告.md) | 运营视角评审 |

## 技术规格

| 文档 | 说明 |
|---|---|
| [03-数据库设计完整版.md](docs/03-数据库设计完整版.md) | MySQL + Redis Schema |
| [04-WebSocket协议规范.md](docs/04-WebSocket协议规范.md) | 实时通信协议 |
| [06-架构补充修订-v1.1.md](docs/06-架构补充修订-v1.1.md) | 技术架构 |
| [07-开发里程碑与任务拆分.md](docs/07-开发里程碑与任务拆分.md) | 研发 Phase 1–5 |

## 评审记录

| 文档 | 说明 |
|---|---|
| [08-评审会议纪要-20260705.md](docs/08-评审会议纪要-20260705.md) | 技术评审 P0 闭环 |
| [02-待决策事项清单.md](docs/02-待决策事项清单.md) | 决策清单（已关闭） |

## 归档

- [PRD v1.4 原文](docs/archive/PRD-v1.4-original.md)
- [架构 v1.0 原文](docs/archive/Architecture-v1.0-original.md)
- [PRD 补充 v1.5](docs/05-PRD补充修订-v1.5.md)（已合并入 v2.0）

## v2.0 关键决策摘要

| 项 | 决策 |
|---|---|
| 官方场 | 9 人桌 |
| 私人场 | v1.0.5 上线（含组局 UX + 举报） |
| 支付 | v1.0 模拟；v1.1 真实 IAP |
| Bot | v1.0 规则型；v1.5 GTO |
| 留存 | 注册送 100 筹码 + 等级 + 周榜 Top10 |

## 下一步

启动 **Phase 1**：Monorepo + `packages/poker-engine`
