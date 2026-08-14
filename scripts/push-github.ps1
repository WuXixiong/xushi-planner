# 一键把「序事」上传到 GitHub（仓库名: xushi-planner, 私有）
# 用法: pwsh scripts/push-github.ps1
# 认证二选一：
#   1) gh CLI（推荐）: winget install GitHub.cli 之后 gh auth login
#   2) 环境变量 GITHUB_TOKEN（需要 repo 权限的 Personal Access Token）
$ErrorActionPreference = "Stop"
$RepoName = "xushi-planner"
$Visibility = "private"

function Fail($msg) {
  Write-Host "✖ $msg" -ForegroundColor Red
  exit 1
}

# 发现 gh：先找 PATH，再找常见安装位置（PATH 未刷新时也能用）
$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $gh) {
  foreach ($candidate in @(
    "$env:ProgramFiles\GitHub CLI\gh.exe",
    "$env:LOCALAPPDATA\Programs\GitHub CLI\gh.exe"
  )) {
    if (Test-Path $candidate) { $gh = $candidate; break }
  }
}

if ($gh) {
  $ghCmd = if ($gh -is [string]) { $gh } else { $gh.Source }
  $status = & $ghCmd auth status 2>&1 | Out-String
  if ($status -match "Logged in to github.com") {
    Write-Host "→ 使用 gh CLI 创建仓库并推送..." -ForegroundColor Cyan
    & $ghCmd repo create $RepoName "--$Visibility" --source . --remote origin --push
    if ($LASTEXITCODE -ne 0) {
      Fail "创建失败。若提示仓库已存在，请先删除同名仓库或修改 scripts/push-github.ps1 中的 RepoName"
    }
    $user = (& $ghCmd api user -q .login).Trim()
    Write-Host ""
    Write-Host "✔ 完成！仓库地址: https://github.com/$user/$RepoName" -ForegroundColor Green
    exit 0
  }
  Write-Host "! gh 已安装但未登录，请先运行: gh auth login" -ForegroundColor Yellow
} elseif ($env:GITHUB_TOKEN) {
  Write-Host "→ 使用 GITHUB_TOKEN 创建仓库并推送..." -ForegroundColor Cyan
  $user = (Invoke-RestMethod -Uri "https://api.github.com/user" -Headers @{ Authorization = "token $env:GITHUB_TOKEN" }).login
  $body = @{ name = $RepoName; private = ($Visibility -eq "private") } | ConvertTo-Json
  try {
    Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Method Post -Headers @{ Authorization = "token $env:GITHUB_TOKEN" } -Body $body | Out-Null
  } catch {
    Write-Host "! 创建仓库失败（可能已存在，继续尝试推送）: $($_.Exception.Message)" -ForegroundColor Yellow
  }
  git remote remove origin 2>$null
  git remote add origin "https://x-access-token:$env:GITHUB_TOKEN@github.com/$user/$RepoName.git"
  git push -u origin main
  git remote set-url origin "https://github.com/$user/$RepoName.git"
  Write-Host ""
  Write-Host "✔ 完成！仓库地址: https://github.com/$user/$RepoName" -ForegroundColor Green
  exit 0
} else {
  Fail "未找到可用认证，请任选一种后重试：
  1) 安装并登录 gh CLI：
       winget install GitHub.cli
       gh auth login
  2) 设置环境变量 GITHUB_TOKEN（需 repo 权限的 Personal Access Token）"
}
