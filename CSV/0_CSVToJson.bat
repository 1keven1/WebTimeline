@echo off
chcp 65001 >nul
title CSV 转 JSON 工具

if "%~1"=="" (
    powershell -ExecutionPolicy Bypass -NoExit -File "%~dp00_CSVToJson.ps1"
) else (
    powershell -ExecutionPolicy Bypass -NoExit -File "%~dp00_CSVToJson.ps1" -InputFile "%~1"
)