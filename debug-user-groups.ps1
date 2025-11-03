# Debug script to check user groups in DynamoDB
# Run this to diagnose why demo_platform_admin is not getting groups

param(
    [string]$ProfileName = "admin",
    [string]$Region = "us-east-1",
    [string]$TableName = "platform-admin"
)

Write-Host "==============================================`n" -ForegroundColor Cyan
Write-Host "Checking User Groups in DynamoDB" -ForegroundColor Cyan
Write-Host "==============================================`n" -ForegroundColor Cyan

# Step 1: Get the Cognito user to find the sub
Write-Host "Step 1: Getting Cognito user 'demo_platform_admin'..." -ForegroundColor Yellow
$userPoolsOutput = aws cognito-idp list-user-pools --max-results 10 --profile $ProfileName --region $Region | ConvertFrom-Json
$userPoolId = ($userPoolsOutput.UserPools | Where-Object { $_.Name -like "*admin*" })[0].Id

if (-not $userPoolId) {
    Write-Host "ERROR: Could not find user pool" -ForegroundColor Red
    exit 1
}

Write-Host "Found User Pool: $userPoolId" -ForegroundColor Green

$cognitoUser = aws cognito-idp admin-get-user `
    --user-pool-id $userPoolId `
    --username "demo_platform_admin" `
    --profile $ProfileName `
    --region $Region | ConvertFrom-Json

$userSub = ($cognitoUser.UserAttributes | Where-Object { $_.Name -eq "sub" }).Value
$tenantIdAttr = ($cognitoUser.UserAttributes | Where-Object { $_.Name -eq "custom:tenant_id" }).Value

Write-Host "`nCognito User Info:" -ForegroundColor Green
Write-Host "  Username: $($cognitoUser.Username)"
Write-Host "  Sub: $userSub"
Write-Host "  TenantId (custom:tenant_id): $tenantIdAttr"
Write-Host "  Status: $($cognitoUser.UserStatus)`n"

# Step 2: Check if the user exists in DynamoDB
Write-Host "Step 2: Checking user in DynamoDB..." -ForegroundColor Yellow
$userPK = "TENANT#$tenantIdAttr"
$userSK = "USER#$userSub"

Write-Host "Querying DynamoDB with:" -ForegroundColor Gray
Write-Host "  Table: $TableName" -ForegroundColor Gray
Write-Host "  PK: $userPK" -ForegroundColor Gray
Write-Host "  SK: $userSK`n" -ForegroundColor Gray

try {
    $userItem = aws dynamodb get-item `
        --table-name $TableName `
        --key "{`"PK`": {`"S`": `"$userPK`"}, `"SK`": {`"S`": `"$userSK`"}}" `
        --profile $ProfileName `
        --region $Region | ConvertFrom-Json
    
    if ($userItem.Item) {
        Write-Host "✓ User found in DynamoDB RBAC table" -ForegroundColor Green
        Write-Host ($userItem.Item | ConvertTo-Json -Depth 5)
    } else {
        Write-Host "✗ User NOT found in DynamoDB RBAC table" -ForegroundColor Red
        Write-Host "This is expected if RBAC data uses a different structure" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ Error querying user: $_" -ForegroundColor Red
}

# Step 3: Check group memberships
Write-Host "`nStep 3: Checking group memberships..." -ForegroundColor Yellow
$groupsPK = "USER#$tenantIdAttr#$userSub#GROUPS"

Write-Host "Querying for group memberships with:" -ForegroundColor Gray
Write-Host "  Table: $TableName" -ForegroundColor Gray
Write-Host "  PK: $groupsPK`n" -ForegroundColor Gray

try {
    $groupMemberships = aws dynamodb query `
        --table-name $TableName `
        --key-condition-expression "PK = :pk" `
        --expression-attribute-values "{`":pk`": {`"S`": `"$groupsPK`"}}" `
        --profile $ProfileName `
        --region $Region | ConvertFrom-Json
    
    if ($groupMemberships.Count -gt 0) {
        Write-Host "✓ Found $($groupMemberships.Count) group memberships:" -ForegroundColor Green
        $groupMemberships.Items | ForEach-Object {
            Write-Host ($_ | ConvertTo-Json -Depth 5)
        }
    } else {
        Write-Host "✗ No group memberships found!" -ForegroundColor Red
        Write-Host "`nDiagnostic Information:" -ForegroundColor Yellow
        Write-Host "  The query is looking for PK: $groupsPK"
        Write-Host "  This should exist if Terraform bootstrap completed successfully"
        Write-Host "`n  Possible Issues:" -ForegroundColor Yellow
        Write-Host "  1. Terraform bootstrap module hasn't been applied yet"
        Write-Host "  2. TenantId mismatch between Cognito and DynamoDB"
        Write-Host "  3. User was created before RBAC bootstrap"
        Write-Host "`n  Solutions:" -ForegroundColor Yellow
        Write-Host "  1. Run: terraform apply with platform-bootstrap module enabled"
        Write-Host "  2. Manually add user to platform-admin group in DynamoDB"
    }
} catch {
    Write-Host "✗ Error querying groups: $_" -ForegroundColor Red
}

# Step 4: List all items in table with USER prefix to help debug
Write-Host "`nStep 4: Scanning for all USER#*#GROUPS entries in table..." -ForegroundColor Yellow
Write-Host "(This will show what user-group mappings actually exist)`n" -ForegroundColor Gray

try {
    $scanResult = aws dynamodb scan `
        --table-name $TableName `
        --filter-expression "begins_with(PK, :prefix)" `
        --expression-attribute-values "{`":prefix`": {`"S`": `"USER#`"}}" `
        --profile $ProfileName `
        --region $Region | ConvertFrom-Json
    
    $userGroupItems = $scanResult.Items | Where-Object { $_.PK.S -like "*#GROUPS" }
    
    if ($userGroupItems.Count -gt 0) {
        Write-Host "Found $($userGroupItems.Count) user-group mapping(s):" -ForegroundColor Green
        $userGroupItems | ForEach-Object {
            Write-Host "  PK: $($_.PK.S)" -ForegroundColor Cyan
            Write-Host "  SK: $($_.SK.S)" -ForegroundColor Cyan
            if ($_.groupId) {
                Write-Host "  GroupId: $($_.groupId.S)" -ForegroundColor Gray
            }
            if ($_.userId) {
                Write-Host "  UserId: $($_.userId.S)" -ForegroundColor Gray
            }
            Write-Host ""
        }
        
        Write-Host "`nCompare the PK values above with the expected PK:" -ForegroundColor Yellow
        Write-Host "  Expected: $groupsPK" -ForegroundColor Cyan
    } else {
        Write-Host "No user-group mappings found in the table!" -ForegroundColor Red
        Write-Host "The platform-bootstrap Terraform module likely hasn't been applied." -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ Error scanning table: $_" -ForegroundColor Red
}

Write-Host "`n==============================================`n" -ForegroundColor Cyan
Write-Host "Debug complete!" -ForegroundColor Cyan
Write-Host "==============================================`n" -ForegroundColor Cyan
