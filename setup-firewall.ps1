# AnyKeep 开发服务器防火墙配置脚本
# 需要以管理员身份运行

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  AnyKeep 防火墙配置脚本" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# 检查管理员权限
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ 错误：此脚本需要管理员权限" -ForegroundColor Red
    Write-Host ""
    Write-Host "请右键点击 PowerShell 并选择 '以管理员身份运行'" -ForegroundColor Yellow
    Write-Host "然后重新运行此脚本" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

Write-Host "✅ 检测到管理员权限" -ForegroundColor Green
Write-Host ""

# 删除旧规则（如果存在）
Write-Host "🔍 检查现有防火墙规则..." -ForegroundColor Yellow
$existingRule = Get-NetFirewallRule -DisplayName "AnyKeep Dev Server" -ErrorAction SilentlyContinue

if ($existingRule) {
    Write-Host "🗑️  删除旧的防火墙规则..." -ForegroundColor Yellow
    Remove-NetFirewallRule -DisplayName "AnyKeep Dev Server"
}

# 创建新的入站规则
Write-Host "➕ 创建新的防火墙入站规则..." -ForegroundColor Yellow
try {
    New-NetFirewallRule `
        -DisplayName "AnyKeep Dev Server" `
        -Description "允许 AnyKeep 开发服务器接受局域网连接（端口 3000）" `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort 3000 `
        -Action Allow `
        -Profile Domain,Private,Public `
        -Enabled True | Out-Null

    Write-Host ""
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host "  ✅ 防火墙配置成功！" -ForegroundColor Green
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "📱 现在你可以通过以下地址访问应用：" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   本机访问：http://localhost:3000" -ForegroundColor White
    Write-Host "   局域网访问：http://192.168.1.26:3000" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "💡 提示：" -ForegroundColor Cyan
    Write-Host "   - 确保手机和电脑连接到同一个 WiFi" -ForegroundColor Gray
    Write-Host "   - 在手机浏览器输入上面的局域网地址" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "❌ 防火墙配置失败：$($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    exit 1
}

# 显示规则信息
Write-Host "📋 防火墙规则详情：" -ForegroundColor Cyan
Get-NetFirewallRule -DisplayName "AnyKeep Dev Server" | Format-List DisplayName, Enabled, Direction, Action

Write-Host ""
Write-Host "按任意键退出..." -ForegroundColor Gray
pause | Out-Null
