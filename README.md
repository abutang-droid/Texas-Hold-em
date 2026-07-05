# Texas Hold'em — 联网多人德州扑克

跨端（iOS / Android / Web）实时德州扑克应用。

## 当前阶段

**P0 评审已关闭** — 可启动 Phase 1 开发（Monorepo + poker-engine）。

## 文档索引

| 文档 | 说明 |
|---|---|
| [08-评审会议纪要](docs/08-评审会议纪要-20260705.md) | **P0 决策记录（最新）** |
| [01-产品技术联合评审](docs/01-产品技术联合评审.md) | 评审议程、矛盾修正 |
| [02-待决策事项清单](docs/02-待决策事项清单.md) | ✅ P0 已全部关闭 |
| [03-数据库设计完整版](docs/03-数据库设计完整版.md) | MySQL + Redis Schema |
| [04-WebSocket协议规范](docs/04-WebSocket协议规范.md) | 实时通信协议 |
| [05-PRD补充修订-v1.5](docs/05-PRD补充修订-v1.5.md) | 产品文档（已定稿） |
| [06-架构补充修订-v1.1](docs/06-架构补充修订-v1.1.md) | 技术架构（已定稿） |
| [07-开发里程碑与任务拆分](docs/07-开发里程碑与任务拆分.md) | Phase 1–4 任务 |

### 原始参考文档

- [PRD v1.4 原文](docs/archive/PRD-v1.4-original.md)
- [架构 v1.0 原文](docs/archive/Architecture-v1.0-original.md)

## v1.0 MVP 范围（已确认）

- 官方场 **9 人桌** + 私人场（同步上线）
- **模拟支付**（真实 IAP v1.1+）
- **规则型 Bot**（GTO v1.5+）
- 用户登录、IP 互斥、断线重连、后台最小集

## 建议下一步

启动 **Phase 1**：Monorepo 搭建 + `packages/poker-engine` 核心算法
