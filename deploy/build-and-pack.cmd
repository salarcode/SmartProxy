@echo off
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-and-pack.ps1" %*
pause
