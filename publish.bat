@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==== Nubl Marketing Hub - publish ====
git config --global --add safe.directory "%CD:\=/%" >nul 2>&1
git pull --rebase --autostash origin main
if errorlevel 1 goto fail
git add -A
set MSG=%*
if "%MSG%"=="" set MSG=تحديث المنصة
git diff --cached --quiet || git commit -m "%MSG%"
git push origin main
if errorlevel 1 goto fail
echo.
echo تم الرفع. Cloudflare ينشر خلال دقيقة: https://nubl-ebtikar.online/marketing/hub/
pause
exit /b 0
:fail
echo.
echo تعذر الرفع - راجع الرسالة أعلاه أو أرسلها لـ Claude.
pause
exit /b 1
