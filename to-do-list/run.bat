@echo off
setlocal
cd /d "%~dp0todo-app"

rem Trust the system's root CA store (needed on networks like campus Wi-Fi
rem that MITM-inspect TLS via their own root cert) for MongoDB/Clerk TLS.
set "NODE_EXTRA_CA_CERTS=%~dp0todo-app\certs\system-ca-bundle.pem"

if not exist node_modules (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo.
        echo npm install failed. Aborting.
        pause
        exit /b 1
    )
)

echo Starting TaskFlow at http://localhost:3000 ...
start "" http://localhost:3000
call npm run dev

pause
