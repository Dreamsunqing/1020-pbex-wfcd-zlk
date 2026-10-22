@echo off
chcp 65001 >nul
cd /d "%~dp0"
node "资料工具.mjs" %*
pause
