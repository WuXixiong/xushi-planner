@echo off
rem 序事 · 注册开机自启（把本文件复制到"启动"文件夹，或直接运行一次本文件）
set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
copy /Y "%~dp0serve.cmd" "%STARTUP%\序事-serve.cmd" >nul
echo 已注册开机自启: %STARTUP%\序事-serve.cmd
echo 取消自启: 删除上述文件即可。
pause
