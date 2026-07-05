# WebSocket 协议规范

| 项目 | 内容 |
|---|---|
| 版本 | v1.0 |
| 传输 | Socket.io over WSS |
| 命名 | 事件名 snake_case；JSON 字段 camelCase |
| 鉴权 | 连接时 `auth: { token: "<JWT>" }` |

---

## 一、通用约定

### 1.1 消息信封

所有服务端推送可携带：

```json
{
  "seq": 1024,
  "serverTs": 1720195200123,
  "payload": { }
}
```

- `seq`：房间级递增序号，客户端用于检测丢包/乱序
- 客户端 `emit` 需带 `requestId`（UUID）用于幂等

### 1.2 错误响应

```json
{
  "event": "error",
  "payload": {
    "code": "INSUFFICIENT_CHIPS",
    "message": "筹码不足",
    "requestId": "uuid"
  }
}
```

### 1.3 错误码表

| Code | HTTP 类比 | 说明 |
|---|---|---|
| `UNAUTHORIZED` | 401 | Token 无效 |
| `FORBIDDEN` | 403 | 无权限（如私人场未开通） |
| `ROOM_NOT_FOUND` | 404 | 房间不存在 |
| `ROOM_FULL` | 409 | 座位已满 |
| `IP_CONFLICT` | 403 | 同 IP 禁止同桌 |
| `DEVICE_CONFLICT` | 403 | 同设备禁止同桌 |
| `INSUFFICIENT_CHIPS` | 400 | 筹码不足 |
| `INVALID_ACTION` | 400 | 非法操作（非己回合等） |
| `BUY_IN_CAP_EXCEEDED` | 400 | 超过带入上限 |
| `RATE_LIMITED` | 429 | 操作过频 |

---

## 二、客户端 → 服务端

### `join_room` — 加入房间

```json
{
  "requestId": "uuid",
  "roomId": "R123456",
  "buyInAmount": 100,
  "postBlind": false
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| roomId | string | 否 | 空则快速开始（官方场） |
| buyInAmount | int | 是 | expiry | 带入筹码 |
| postBlind | bool | 否 | 是否支付 Big Blind 立即参与 |

---

### `player_action` — 玩家行动

```json
{
  "requestId": "uuid",
  "actionType": "raise",
  "amount": 20
}
```

| actionType | amount | 说明 |
|---|---|---|
| `fold` | - | 弃牌 |
| `check` | - | 过牌 |
| `call` | - | 跟注（服务端计算金额） |
| `raise` | int | 加注至总额 |
| `all_in` | - | 全押 |

---

### `sit_out` / `sit_in`

```json
{ "requestId": "uuid", "sitOut": true }
```

---

### `re_buy_request` — 私人场 Re-buy

```json
{
  "requestId": "uuid",
  "amount": 200
}
```

---

### `re_buy_response` — 房主审批（仅房主）

```json
{
  "requestId": "uuid",
  "targetUserId": 10002,
  "approved": true
}
```

---

### `room_admin_action` — 房主管理

```json
{
  "requestId": "uuid",
  "action": "kick",
  "targetUserId": 10002,
  "reason": "optional"
}
```

| action | 说明 |
|---|---|
| `kick` | 踢人（当前手牌结束后生效） |
| `mute` | 文字禁言 |
| `pause` | 暂停（当前手牌结束后） |
| `resume` | 恢复 |
| `dissolve_vote` | 发起解散投票 |

---

### `dissolve_vote_response`

```json
{
  "requestId": "uuid",
  "approved": true
}
```

---

### `send_emoji` — 官方场快捷表情

```json
{
  "requestId": "uuid",
  "emojiId": "nice_hand"
}
```

---

### `send_chat` — 私人场文字（v1.5）

```json
{
  "requestId": "uuid",
  "message": "hello"
}
```

---

## 三、服务端 → 客户端

### `room_state_sync` — 全量快照（进房/重连）

```json
{
  "seq": 1,
  "payload": {
    "roomId": "R123456",
    "roomType": "OFFICIAL",
    "maxSeats": 9,
    "blinds": { "sb": 1, "bb": 2 },
    "buyInCap": 100,
    "phase": "PRE_FLOP",
    "handId": "H...",
    "buttonSeat": 0,
    "communityCards": [],
    "pots": [{ "amount": 3, "eligibleSeats": [0, 1] }],
    "seats": [
      {
        "seatIndex": 0,
        "userId": 10001,
        "nickname": "Player1",
        "avatarUrl": "...",
        "chips": 97,
        "betThisRound": 2,
        "status": "ACTIVE",
        "isBot": false,
        "holeCards": ["Ah", "Ks"]
      },
      {
        "seatIndex": 1,
        "userId": 10002,
        "holeCards": ["**", "**"]
      }
    ],
    "mySeatIndex": 0,
    "currentTurnSeat": 2,
    "actionDeadline": 1720195215000
  }
}
```

> 重连时 `holeCards` 仅自己的为明文。

---

### `player_joined` / `player_left`

```json
{
  "payload": {
    "seatIndex": 3,
    "userId": 10003,
    "nickname": "Mike_D",
    "chips": 100,
    "isBot": false
  }
}
```

---

### `game_started`

```json
{
  "payload": {
    "handId": "H20260705143000001",
    "buttonSeat": 2,
    "sbSeat": 3,
    "bbSeat": 4,
    "blindsPosted": { "sb": 1, "bb": 2 }
  }
}
```

---

### `hole_cards_dealt` — 仅发给对应玩家

```json
{
  "payload": {
    "cards": ["Ah", "Ks"]
  }
}
```

其他玩家收到：

```json
{ "payload": { "seatIndex": 0, "cards": ["**", "**"] } }
```

---

### `action_turn`

```json
{
  "payload": {
    "seatIndex": 3,
    "userId": 10003,
    "deadline": 1720195215000,
    "validActions": ["fold", "call", "raise", "all_in"],
    "callAmount": 10,
    "minRaise": 20,
    "maxRaise": 150
  }
}
```

---

### `action_result`

```json
{
  "payload": {
    "seatIndex": 3,
    "userId": 10003,
    "actionType": "raise",
    "amount": 20,
    "chipsRemaining": 80,
    "potTotal": 45,
    "autoAction": false
  }
}
```

`autoAction: true` 表示超时系统自动 Check/Fold。

---

### `community_cards_dealt`

```json
{
  "payload": {
    "phase": "FLOP",
    "cards": ["Ah", "Kd", "7c"],
    "allCommunityCards": ["Ah", "Kd", "7c"]
  }
}
```

---

### `pot_updated`

```json
{
  "payload": {
    "mainPot": 45,
    "sidePots": [
      { "index": 1, "amount": 30, "eligibleSeats": [0, 1] }
    ]
  }
}
```

---

### `showdown_result`

```json
{
  "payload": {
    "hands": [
      {
        "seatIndex": 0,
        "userId": 10001,
        "holeCards": ["Ah", "Ks"],
        "bestFive": ["Ah", "Ks", "Kd", "7c", "2d"],
        "handRank": "ONE_PAIR",
        "won": true,
        "winAmount": 42
      }
    ],
    "potBreakdown": [
      { "potIndex": 0, "amount": 45, "rake": 2, "winners": [{ "seatIndex": 0, "amount": 43 }] }
    ],
    "totalRake": 2
  }
}
```

---

### `hand_ended`

```json
{
  "payload": {
    "handId": "H...",
    "nextHandIn": 3000
  }
}
```

---

### `buy_in_cap_updated` — 动态上限变更

```json
{
  "payload": {
    "newCap": 200,
    "triggerReason": "TWO_PLAYERS_OVER_500"
  }
}
```

---

### `re_buy_approval_needed` — 通知房主

```json
{
  "payload": {
    "userId": 10002,
    "nickname": "Player2",
    "amount": 200,
    "deadline": 1720195221000
  }
}
```

---

### `bot_fill_notice` — 可选，Bot 入场提示（可不展示给玩家）

```json
{
  "payload": {
    "seatIndex": 4,
    "displayName": "PokerKing88"
  }
}
```

---

### `risk_notice` — 风控（如被 Sit Out）

```json
{
  "payload": {
    "type": "FORCED_SIT_OUT",
    "reason": "TIMEOUT_TWICE",
    "durationSec": 300
  }
}
```

---

## 四、房间阶段状态机（与服务端对齐）

```
WAITING → PRE_FLOP → FLOP → TURN → RIVER → SHOWDOWN → END_HAND → (WAITING|PRE_FLOP)
```

**暂停态**：`PAUSED` 叠加在 `WAITING`，不发新牌直至 `resume`。

---

## 五、客户端实现要点

1. **以 `room_state_sync` 为唯一真相来源**，其他事件做增量
2. **重连流程**：WS reconnect → emit `reconnect_room`（可选）→ 收 `room_state_sync`
3. **动画队列**：`action_result` / `community_cards_dealt` 按 seq 排队播放，避免乱序
4. **预操作**：客户端本地维护，局势变化时清空并提示
5. **幂等**：相同 `requestId` 重复提交，服务端返回首次结果

---

## 六、REST 与 WS 职责边界

| 能力 | 通道 |
|---|---|
| 登录、资料、充值、权限购买 | REST |
| 快速开始（仅匹配） | REST 返回 roomId + WS token，或纯 WS join_room |
| 对局内所有交互 | WS |
| 排行榜拉取 | REST |

---

*协议变更需递增 `protocolVersion`，客户端连接时协商。*
