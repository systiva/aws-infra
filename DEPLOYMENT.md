# Multi-Account SaaS Platform - Deployment Guide

## Prerequisites

### Required Tools
- **Terraform** >= 1.5.0
- **AWS CLI** >= 2.0
- **Node.js** >= 18.x
- **npm** >= 9.x
- **Git**
- **PowerShell** (Windows) or **Bash** (Linux/macOS)

### AWS Account Setup
1. **Admin Account**: Central account for admin portal and cross-account management
2. **Account Account(s)**: Separate accounts for account-specific resources
3. **IAM Roles**: Cross-account roles configured for admin access to account accounts

### Environment Variables
```bash
export AWS_REGION=us-east-1
export AWS_ADMIN_PROFILE=admin-profile-name
export AWS_ACCOUNT_PROFILE=account-profile-name
export TERRAFORM_WORKSPACE=dev
```

## Deployment Steps

### Step 1: Configure AWS Profiles

Configure separate AWS profiles for admin and account accounts:

```bash
# Configure admin profile
aws configure --profile admin-profile-name
AWS Access Key ID: [Admin Account Access Key]
AWS Secret Access Key: [Admin Account Secret Key]
Default region name: us-east-1
Default output format: json

# Configure account profile  
aws configure --profile account-profile-name
AWS Access Key ID: [Account Account Access Key]
AWS Secret Access Key: [Account Account Secret Key]
Default region name: us-east-1
Default output format: json
```

### Step 2: Deploy Admin Infrastructure

#### 2.1 Bootstrap Admin Infrastructure
```bash
./cicd.sh admin-bootstrap \
  --workspace=dev \
  --aws-account=583122682394 \
  --admin-profile=admin
```

#### 2.2 Plan Admin Infrastructure
```bash
./cicd.sh admin-plan \
  --workspace=dev \
  --aws-account=583122682394 \
  --admin-profile=admin
```

#### 2.3 Apply Admin Infrastructure
```bash
./cicd.sh admin-apply \
  --workspace=dev \
  --aws-account=583122682394 \
  --admin-profile=admin
```

### Step 3: Deploy Account Infrastructure

#### 3.1 Bootstrap Account Infrastructure
```bash
./cicd.sh account-bootstrap \
  --workspace=dev \
  --aws-account=560261045252 \
  --admin-account=583122682394 \
  --account-profile=account
```

#### 3.2 Plan Account Infrastructure
```bash
./cicd.sh account-plan \
  --workspace=dev \
  --aws-account=560261045252 \
  --admin-account=583122682394 \
  --account-profile=account
```

#### 3.3 Apply Account Infrastructure
```bash
./cicd.sh account-apply \
  --workspace=dev \
  --aws-account=560261045252 \
  --admin-account=583122682394 \
  --account-profile=account
```

### Step 4: Deploy Services

#### 4.1 Build and Deploy React Frontend
```bash
# Build the frontend
./cicd.sh build --service=admin-portal-fe

# Deploy the frontend
./cicd.sh deploy \
  --service=admin-portal-fe \
  --workspace=dev \
  --admin-profile=admin

# Test the deployment
# ./cicd.sh test --service=admin-portal-fe
```

#### 4.2 Build and Deploy Lambda Functions
```bash
# Build and deploy admin-portal-web-server
#./cicd.sh build --service=admin-portal-web-server
./cicd.sh deploy \
  --service=admin-portal-web-server \
  --workspace=dev \
  --admin-profile=admin

# Build and deploy admin-portal-be
#./cicd.sh build --service=admin-portal-be
./cicd.sh deploy \
  --service=admin-portal-be \
  --workspace=dev \
  --admin-profile=admin

# Build and deploy ims-service
#./cicd.sh build --service=ims-service
./cicd.sh deploy \
  --service=ims-service \
  --workspace=dev \
  --admin-profile=admin

# Build and deploy create-infra-worker
#./cicd.sh build --service=create-infra-worker
./cicd.sh deploy \
  --service=create-infra-worker \
  --workspace=dev \
  --admin-profile=admin

# Build and deploy delete-infra-worker
#./cicd.sh build --service=delete-infra-worker
./cicd.sh deploy \
  --service=delete-infra-worker \
  --workspace=dev \
  --admin-profile=admin

# Build and deploy poll-infra-worker
#./cicd.sh build --service=poll-infra-worker
./cicd.sh deploy \
  --service=poll-infra-worker \
  --workspace=dev \
  --admin-profile=admin

# Build and deploy create-admin-worker
#./cicd.sh build --service=create-admin-worker
./cicd.sh deploy \
  --service=create-admin-worker \
  --workspace=dev \
  --admin-profile=admin

# Build and deploy create-admin-worker
#./cicd.sh build --service=create-admin-worker
./cicd.sh deploy \
  --service=setup-rbac-worker \
  --workspace=dev \
  --admin-profile=admin

# Build and deploy jwt-authorizer
#./cicd.sh build --service=jwt-authorizer
./cicd.sh deploy \
  --service=jwt-authorizer \
  --workspace=dev \
  --admin-profile=admin

# Build and deploy jwt-authorizer
#./cicd.sh build --service=oms-service
./cicd.sh deploy \
  --service=oms-service \
  --workspace=dev \
  --admin-profile=admin

# Build individual Lambda functions using Powershell 
.\deploy-lambda.ps1 -Action build -Service admin-portal-web-server
.\deploy-lambda.ps1 -Action build -Service admin-portal-be
.\deploy-lambda.ps1 -Action build -Service ims-service
.\deploy-lambda.ps1 -Action build -Service create-infra-worker
.\deploy-lambda.ps1 -Action build -Service delete-infra-worker
.\deploy-lambda.ps1 -Action build -Service poll-infra-worker
.\deploy-lambda.ps1 -Action build -Service create-admin-worker
.\deploy-lambda.ps1 -Action build -Service jwt-authorizer