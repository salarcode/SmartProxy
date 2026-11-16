@echo off
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0publish.ps1" %*
pause
