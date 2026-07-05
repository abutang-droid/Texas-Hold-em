# 联网多人德州扑克技术架构与开发文档

| 项目 | 内容 |
|---|---|
| 文档版本 | v1.0 |
| 依据产品文档 | TexasHoldem_PRD v1.4 |
| 作者 | Manus AI (架构工程师) |
| 最后更新 | 2026-07-05 |

---

## 一、系统架构概览 (System Architecture)

本德州扑克应用采用**微服务架构（Microservices Architecture）**，以实现高并发、低延迟的实时游戏体验，并确保核心经济系统的强一致性与安全性。系统从逻辑上划分为四个主要层级：客户端层、网关接入层、业务逻辑层与数据持久层。

### 1.1 架构分层设计

- **客户端层 (Client Layer)**：负责 UI 渲染、动画表现（如发牌轨迹、筹码飞入）、音频播放及与服务端的实时通信。采用跨平台技术栈，以一套代码输出 iOS、Android 及 Web 端，UI 设计严格遵循拟物化（Skeuomorphic）规范。
- **网关接入层 (Gateway Layer)**：作为所有外部请求的统一入口，负责 SSL 卸载、负载均衡、连接保持、鉴权拦截及 WebSocket 消息的初步路由。
- **业务逻辑层 (Business Logic Layer)**：核心层，拆分为无状态的常规业务服务（如用户服务、充值服务）和有状态的实时游戏服务（Room Server）。游戏状态机（State Machine）在此层运行，负责所有的发牌、算牌、边池计算及 Bot 策略调度。
- **数据持久层 (Data Persistence Layer)**：负责用户数据、筹码流水、对局快照及配置信息的存储。采用关系型数据库与内存数据库混合使用的策略，以平衡数据强一致性与高读写性能。

### 1.2 核心设计原则

- **服务端权威模型 (Server-Authoritative)**：客户端仅作为"愚蠢的渲染器"（Dumb Terminal）。所有的随机数生成（洗牌）、逻辑判定（比牌、边池计算）、经济结算均在服务端完成，客户端的任何状态修改请求均需经过服务端校验，从根本上杜绝客户端内存修改类外挂。
- **高可用与断线恢复**：Room Server 需高频记录游戏状态快照（State Snapshot）至内存数据库。当客户端断线重连时，直接下发最新的快照以实现毫秒级画面恢复。

---

## 二、技术栈选型 (Technology Stack)

基于团队规模、开发效率及实时游戏场景的特殊要求，选型如下：

| 模块 | 技术选型 | 选型理由 |
|---|---|---|
| **客户端 (前端)** | React Native (Expo) | 一套代码跨 iOS/Android/Web，生态丰富，足以支撑德州扑克的 2D 动画需求。 |
| **网关接入层** | Nginx + HAProxy | Nginx 负责静态资源与 HTTPS 卸载，HAProxy 负责 WebSocket 的高效负载均衡。 |
| **实时通信协议** | WebSocket (Socket.io) | Socket.io 提供开箱即用的房间（Room）管理、广播及自动重连机制，非常适合棋牌类房间模型。 |
| **核心后端服务** | Node.js (TypeScript) + NestJS | 异步非阻塞 I/O 极适合处理大量 WebSocket 并发连接；TypeScript 提供严格的类型检查，降低重构风险。 |
| **游戏状态机** | XState | 用于管理德州扑克复杂的对局状态流转（Pre-flop -> Flop -> Turn -> River -> Showdown）。 |
| **内存数据库** | Redis | 存储玩家 Session、实时房间状态、对局快照、排行榜缓存，支撑高频读写。 |
| **关系型数据库** | MySQL 8.0 | 存储用户核心资产（筹码）、充值流水、私人场权限等强一致性要求高的数据。 |
| **Bot 策略引擎** | Python (C++ 扩展) | 运行 GTO 算法，通过 gRPC 或消息队列与 Node.js 游戏服通信。 |

---

## 三、数据库设计 (Database Design)

数据库设计遵循强一致性原则，尤其是涉及筹码变动的流水表（Ledger），必须支持事务（Transaction）与审计追踪。以下为核心表结构设计：

### 3.1 核心表结构定义

**用户表 (users)**
记录用户基本信息与权限状态。
- `id` (BIGINT, PK): 用户唯一标识
- `device_id` (VARCHAR): 设备指纹，用于反作弊与游客绑定
- `nickname` (VARCHAR): 昵称
- `avatar_url` (VARCHAR): 头像路径
- `chips_balance` (DECIMAL): 筹码余额（精确到小数点后2位，尽管业务上可能只用整数，但DECIMAL可防精度丢失）
- `private_room_permission` (BOOLEAN): 是否已支付 100 筹码开通私人场权限，默认 `false`
- `status` (ENUM): 账号状态（正常、冻结等）

**筹码流水表 (chip_transactions)**
所有筹码的增减必须在此表记录，用于审计和反作弊分析。
- `id` (BIGINT, PK): 流水唯一标识
- `user_id` (BIGINT, FK): 关联用户
- `amount` (DECIMAL): 变动金额（正数为增加，负数为减少）
- `type` (ENUM): 变动类型（RECHARGE_充值, RAKE_抽水, GAME_WIN_对局赢取, GAME_LOSS_对局输掉, PRIVATE_FEE_私人场权限费, EVENT_GIFT_运营赠送）
- `reference_id` (VARCHAR): 关联的外部单号或对局 ID（如牌局的 Hand ID）
- `created_at` (TIMESTAMP): 发生时间

**私人场房间记录表 (private_rooms)**
记录私人场的配置与生命周期。
- `id` (VARCHAR, PK): 房间号（如 6 位数字）
- `owner_id` (BIGINT, FK): 房主 ID
- `blind_level` (VARCHAR): 盲注级别（如 "5/10"）
- `buy_in_cap` (INT): 带入上限
- `status` (ENUM): 房间状态（WAITING, PLAYING, CLOSED）
- `created_at` (TIMESTAMP): 创建时间

**对局记录表 (hand_histories)**
记录每一手牌的完整历史，用于回放和外挂/伙牌检测。
- `hand_id` (VARCHAR, PK): 手牌唯一标识
- `room_id` (VARCHAR): 所在房间 ID
- `room_type` (ENUM): 房间类型（OFFICIAL_官方场, PRIVATE_私人场）
- `pot_size` (INT): 最终总底池大小
- `rake_amount` (INT): 抽水金额（官方场 5%，私人场 3%）
- `actions_json` (JSON): 完整操作序列（如 A 加注，B 跟注，发牌等）
- `created_at` (TIMESTAMP): 对局结束时间

### 3.2 Redis 缓存与实时状态设计

由于对局中筹码变动极度频繁，若每次下注都写 MySQL 会导致数据库崩溃。因此，采用 **Redis 作为对局中的主存储**，MySQL 作为持久化后盾。

- **房间状态缓存 (`room:state:{room_id}`)**: 存储当前牌桌上所有玩家的座位号、当前手牌、筹码量、倒计时状态。
- **玩家 Session 映射 (`user:session:{user_id}`)**: 存储玩家当前所在的 `room_id` 及 WebSocket 的 `socket_id`，用于断线重连路由。
- **带入锁 (`lock:buy_in:{user_id}`)**: 防止玩家在网络极差时双重点击带入导致筹码重复扣除。

**筹码结算策略**：
1. 玩家加入房间并带入筹码时，开启 MySQL 事务，从 `users.chips_balance` 扣除对应金额，写入 `chip_transactions`，并将该金额注入 Redis 房间状态中。
2. 对局过程中（如下注、赢取底池），所有筹码流转**仅在 Redis 中进行**。
3. 玩家离桌或房间解散时，将 Redis 中该玩家的最终筹码余额写回 MySQL，完成结算。

---

## 四、API 与实时通信规范 (API & Real-time Communication)

系统通信分为两类：基于 HTTP 的 RESTful API（用于非实时业务）和基于 WebSocket 的实时通信（用于对局）。

### 4.1 RESTful API 规范

用于用户认证、商城充值、排行榜拉取、私人场权限购买等。
- **协议**: HTTPS
- **数据格式**: JSON
- **鉴权**: JWT (JSON Web Token)，放置于 Header 的 `Authorization: Bearer <token>` 中。

**核心接口示例**：
- `POST /api/v1/auth/login`：用户登录/游客绑定
- `GET /api/v1/user/profile`：获取用户资料与筹码余额
- `POST /api/v1/shop/recharge`：发起充值请求，返回支付网关凭证
- `POST /api/v1/private-room/permission`：支付 100 筹码开通私人场权限
- `POST /api/v1/private-room/create`：创建私人房间（需验证权限）

### 4.2 WebSocket 实时通信规范

用于房间内的所有交互。采用事件驱动（Event-Driven）模型。

**客户端 -> 服务端 (Emit Events)**：
- `join_room`: 请求加入指定房间（携带带入筹码量）
- `player_action`: 玩家执行操作，参数包含 `actionType` (fold/check/call/raise/all-in) 和 `amount`
- `sit_out`: 请求暂离座位
- `re_buy_request`: (私人场) 玩家请求重新带入，需房主审批
- `room_admin_action`: (私人场) 房主执行管理操作，如踢人、暂停、解散

**服务端 -> 客户端 (Broadcast Events)**：
- `room_state_sync`: 下发完整的房间状态快照（用于初始化或断线重连）
- `player_joined` / `player_left`: 玩家加入/离开通知
- `game_started`: 牌局开始，下发初始状态（包括庄家位置、盲注扣除）
- `hole_cards_dealt`: 下发底牌（仅向对应玩家下发其底牌，其他人收到掩码数据）
- `action_turn`: 通知轮到某位玩家操作，并下发 15 秒倒计时时间戳
- `action_result`: 广播某位玩家的操作结果及动画指令
- `community_cards_dealt`: 发放公共牌（Flop/Turn/River）
- `pot_updated`: 底池更新通知，包含主池和边池（Side Pots）的实时数据
- `showdown_result`: 摊牌结果，包含胜者、赢取金额及底池分配明细（已扣除 5% 或 3% 抽水）
- `re_buy_approval_needed`: (私人场) 通知房主有玩家申请 Re-buy

---

## 五、核心逻辑实现方案 (Core Logic Implementation)

### 5.1 游戏状态机 (Game State Machine)

德州扑克逻辑复杂，极易出现时序 Bug。采用状态机模式严格控制对局流转。

**状态定义**：
1. `WAITING`: 等待玩家（人数 < 2）
2. `PRE_FLOP`: 翻牌前下注圈
3. `FLOP`: 翻牌圈下注圈
4. `TURN`: 转牌圈下注圈
5. `RIVER`: 河牌圈下注圈
6. `SHOWDOWN`: 摊牌与结算
7. `END_HAND`: 单局结束，清理桌面，准备进入下一局

**状态流转触发条件**：
在每个下注圈状态（如 `FLOP`），系统维护一个 `ActionQueue`。当所有未弃牌玩家都已操作，且投入底池的筹码持平（或全押）时，触发状态机向下一个状态（如 `TURN`）流转。

### 5.2 边池计算算法 (Side Pot Algorithm)

边池是德州扑克开发中最复杂的算法之一。当出现玩家 All-in 时，触发此逻辑。

**算法步骤**：
1. 收集当前下注圈所有玩家投入的筹码，按投入量从小到大排序。
2. 提取最小的 All-in 筹码量 `M`。
3. 从所有未弃牌玩家的投入中扣除 `M`，汇总形成一个底池（主池或上一个边池）。
4. 将该 All-in 玩家标记为"已封顶"（Capped），他仅有资格参与争夺步骤 3 形成的底池。
5. 若还有剩余筹码未分配，重复步骤 2-4，依次形成 Side Pot 1, Side Pot 2...
6. 结算时，从最后形成的边池开始，判定有资格争夺该边池的玩家中牌型最大者，分配筹码。

### 5.3 抽水逻辑与精度控制

- **触发判断**：状态机必须流转至 `FLOP` 状态及以后才允许抽水。若在 `PRE_FLOP` 阶段所有其他玩家弃牌导致一人获胜，则 `rake_amount = 0`。
- **比例与上限**：
  - 官方场：`rake_amount = Math.floor(Total_Pot * 0.05)`，无上限。
  - 私人场：`rake_amount = Math.floor(Total_Pot * 0.03)`，无上限。
- **扣除时机**：在 `SHOWDOWN` 状态计算出各赢家应得底池后，从总底池中扣除抽水，再将剩余筹码分配给赢家。

### 5.4 反作弊与安全加密

- **底牌非对称隔离**：服务端的洗牌算法在内存中生成牌库后，每个玩家的底牌数据被独立隔离。在 `hole_cards_dealt` 事件中，服务端只向玩家 A 的 WebSocket 连接发送其真实底牌，向玩家 B、C 发送 `[hidden, hidden]`。直到摊牌阶段，才广播真实数据。
- **外挂防范**：通过 Nginx 记录 IP，后端记录 Device ID。在加入房间接口中加入拦截中间件，严格执行 IP 和设备指纹互斥规则。

---

## 六、部署架构方案 (Deployment Architecture)

为支持高并发并确保全球玩家的低延迟，建议采用云原生容器化部署方案。

### 6.1 基础设施拓扑

- **CDN/边缘节点**：部署 Cloudflare 或 AWS CloudFront，用于加速客户端静态资源（UI 图片、音效）的加载。
- **负载均衡器 (ALB/ELB)**：统一入口，负责 HTTPS 证书卸载和 WebSocket 长连接的会话保持（Sticky Sessions）。
- **K8s 容器集群 (EKS/GKE)**：
  - **API Pods**：部署无状态的 HTTP API 服务，可根据 CPU 负载水平自动扩缩容（HPA）。
  - **Room Pods**：部署有状态的 WebSocket 游戏服务。通过 Redis 记录每个 Room 所在的 Pod IP。网关层需实现精准路由，将同一房间的玩家请求打到同一个 Pod 上。
- **Redis 集群**：采用 Redis Cluster 模式，提供高可用的内存数据读写。
- **MySQL 主从集群**：一主多从架构，主库处理充值、抽水等写操作，从库处理排行榜、历史记录等读操作。

### 6.2 CI/CD 流水线

- 采用 GitHub Actions 或 GitLab CI 构建自动化流水线。
- 代码合并至 `main` 分支后，自动触发单元测试（重点测试边池算法和抽水逻辑）。
- 测试通过后，构建 Docker 镜像并推送至镜像仓库，随后自动触发 K8s 的滚动更新（Rolling Update），实现零停机部署。

---

## 七、开发阶段与里程碑 (Development Phases)

| 阶段 | 周期估算 | 核心交付物 |
|---|---|---|
| **Phase 1: 基础设施与核心引擎** | 第 1-3 周 | 搭建前后端框架；完成洗牌、发牌、比牌及边池计算的底层算法引擎；完成 MySQL/Redis 结构设计。 |
| **Phase 2: 官方场 MVP** | 第 4-6 周 | 实现客户端 UI 渲染；打通 WebSocket 通信；完成官方场的完整对局流转、抽水结算及动态带入上限逻辑。 |
| **Phase 3: 私人场与经济系统** | 第 7-8 周 | 接入支付网关实现 1:1 充值；开发私人场权限购买、房主管理权限（审批 Re-buy、踢人）及 3% 抽水逻辑。 |
| **Phase 4: 联调、风控与压测** | 第 9-10 周 | 完善反作弊监控（IP互斥、筹码转移告警）；进行并发压测，优化延迟；修复边界时序 Bug。 |

---
*本文档基于 PRD v1.4 编制，作为研发团队架构设计与接口定义的基准指导。*
