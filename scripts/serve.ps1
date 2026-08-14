# 序事 · 常驻服务（Tailscale 私有网络访问用）
# 用法:
#   pwsh scripts/serve.ps1             # 直接启动（前台窗口，关闭即停止）
#   pwsh scripts/serve.ps1 -Build      # 先重新构建再启动（代码更新后执行）
# 开机自启：scripts/install-startup.cmd 已把本脚本注册到"启动"文件夹
param(
  [switch]$Build
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

if ($Build -or -not (Test-Path "dist\server\index.js")) {
  Write-Host "→ 构建生产产物..." -ForegroundColor Cyan
  npx vinext build
  if ($LASTEXITCODE -ne 0) { Write-Host "✖ 构建失败" -ForegroundColor Red; exit 1 }
}

Write-Host "→ 启动服务（wrangler dev，端口 8420，监听所有网卡）..." -ForegroundColor Cyan
Write-Host "  本机: http://localhost:8420"
Write-Host "  按 Ctrl+C 停止。局域网/Tailscale 访问说明见 README.md"
npx wrangler dev --port 8420 --ip 0.0.0.0
