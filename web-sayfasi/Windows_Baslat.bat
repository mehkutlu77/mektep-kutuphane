@echo off
chcp 65001 > nul
title Mektep Yazar Kitapciklari
cd /d "%~dp0"

echo ===================================================
echo   MEKTEP KÜTÜPHANESİ BAŞLATILIYOR
echo ===================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo HATA: Bilgisayarda Node.js kurulu degil.
    echo https://nodejs.org adresinden indirip kurun, sonra tekrar deneyin.
    echo.
    pause
    exit /b 1
)

echo Sunucu baslatiliyor... ^(Bu pencereyi KAPATMAYIN^)
echo Kutuphaneyi kapatmak icin bu pencerede Ctrl+C yapin.
echo.

REM Sunucu başlat ve kütüphaneyi aç
start http://localhost:3000/mektep_kutuphane.html
timeout /t 2 /nobreak
node server.js

echo.
echo Sunucu durdu.
pause
