# Proxmox LXC · Staging 部署指南

| 项目 | 配置 |
|------|------|
| 适用场景 | **开发 Staging**（非生产） |
| Proxmox 主机 | 12 代 i7 · 32 GB RAM |
| 部署方式 | **仅新建独立 LXC**（不使用 `192.168.31.52` 共享部署） |
| 已有服务器 `192.168.31.52` | 跑其他应用 · **本方案不部署其上** |
| **LXC `th-staging` IP** | **`192.168.31.53`** · 网关 `192.168.31.1` |
| 公网 | 前期仅局域网；后期可选 Cloudflare Tunnel |

---

## 一、资源规划

### 1.1 Proxmox 主机（32 GB）建议切分

| 用途 | vCPU | 内存 | 磁盘 |
|------|------|------|------|
| **LXC `th-staging`** | 4 | **8 GB** | 80 GB |
| Proxmox + 预留 | — | ~24 GB | — |

8 GB 足够跑 Postgres + Redis + API + Room + Admin；后期加 cloudflared 可临时调到 12 GB。

### 1.2 两种访问模式

| 模式 | 何时用 | 需要域名？ |
|------|--------|------------|
| **A. 局域网（推荐前期）** | Mac / 手机与 LXC 同一 WiFi，内网联调 | **不需要** |
| **B. Cloudflare Tunnel** | 外出测试、TestFlight、给他人远程访问 | 需要（或用 `trycloudflare.com` 临时域名） |

### 1.3 推荐拓扑 · 新建 LXC（`th-staging`）

```text
家庭 WiFi（网关 192.168.31.1）
   │
   ├── Mac mini ─────────── http://192.168.31.53:3000  (API)
   │                        http://192.168.31.53:3001  (Room)
   │
   ├── Ubuntu 192.168.31.52  ← 原有应用，不改动
   │
   └── LXC th-staging 192.168.31.53  ← Texas Hold'em 专用
         ├── Docker: PostgreSQL + Redis
         └── PM2: api · room · admin
```

> **`.52` 已有其他应用** → 新建 LXC，用 **`.53`**（或 DHCP 后固定 IP），用默认端口 **3000/3001/5173** 即可。

### 1.4 模式 B · Cloudflare Tunnel 拓扑

```text
Internet → Cloudflare → cloudflared → 127.0.0.1:3000/3001/5173
```

---

## 二、新建 LXC 并部署（推荐路径）

### 2.1 在 Proxmox 创建 LXC

Web UI → **Create CT**：

| 项 | 值 |
|----|-----|
| Hostname | `th-staging` |
| Template | `ubuntu-24.04-standard` |
| CPU / RAM | **4 核 · 8192 MB**（Swap 2048） |
| Disk | **80 GB** |
| IPv4 | **Static `192.168.31.53/24`** |
| Gateway | **`192.168.31.1`** |
| DNS | `192.168.31.1` 或 `223.5.5.5` |
| Features | ✅ **nesting=1**（Docker 必须） |

创建后若 Docker 报错，在 Proxmox 节点执行：

```bash
pct set <CTID> -features nesting=1,keyctl=1
pct start <CTID>
```

SSH 登录：

```bash
ssh root@192.168.31.53
```

### 2.2 LXC 内一键初始化

```bash
git clone https://github.com/abutang-droid/Texas-Hold-em.git
cd Texas-Hold-em
git checkout cursor/phase4-open-beta-2fc9
# 合并 doc 分支以获取 scripts/staging-* 与 infra/staging/

sudo bash scripts/staging-bootstrap.sh
```

### 2.3 配置并启动（默认端口，无需 131xx）

```bash
cp infra/staging/.env.lan.example .env
nano .env   # 改 JWT_SECRET、ADMIN_API_KEY；IP 默认 192.168.31.53

docker compose up -d
pnpm install && pnpm build && pnpm migrate
bash scripts/staging-up.sh
```

### 2.4 Mac mini 验证

```bash
curl http://192.168.31.53:3000/health
curl http://192.168.31.53:3001/health
open http://192.168.31.53:5173
```

Expo `.env`：

```bash
EXPO_PUBLIC_API_URL=http://192.168.31.53:3000
EXPO_PUBLIC_ROOM_URL=http://192.168.31.53:3001
```

---

## 三、备选 · 复用 192.168.31.52（与其他应用共存）

> 若**不建 LXC**、坚持在现有 Ubuntu 上跑，才用本章。已决定新建 LXC 可**跳过**。

### 3.1 共享端口 `131xx`

```bash
ssh <用户>@192.168.31.52
cp infra/staging/.env.lan.shared.example .env
docker compose -f docker-compose.yml -f infra/staging/docker-compose.shared.yml up -d
bash scripts/staging-up.sh
```

| 服务 | 端口 |
|------|------|
| API | 13100 |
| Room | 13101 |
| Admin | 13180 |

---

## 四、局域网限制 & Quick Tunnel

| 能力 | 局域网 | 说明 |
|------|--------|------|
| Mac / 同 WiFi 手机调试 | ✅ | 前期够用 |
| 外出 / 4G 访问 | ❌ | 需 Tunnel 或 VPN |
| TestFlight 外网测试 | ❌ | 需 HTTPS 公网地址 |
| Apple IAP 沙盒真机 | ⚠️ | 部分场景要 HTTPS；后期再上 Tunnel |
| 商店提审 | ❌ | 必须公网 HTTPS + 正式域名 |

> **结论：** 前期接场、打牌、后台、mock 充值用局域网即可；**临近提审再加域名 + Tunnel**。

### 4.1 Quick Tunnel（临时外网，无域名）

```bash
cloudflared tunnel --url http://127.0.0.1:3000
# 输出 https://xxxx.trycloudflare.com
```

---

## 五、Cloudflare Tunnel 配置（后期再加）

### 5.1 创建 Tunnel（Zero Trust 控制台）

1. 登录 [Cloudflare Zero Trust](https://one.dash.cloudflare.com/)
2. **Networks → Tunnels → Create a tunnel**
3. 名称：`th-staging` · 选择 **Cloudflared**
4. 复制 **Tunnel token**（形如 `eyJhIjoi...`）
5. 写入 LXC 的 `.env`：`CLOUDFLARE_TUNNEL_TOKEN=...`

### 5.2 添加 Public Hostname

在 Tunnel 的 **Public Hostname** 页添加（域名需已在 Cloudflare DNS）：

| Subdomain | Service | URL |
|-----------|---------|-----|
| `api-staging` | HTTP | `localhost:3000` |
| `room-staging` | HTTP | `localhost:3001` |
| `admin-staging` | HTTP | `localhost:5173` |

保存后，外网地址示例：

- `https://api-staging.yourdomain.com/health`
- `https://room-staging.yourdomain.com/health`
- `https://admin-staging.yourdomain.com`

### 5.3 安装 cloudflared 服务（LXC）

```bash
# .env 中已有 CLOUDFLARE_TUNNEL_TOKEN 后：
bash scripts/staging-tunnel-install.sh
sudo systemctl status cloudflared
```

---

## 六、`.env` 关键项

参考 `infra/staging/.env.lan.example`（无域名）或 `.env.staging.example`（Tunnel）。

```bash
# 强随机字符串
JWT_SECRET=<openssl rand -hex 32>
ADMIN_API_KEY=<openssl rand -hex 16>

# 数据库（与 docker-compose 一致）
POSTGRES_PASSWORD=<强密码>

# 对外 URL（与 Cloudflare 子域一致）
ROOM_SERVER_URL=https://room-staging.yourdomain.com
EXPO_PUBLIC_API_URL=https://api-staging.yourdomain.com
EXPO_PUBLIC_ROOM_URL=https://room-staging.yourdomain.com

# Staging 保持沙盒 / 开发 OAuth
PAYMENT_MODE=mock
IAP_SANDBOX_MODE=true
OAUTH_DEV_MODE=true

CLOUDFLARE_TUNNEL_TOKEN=eyJ...
```

**Mac / 手机 Expo 联调**：在开发机 `.env` 或 `app.config` 里把 `EXPO_PUBLIC_*` 指向上表 HTTPS 地址。

---

## 七、日常运维命令

```bash
cd ~/Texas-Hold-em

# 查看状态
pm2 status
docker compose ps
curl -s https://api-staging.yourdomain.com/health

# 重启应用
bash scripts/staging-up.sh

# 停止
bash scripts/staging-down.sh

# 拉代码更新
git pull
pnpm install && pnpm build && pnpm migrate
pm2 restart all

# 冒烟
pnpm smoke   # 需 API 在 localhost:3000 可达
```

---

## 八、备份（建议每周）

```bash
# Postgres 逻辑备份
docker exec th-postgres pg_dump -U th texas_holdem | gzip > ~/backup/th-$(date +%F).sql.gz

# Proxmox 层面：对 CT 做 snapshot（Web UI → Backup / Snapshot）
```

---

## 九、安全注意

| 项 | 建议 |
|----|------|
| 防火墙 | LXC **不要**对局域网外暴露 3000/3001/5432；仅 cloudflared 出网 |
| SSH | 仅密钥登录；可配合 Cloudflare Access 保护 admin 子域 |
| 密钥 | `.env` 权限 `chmod 600`；勿提交 Git |
| Staging 定位 | 内测 / 联调；**不要**当唯一生产环境 |

---

## 十、故障排查

| 现象 | 检查 |
|------|------|
| Tunnel 502 | `pm2 logs` · API/Room 是否在监听 |
| 手机连不上 Room | `EXPO_PUBLIC_ROOM_URL` 是否为 **https** 且与 Tunnel 一致 |
| 数据库连接失败 | `docker compose ps` · `.env` 密码与 compose 是否一致 |
| Admin 登录后 API 失败 | Admin 用 Vite 代理 `/api`；确认 5173 进程在跑 |

---

## 十一、与 Mac mini 分工

| 机器 | 角色 |
|------|------|
| **Mac mini** | 写代码、Expo 真机调试、指向 Staging URL |
| **Proxmox LXC `.53`** | Texas Hold'em 专用 Staging |
| **`192.168.31.52`** | 原有应用，互不干扰 |
| **Cloudflare** | HTTPS、Tunnel、可选 WAF / Access |

---

*文档版本 v1.2 · 2026-08-28 · 新建 LXC 192.168.31.53 推荐路径*
