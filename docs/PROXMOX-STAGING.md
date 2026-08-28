# Proxmox LXC · Staging 部署指南

| 项目 | 配置 |
|------|------|
| 适用场景 | **开发 Staging**（非生产） |
| Proxmox 主机 | 12 代 i7 · 32 GB RAM |
| 容器类型 | **LXC**（或复用已有 Ubuntu VM/物理机） |
| 当前服务器 | **已有 Ubuntu · `192.168.31.52`**（网关 `192.168.31.1`） |
| 公网暴露 | **前期可选**：仅局域网 IP；后期再加 Cloudflare Tunnel + 域名 |
| 代码分支 | `cursor/phase4-open-beta-2fc9` |

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

### 1.3 模式 A · 局域网拓扑（无公网域名）

```text
家庭 WiFi（网关 192.168.31.1）
   │
   ├── Mac mini（开发）───── http://192.168.31.52:3000  (API)
   │                        http://192.168.31.52:3001  (Room)
   └── Ubuntu 服务器 (192.168.31.52)  ← 已有，直接部署
         ├── Docker: PostgreSQL + Redis
         ├── PM2: api :3000 · room :3001 · admin :5173
         └── 无需 cloudflared
```

> **若已有 Ubuntu（如 192.168.31.52）**：跳过 §三「新建 LXC」，直接在该机执行 §二部署即可。

### 1.4 模式 B · Cloudflare Tunnel 拓扑

```text
Internet → Cloudflare → cloudflared → 127.0.0.1:3000/3001/5173
```

---

## 二、前期快速开始（无域名 · 局域网）

### 2.1 创建 LXC

同下文 **§三**；建议为 LXC 设静态 IP **`192.168.31.52`**（网关 `192.168.31.1`，掩码 `255.255.255.0`）。

### 2.2 部署（跳过 Tunnel）

```bash
git clone https://github.com/abutang-droid/Texas-Hold-em.git
cd Texas-Hold-em
git checkout cursor/phase4-open-beta-2fc9
# 部署脚本在 doc 分支，见仓库 infra/staging/

# 仅安装 Docker / Node / pnpm / PM2（可不装 cloudflared）
bash scripts/staging-bootstrap.sh

cp infra/staging/.env.lan.example .env
nano .env   # 默认已填 192.168.31.52；若 IP 不同请修改，并改 JWT / ADMIN 密钥

docker compose up -d
pnpm install && pnpm build && pnpm migrate
bash scripts/staging-up.sh
```

### 2.3 Mac mini 验证

```bash
curl http://192.168.31.52:3000/health
curl http://192.168.31.52:3001/health
open http://192.168.31.52:5173          # 运营后台
```

Expo 开发机 `.env`：

```bash
EXPO_PUBLIC_API_URL=http://192.168.31.52:3000
EXPO_PUBLIC_ROOM_URL=http://192.168.31.52:3001
```

手机真机：**连同一 WiFi**，用 Expo Go 扫 Mac 上的二维码即可（请求会打到 LXC IP）。

### 2.4 局域网模式的限制

| 能力 | 局域网 | 说明 |
|------|--------|------|
| Mac / 同 WiFi 手机调试 | ✅ | 前期够用 |
| 外出 / 4G 访问 | ❌ | 需 Tunnel 或 VPN |
| TestFlight 外网测试 | ❌ | 需 HTTPS 公网地址 |
| Apple IAP 沙盒真机 | ⚠️ | 部分场景要 HTTPS；后期再上 Tunnel |
| 商店提审 | ❌ | 必须公网 HTTPS + 正式域名 |

> **结论：** 前期接场、打牌、后台、mock 充值用局域网即可；**临近提审再加域名 + Tunnel**。

### 2.5 不想买域名时的过渡方案

Cloudflare **Quick Tunnel**（免费随机域名，无需自有域名）：

```bash
# 临时暴露 API（关掉终端即失效）
cloudflared tunnel --url http://127.0.0.1:3000
# 输出类似 https://xxxx.trycloudflare.com
```

适合偶尔给外人看一眼，不适合长期 Staging。

---

## 三、（可选）新建 LXC 容器

> **已有 Ubuntu `192.168.31.52` 可跳过本章。**

1. **下载模板**：local → CT Templates → `ubuntu-24.04-standard`
2. **Create CT**：
   - Hostname: `th-staging`
   - Password / SSH key：建议仅 SSH key
   - **Unprivileged container**：可勾选（需开启 nesting，见下）
   - Cores: **4** · Memory: **8192** · Swap: **2048**
   - Root disk: **80 GB**（local-lvm）
   - Network: `vmbr0` · 建议静态 IP **`192.168.31.52`** / 网关 **`192.168.31.1`** / `255.255.255.0`
3. **Options → Features**：勾选 **nesting=1**（容器内跑 Docker 必须）
4. 启动 CT，SSH 登录：`ssh root@192.168.31.52`

> 若 Docker 报权限错误，在 Proxmox 节点执行：  
> `pct set <CTID> -features nesting=1,keyctl=1`

---

## 四、LXC 一次性初始化

在 **LXC 内**执行（也可用仓库脚本）：

```bash
# 从 Mac 把脚本拷进 LXC，或在 LXC 里 git clone 后执行：
bash scripts/staging-bootstrap.sh
```

脚本会安装：Docker、Node 20、pnpm、PM2、cloudflared。

---

## 五、部署应用（含 Tunnel 时用 .env.staging.example）

```bash
# 1. 克隆（在 LXC 内）
git clone https://github.com/abutang-droid/Texas-Hold-em.git
cd Texas-Hold-em
git checkout cursor/phase4-open-beta-2fc9

# 2. 环境变量
cp infra/staging/.env.staging.example .env
nano .env   # 改密码、JWT、域名、Tunnel token

# 3. 数据库
docker compose -f docker-compose.yml up -d
pnpm install
pnpm build
pnpm migrate

# 4. 启动应用 + Tunnel
bash scripts/staging-up.sh
```

---

## 六、Cloudflare Tunnel 配置（后期再加）

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

## 七、`.env` 关键项

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

## 八、日常运维命令

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

## 九、备份（建议每周）

```bash
# Postgres 逻辑备份
docker exec th-postgres pg_dump -U th texas_holdem | gzip > ~/backup/th-$(date +%F).sql.gz

# Proxmox 层面：对 CT 做 snapshot（Web UI → Backup / Snapshot）
```

---

## 十、安全注意

| 项 | 建议 |
|----|------|
| 防火墙 | LXC **不要**对局域网外暴露 3000/3001/5432；仅 cloudflared 出网 |
| SSH | 仅密钥登录；可配合 Cloudflare Access 保护 admin 子域 |
| 密钥 | `.env` 权限 `chmod 600`；勿提交 Git |
| Staging 定位 | 内测 / 联调；**不要**当唯一生产环境 |

---

## 十一、故障排查

| 现象 | 检查 |
|------|------|
| Tunnel 502 | `pm2 logs` · API/Room 是否在监听 |
| 手机连不上 Room | `EXPO_PUBLIC_ROOM_URL` 是否为 **https** 且与 Tunnel 一致 |
| 数据库连接失败 | `docker compose ps` · `.env` 密码与 compose 是否一致 |
| Admin 登录后 API 失败 | Admin 用 Vite 代理 `/api`；确认 5173 进程在跑 |

---

## 十二、与 Mac mini 分工

| 机器 | 角色 |
|------|------|
| **Mac mini** | 写代码、Expo 真机调试、指向 Staging URL |
| **Proxmox LXC** | 7×24 内网 Staging；后期再加 Tunnel |
| **Cloudflare** | HTTPS、Tunnel、可选 WAF / Access |

---

*文档版本 v1.1 · 2026-08-28 · 新增局域网无域名方案*
