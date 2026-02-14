$body = @{
    username = "admin"
    password = "Admin@2026"
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
}

$baseUrl = "https://sitemanagement-production.up.railway.app"

Write-Host "1. Testing Login..."
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/auth/login" `
        -Method POST `
        -Headers $headers `
        -Body $body `
        -UseBasicParsing

    Write-Host "Login Status: $($response.StatusCode)" -ForegroundColor Green
    
    $json = $response.Content | ConvertFrom-Json
    $token = $json.token
    
    if (-not $token) {
        Write-Host "❌ No token found in response!" -ForegroundColor Red
        exit
    }
    
    Write-Host "✅ Token received" -ForegroundColor Green

    Write-Host "`n2. Testing /api/auth/me..."
    
    $authHeaders = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $token"
    }
    
    $meResponse = Invoke-WebRequest -Uri "$baseUrl/api/auth/me" `
        -Method GET `
        -Headers $authHeaders `
        -UseBasicParsing
        
    Write-Host "/me Status: $($meResponse.StatusCode)" -ForegroundColor Green
    Write-Host "Response Body:"
    Write-Host $meResponse.Content

} catch {
    Write-Host "❌ Error occurred:" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)"
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        Write-Host "Error Body: $($reader.ReadToEnd())"
    } else {
        Write-Host $_.Exception.Message
    }
}
