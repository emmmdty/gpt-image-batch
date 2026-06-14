$ErrorActionPreference = "Stop"

function Write-Info($Message) {
  Write-Host "[GPT Image Batch] $Message" -ForegroundColor Cyan
}

function Write-Warn($Message) {
  Write-Host "[GPT Image Batch] $Message" -ForegroundColor Yellow
}

function Write-Fail($Message) {
  Write-Host "[GPT Image Batch] $Message" -ForegroundColor Red
}

function Pause-Before-Exit {
  if ($Host.Name -notmatch "ConsoleHost") {
    return
  }
  Write-Host ""
  Read-Host "按 Enter 关闭窗口"
}

function Test-NodeUsable {
  try {
    $version = & node -v 2>$null
    if (-not $version) {
      return $false
    }
    $major = [int]($version.TrimStart("v").Split(".")[0])
    return $major -ge 18
  } catch {
    return $false
  }
}

function Install-Node {
  Write-Warn "未检测到 Node.js 18+，将尝试使用 winget 自动安装 Node.js LTS。"
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) {
    throw "当前系统没有 winget。请先安装 Node.js LTS：https://nodejs.org/zh-cn/download，然后重新运行本脚本。"
  }

  Write-Info "正在执行：winget install OpenJS.NodeJS.LTS"
  Write-Warn "安装过程可能需要确认 UAC 或许可协议，请留意弹窗和终端提示。"
  & winget install --id OpenJS.NodeJS.LTS --source winget --accept-source-agreements --accept-package-agreements
  if ($LASTEXITCODE -ne 0) {
    throw "winget 安装 Node.js 失败。请手动安装 Node.js LTS 后重试。"
  }

  $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
  if (-not (Test-NodeUsable)) {
    throw "Node.js 已安装，但当前终端还没有识别到。请关闭此窗口，重新打开 PowerShell 后再运行。"
  }
}

try {
  Set-Location -LiteralPath $PSScriptRoot
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
  $OutputEncoding = [System.Text.UTF8Encoding]::new()

  Write-Info "准备启动局域网 Web 应用。"
  if (-not (Test-NodeUsable)) {
    Install-Node
  } else {
    Write-Info "Node.js 版本可用：$(& node -v)"
  }

  Write-Info "进入共享启动器。后续会显示自检、安装依赖、数据库初始化和访问地址。"
  & node ".\scripts\start-lan.mjs" @args
  if ($LASTEXITCODE -ne 0) {
    throw "局域网启动器退出，退出码 $LASTEXITCODE。"
  }
} catch {
  Write-Fail $_.Exception.Message
  Pause-Before-Exit
  exit 1
}
