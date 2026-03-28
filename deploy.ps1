# deploy.ps1 — deploy backend then frontend

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Backend ──────────────────────────────────────────────────────────────────

$APP_NAME    = "mtg-tracker-backend"
$BACKEND_DIR = "$PSScriptRoot\backend"
$ZIP_PATH    = "$BACKEND_DIR\deploy.zip"

Write-Host "`n==> Deploying backend..." -ForegroundColor Cyan

$excludeNames = @("__pycache__", "deploy.zip", "admin_keys.json", "mtg_tracker.db", "import_csv.py", ".azure")
Push-Location $BACKEND_DIR
$filesToZip = Get-ChildItem -Path "." |
    Where-Object { $excludeNames -notcontains $_.Name -and $_.Extension -ne ".pyc" }
if (Test-Path $ZIP_PATH) { Remove-Item $ZIP_PATH }
Compress-Archive -Path ($filesToZip | ForEach-Object { $_.Name }) -DestinationPath $ZIP_PATH
Pop-Location

$RESOURCE_GROUP = az webapp list --query "[?name=='$APP_NAME'].resourceGroup" -o tsv
if (-not $RESOURCE_GROUP) {
    Write-Host "Could not find app '$APP_NAME'. Make sure you are logged in: az login" -ForegroundColor Red
    exit 1
}

Write-Host "Deploying to $APP_NAME (resource group: $RESOURCE_GROUP)..." -ForegroundColor Cyan
az webapp deploy `
    --resource-group $RESOURCE_GROUP `
    --name $APP_NAME `
    --src-path $ZIP_PATH `
    --type zip

if ($LASTEXITCODE -ne 0) {
    Write-Host "Backend deploy failed." -ForegroundColor Red
    exit 1
}

Write-Host "Backend deployed." -ForegroundColor Green

# ── Frontend ─────────────────────────────────────────────────────────────────

$FRONTEND_DIR = "$PSScriptRoot\frontend"
$API_FILE     = "$FRONTEND_DIR\src\api.js"
$LIVE_URL     = "https://mtg-tracker-backend.azurewebsites.net"

Write-Host "`n==> Deploying frontend..." -ForegroundColor Cyan

$originalContent = Get-Content $API_FILE -Raw
$liveContent = $originalContent -replace "(?m)^(?!\/\/).*const BASE\s*=.*$", "const BASE = '$LIVE_URL'"
Set-Content $API_FILE $liveContent
Write-Host "Set api.js to live backend." -ForegroundColor Cyan

Set-Location $FRONTEND_DIR
npm run build
$buildExit = $LASTEXITCODE

Set-Content $API_FILE $originalContent
Write-Host "Restored api.js." -ForegroundColor Cyan

if ($buildExit -ne 0) {
    Write-Host "Frontend build failed." -ForegroundColor Red
    exit 1
}

swa deploy ./dist --env production --app-name mtg-tracker
if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend deploy failed. Make sure swa CLI is installed: npm install -g @azure/static-web-apps-cli" -ForegroundColor Red
    exit 1
}

Write-Host "Frontend deployed." -ForegroundColor Green
Write-Host "`nAll done." -ForegroundColor Green
