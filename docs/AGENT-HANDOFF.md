# Agent 交接文档（Texas Hold'em）

> **用途**：开新 Cursor 对话时，把本文档路径或全文贴给 Agent，可快速恢复上下文。  
> **最后更新**：2026-08-30（r3：多镜像 + 完整同步清单 + Expo --web 等待端口）  
> **仓库**：`https://github.com/abutang-droid/Texas-Hold-em`  
> **主分支**：`main`（开发以 `main` 为准，不再要求 checkout 旧 feature 分支）

---

## 1. 用户与环境

| 角色 | 机器 | 说明 |
|------|------|------|
| **用户日常开发** | Mac mini `je@jedeMac-mini` | 只跑 Expo 客户端；**不能**稳定 `git pull`（GitHub 443 超时，国内网络） |
| **Staging 服务器** | `uoto@tex` / `192.168.31.53` | API `:3000`、Room `:3001`、Admin `:5173`；用 PM2 + Docker Postgres |

**用户当前环境（已确认）**：
- Node `v24.15.0`（文档建议 20，但 24 可用）
- pnpm `10.9.0`
- 项目目录：`~/Texas-Hold-em`

**硬约束**：
- Phase 1 轻量 App，**不要**推进生产 OAuth/IAP（B1 决策未做）
- Mac 端更新代码靠 **mirror curl**，不靠 `git pull`
- 所有 Cloud Agent 新建分支名：遵循**当前 run 的后缀**（本机说明里的 `-2fc9` 是旧 run；不要混用）

---

## 2. 架构（一句话）

```text
Mac Expo (localhost:8081)  →  Staging API (:3000) + Room (:3001)  →  Docker Postgres/Redis
```

Monorepo（pnpm workspace）：
- `apps/mobile` — Expo Router 客户端
- `apps/api` — NestJS API
- `apps/room` — 游戏房间 WebSocket 引擎
- `apps/admin` — 运营后台
- `packages/shared` — 共享类型/常量（mobile 依赖其 `dist/`）
- `packages/poker-engine`、`packages/db`

---

## 3. 用户当前卡点（优先处理）

**现象**：Mac 上 curl 脚本后 **Expo 没有启动**。上一轮最后一次失败是：

```text
curl: (56) The requested URL returned error: 404
bash: /tmp/mac-start.sh: No such file or directory
```

（当时 `mac-start-mobile.sh` 刚合入 `main`，ghfast 缓存 404。）用户尚未确认 Expo 已起来。

**请让用户执行（多镜像，避免单点 404）**：

```bash
cd ~/Texas-Hold-em

ok=0
for u in \
  "https://ghfast.top/https://raw.githubusercontent.com/abutang-droid/Texas-Hold-em/main/scripts/mac-start-mobile.sh" \
  "https://gh-proxy.com/https://raw.githubusercontent.com/abutang-droid/Texas-Hold-em/main/scripts/mac-start-mobile.sh" \
  "https://cdn.jsdelivr.net/gh/abutang-droid/Texas-Hold-em@main/scripts/mac-start-mobile.sh"
do
  echo "下载: $u"
  if curl -fsSL --connect-timeout 10 --max-time 30 --retry 3 --retry-delay 2 "$u" -o /tmp/mac-start.sh; then
    ok=1
    break
  fi
done

if [ "$ok" = 1 ]; then bash /tmp/mac-start.sh; else bash scripts/mac-mobile-dev.sh; fi
```

**若 PR 尚未合入 main**，把 URL 里的 `main` 换成当前修复分支名。

**成功标志**：终端出现 `Expo 已启动` 或 `Starting Expo (Metro)`；浏览器打开 `http://localhost:8081/auth/login`。

**排障**（让用户贴完整输出）：

```bash
cd ~/Texas-Hold-em
bash scripts/mac-diagnose.sh
lsof -i :8081
```

---

## 4. Mac 脚本体系（`scripts/lib/mac-common.sh` 为单一真相）

| 脚本 | 作用 |
|------|------|
| `mac-start-mobile.sh` | **推荐**：mirror 同步 + `pnpm install`（如需）+ build shared + 启动 Expo |
| `mac-sync-mobile.sh` | 仅同步 mobile/shared 文件清单 + build shared；**不启动** |
| `mac-mobile-dev.sh` | 仅启动 Expo（假设代码已同步） |
| `mac-staging-mobile.sh` | 含 staging 健康检查 + 全量 `pnpm build` + 启动 |
| `mac-staging-check.sh` | Ping + API/Room health |
| `mac-diagnose.sh` | 打印 node/pnpm/8081/.env/关键文件，方便把输出贴给 Agent |

**关键实现**：
- `/tmp` 下 curl 的脚本 → 多镜像拉取最新 `mac-common.sh`；**进度日志必须打 stderr**（否则 `source "$(...)"` 路径被污染，脚本静默退出 —— PR #30 的隐藏 bug）
- `ensure_workspace_deps` — 每次 `pnpm install`（已装则很快）；失败则 npmmirror
- `free_expo_port` — 8081 被占时杀掉旧 Metro
- `start_expo_dev_server` — 使用仓库内 expo 二进制 + `--web`；等待端口就绪后打开登录页
- `mac_mobile_sync_files` — 含牌桌/登录全部依赖（漏文件会导致 Metro 500）

**Mirror 基址（自动回退）**：

```text
https://ghfast.top/https://raw.githubusercontent.com/abutang-droid/Texas-Hold-em/main/
https://gh-proxy.com/https://raw.githubusercontent.com/abutang-droid/Texas-Hold-em/main/
https://cdn.jsdelivr.net/gh/abutang-droid/Texas-Hold-em@main/
```

**常见用户错误**：
- 在服务器 `uoto@tex` 上跑 Mac 脚本（Linux 无 brew）
- 只跑 sync 以为会启动
- `cd` 不在 `~/Texas-Hold-em` 导致 `ROOT=/`（旧问题，已在 mac-common 修复）
- zip 全量解压 mirror 包时 `docs/` 乱码文件名失败 → 用 file-by-file sync

---

## 5. Staging 服务器运维

**SSH**：`uoto@192.168.31.53`（用户有时写 `uoto@tex`）

| 服务 | 端口 | 检查 |
|------|------|------|
| API | 3000 | `curl http://192.168.31.53:3000/health` |
| Room | 3001 | `curl http://192.168.31.53:3001/health` → `version` 应为 **0.4.5** |
| Admin | 5173 | 浏览器；密钥 = 服务器 `.env` 的 `ADMIN_API_KEY` |

**Room 版本曾卡在 0.4.1**：dist 未重建 / PM2 未重启。  
修复脚本：`scripts/staging-redeploy-room.sh`（期望 version `0.4.5`）

**部署曾失败点**：`migrate.sh` 宿主机无 `psql` → 已改为 `docker exec th-postgres`；migrate 失败不阻塞 PM2（PR #18）

**6-max 桌**（PR #26，代码在 main）：
- `packages/shared/src/table-config.ts` → `MAX_TABLE_SEATS = 6`
- `apps/room/src/game/interactive-table.ts` → `maxSeats: 6`
- migration `003_max_seats_six.sql`
- **需确认 staging 是否已 deploy** 到含 6-max 的 main

---

## 6. Mobile 认证 / 导航流程（当前 `main`）

顺序：**登录/游客 → 可选 onboarding → 大厅 → 年龄声明 → 快速开始**

关键文件：
- `apps/mobile/app/_layout.tsx` — 始终渲染 `<Stack />`；`NavigationGuards` 在 nav ready 后 `router.replace`
- `apps/mobile/app/index.tsx` — 大厅；**不要在 init 里直接 `router.replace`**（曾导致 mount 前导航崩溃）
- `apps/mobile/app/auth/login.tsx` — 登录页
- `apps/mobile/src/api/client.ts` — `bootstrapSession()`、401 清 session、`setUnauthorizedHandler`

Layout 版本标记：`LAYOUT_REV = '2026-08-30-nav2'`（console 可确认是否加载新 bundle）

---

## 7. 已合并 PR 摘要（#16–#30）

| PR | 主题 |
|----|------|
| #16 | Quick Start：loading、超时、合规 UX |
| #17 | `staging-redeploy-room.sh` |
| #18 | migrate 失败不阻塞 PM2 |
| #19–#21 | 登录重定向、auth 顺序、Root Layout mount |
| #22 | Lobby init guard |
| #23–#28 | Mac mirror 同步脚本、ROOT 修复、`.env` 自动创建 |
| #26 | **仅 6 人桌** |
| #27 | Metro 500：mirror 后需 build shared |
| #29 | 脚本收敛到 `mac-common.sh` |
| #30 | **Expo 启动修复** + `mac-start-mobile.sh`（已 merge `main`） |
| #31 | **Expo 启动加固**：多镜像、完整同步清单、等待 Metro、`source` stdout 污染修复 |

---

## 8. 已知问题 / 技术债

1. **CI 失败**（与脚本改动无关）：`pnpm/action-setup@v4` 与 `package.json` 的 `packageManager: pnpm@10.9.0` 冲突 → workflow 需去重 version 配置
2. **ghfast 镜像延迟**：新文件 push 到 main 后可能 404 数秒～数分钟；脚本会换 gh-proxy / jsDelivr；仍失败则用本地 `mac-mobile-dev.sh`
3. **async-storage 版本警告**：Expo 52 期望 `1.23.1`，当前 `3.1.1` — 仅 warning，暂未阻塞
4. **用户 Node 24** vs 文档 Node 20 — 目前能跑，出问题再 pin

---

## 9. 开新对话时 Agent 应遵守

1. **先读** `scripts/lib/mac-common.sh` 和 `docs/MAC-MINI-STAGING.md`
2. Mac 用户：**优先 mirror curl**，不要假设能 `git pull`
3. 改 mobile 后：manifest 在 `mac_mobile_sync_files()` 里补路径
4. 测试 mobile：根目录 `pnpm --filter @texas-holdem/shared build`；`apps/mobile` 下 `npx expo start`
5. 分支：`cursor/<name>-<当前run后缀>`；PR base `main`；push `git push -u origin <branch>`
6. **不要**擅自推进 OAuth/IAP/生产支付

---

## 10. 快速命令备忘

### Mac 一键启动

```bash
cd ~/Texas-Hold-em
ok=0
for u in \
  "https://ghfast.top/https://raw.githubusercontent.com/abutang-droid/Texas-Hold-em/main/scripts/mac-start-mobile.sh" \
  "https://gh-proxy.com/https://raw.githubusercontent.com/abutang-droid/Texas-Hold-em/main/scripts/mac-start-mobile.sh" \
  "https://cdn.jsdelivr.net/gh/abutang-droid/Texas-Hold-em@main/scripts/mac-start-mobile.sh"
do
  echo "下载: $u"
  if curl -fsSL --connect-timeout 10 --max-time 30 --retry 3 --retry-delay 2 "$u" -o /tmp/mac-start.sh; then
    ok=1
    break
  fi
done
if [ "$ok" = 1 ]; then bash /tmp/mac-start.sh; else bash scripts/mac-mobile-dev.sh; fi
```

### Mac 检查 Staging

```bash
bash scripts/mac-staging-check.sh
```

### Staging 仅重启 Room

```bash
cd ~/Texas-Hold-em && bash scripts/staging-redeploy-room.sh
```

### 本地（Cloud Agent VM）验证 shared build

```bash
cd /workspace && pnpm --filter @texas-holdem/shared build
```

---

## 11. 相关文档

| 文件 | 内容 |
|------|------|
| `docs/MAC-MINI-STAGING.md` | Mac 连 Staging 技术说明（含 mirror） |
| `docs/MAC-MINI-操作指南.md` | 用户向网页操作指南（部分分支名过时） |
| `docs/LOCAL_DEV.md` | Mac 本地全栈 |
| `docs/PROXMOX-STAGING.md` | Staging 服务器安装 |
| `docs/PRD-完整版-v2.1.md` | 产品需求 |

---

## 12. 下一步建议（按优先级）

1. **确认用户 Mac 上多镜像 `mac-start-mobile.sh` 是否成功启动 Expo** — 未成功则根据 `mac-diagnose.sh` + 终端日志排障
2. **确认 Staging Room health = 0.4.5** 且 6-max 已生效
3. 修复 CI pnpm version 冲突（可选，不阻塞用户玩）
4. 继续 Phase 1 游戏流程 / UI polish（见各 `cursor/*` 分支）

---

*交接文档维护：每次解决 Mac 启动 / Staging 部署 / 重大 PR 合并后，更新第 3、7、12 节。*
