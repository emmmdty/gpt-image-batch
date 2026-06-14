#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

info() {
  printf '\033[36m[GPT Image Batch]\033[0m %s\n' "$1"
}

warn() {
  printf '\033[33m[GPT Image Batch]\033[0m %s\n' "$1"
}

fail() {
  printf '\033[31m[GPT Image Batch]\033[0m %s\n' "$1" >&2
}

pause_on_error() {
  if [[ -t 0 ]]; then
    printf '\n按 Enter 关闭窗口'
    read -r _ || true
  fi
}

node_usable() {
  if ! command -v node >/dev/null 2>&1; then
    return 1
  fi
  local major
  major="$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || echo 0)"
  [[ "$major" -ge 18 ]]
}

install_node_macos() {
  warn "未检测到 Node.js 18+，将尝试在 macOS 上自动安装。"
  if command -v brew >/dev/null 2>&1; then
    info "正在执行：brew install node"
    warn "Homebrew 安装可能需要几分钟，请不要关闭窗口。"
    brew install node
    return
  fi

  warn "未检测到 Homebrew。即将安装 Homebrew，然后安装 Node.js。"
  warn "Homebrew 安装脚本需要访问 GitHub；中国大陆网络可能较慢或失败。"
  if [[ -t 0 ]]; then
    printf '继续安装 Homebrew 吗？[Y/n] '
    read -r answer || true
    if [[ -n "${answer:-}" && ! "$answer" =~ ^[Yy] ]]; then
      fail "已取消自动安装。请手动安装 Node.js LTS：https://nodejs.org/zh-cn/download"
      exit 1
    fi
  fi
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

  if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -x /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
  brew install node
}

install_node_linux() {
  fail "未检测到 Node.js 18+。Linux/WSL 请先安装 Node.js LTS："
  fail "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
  fail "  sudo apt-get install -y nodejs"
  exit 1
}

main() {
  info "准备启动局域网 Web 应用。"
  if ! node_usable; then
    case "$(uname -s)" in
      Darwin)
        install_node_macos
        ;;
      Linux)
        install_node_linux
        ;;
      *)
        fail "当前系统未自动支持。请先安装 Node.js 18+ 后重试。"
        exit 1
        ;;
    esac
  else
    info "Node.js 版本可用：$(node -v)"
  fi

  info "进入共享启动器。后续会显示自检、安装依赖、数据库初始化和访问地址。"
  node "$ROOT_DIR/scripts/start-lan.mjs" "$@"
}

if ! main "$@"; then
  fail "启动失败。请查看上方中文提示。"
  pause_on_error
  exit 1
fi
