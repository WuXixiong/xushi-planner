@echo off
rem 序事 · 开机自启（注册到"启动"文件夹即可）
start "序事服务" pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
