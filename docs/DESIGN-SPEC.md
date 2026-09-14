# 德州扑克 · 项目设计规范

版本：v3 · 2026-09-12  
状态：**当前客户端视觉 SSOT**  
适用范围：Expo / React Native **移动端优先**（大厅、登录、人庄、商城、设置、6 人桌），管理后台与 `apps/felt-web` 演示桌对齐同一 token。

画板基准是 **390×844 竖屏手机**。所有新界面先在竖屏成立，再考虑横屏加宽。6 人现金桌可以横屏，但不得把横屏桌当成规范基准。

本规范：大厅 / 登录走暗绿场；**人庄主界面**走亮绿竖屏毡面（圆形霓虹下注位 + 底部筹码条）。技术栈以 React Native 为主。

产品约束不变：

- 官方 6 人桌（`maxPlayers = 6`），椭圆座位，荷官固定顶中
- 默认旁观 → 入座 → 站起 / 离桌
- 发牌从荷官飞出、公共牌翻牌前不占位、摊牌逐步结算
- 虚拟筹码；不做真金 / WLD / 监管套利赌场功能

---

## 1. 设计原则

1. **移动优先**：先做一只手可操作的竖屏。Web / 横屏是加宽，不是主稿。
2. **大厅暗场 / 人庄亮毡**：大厅、登录、6 人桌壳用 `#07140F`；人庄主界面用亮绿毡 `#1C8A48`，底部木色栏。
3. **单一行动色（大厅）**：鼠尾草绿 `#2E7D63` 用于主按钮、当前行动、入座 CTA。
4. **人庄用白描边圆位**：底注 / 加注是空心圆 + 细白边，选中筹码坐在圆上；不要做成大厅那套深色卡片列表。
5. **浅字深底**：大厅主文字 `#E8F5EE`；人庄主文字 `#F4FFF8`。牌面点数仍用深墨 `#17191C` 写在白牌上。
6. **触控优先**：可点区域 ≥ 44×44；底部筹码直径 ≥ 48。
7. **荷官顶中（6 人桌）**：荷官是发牌起点，不是装饰人像。
8. **虚拟筹码**：不做真金、WLD、UTH 边注、监管套利。人庄玩法仍是加勒比梭哈：底注 → 弃牌或 2× 加注，庄家一对 4 成牌。

旧版浅灰大厅（`#EEF1F3` + 白卡片）已退役。金色 `#C9A227` 不再作为品牌色。

---

## 2. 设计 Token

实现位置：

- 色板：`packages/shared/src/design-tokens/colors.json`（跨端共享）
- 主题：`apps/mobile/src/theme/index.ts`（RN spacing / type / shadow / extras）
- Web 演示：`apps/felt-web` 对齐同一 hex
- 管理后台：`apps/admin/src/styles.css` 对齐同一 hex

### 2.1 颜色

| Token | Hex / 值 | 用途 |
| --- | --- | --- |
| `--bg` / `color.bg.lobby` | `#07140F` | 全局背景、大厅、登录、牌桌壳 |
| `--surface` / `color.bg.card` | `#0E241C` | 卡片、座位条、输入框、次按钮底 |
| `--surface-modal` / `color.bg.modal` | `#122A22` | 弹层 |
| `--felt` / `color.felt.base` | `#0C3A2B` | 椭圆毯面 |
| `--rail` / `color.felt.rail` | `#16120E` | 木沿 |
| `--rail-highlight` | `rgba(201,176,120,0.22)` | 木沿细金边（装饰，不是品牌金标题） |
| `--ink` / `color.text.primary` | `#E8F5EE` | 标题、主文案（牌面除外） |
| `--muted` / `color.text.secondary` | `#8FBFAB` | 辅助说明 |
| `--disabled` / `color.text.disabled` | `#5A7A6C` | 占位、禁用 |
| `--line` / `palette.line` | `rgba(232,245,238,0.14)` | 细分割、输入框边 |
| `--accent` / `color.brand.primary` | `#2E7D63` | 主按钮、当前行动 |
| `--lime` / `color.brand.secondary` | `#A3E635` | 余额、底池、呼吸光 |
| `--accent-soft` / `palette.accentSoft` | `rgba(52,211,153,0.16)` | 选中态、下注胶囊 |
| `--warn` / `color.semantic.danger` | `#E11D48` | 弃牌、错误、破坏性操作 |
| `--red-suit` / `palette.redSuit` | `#E11D48` | ♥ ♦ |
| `--card-face` / `palette.cardFace` | `#FFFFFF` | 牌面底 |
| `--card-ink` / `palette.ink` | `#17191C` | 牌面点数 / 黑花色 |
| `--card-back` / `palette.cardBack` | `#4A1018` | 牌背底（图加载前） |
| `--inverse` / `palette.inverse` | `#F4F7F5` | 绿按钮上的字，**不是**面板底 |
| `--chip-stack` / `palette.chipStack` | `#1A3D30` | 筹码堆 |
| `--backdrop` / `palette.backdrop` | `rgba(5,8,7,0.72)` | 弹层遮罩 |
| `palette.studFelt` | `#1C8A48` | 人庄亮绿毡 |
| `palette.studFeltDeep` | `#14753C` | 人庄底栏 |
| `palette.studBanner` | `#F3F4EF` | 人庄成牌说明胶囊 |

强调色只用在：当前玩家描边、主按钮、底池 / 下注高亮、发牌中荷官环、余额。  
禁止：渐变按钮、金色大标题、紫色装饰、整页霓虹描边。  
`palette.inverse` 只做「深底上的浅字」，不要再当浅色面板。

### 2.2 圆角 / 阴影 / 间距

| Token | 值 |
| --- | --- |
| `--r-card` | 18 |
| `--r-btn` | 14 |
| `--r-pill` | 999 |
| `--r-sm` | 10 |
| `--shadow` | `0 16px 28px rgba(0,0,0,0.45)` |
| `--glow` | `0 0 14px rgba(163,230,53,0.45)` |
| 间距阶 | 4 / 8 / 12 / 16 / 24 / 32 / 48 |

### 2.3 字体

优先 **Sora** 400 / 600 / 700 / 800。未加载到 Sora 时回退系统无衬线（iOS San Francisco / 安卓 sans-serif / 中文系统字体）。

| 角色 | 字号 | 字重 |
| --- | --- | --- |
| 顶栏标题 | 16 | 800 |
| 分区标题 | 13 | 700 |
| 正文 | 13–14 | 400 |
| 按钮 | 14 | 800 |
| 底池数字 | 20 | 800 |
| 座位名 / 筹码 | 11–12 | 600–800 |
| 牌面点数 | 随牌面尺寸 | 800 |

---

## 3. 信息架构与页面骨架

自上而下（牌桌）：

1. **顶栏**：返回 · 房间标题（`6 人 · 盲注`）· 设置
2. **荷官区**：圆角头像 + 状态胶囊（等待 / 发牌中 / 亮牌中）
3. **对手座位**：沿椭圆分布，避开顶中荷官与底中自己
4. **公共牌 + 底池**：桌心；翻牌前不放三张空牌位
5. **自己手牌 + 行动条**：底部固定；主按钮 52 高

大厅 / 登录 / 商城 / 设置沿用暗绿底。人庄是独立亮绿竖屏，不复用大厅卡片列表。  
Expo `orientation` 为 `default`（竖屏优先）；`userInterfaceStyle` 与启动屏为 `#07140F`。StatusBar 用 light content。

人庄主界面骨架（对照手机竖屏参考图）：

1. 顶栏图标：关闭 / 返回 / 规则 / 静音 / 回大厅  
2. 四格数据：余额 · 总局数 · 底注 · 总盈亏  
3. 最大额 / 最小额（取当前 ante 档）  
4. 白底胶囊：庄家至少一对 4  
5. 标题 CARIBBEAN STUD（不是 Ultimate Texas Hold'em）  
6. 圆形位：对子 4+（只打开规则）→ 底注（点下发牌）→ 加注（决策后 2×）  
7. 发牌后在毡面上叠庄家牌 / 公共牌 / 手牌  
8. 底部木色栏：筹码档 + 规则；脚注「人庄 · 虚拟筹码桌」

禁止把参考图里的 UTH「三条或以上 / 盲注」做成真实边注。

---

## 4. 荷官

- 形态：圆角头像（「荷」字或极简筹码堆），**不是**写实人物。
- 位置：桌面顶中，发牌飞出的起点。
- 状态胶囊：`等待` / `发牌中…` / `亮牌中`。
- 发牌中：头像外圈用 `--lime` 细环，可加克制呼吸光。
- 禁止：帽子、领结、写实面部。

---

## 5. 座位

- 容器：深绿卡片、圆角 14、深阴影。
- 头像：圆角方（约 28% 半径），当前座位 / 自己座位可加青柠光晕。
- 庄家 D：`--accent` 底 + inverse 小圆。
- 筹码：次要色数字，不用金色。
- 下注：`--accent-soft` 胶囊 + `--lime` 或 `--accent` 数字。
- 当前行动：`--lime` 描边 + 呼吸光。
- 弃牌：整体透明度 45%。
- 空座：虚线边 + 「入座」；旁观可点。
- 自己座位：可与手牌区合并，避免桌面上再叠一块重复座位卡。

---

## 6. 扑克牌

| 尺寸 | 宽×高 | 用途 |
| --- | --- | --- |
| xs | 26×36 | 对手牌背 |
| sm | 46×64 | 公共牌 |
| lg | 62×88 | 自己手牌 |

牌面：

- 白底、细线 `#E6E8EB`、圆角 8
- **左上角只放点数**（无花色角标）
- **正中放大花色**
- 不画右下角倒置索引
- 红花色 `#E11D48`，黑花色 `#17191C`

牌背：

- 使用 `apps/mobile/assets/card-back.webp`（felt-web 同图）：Serpentine Legacy 红底金蛇
- 圆角裁切 + `cover`，细描边 `rgba(201,176,120,0.45)`
- 图未到时底色 `#4A1018`

摊牌：有竞争才亮对手手牌；单人赢（全弃）保持牌背。

---

## 7. 底池、计时、结算

- 底池：深绿卡片 + 青柠数字。
- 边池：同一卡片内次要色说明。
- 行动计时：圆环 / 数字用 `--accent`；紧急态用 `--warn`。
- 结算：逐步展示（谁赢 → 主池 / 边池 → 未跟注退还）；文案用 ink / muted，金额用 lime。
- 飞筹码：深绿筹码，轨迹克制，不做金色粒子。
- 飞牌：280–420ms，从荷官飞到座位 / 公共牌，可带轻微旋转。

---

## 8. 按钮与表单

| 类型 | 样式 |
| --- | --- |
| 主按钮 | `--accent` 底 + **inverse 字** + 圆角 14 + 高 52 |
| 次按钮 | 深绿卡片 + 浅字 + `--line` 边 |
| 弃牌 | 深绿底 + `--warn` 字与边 |
| 跟注 / 加注 | 主按钮样式 |
| 禁用 | 透明度 45%，不可点 |

输入框：深绿底、`--line` 边、圆角 10、高 ≥ 44、浅色字。  
弹层：`--surface-modal`、圆角 18、`--backdrop` 遮罩。

---

## 9. 动效

- 时长：飞牌 / 飞筹码 280–420ms，ease-out。
- 发牌：从荷官中心飞到目标座位或公共牌位。
- 翻牌：不要在翻牌前预留三张空槽。
- 座位光晕：只闪头像外环，不要把整个头像透明度闪没。
- 禁止：弹性夸张弹跳、屏幕闪金、粒子爆炸。

---

## 10. 无障碍与工程约束

- 主操作对比度：绿底浅字；正文浅字 on `--bg`。
- 牌面必须保持白底深墨，保证红黑花色可读。
- 可点热区 ≥ 44px；站起 / 离桌等桌面小按钮按现有热区放大，不得小于 44。
- 中英文案走 `locales`，视觉层不写死房间玩法数字。
- Token 变更必须改 `colors.json` + `theme/index.ts`，禁止在页面里新增长期硬编码色。
- 本规范不改变协议与房间逻辑；UI 重构不得回退旁观 / 入座 / 站起 / 逐步结算。
- 移动端改动后同步更新 `scripts/lib/mac-common.sh` 与 `scripts/mac-fix-call-loop.sh`。
- 不要把 `router.replace('/auth/login')` 写回 `apps/mobile/app/index.tsx`。

---

## 11. 明确禁止

- 紫蓝渐变、金色大标题、霓虹描边、WLD 紫
- Emoji 充当系统图标（牌桌内表情互动条除外，且需收敛为次要控件）
- 写实荷官、牌面四角重复索引、除指定 Serpentine Legacy 外另做赌场花纹牌背
- 浅灰大厅 / 白卡片皮肤（v1 已退役）
- 主按钮深色字（绿底必须 inverse 字）
- 用 `palette.inverse` 当面板背景

---

## 12. 对照实现

| 规范章节 | 主要文件 |
| --- | --- |
| Token | `packages/shared/src/design-tokens/colors.json`、`apps/mobile/src/theme/index.ts` |
| 荷官 | `apps/mobile/src/components/DealerStation.tsx` |
| 牌桌 / 座位 | `apps/mobile/src/components/Table9Max.tsx` |
| 头像 | `apps/mobile/src/components/Avatar.tsx` |
| 扑克牌 | `apps/mobile/src/components/ui/PlayingCard.tsx` |
| 底池 | `apps/mobile/src/components/PotDisplay.tsx` |
| 行动条 | `apps/mobile/src/components/ActionPanel.tsx` |
| 结算 | `apps/mobile/src/components/ShowdownOverlay.tsx` |
| 牌桌壳 | `apps/mobile/app/table.tsx` |
| 人庄 | `apps/mobile/app/stud.tsx` |
| 按钮 | `apps/mobile/src/components/ui/Button.tsx` |
| Web 演示 | `apps/felt-web` |
| 管理后台 | `apps/admin/src/styles.css` |
