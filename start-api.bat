@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"
cd /d "%ROOT%"

set "PROJECT_NODE_HOME=%ROOT%tools\node-v22.15.1-win-x64"
set "CODEX_NODE_HOME=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"

if exist "%PROJECT_NODE_HOME%\node.exe" (
  set "NODE_HOME=%PROJECT_NODE_HOME%"
) else if exist "%CODEX_NODE_HOME%\node.exe" (
  set "NODE_HOME=%CODEX_NODE_HOME%"
)

if defined NODE_HOME (
  set "NODE_EXE=%NODE_HOME%\node.exe"
  set "PATH=%NODE_HOME%;%PATH%"
) else (
  for /f "delims=" %%I in ('where node.exe 2^>nul') do (
    if not defined NODE_EXE set "NODE_EXE=%%I"
  )
)

if not defined NODE_EXE (
  echo [ERROR] Node.js was not found.
  pause
  exit /b 1
)

if not exist "%ROOT%.env" (
  echo [WARN] .env not found. OpenAI Compatible mode needs backend credentials.
  echo [WARN] Copy .env.example to .env and fill OPENAI_API_KEY / OPENAI_MODEL.
  echo.
)

echo [INFO] Starting backend proxy: http://localhost:8787
call "%NODE_EXE%" "%ROOT%server.js"

echo.
echo [INFO] API server stopped.
pause
