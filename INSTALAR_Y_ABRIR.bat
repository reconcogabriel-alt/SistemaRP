@echo off
setlocal enabledelayedexpansion
title Instalacion - Sistema de Costos Unitarios
color 0B
cd /d "%~dp0"
set "APP_DIR=%~dp0"
set "APP_DIR=%APP_DIR:~0,-1%"

echo.
echo  ====================================================
echo    INSTALACION - SISTEMA DE COSTOS UNITARIOS
echo    Servicios y Construcciones RP
echo  ====================================================
echo.
echo  Este proceso configurara el sistema en su computadora.
echo  Solo necesita realizarlo UNA VEZ.
echo.
pause

:: ── 1. Verificar / Instalar Node.js ──────────────────
echo.
echo  [1/3] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo        No encontrado. Descargando e instalando Node.js...
    echo        (Requiere conexion a internet - puede tardar 3-5 minutos^)
    powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi' -OutFile '%TEMP%\node_setup.msi' -UseBasicParsing"
    if %errorlevel% neq 0 (
        echo.
        echo  [ERROR] Sin acceso a internet.
        echo          Descargue Node.js manualmente desde https://nodejs.org
        echo          instale la version LTS, y ejecute INICIAR.bat
        pause
        exit /b 1
    )
    msiexec /i "%TEMP%\node_setup.msi" /qn ADDLOCAL=ALL
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
    echo        Node.js instalado correctamente.
) else (
    for /f "tokens=*" %%v in ('node --version') do echo        Node.js %%v - OK
)

:: ── 2. Instalar dependencias npm ─────────────────────
echo.
echo  [2/3] Instalando dependencias del sistema...
echo        (Solo ocurre esta vez - 2-3 minutos^)
if not exist "node_modules\express" (
    call npm install --silent
    if %errorlevel% neq 0 (
        echo  [ERROR] Fallo la instalacion de paquetes.
        echo          Verifique su conexion a internet e intente de nuevo.
        pause
        exit /b 1
    )
)
echo        Dependencias instaladas - OK

:: ── 3. Crear acceso directo en Escritorio ────────────
echo.
echo  [3/3] Creando acceso directo en el Escritorio...
set "SHORTCUT=%USERPROFILE%\Desktop\Costos Unitarios.lnk"
set "TARGET=%APP_DIR%\INICIAR.bat"
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = 'cmd.exe'; $s.Arguments = '/c \"%TARGET%\"'; $s.WorkingDirectory = '%APP_DIR%'; $s.IconLocation = 'shell32.dll,21'; $s.Description = 'Sistema de Costos Unitarios'; $s.Save()"
echo        Acceso directo creado en el Escritorio.

:: ── Listo ─────────────────────────────────────────────
if not exist "data" mkdir data

echo.
echo  ====================================================
echo   INSTALACION COMPLETADA
echo.
echo   Desde ahora use el icono del Escritorio:
echo   "Costos Unitarios"
echo.
echo   O ejecute directamente: INICIAR.bat
echo.
echo   Usuario:    admin@costos.hn
echo   Contrasena: admin123
echo  ====================================================
echo.
echo  Iniciando el sistema ahora...
echo.
timeout /t 3 /nobreak >nul
start "" "http://localhost:3000"
node src/app.js
pause
