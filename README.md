# Texas Hold'em — 联网多人德州扑克

跨端（iOS / Android / Web）实时德州扑克应用。

## 当前阶段

**文档评审与完善** — 开发尚未启动。请先完成产品/技术联合评审后再进入编码。

## 文档索引

| 文档 | 说明 |
|---|---|
| [01-产品技术联合评审](docs/01-产品技术联合评审.md) | 评审议程、矛盾修正、MVP 边界 |
| [02-待决策事项清单](docs/02-待决策事项清单.md) | 需 PM/技术拍板的开放问题 |
| [03-数据库设计完整版](docs/03-数据库设计完整版.md) | MySQL + Redis 完整 Schema |
| [04-WebSocket协议规范](docs/04-WebSocket协议规范.md) | 实时通信事件与 payload |
| [05-PRD补充修订-v1.5](docs/05-PRD补充修订-v1.5.md) | 产品文档补充（draft） |
| [06-架构补充修订-v1.1](docs/06-架构补充修订-v1.1.md) | 技术架构补充（draft） |
| [07-开发里程碑与任务拆分](docs/07-开发里程碑与任务拆分.md) | Phase 1–4 任务与验收 |

### 原始参考文档

- [PRD v1.4 原文](docs/archive/PRD-v1.4-original.md)
- [架构 v1.0 原文](docs/archive/Architecture-v1.0-original.md)

## 建议下一步

1. 召开评审会，逐项确认 `02-待决策事项清单.md` 中的 P0 项
2. 定稿 PRD v1.5 + 架构 v1.1
3. 按 `07-开发里程碑与任务拆分.md` 启动 Phase 1（Monorepo + poker-engine）
