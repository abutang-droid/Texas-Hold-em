# Proxmox LXC · Staging 部署指南

| 项目 | 配置 |
|------|------|
| 适用场景 | **开发 Staging**（非生产） |
| Proxmox 主机 | 12 代 i7 · 32 GB RAM |
| 容器类型 | **LXC** |
| 公网暴露 | **Cloudflare Tunnel**（无需家庭公网 IP / 端口转发） |
| 代码分支 | `cursor/phase4-open-beta-2fc9` |

---

## 一、资源规划

### 1.1 Proxmox 主机（32 GB）建议切分

| 用途 | vCPU | 内存 | 磁盘 |
|------|------|------|------|
| **LXC `th-staging`** | 4 | **8 GB** | 80 GB |
| Proxmox + 预留 | — | ~24 GB | — |

8 GB 足够跑 Postgres + Redis + API + Room + Admin + cloudflared；后续压测可临时调到 12 GB。

### 1.2 Staging 服务拓扑

```text
Internet
   │
   ▼
Cloudflare Edge (HTTPS)
   │
   ▼ cloudflared（LXC 内 systemd）
   ├── api-staging.yourdomain.com  → 127.0.0.1:3000
   ├── room-staging.yourdomain.com → 127.0.0.1:3001
   └── admin-staging.yourdomain.com → 127.0.0.1:5173

LXC th-staging
   ├── Docker: PostgreSQL 16 + Redis 7
   ├── PM2: @texas-holdem/api (3000)
   ├── PM2: @texas-holdem/room (3001)
   └── PM2: admin Vite dev (5173，代理 /api)
```

---

## 二、创建 LXC 容器（Proxmox Web UI）

1. **下载模板**：local → CT Templates → `ubuntu-24.04-standard`
2. **Create CT**：
   - Hostname: `th-staging`
   - Password / SSH key：建议仅 SSH key
   - **Unprivileged container**：可勾选（需开启 nesting，见下）
   - Cores: **4** · Memory: **8192** · Swap: **2048**
   - Root disk: **80 GB**（local-lvm）
   - Network: `vmbr0` · DHCP 或静态 IP（如 `192.168.1.50`）
3. **Options → Features**：勾选 **nesting=1**（容器内跑 Docker 必须）
4. 启动 CT，SSH 登录：`ssh root@192.168.1.50`

> 若 Docker 报权限错误，在 Proxmox 节点执行：  
> `pct set <CTID> -features nesting=1,keyctl=1`

---

## 三、LXC 一次性初始化

在 **LXC 内**执行（也可用仓库脚本）：

```bash
# 从 Mac 把脚本拷进 LXC，或在 LXC 里 git clone 后执行：
bash scripts/staging-bootstrap.sh
```

脚本会安装：Docker、Node 20、pnpm、PM2、cloudflared。

---

## 四、部署应用

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

## 五、Cloudflare Tunnel 配置

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

## 六、`.env` 关键项（Staging）

参考 `infra/staging/.env.staging.example`，至少修改：

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
| **Proxmox LXC** | 7×24 Staging、团队内测、IAP 沙盒联调后端 |
| **Cloudflare** | HTTPS、Tunnel、可选 WAF / Access |

---

*文档版本 v1.0 · 2026-08-28*
