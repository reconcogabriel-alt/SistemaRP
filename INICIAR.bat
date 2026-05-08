@echo off
setlocal enabledelayedexpansion
title Sistema de Costos Unitarios
color 0A
cd /d "%~dp0"

echo.
echo  ====================================================
echo    SISTEMA DE COSTOS UNITARIOS
echo    Servicios y Construcciones RP
echo  ====================================================
echo.

:: ── 1. Verificar Node.js ─────────────────────────────
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] Node.js no esta instalado.
    echo      Instalando automaticamente...
    echo.
    powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi' -OutFile '%TEMP%\node_installer.msi'"
    if %errorlevel% neq 0 (
        echo  [ERROR] No se pudo descargar Node.js.
        echo          Descargue manualmente desde: https://nodejs.org
        echo          Luego vuelva a ejecutar este archivo.
        pause
        exit /b 1
    )
    echo  Instalando Node.js (esto puede tardar 1-2 minutos^)...
    msiexec /i "%TEMP%\node_installer.msi" /qn ADDLOCAL=ALL
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
    node --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo.
        echo  [!] Instalacion completada. CIERRE esta ventana,
        echo      vuelva a abrirla y ejecute INICIAR.bat de nuevo.
        pause
        exit /b 1
    )
    echo  [OK] Node.js instalado correctamente.
    echo.
) else (
    for /f "tokens=*" %%v in ('node --version') do echo  [OK] Node.js %%v detectado
)

:: ── 2. Instalar dependencias si no existen ───────────
if not exist "node_modules\express" (
    echo.
    echo  [..] Instalando dependencias por primera vez...
    echo       Esto solo ocurre una vez - puede tardar 2-3 minutos.
    echo.
    call npm install --silent
    if %errorlevel% neq 0 (
        echo  [ERROR] Fallo la instalacion de dependencias.
        echo          Verifique su conexion a internet e intente de nuevo.
        pause
        exit /b 1
    )
    echo  [OK] Dependencias instaladas.
)

:: ── 3. Crear carpeta de datos ────────────────────────
if not exist "data" mkdir data

:: ── 4. Abrir navegador automaticamente ──────────────
echo.
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"

:: ── 5. Iniciar servidor ──────────────────────────────
echo.
echo  ====================================================
echo   Sistema listo - acceda desde su navegador:
echo.
echo     http://localhost:3000
echo.
echo   Usuario:    admin@costos.hn
echo   Contrasena: admin123
echo.
echo   NO CIERRE esta ventana mientras use el sistema.
echo  ====================================================
echo.
node src/app.js

echo.
echo  [!] El servidor se detuvo. Presione cualquier tecla para cerrar.
pause
