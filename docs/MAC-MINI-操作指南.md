# Mac mini 操作指南（网页版）

> **核心原则：日常只在 Mac 上操作。** 终端开 1 条命令 → 浏览器玩游戏。  
> 服务器 `192.168.31.53` 装好后基本不用碰。

---

## 先分清两台机器

| | Mac mini | 服务器 192.168.31.53 |
|---|----------|----------------------|
| 系统 | macOS | Ubuntu Linux |
| 终端提示符 | 你的名字，如 `yourname@Mac-mini` | 如 `uoto@tex` |
| 能装 brew 吗 | ✅ 能 | ❌ **不能**（没有 brew） |
| 你日常做什么 | 跑游戏网页 | 不用管（已装好 API） |

**常见错误：** 在服务器 `uoto@tex` 里执行 `brew install` → 会报错。那是 Linux，不是 Mac。

在 Mac 终端输入下面命令确认你在 Mac 上：

```bash
uname -s
```

应显示 `Darwin`（= macOS）。若显示 `Linux`，说明你连的是服务器，输入 `exit` 退出 SSH。

---

## 你要收藏的 2 个网址

| 用途 | 地址 | 何时打开 |
|------|------|----------|
| **玩游戏** | http://localhost:8081 | 终端跑完启动命令后 |
| **运营后台** | http://192.168.31.53:5173 | 随时，纯浏览器 |

把这两个加到 Safari / Chrome 书签栏。

---

## 一次性准备（Mac 只做一次）

### 1. 打开终端

**应用程序 → 实用工具 → 终端**

### 2. 安装 Node（复制整段，回车）

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

装完后**按屏幕提示**执行它给出的两行 PATH 命令（类似 `echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile`）。

然后：

```bash
brew install node@20 git
npm install -g pnpm@10
node -v && pnpm -v
```

应看到 `v20.x.x` 和 `10.x`。

### 3. 下载项目

```bash
cd ~
git clone https://github.com/abutang-droid/Texas-Hold-em.git
cd Texas-Hold-em
git fetch origin
git checkout cursor/phase4-open-beta-2fc9
git pull origin cursor/phase4-open-beta-2fc9
```

### 4. 配置连服务器

```bash
cp apps/mobile/.env.staging.example apps/mobile/.env
```

### 5. 检查服务器在线

```bash
bash scripts/mac-staging-check.sh
```

必须 **3 个 ✓**。若有 ✗ → 跳到文末「服务器装一次」。

---

## 每天怎么玩（3 步）

### 第 1 步 · 打开终端，启动游戏

```bash
cd ~/Texas-Hold-em
bash scripts/mac-staging-mobile.sh
```

- 首次约 2–5 分钟（下载依赖）
- 之后约 30 秒
- 看到菜单和二维码 = 成功

### 第 2 步 · 打开网页

**任选一种：**

- 终端里按键盘 **`w`**
- 或浏览器打开 **http://localhost:8081**

建议 Chrome / Safari 全屏，窗口拉宽（游戏横屏）。

### 第 3 步 · 玩

1. 引导页 → 继续  
2. 大厅 → **Quick Start**  
3. 私人场 → 侧边栏 **Private**  
4. 商城 → **Shop**

### 结束 · 关掉

终端里按 **`Ctrl + C`**。

---

## 运营后台（不用终端）

1. 浏览器打开：**http://192.168.31.53:5173**
2. 登录密钥 = 服务器 `.env` 里的 `ADMIN_API_KEY`  
   （需要时让协助方在服务器执行：`grep ADMIN_API_KEY ~/Texas-Hold-em/.env`）
3. 可查看用户、封禁、经济面板、举报

---

## 快捷方式（可选，做完更省事）

在 Mac 终端执行一次，以后输入 `thgame` 就能启动：

```bash
echo 'alias thgame="cd ~/Texas-Hold-em && bash scripts/mac-staging-mobile.sh"' >> ~/.zshrc
source ~/.zshrc
```

以后每天只需：

```bash
thgame
```

然后按 `w` 开网页。

---

## 常见问题

| 现象 | 原因 | 处理 |
|------|------|------|
| `brew: command not found` | 在 Mac 上没装 Homebrew，或 PATH 没配 | 重做「一次性准备」第 2 步 |
| 在 `uoto@tex` 里跑 brew 报错 | 你在**服务器**上，不是 Mac | 输入 `exit` 回到 Mac |
| check 脚本 3 个 ✗ | 服务器服务没起来 | 见下方「服务器装一次」 |
| 网页白屏 | Expo 没跑好 | `Ctrl+C` 停掉，再跑 `bash scripts/mac-staging-mobile.sh` |
| 能开网页但登录失败 | API 挂了 | 服务器需 `pm2 status` 确认 th-api 在跑 |
| 换 WiFi 后连不上 | 不在同一局域网 | Mac 和 192.168.31.53 必须同一 WiFi |

---

## 更新代码（偶尔）

```bash
cd ~/Texas-Hold-em
git pull origin cursor/phase4-open-beta-2fc9
pnpm install && pnpm build
bash scripts/mac-staging-mobile.sh
```

---

## 服务器装一次（仅当 check 失败时）

> **这不是 Mac 操作。** 只有 `mac-staging-check.sh` 打 ✗ 时才需要做。

在 **Mac 终端** SSH 进服务器：

```bash
ssh uoto@192.168.31.53
```

在服务器里执行（**没有 brew，用 bash 脚本**）：

**推荐（任意目录均可，自动进入 `~/Texas-Hold-em`）：**

```bash
curl -fsSL "https://ghfast.top/https://raw.githubusercontent.com/abutang-droid/Texas-Hold-em/main/scripts/staging-server-deploy.sh" | bash -s main
```

**部署 6-max 规则校正（PR #32，Room 0.4.8）— 在 Mac 上：**

```bash
cd ~/Texas-Hold-em
bash scripts/staging-remote-deploy.sh cursor/poker-rules-6max-9b0a
```

**或在测试机 `uoto@tex` 上：**

```bash
curl -fsSL "https://ghfast.top/https://raw.githubusercontent.com/abutang-droid/Texas-Hold-em/cursor/poker-rules-6max-9b0a/scripts/staging-server-deploy.sh" \
  | bash -s cursor/poker-rules-6max-9b0a
curl -s http://127.0.0.1:3001/health
```

成功应看到 `"version":"0.4.8"`。

跟注按钮转圈 / 点一下立刻又要跟：先更新 Mac 客户端再部署 Room：

```bash
curl -fsSL "https://ghfast.top/https://raw.githubusercontent.com/abutang-droid/Texas-Hold-em/cursor/poker-rules-6max-9b0a/scripts/mac-fix-call-loop.sh" -o /tmp/mac-fix-call.sh
bash /tmp/mac-fix-call.sh
```

或已在项目目录时：

```bash
cd ~/Texas-Hold-em
bash scripts/staging-update-no-git.sh main
```

**若 `git pull` 报 `not a git repository`（zip 安装）— 用下面整段更新：**

```bash
cd ~
cp Texas-Hold-em/.env /tmp/th-env-backup 2>/dev/null || true
curl -fsSL -o th-main.zip "https://ghfast.top/https://github.com/abutang-droid/Texas-Hold-em/archive/refs/heads/main.zip"
unzip -qo th-main.zip
rsync -a --delete Texas-Hold-em-main/ Texas-Hold-em/ --exclude node_modules --exclude .env
cp /tmp/th-env-backup Texas-Hold-em/.env 2>/dev/null || true
cd Texas-Hold-em
pnpm install && pnpm build && pnpm migrate
pm2 startOrRestart infra/staging/ecosystem.config.cjs --update-env
curl -s http://localhost:3000/health
```

health 应含 `"version":"0.5.0"`。之后可用：`bash scripts/staging-update-no-git.sh`

**若有 git 仓库（首次安装）：**

```bash
cd ~/Texas-Hold-em 2>/dev/null || { cd ~ && git clone https://github.com/abutang-droid/Texas-Hold-em.git && cd Texas-Hold-em; }
git fetch origin
git checkout main
git pull origin main
sudo bash scripts/staging-bootstrap.sh
sudo bash scripts/staging-install-all.sh
```

看到 `安装完成` / `API OK` 后：

```bash
exit
```

回到 **Mac**，再跑：

```bash
cd ~/Texas-Hold-em
bash scripts/mac-staging-check.sh
```

---

## 架构一览

```text
  Mac 浏览器  localhost:8081  ←── Expo 网页（Mac 本地跑）
           │
           ▼
  192.168.31.53:3000  API
  192.168.31.53:3001  Room

  Mac 浏览器  192.168.31.53:5173  ←── 运营后台（纯浏览器）
```

---

*v1.1 · Mac 网页版 · Staging 192.168.31.53*
