@echo off
setlocal
chcp 65001 >nul
title GPT Image Batch 局域网启动器
cd /d "%~dp0"

echo [GPT Image Batch] Opening Windows launcher...
echo [GPT Image Batch] Keep this window open. The PowerShell launcher will show Chinese progress.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-lan.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo [GPT Image Batch] Launch failed. Exit code: %EXIT_CODE%
  echo Please read the messages above.
  echo.
  pause
  exit /b %EXIT_CODE%
)

exit /b 0
