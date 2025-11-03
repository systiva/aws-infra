# Script to test tenant endpoint and check logs
param(
    [string]$TenantId = "72208947",
    [string]$ProfileName = "admin",
    [string]$Region = "us-east-1"
)

Write-Host "==============================================`n" -ForegroundColor Cyan
Write-Host "Testing Tenant Endpoint" -ForegroundColor Cyan
Write-Host "==============================================`n" -ForegroundColor Cyan

# Get API Gateway ID
Write-Host "Step 1: Finding API Gateway..." -ForegroundColor Yellow
$apiGateways = aws apigateway get-rest-apis --profile $ProfileName --region $Region | ConvertFrom-Json
$adminApi = $apiGateways.items | Where-Object { $_.name -like "*admin*api*" }

if (-not $adminApi) {
    Write-Host "ERROR: Could not find API Gateway" -ForegroundColor Red
    exit 1
}

Write-Host "Found API Gateway: $($adminApi.name) ($($adminApi.id))" -ForegroundColor Green

# Check API Gateway resources
Write-Host "`nStep 2: Checking API Gateway resources..." -ForegroundColor Yellow
$resources = aws apigateway get-resources --rest-api-id $adminApi.id --profile $ProfileName --region $Region | ConvertFrom-Json

Write-Host "Available resources:" -ForegroundColor Cyan
$resources.items | ForEach-Object {
    Write-Host "  $($_.path) [$($_.id)]" -ForegroundColor Gray
}

# Find the tenant by ID resource
$tenantByIdResource = $resources.items | Where-Object { $_.pathPart -eq "{tenantId}" }

if ($tenantByIdResource) {
    Write-Host "`n✓ Found /api/v1/tenants/{tenantId} resource" -ForegroundColor Green
    Write-Host "  Resource ID: $($tenantByIdResource.id)" -ForegroundColor Gray
    
    # Check method
    Write-Host "`nStep 3: Checking GET method configuration..." -ForegroundColor Yellow
    try {
        $method = aws apigateway get-method `
            --rest-api-id $adminApi.id `
            --resource-id $tenantByIdResource.id `
            --http-method GET `
            --profile $ProfileName `
            --region $Region | ConvertFrom-Json
        
        Write-Host "✓ GET method exists" -ForegroundColor Green
        Write-Host "  Authorization: $($method.authorizationType)" -ForegroundColor Gray
        if ($method.authorizerId) {
            Write-Host "  Authorizer ID: $($method.authorizerId)" -ForegroundColor Gray
        }
        
        # Check integration
        Write-Host "`nStep 4: Checking Lambda integration..." -ForegroundColor Yellow
        $integration = aws apigateway get-integration `
            --rest-api-id $adminApi.id `
            --resource-id $tenantByIdResource.id `
            --http-method GET `
            --profile $ProfileName `
            --region $Region | ConvertFrom-Json
        
        Write-Host "✓ Integration configured" -ForegroundColor Green
        Write-Host "  Type: $($integration.type)" -ForegroundColor Gray
        Write-Host "  URI: $($integration.uri)" -ForegroundColor Gray
        Write-Host "  HTTP Method: $($integration.httpMethod)" -ForegroundColor Gray
        
    } catch {
        Write-Host "✗ Error checking method: $_" -ForegroundColor Red
    }
} else {
    Write-Host "✗ /api/v1/tenants/{tenantId} resource NOT found" -ForegroundColor Red
}

# Check backend Lambda logs
Write-Host "`nStep 5: Checking recent backend Lambda logs..." -ForegroundColor Yellow
$lambdas = aws lambda list-functions --profile $ProfileName --region $Region | ConvertFrom-Json
$backendLambda = $lambdas.Functions | Where-Object { $_.FunctionName -like "*backend*" -and $_.FunctionName -notlike "*web*" }

if ($backendLambda) {
    Write-Host "Backend Lambda: $($backendLambda.FunctionName)" -ForegroundColor Green
    
    $logGroupName = "/aws/lambda/$($backendLambda.FunctionName)"
    Write-Host "Log Group: $logGroupName" -ForegroundColor Gray
    
    Write-Host "`nRecent log streams (last 5 minutes):" -ForegroundColor Cyan
    try {
        $logStreams = aws logs describe-log-streams `
            --log-group-name $logGroupName `
            --order-by LastEventTime `
            --descending `
            --max-items 5 `
            --profile $ProfileName `
            --region $Region | ConvertFrom-Json
        
        if ($logStreams.logStreams.Count -gt 0) {
            $logStreams.logStreams | ForEach-Object {
                $lastEventTime = [DateTimeOffset]::FromUnixTimeMilliseconds($_.lastEventTimestamp).LocalDateTime
                Write-Host "  $($_.logStreamName) - Last event: $lastEventTime" -ForegroundColor Gray
            }
            
            # Get latest log events
            $latestStream = $logStreams.logStreams[0].logStreamName
            Write-Host "`nLatest log events from: $latestStream" -ForegroundColor Cyan
            
            $events = aws logs get-log-events `
                --log-group-name $logGroupName `
                --log-stream-name $latestStream `
                --limit 20 `
                --profile $ProfileName `
                --region $Region | ConvertFrom-Json
            
            $events.events | ForEach-Object {
                $eventTime = [DateTimeOffset]::FromUnixTimeMilliseconds($_.timestamp).LocalDateTime
                Write-Host "[$eventTime] $($_.message)" -ForegroundColor Gray
            }
        } else {
            Write-Host "  No recent log streams found" -ForegroundColor Yellow
            Write-Host "  This suggests the Lambda is NOT being invoked" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "✗ Error reading logs: $_" -ForegroundColor Red
    }
} else {
    Write-Host "Backend Lambda not found" -ForegroundColor Red
}

# Check API Gateway execution logs
Write-Host "`nStep 6: Checking API Gateway execution logs..." -ForegroundColor Yellow
$apiLogGroupName = "API-Gateway-Execution-Logs_$($adminApi.id)/prod"
Write-Host "API Gateway Log Group: $apiLogGroupName" -ForegroundColor Gray

try {
    $apiLogStreams = aws logs describe-log-streams `
        --log-group-name $apiLogGroupName `
        --order-by LastEventTime `
        --descending `
        --max-items 3 `
        --profile $ProfileName `
        --region $Region 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        $apiLogData = $apiLogStreams | ConvertFrom-Json
        if ($apiLogData.logStreams.Count -gt 0) {
            Write-Host "✓ API Gateway execution logs found" -ForegroundColor Green
            
            $latestApiStream = $apiLogData.logStreams[0].logStreamName
            Write-Host "`nLatest API Gateway log events:" -ForegroundColor Cyan
            
            $apiEvents = aws logs get-log-events `
                --log-group-name $apiLogGroupName `
                --log-stream-name $latestApiStream `
                --limit 20 `
                --profile $ProfileName `
                --region $Region | ConvertFrom-Json
            
            $apiEvents.events | ForEach-Object {
                $eventTime = [DateTimeOffset]::FromUnixTimeMilliseconds($_.timestamp).LocalDateTime
                Write-Host "[$eventTime] $($_.message)" -ForegroundColor Gray
            }
        } else {
            Write-Host "✗ No API Gateway log streams found" -ForegroundColor Yellow
        }
    } else {
        Write-Host "✗ API Gateway execution logging may not be enabled" -ForegroundColor Yellow
        Write-Host "  Error: $apiLogStreams" -ForegroundColor Gray
    }
} catch {
    Write-Host "✗ Could not access API Gateway logs: $_" -ForegroundColor Yellow
}

Write-Host "`n==============================================`n" -ForegroundColor Cyan
Write-Host "Diagnostic complete!" -ForegroundColor Cyan
Write-Host "==============================================`n" -ForegroundColor Cyan
