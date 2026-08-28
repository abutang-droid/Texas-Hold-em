# Mac mini · 连接 Staging 服务器开发

Mac **只跑 Expo 客户端**；API / Room / 数据库在 **`192.168.31.53`** 上。

---

## 一、架构

```text
Mac mini                          Staging LXC (192.168.31.53)
├── git clone                     ├── API   :3000
├── pnpm dev mobile (Expo)  ───►  ├── Room  :3001
└── 浏览器 / 真机                  └── Admin :5173
```

---

## 二、Mac 首次准备（约 10 分钟）

### 2.1 安装工具

```bash
# 若无 Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew install node@20 git
npm install -g pnpm@10

# 确认
bash scripts/mac-dev-check.sh
```

### 2.2 克隆代码

```bash
cd ~
git clone https://github.com/abutang-droid/Texas-Hold-em.git
cd Texas-Hold-em
git checkout cursor/phase4-open-beta-2fc9
git pull
```

---

## 三、确认 Staging 服务器可达

```bash
bash scripts/mac-staging-check.sh
```

应看到：

```text
✓ Ping 192.168.31.53
✓ API   http://192.168.31.53:3000/health
✓ Room  http://192.168.31.53:3001/health
```

若失败 → 先在 **192.168.31.53** 上跑 `sudo bash scripts/staging-install-all.sh`。

---

## 四、启动游戏客户端

```bash
bash scripts/mac-staging-mobile.sh
```

或手动：

```bash
cp apps/mobile/.env.staging.example apps/mobile/.env
pnpm install && pnpm build
cd apps/mobile && npx expo start --clear
```

| 方式 | 操作 |
|------|------|
| **Web** | 终端按 `w`，或打开 http://localhost:8081 |
| **iPhone** | 安装 Expo Go，**同一 WiFi**，扫码 |
| **Android** | Expo Go 扫码 |

---

## 五、环境变量

`apps/mobile/.env`：

```bash
EXPO_PUBLIC_API_URL=http://192.168.31.53:3000
EXPO_PUBLIC_ROOM_URL=http://192.168.31.53:3001
```

改 IP 后需重启 Expo（`--clear`）。

---

## 六、运营后台

浏览器直接开（无需 Mac 跑服务）：

```text
http://192.168.31.53:5173
```

登录密钥 = 服务器 `.env` 里的 `ADMIN_API_KEY`。

---

## 七、常见问题

| 现象 | 处理 |
|------|------|
| Ping 不通 | Mac 与服务器是否同一 WiFi；路由器是否隔离 AP |
| API ✗ | 服务器上 `pm2 status`、`docker compose ps` |
| Expo 白屏 / 连不上 | 确认 `apps/mobile/.env` 已创建；重启 `expo start --clear` |
| Web 报 shared 找不到 | 项目根执行 `pnpm build` |
| 真机 HTTP 被拦 | 优先用 **Expo Web** 或 **模拟器**；真机后期需 HTTPS / 开发构建 |

---

## 八、可选：Mac 本地全栈（不连 .53）

见 `docs/LOCAL_DEV.md`（需本机 PostgreSQL / Docker）。

---

*Staging IP: 192.168.31.53 · 网关: 192.168.31.1*
