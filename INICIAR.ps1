# ================================================
#  SISTEMA DE COSTOS UNITARIOS
#  Script de inicio automatico
# ================================================
$Host.UI.RawUI.WindowTitle = "Sistema de Costos Unitarios"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host ""
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host "    SISTEMA DE COSTOS UNITARIOS" -ForegroundColor Cyan
Write-Host "    Servicios y Construcciones RP" -ForegroundColor Cyan
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar Node.js
$nodeVer = $null
try { $nodeVer = & node --version 2>$null } catch {}

if (-not $nodeVer) {
    Write-Host "  [!] Node.js no detectado. Descargando..." -ForegroundColor Yellow
    $installer = "$env:TEMP\node_installer.msi"
    try {
        Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi" -OutFile $installer -UseBasicParsing
        Write-Host "  [..] Instalando Node.js (1-2 minutos)..." -ForegroundColor Yellow
        Start-Process msiexec.exe -ArgumentList "/i `"$installer`" /qn ADDLOCAL=ALL" -Wait
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        Write-Host "  [OK] Node.js instalado." -ForegroundColor Green
    } catch {
        Write-Host "  [ERROR] Descargue Node.js manualmente desde: https://nodejs.org" -ForegroundColor Red
        Read-Host "Presione Enter para cerrar"
        exit 1
    }
} else {
    Write-Host "  [OK] Node.js $nodeVer detectado" -ForegroundColor Green
}

# 2. Instalar dependencias (solo primera vez)
if (-not (Test-Path "node_modules\express")) {
    Write-Host ""
    Write-Host "  [..] Primera ejecucion - instalando dependencias (2-3 min)..." -ForegroundColor Yellow
    & npm install --silent
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] Fallo npm install. Verifique su conexion a internet." -ForegroundColor Red
        Read-Host "Presione Enter para cerrar"
        exit 1
    }
    Write-Host "  [OK] Dependencias instaladas." -ForegroundColor Green
}

# 3. Crear carpeta de datos
if (-not (Test-Path "data")) { New-Item -ItemType Directory -Path "data" | Out-Null }

# 4. Abrir navegador automaticamente
Start-Sleep -Seconds 2
Start-Process "http://localhost:3000"

# 5. Iniciar servidor
Write-Host ""
Write-Host "  ================================================" -ForegroundColor Green
Write-Host "   Sistema listo - abra su navegador en:" -ForegroundColor Green
Write-Host "     http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "   Usuario:    admin@costos.hn" -ForegroundColor Gray
Write-Host "   Contrasena: admin123" -ForegroundColor Gray
Write-Host ""
Write-Host "   NO CIERRE esta ventana mientras use el sistema." -ForegroundColor Yellow
Write-Host "  ================================================" -ForegroundColor Green
Write-Host ""

& node src/app.js

Write-Host ""
Write-Host "  El servidor se detuvo." -ForegroundColor Red
Read-Host "Presione Enter para cerrar"
