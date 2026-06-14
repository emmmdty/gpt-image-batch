# GPT Image Batch

GPT Image Batch 是一个本地运行的 GPT Image 2 批量生图工具。它调用 OpenAI-compatible Images API，支持单条 prompt、批量 prompt、CSV/JSONL 导入、本地队列、并发控制、自动重试、失败重跑、图片保存和生成记录管理。

## 技术栈

- pnpm workspace
- TypeScript
- React + Vite
- Tailwind CSS + shadcn/ui 风格组件
- Fastify
- SQLite + Drizzle ORM
- zod
- 本地内存队列 + SQLite 状态持久化
- csv-parse
- pino
- dotenv
- eslint + prettier

## WSL 使用说明

项目面向 Ubuntu on WSL2。建议在 WSL 终端中进入项目目录运行命令，不要在 PowerShell/CMD 中混用路径。

```bash
cd /home/eric/workspace/gpt-image-batch
```

## 安装 pnpm

如果还没有 pnpm：

```bash
corepack enable
corepack prepare pnpm@10.33.2 --activate
pnpm --version
```

## 安装依赖

```bash
pnpm install
```

项目使用 `better-sqlite3`，首次安装会编译/下载 native 依赖。

## 一键局域网启动

第一版提供跨平台启动入口，适合把本机 Web 应用给同一局域网内的设备访问。

### Windows 双击启动

在 Windows 文件资源管理器中双击：

```txt
start-lan.cmd
```

这个窗口会保持打开，启动成功后会显示本机地址和局域网地址。不要关闭窗口，关闭后 API 和 Web 服务也会停止。

如果系统没有 Node.js 18+，脚本会优先尝试用 `winget` 安装 Node.js LTS。没有 `winget` 时，请先手动安装 Node.js LTS：

```txt
https://nodejs.org/zh-cn/download
```

如遇到 PowerShell 执行策略限制，可以在当前窗口执行：

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\start-lan.ps1
```

也可以右键 `start-lan.cmd` 选择“以管理员身份运行”，但通常不需要管理员权限，只有安装 Node.js 或系统弹出 UAC 时才需要确认。

### macOS Intel / Apple Silicon 双击启动

在 Finder 中双击：

```txt
start-lan.command
```

如果系统没有 Node.js 18+，脚本会优先使用 Homebrew 安装。Apple Silicon 默认使用 `/opt/homebrew`，Intel Mac 默认使用 `/usr/local`，脚本会自动识别。

### 中国大陆网络

一键启动默认使用 npmmirror 安装依赖，不需要用户在命令行选择：

```bash
./start-lan.sh
```

Windows：

```txt
双击 start-lan.cmd
```

### 一键启动会做什么

启动器会用中文逐步显示状态，避免长时间无输出：

- 检查 Node.js 18+
- 检查 corepack 和 pnpm
- 检查 `.env` 是否存在，不打印 API key
- 检查 `data/`、`outputs/`、`uploads/` 写入权限
- 检查 API 和 Web 端口是否被占用
- 执行 `pnpm install --registry https://registry.npmmirror.com`
- 执行 `pnpm db:migrate`
- 同时启动 API 和 Web
- 显示本机地址和局域网地址

启动成功后保持窗口打开。按 `Ctrl+C` 可以停止 API 和 Web。

### 局域网访问

启动器会输出类似：

```txt
本机 Web：http://localhost:5173
局域网 Web：http://192.168.31.20:5173
```

同一 Wi-Fi 或网线网络内的设备可以打开局域网 Web 地址。若无法访问，检查系统防火墙是否允许 Node.js 或端口 `5173`、`8787` 入站。

### WSL 兜底

WSL 用户仍建议使用开发命令：

```bash
pnpm dev
```

也可以在 WSL 内运行：

```bash
./start-lan.sh
```

如果要让手机或其他电脑访问 WSL 中的服务，优先使用启动器输出的局域网地址；如 Windows 防火墙或 WSL 网络转发阻止访问，请改用 Windows 原生 `start-lan.cmd` 双击启动。

## 创建 `.env`

```bash
cp .env.example .env
```

编辑 `.env`，至少配置：

```env
IMAGE_API_BASE_URL=https://api.longxiadev.store/v1
IMAGE_API_KEY=你的真实 API Key
IMAGE_MODEL=gpt-image-2
```

不要提交真实 API key。也可以先不写 key，启动后在 Settings 页面保存。

## 初始化数据库

```bash
pnpm db:migrate
```

默认数据库路径：

```txt
data/app.db
```

## 启动后端

```bash
pnpm dev:api
```

默认端口：

```txt
http://localhost:8787
```

健康检查：

```bash
curl http://localhost:8787/health
```

## 启动前端

另开一个 WSL 终端：

```bash
pnpm dev:web
```

默认端口：

```txt
http://localhost:5173
```

也可以同时启动：

```bash
pnpm dev
```

## 前端 API 地址

默认：

```env
VITE_API_BASE_URL=http://localhost:8787
```

如需修改，写入 `.env` 后重启 Web dev server。

## CSV 模板

```csv
id,prompt,size,n,quality,output_format
cat_001,"一只橘猫坐在未来城市窗边，电影感光线",1024x1024,1,medium,png
cat_002,"一只狸花猫穿着侦探风衣，雨夜霓虹街道，电影海报风格",1024x1024,1,medium,png
```

## JSONL 模板

```jsonl
{"id":"cat_001","prompt":"一只橘猫坐在未来城市窗边，电影感光线","size":"1024x1024","n":1,"quality":"medium","output_format":"png"}
{"id":"cat_002","prompt":"一只狸花猫穿着侦探风衣，雨夜霓虹街道，电影海报风格","size":"1024x1024","n":1,"quality":"medium","output_format":"png"}
```

## 常见错误

### 401 API key 错误

检查 `.env` 或 Settings 页面中的 API key。日志和前端不会显示完整 key。

### 429 频率限制

降低 Settings 中的 Max Concurrency，或等待 provider 限流恢复。系统会对 429 做指数退避重试。

### 400 参数不兼容

某些兼容 API 不支持 `quality` 或 `output_format`。客户端会先完整请求，再自动移除 `output_format`，仍失败时再移除 `quality`。

### WSL 中 localhost 访问问题

优先在 WSL 内启动 API 和 Web，然后在 Windows 浏览器打开 `http://localhost:5173`。如果访问不到，确认 dev server 输出的 host/port，并检查 Windows 防火墙或 WSL 网络转发。

### Windows PowerShell 中文乱码

启动脚本会把输出编码设置为 UTF-8。如果仍乱码，建议使用 Windows Terminal，并执行：

```powershell
chcp 65001
```

### macOS 提示无法打开脚本

如果双击 `start-lan.command` 被系统阻止，请在终端运行：

```bash
chmod +x start-lan.command start-lan.sh
./start-lan.sh
```

### 局域网设备打不开页面

确认三点：

- 启动器输出了 `局域网 Web` 地址，而不是只输出 localhost。
- 手机/电脑和运行应用的机器在同一局域网。
- 防火墙允许 Node.js 或端口 `5173`、`8787` 入站。

### outputs 目录权限问题

确认当前 WSL 用户对项目目录有写权限：

```bash
mkdir -p outputs uploads data
touch outputs/.write-test && rm outputs/.write-test
```

## 后续升级路线

- Tauri 桌面版
- Electron 桌面版
- 批量 prompt 模板变量
- 图片评分和筛选
- 多 provider 配置
- 成本统计
- 项目空间管理

## 常用脚本

```bash
pnpm install
pnpm db:migrate
pnpm dev
pnpm build
pnpm lint
pnpm test
```
