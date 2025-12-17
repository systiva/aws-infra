# Script to migrate Terraform state from admin_backend to admin_portal_be module
# This moves the existing resources to the new module name without recreating them

param(
    [string]$Workspace = "dev",
    [string]$Profile = "admin",
    [string]$Region = "us-east-1"
)

Write-Host "==============================================`n" -ForegroundColor Cyan
Write-Host "Migrating Terraform State: admin_backend -> admin_portal_be" -ForegroundColor Cyan
Write-Host "==============================================`n" -ForegroundColor Cyan

$env:AWS_PROFILE = $Profile
$env:AWS_REGION = $Region

Set-Location -Path "$PSScriptRoot"

# Select workspace
Write-Host "Selecting workspace: $Workspace" -ForegroundColor Yellow
terraform workspace select $Workspace

# List of resources to move
$resources = @(
    "module.admin_backend.aws_iam_role.lambda_execution_role",
    "module.admin_backend.aws_iam_role_policy.lambda_policy",
    "module.admin_backend.aws_cloudwatch_log_group.lambda_logs",
    "module.admin_backend.aws_lambda_function.backend",
    "module.admin_backend.aws_lambda_permission.api_gateway_invoke",
    "module.admin_backend.data.aws_iam_policy_document.lambda_assume_role",
    "module.admin_backend.data.aws_caller_identity.current",
    "module.admin_backend.data.aws_region.current"
)

Write-Host "`nMoving resources from module.admin_backend to module.admin_portal_be...`n" -ForegroundColor Yellow

foreach ($resource in $resources) {
    $newResource = $resource -replace "module.admin_backend", "module.admin_portal_be"
    
    Write-Host "Moving: $resource" -ForegroundColor Gray
    Write-Host "    To: $newResource" -ForegroundColor Green
    
    try {
        terraform state mv $resource $newResource
        Write-Host "    ✓ Success`n" -ForegroundColor Green
    } catch {
        Write-Host "    ✗ Failed: $_`n" -ForegroundColor Red
    }
}

Write-Host "`n==============================================`n" -ForegroundColor Cyan
Write-Host "State migration complete!" -ForegroundColor Cyan
Write-Host "==============================================`n" -ForegroundColor Cyan

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Run: terraform plan to verify no changes are needed" -ForegroundColor White
Write-Host "2. Run: terraform apply if any updates are required" -ForegroundColor White
