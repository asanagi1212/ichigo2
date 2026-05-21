@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"
cd /d "%ROOT%"

set "PROJECT_NODE_HOME=%ROOT%tools\node-v22.15.1-win-x64"
set "WORKSPACE_NODE_HOME=C:\Downloads\Documents\New project\tools\node-v22.15.1-win-x64"
set "VITE_CLI=%ROOT%node_modules\vite\bin\vite.js"
set "API_SERVER=%ROOT%server.js"

if exist "%PROJECT_NODE_HOME%\node.exe" (
  set "NODE_HOME=%PROJECT_NODE_HOME%"
) else if exist "%WORKSPACE_NODE_HOME%\node.exe" (
  set "NODE_HOME=%WORKSPACE_NODE_HOME%"
)

if defined NODE_HOME (
  set "NODE_EXE=%NODE_HOME%\node.exe"
  set "NPM_CMD=%NODE_HOME%\npm.cmd"
  set "PATH=%NODE_HOME%;%PATH%"
) else (
  for /f "delims=" %%I in ('where node.exe 2^>nul') do (
    if not defined NODE_EXE set "NODE_EXE=%%I"
  )
  for /f "delims=" %%I in ('where npm.cmd 2^>nul') do (
    if not defined NPM_CMD set "NPM_CMD=%%I"
  )
)

if not defined NODE_EXE (
  echo [ERROR] Node.js was not found.
  echo Install Node.js, or put node-v22.15.1-win-x64 under this project's tools folder.
  echo.
  pause
  exit /b 1
)

if not exist "%ROOT%node_modules" (
  if not defined NPM_CMD (
    echo [ERROR] Dependencies are missing and npm was not found.
    echo Please install Node.js with npm, then run this file again.
    echo.
    pause
    exit /b 1
  )

  echo [INFO] Installing dependencies...
  call "%NPM_CMD%" install
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

if not exist "%VITE_CLI%" (
  echo [ERROR] Vite CLI not found:
  echo %VITE_CLI%
  echo.
  pause
  exit /b 1
)

if not exist "%ROOT%.env" (
  echo [WARN] .env not found. OpenAI Compatible mode needs backend credentials.
  echo [WARN] Copy .env.example to .env and fill OPENAI_API_KEY / OPENAI_MODEL.
  echo.
)

if not exist "%API_SERVER%" (
  echo [ERROR] API proxy server not found:
  echo %API_SERVER%
  echo.
  pause
  exit /b 1
)

echo [INFO] Starting backend proxy: http://localhost:8787
start "Pulse Chat API" /min "%ROOT%start-api.bat"

echo [INFO] Starting Vite dev server...
echo [INFO] Local URL:  http://localhost:5173
echo [INFO] For iPhone preview, use the Network URL printed by Vite below.
echo.

start "" "http://localhost:5173"
call "%NODE_EXE%" "%VITE_CLI%" --host 0.0.0.0 --port 5173

echo.
echo [INFO] Dev server stopped.
pause
