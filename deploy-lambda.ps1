# Multi-Tenant SaaS Platform - Lambda Deployment Script for Windows
# This script handles building and deploying Lambda functions using PowerShell
# Compatible with Windows environments where zip command is not available

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("build", "deploy", "build-deploy")]
    [string]$Action,
    
    [Parameter(Mandatory=$true)]
    [ValidateSet("admin-portal-web-server", "admin-portal-be", "ims-service", "create-infra-worker", "delete-infra-worker", "poll-infra-worker", "create-admin-worker", "jwt-authorizer")]
    [string]$Service,
    
    [Parameter(Mandatory=$false)]
    [string]$Workspace = "dev",
    
    [Parameter(Mandatory=$false)]
    [string]$AdminProfile = "admin",
    
    [Parameter(Mandatory=$false)]
    [string]$Region = "us-east-1"
)

# Color codes for output
$Green = [System.ConsoleColor]::Green
$Red = [System.ConsoleColor]::Red
$Yellow = [System.ConsoleColor]::Yellow
$Cyan = [System.ConsoleColor]::Cyan
$White = [System.ConsoleColor]::White

# Helper functions
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor $Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $Yellow
}

function Write-Stage {
    param([string]$Message)
    Write-Host "[STAGE] 🚀 $Message" -ForegroundColor $White -BackgroundColor DarkBlue
}

# Map service names to Terraform function names
function Get-LambdaFunctionName {
    param([string]$ServiceName)
    
    $terraformFunctionName = switch ($ServiceName) {
        "admin-portal-web-server" { "web-server" }
        "admin-portal-be" { "backend" }
        default { $ServiceName }
    }
    
    return "admin-portal-$Workspace-$terraformFunctionName"
}

# Smart npm install function
function Install-NodeModules {
    param([string]$Mode = "--production")
    
    if (Test-Path "package-lock.json") {
        Write-Info "Found package-lock.json, using npm ci..."
        npm ci $Mode
    } elseif (Test-Path "npm-shrinkwrap.json") {
        Write-Info "Found npm-shrinkwrap.json, using npm ci..."
        npm ci $Mode
    } else {
        Write-Info "No lock file found, using npm install..."
        npm install $Mode
    }
    
    return $LASTEXITCODE -eq 0
}

# Validate prerequisites
function Test-Prerequisites {
    Write-Info "Checking prerequisites..."
    
    # Check Node.js
    try {
        $nodeVersion = node --version
        Write-Success "Node.js found: $nodeVersion"
    }
    catch {
        Write-Error "Node.js not found. Please install Node.js >= 18.x"
        exit 1
    }
    
    # Check npm
    try {
        $npmVersion = npm --version
        Write-Success "npm found: $npmVersion"
    }
    catch {
        Write-Error "npm not found. Please install npm >= 9.x"
        exit 1
    }
    
    # Check AWS CLI
    try {
        $awsVersion = aws --version
        Write-Success "AWS CLI found: $awsVersion"
    }
    catch {
        Write-Error "AWS CLI not found. Please install AWS CLI >= 2.0"
        exit 1
    }
    
    # Test AWS profile
    try {
        $identity = aws sts get-caller-identity --profile $AdminProfile 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "AWS profile '$AdminProfile' is working"
        } else {
            Write-Error "AWS profile '$AdminProfile' is not working or not configured"
            exit 1
        }
    }
    catch {
        Write-Error "Failed to validate AWS profile '$AdminProfile'"
        exit 1
    }
}

# Build functions for each Lambda service
function Build-AdminPortalWebServer {
    Write-Info "Building admin-portal-web-server..."
    
    if (!(Test-Path "admin-portal-web-server")) {
        Write-Error "Directory 'admin-portal-web-server' not found"
        return $false
    }
    
    Push-Location "admin-portal-web-server"
    try {
        Write-Info "Installing production dependencies..."
        $installSuccess = Install-NodeModules "--production"
        if (-not $installSuccess) {
            Write-Error "Failed to install dependencies"
            return $false
        }
        
        Write-Info "Creating deployment package..."
        $outputPath = "../admin-portal-iac/lambda-packages/admin-portal-web-server.zip"
        
        # Remove existing zip if it exists
        if (Test-Path $outputPath) {
            Remove-Item $outputPath -Force
        }
        
        # Create zip package excluding unnecessary files
        $filesToExclude = @(
            "*.test.js",
            "test\*",
            ".git\*",
            "node_modules\.cache\*",
            "coverage\*"
        )
        
        # Get all files except excluded ones
        $allFiles = Get-ChildItem -Recurse -File | Where-Object {
            $file = $_
            $shouldExclude = $false
            foreach ($pattern in $filesToExclude) {
                if ($file.FullName -like "*$($pattern.Replace('\', [System.IO.Path]::DirectorySeparatorChar))*") {
                    $shouldExclude = $true
                    break
                }
            }
            -not $shouldExclude
        }
        
        # Create the zip file
        $allFiles | Compress-Archive -DestinationPath $outputPath -Force
        
        Write-Success "✅ admin-portal-web-server built successfully"
        return $true
    }
    catch {
        Write-Error "Failed to build admin-portal-web-server: $($_.Exception.Message)"
        return $false
    }
    finally {
        Pop-Location
    }
}

function Build-AdminPortalBe {
    Write-Info "Building admin-portal-be..."
    
    if (!(Test-Path "admin-portal-be")) {
        Write-Error "Directory 'admin-portal-be' not found"
        return $false
    }
    
    Push-Location "admin-portal-be"
    try {
        Write-Info "Installing production dependencies..."
        $installSuccess = Install-NodeModules "--production"
        if (-not $installSuccess) {
            Write-Error "Failed to install dependencies"
            return $false
        }
        
        Write-Info "Creating deployment package..."
        $outputPath = "../admin-portal-iac/lambda-packages/admin-portal-be.zip"
        
        if (Test-Path $outputPath) {
            Remove-Item $outputPath -Force
        }
        
        $filesToExclude = @("*.test.js", "test\*", ".git\*", "node_modules\.cache\*", "coverage\*")
        $allFiles = Get-ChildItem -Recurse -File | Where-Object {
            $file = $_
            $shouldExclude = $false
            foreach ($pattern in $filesToExclude) {
                if ($file.FullName -like "*$($pattern.Replace('\', [System.IO.Path]::DirectorySeparatorChar))*") {
                    $shouldExclude = $true
                    break
                }
            }
            -not $shouldExclude
        }
        
        $allFiles | Compress-Archive -DestinationPath $outputPath -Force
        Write-Success "✅ admin-portal-be built successfully"
        return $true
    }
    catch {
        Write-Error "Failed to build admin-portal-be: $($_.Exception.Message)"
        return $false
    }
    finally {
        Pop-Location
    }
}

function Build-ImsService {
    Write-Info "Building ims-service..."
    
    if (!(Test-Path "ims-service")) {
        Write-Error "Directory 'ims-service' not found"
        return $false
    }
    
    Push-Location "ims-service"
    try {
        Write-Info "Installing production dependencies..."
        $installSuccess = Install-NodeModules "--production"
        if (-not $installSuccess) {
            Write-Error "Failed to install dependencies"
            return $false
        }
        
        Write-Info "Creating deployment package..."
        $outputPath = "../admin-portal-iac/lambda-packages/ims-service.zip"
        
        if (Test-Path $outputPath) {
            Remove-Item $outputPath -Force
        }
        
        $filesToExclude = @("*.test.js", "test\*", ".git\*", "node_modules\.cache\*", "coverage\*")
        $allFiles = Get-ChildItem -Recurse -File | Where-Object {
            $file = $_
            $shouldExclude = $false
            foreach ($pattern in $filesToExclude) {
                if ($file.FullName -like "*$($pattern.Replace('\', [System.IO.Path]::DirectorySeparatorChar))*") {
                    $shouldExclude = $true
                    break
                }
            }
            -not $shouldExclude
        }
        
        $allFiles | Compress-Archive -DestinationPath $outputPath -Force
        Write-Success "✅ ims-service built successfully"
        return $true
    }
    catch {
        Write-Error "Failed to build ims-service: $($_.Exception.Message)"
        return $false
    }
    finally {
        Pop-Location
    }
}

function Build-CreateInfraWorker {
    Write-Info "Building create-infra-worker..."
    
    if (!(Test-Path "create-infra-worker")) {
        Write-Error "Directory 'create-infra-worker' not found"
        return $false
    }
    
    Push-Location "create-infra-worker"
    try {
        Write-Info "Installing production dependencies..."
        $installSuccess = Install-NodeModules "--production"
        if (-not $installSuccess) {
            Write-Error "Failed to install dependencies"
            return $false
        }
        
        Write-Info "Creating deployment package..."
        $outputPath = "../admin-portal-iac/lambda-packages/create-infra-worker.zip"
        
        if (Test-Path $outputPath) {
            Remove-Item $outputPath -Force
        }
        
        $filesToExclude = @("*.test.js", "test\*", ".git\*", "node_modules\.cache\*", "coverage\*")
        $allFiles = Get-ChildItem -Recurse -File | Where-Object {
            $file = $_
            $shouldExclude = $false
            foreach ($pattern in $filesToExclude) {
                if ($file.FullName -like "*$($pattern.Replace('\', [System.IO.Path]::DirectorySeparatorChar))*") {
                    $shouldExclude = $true
                    break
                }
            }
            -not $shouldExclude
        }
        
        $allFiles | Compress-Archive -DestinationPath $outputPath -Force
        Write-Success "✅ create-infra-worker built successfully"
        return $true
    }
    catch {
        Write-Error "Failed to build create-infra-worker: $($_.Exception.Message)"
        return $false
    }
    finally {
        Pop-Location
    }
}

function Build-DeleteInfraWorker {
    Write-Info "Building delete-infra-worker..."
    
    if (!(Test-Path "delete-infra-worker")) {
        Write-Error "Directory 'delete-infra-worker' not found"
        return $false
    }
    
    Push-Location "delete-infra-worker"
    try {
        Write-Info "Installing production dependencies..."
        $installSuccess = Install-NodeModules "--production"
        if (-not $installSuccess) {
            Write-Error "Failed to install dependencies"
            return $false
        }
        
        Write-Info "Creating deployment package..."
        $outputPath = "../admin-portal-iac/lambda-packages/delete-infra-worker.zip"
        
        if (Test-Path $outputPath) {
            Remove-Item $outputPath -Force
        }
        
        $filesToExclude = @("*.test.js", "test\*", ".git\*", "node_modules\.cache\*", "coverage\*")
        $allFiles = Get-ChildItem -Recurse -File | Where-Object {
            $file = $_
            $shouldExclude = $false
            foreach ($pattern in $filesToExclude) {
                if ($file.FullName -like "*$($pattern.Replace('\', [System.IO.Path]::DirectorySeparatorChar))*") {
                    $shouldExclude = $true
                    break
                }
            }
            -not $shouldExclude
        }
        
        $allFiles | Compress-Archive -DestinationPath $outputPath -Force
        Write-Success "✅ delete-infra-worker built successfully"
        return $true
    }
    catch {
        Write-Error "Failed to build delete-infra-worker: $($_.Exception.Message)"
        return $false
    }
    finally {
        Pop-Location
    }
}

function Build-PollInfraWorker {
    Write-Info "Building poll-infra-worker..."
    
    if (!(Test-Path "poll-infra-worker")) {
        Write-Error "Directory 'poll-infra-worker' not found"
        return $false
    }
    
    Push-Location "poll-infra-worker"
    try {
        Write-Info "Installing production dependencies..."
        $installSuccess = Install-NodeModules "--production"
        if (-not $installSuccess) {
            Write-Error "Failed to install dependencies"
            return $false
        }
        
        Write-Info "Creating deployment package..."
        $outputPath = "../admin-portal-iac/lambda-packages/poll-infra-worker.zip"
        
        if (Test-Path $outputPath) {
            Remove-Item $outputPath -Force
        }
        
        $filesToExclude = @("*.test.js", "test\*", ".git\*", "node_modules\.cache\*", "coverage\*")
        $allFiles = Get-ChildItem -Recurse -File | Where-Object {
            $file = $_
            $shouldExclude = $false
            foreach ($pattern in $filesToExclude) {
                if ($file.FullName -like "*$($pattern.Replace('\', [System.IO.Path]::DirectorySeparatorChar))*") {
                    $shouldExclude = $true
                    break
                }
            }
            -not $shouldExclude
        }
        
        $allFiles | Compress-Archive -DestinationPath $outputPath -Force
        Write-Success "✅ poll-infra-worker built successfully"
        return $true
    }
    catch {
        Write-Error "Failed to build poll-infra-worker: $($_.Exception.Message)"
        return $false
    }
    finally {
        Pop-Location
    }
}

function Build-CreateAdminWorker {
    Write-Info "Building create-admin-worker..."
    
    if (!(Test-Path "create-admin-worker")) {
        Write-Error "Directory 'create-admin-worker' not found"
        return $false
    }
    
    Push-Location "create-admin-worker"
    try {
        Write-Info "Installing production dependencies..."
        $installSuccess = Install-NodeModules "--production"
        if (-not $installSuccess) {
            Write-Error "Failed to install dependencies"
            return $false
        }
        
        Write-Info "Creating deployment package..."
        $outputPath = "../admin-portal-iac/lambda-packages/create-admin-worker.zip"
        
        if (Test-Path $outputPath) {
            Remove-Item $outputPath -Force
        }
        
        $filesToExclude = @("*.test.js", "test\*", ".git\*", "node_modules\.cache\*", "coverage\*")
        $allFiles = Get-ChildItem -Recurse -File | Where-Object {
            $file = $_
            $shouldExclude = $false
            foreach ($pattern in $filesToExclude) {
                if ($file.FullName -like "*$($pattern.Replace('\', [System.IO.Path]::DirectorySeparatorChar))*") {
                    $shouldExclude = $true
                    break
                }
            }
            -not $shouldExclude
        }
        
        $allFiles | Compress-Archive -DestinationPath $outputPath -Force
        Write-Success "✅ create-admin-worker built successfully"
        return $true
    }
    catch {
        Write-Error "Failed to build create-admin-worker: $($_.Exception.Message)"
        return $false
    }
    finally {
        Pop-Location
    }
}

function Build-JwtAuthorizer {
    Write-Info "Building jwt-authorizer..."
    
    if (!(Test-Path "jwt-authorizer")) {
        Write-Error "Directory 'jwt-authorizer' not found"
        return $false
    }
    
    Push-Location "jwt-authorizer"
    try {
        Write-Info "Installing production dependencies..."
        $installSuccess = Install-NodeModules "--production"
        if (-not $installSuccess) {
            Write-Error "Failed to install dependencies"
            return $false
        }
        
        Write-Info "Creating deployment package..."
        $outputPath = "../admin-portal-iac/lambda-packages/jwt-authorizer.zip"
        
        if (Test-Path $outputPath) {
            Remove-Item $outputPath -Force
        }
        
        $filesToExclude = @("*.test.js", "test\*", ".git\*", "node_modules\.cache\*", "coverage\*")
        $allFiles = Get-ChildItem -Recurse -File | Where-Object {
            $file = $_
            $shouldExclude = $false
            foreach ($pattern in $filesToExclude) {
                if ($file.FullName -like "*$($pattern.Replace('\', [System.IO.Path]::DirectorySeparatorChar))*") {
                    $shouldExclude = $true
                    break
                }
            }
            -not $shouldExclude
        }
        
        $allFiles | Compress-Archive -DestinationPath $outputPath -Force
        Write-Success "✅ jwt-authorizer built successfully"
        return $true
    }
    catch {
        Write-Error "Failed to build jwt-authorizer: $($_.Exception.Message)"
        return $false
    }
    finally {
        Pop-Location
    }
}

# Build service function
function Build-Service {
    param([string]$ServiceName)
    
    Write-Stage "Building Service: $ServiceName"
    
    # Ensure lambda-packages directory exists
    $packagesDir = "admin-portal-iac/lambda-packages"
    if (!(Test-Path $packagesDir)) {
        New-Item -ItemType Directory -Path $packagesDir -Force | Out-Null
        Write-Info "Created lambda-packages directory"
    }
    
    switch ($ServiceName) {
        "admin-portal-web-server" { return Build-AdminPortalWebServer }
        "admin-portal-be" { return Build-AdminPortalBe }
        "ims-service" { return Build-ImsService }
        "create-infra-worker" { return Build-CreateInfraWorker }
        "delete-infra-worker" { return Build-DeleteInfraWorker }
        "poll-infra-worker" { return Build-PollInfraWorker }
        "create-admin-worker" { return Build-CreateAdminWorker }
        "jwt-authorizer" { return Build-JwtAuthorizer }
        default {
            Write-Error "Unknown service: $ServiceName"
            return $false
        }
    }
}

# Deploy service function
function Deploy-Service {
    param([string]$ServiceName)
    
    Write-Stage "Deploying Service: $ServiceName"
    
    $zipPath = "admin-portal-iac/lambda-packages/$ServiceName.zip"
    
    if (!(Test-Path $zipPath)) {
        Write-Error "Deployment package not found: $zipPath"
        Write-Info "Please build the service first using: .\deploy-lambda.ps1 -Action build -Service $ServiceName"
        return $false
    }
    
    Write-Info "Deploying Lambda function: $ServiceName"
    
    # Switch to admin-portal-iac directory for terraform operations
    Push-Location "admin-portal-iac"
    try {
        # Set workspace
        Write-Info "Setting Terraform workspace to: $Workspace"
        terraform workspace select $Workspace
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Workspace '$Workspace' not found, creating it..."
            terraform workspace new $Workspace
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Failed to create workspace '$Workspace'"
                return $false
            }
        }
        
        # Update Lambda function code
        Write-Info "Updating Lambda function code..."
        $env:AWS_PROFILE = $AdminProfile
        
        try {
            $functionName = Get-LambdaFunctionName -ServiceName $ServiceName
            Write-Info "Using function name: $functionName"
            
            aws lambda update-function-code `
                --function-name "$functionName" `
                --zip-file "fileb://lambda-packages/$ServiceName.zip" `
                --region $Region
                
            if ($LASTEXITCODE -eq 0) {
                Write-Success "✅ $ServiceName deployed successfully"
                return $true
            } else {
                Write-Error "Failed to deploy $ServiceName"
                return $false
            }
        }
        catch {
            Write-Error "Failed to deploy ${Service}: $($_.Exception.Message)"
            return $false
        }
    }
    finally {
        Pop-Location
        Remove-Item Env:AWS_PROFILE -ErrorAction SilentlyContinue
    }
}

# Test service function
function Test-Service {
    param([string]$ServiceName)
    
    Write-Stage "Testing Service: $ServiceName"
    
    $env:AWS_PROFILE = $AdminProfile
    try {
        Write-Info "Getting function configuration..."
        $functionName = Get-LambdaFunctionName -ServiceName $ServiceName
        Write-Info "Using function name: $functionName"
        
        $functionInfo = aws lambda get-function-configuration `
            --function-name "$functionName" `
            --region $Region 2>$null
            
        if ($LASTEXITCODE -eq 0) {
            $config = $functionInfo | ConvertFrom-Json
            Write-Success "Function: $($config.FunctionName)"
            Write-Success "Runtime: $($config.Runtime)"
            Write-Success "Last Modified: $($config.LastModified)"
            Write-Success "State: $($config.State)"
            return $true
        } else {
            Write-Error "Function '$functionName' not found or not accessible"
            return $false
        }
    }
    catch {
        Write-Error "Failed to test ${ServiceName}: $($_.Exception.Message)"
        return $false
    }
    finally {
        Remove-Item Env:AWS_PROFILE -ErrorAction SilentlyContinue
    }
}

# Main execution
function Main {
    Write-Info "Multi-Tenant SaaS Platform - Lambda Deployment Script"
    Write-Info "Action: $Action, Service: $Service, Workspace: $Workspace, Profile: $AdminProfile"
    
    # Test prerequisites
    Test-Prerequisites
    
    switch ($Action) {
        "build" {
            $success = Build-Service -ServiceName $Service
            if (-not $success) {
                exit 1
            }
        }
        "deploy" {
            $success = Deploy-Service -ServiceName $Service
            if (-not $success) {
                exit 1
            }
        }
        "build-deploy" {
            Write-Info "Building and deploying $Service..."
            $buildSuccess = Build-Service -ServiceName $Service
            if (-not $buildSuccess) {
                Write-Error "Build failed, skipping deployment"
                exit 1
            }
            
            $deploySuccess = Deploy-Service -ServiceName $Service
            if (-not $deploySuccess) {
                exit 1
            }
        }
    }
    
    Write-Success "🎉 Operation completed successfully!"
}

# Execute main function
Main