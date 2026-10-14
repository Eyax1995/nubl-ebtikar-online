@echo off
cd /d "%~dp0"
set LOG=%~dp0publish-log.txt
echo ==== Nubl Marketing Hub - publish ==== > "%LOG%"
echo %DATE% %TIME% >> "%LOG%"
where git >> "%LOG%" 2>&1
if errorlevel 1 (
  echo.
  echo [X] Git is not installed on this computer.
  echo     Install it from https://git-scm.com/download/win then run this file again.
  echo GIT_NOT_INSTALLED >> "%LOG%"
  pause
  exit /b 1
)
git config --global --add safe.directory "*" >> "%LOG%" 2>&1
echo Pulling latest...
git pull --rebase --autostash origin main >> "%LOG%" 2>&1
if errorlevel 1 goto fail
git add -A >> "%LOG%" 2>&1
git diff --cached --quiet || git commit -m "update hub" >> "%LOG%" 2>&1
echo Pushing to GitHub (a sign-in window may appear)...
git push origin main >> "%LOG%" 2>&1
if errorlevel 1 goto fail
echo PUSH_OK >> "%LOG%"
echo.
echo [OK] Published. Cloudflare deploys within 1 minute:
echo      https://nubl-ebtikar.online/marketing/hub/
pause
exit /b 0
:fail
echo PUSH_FAILED >> "%LOG%"
echo.
echo [X] Publish failed. Details saved in publish-log.txt
type "%LOG%"
pause
exit /b 1
