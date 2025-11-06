# Generate JWT_SECRET for Cloudflare Pages
$bytes = New-Object byte[] 48
$rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
$rng.GetBytes($bytes)
$secret = [Convert]::ToBase64String($bytes)
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "JWT_SECRET Generated Successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host $secret -ForegroundColor Yellow
Write-Host ""
Write-Host "Copy this value and add it to Cloudflare Pages Environment Variables" -ForegroundColor Cyan
Write-Host ""

