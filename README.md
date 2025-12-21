# Multi-Account POC - Serverless SaaS Platform

A proof-of-concept demonstrating a serverless multi-account SaaS platform built on AWS. This system supports both **public** (shared infrastructure) and **private** (dedicated infrastructure) tenancy models with automated provisioning and management workflows.

## 📁 Project Structure

```
multi-account-poc/
├── admin-portal-be/          # Backend API services
├── admin-portal-fe/          # React frontend application  
├── admin-portal-iac/         # Infrastructure as Code (Terraform)
├── admin-portal-web-server/  # Lambda web server for hosting frontend
├── create-infra-worker/      # Lambda function for creating account infrastructure
├── delete-infra-worker/      # Lambda function for deleting account infrastructure
├── poll-infra-worker/        # Lambda function for monitoring infrastructure status
└── README.md                 # This file
```

##  Component Responsibilities

###  Frontend & Backend

#### **admin-portal-fe/**
- **Technology**: React 19 + TypeScript + React Router
- **Purpose**: Web-based admin interface for account management
- **Key Features**:
  - Account creation and deletion workflows
  - Real-time status monitoring
  - User authentication and session management
  - Responsive UI for account operations
- **Build Output**: Static files deployed to Lambda via admin-portal-web-server

#### **admin-portal-be/**
- **Technology**: Node.js + Express + AWS SDK
- **Purpose**: REST API backend providing business logic and data access
- **Key Features**:
  - Account CRUD operations
  - Step Functions workflow orchestration
  - DynamoDB data access layer
  - Cross-account IAM role management
- **Deployment**: Lambda function with API Gateway integration

#### **admin-portal-web-server/**
- **Technology**: Node.js Lambda + AWS Lambda Function URLs
- **Purpose**: Serves the React frontend as a static website
- **Key Features**:
  - Single Lambda function hosting complete React SPA
  - Function URL for direct web access
  - Static asset serving with proper MIME types
- **Integration**: Hosts the built output from admin-portal-fe

### 🔧 Infrastructure & Orchestration

#### **admin-portal-iac/**
- **Technology**: Terraform + AWS Provider
- **Purpose**: Infrastructure as Code for complete AWS resource provisioning
- **Key Resources**:
  - VPC with public/private subnets and NAT gateways
  - Lambda functions for all workers and web server
  - DynamoDB tables (account registry, public accounts)
  - Step Functions state machines
  - IAM roles and security groups
  - S3 buckets for deployment artifacts
- **Environments**: Support for dev/prod with separate tfvars files

### ⚙️ Worker Functions (Lambda)

#### **create-infra-worker/**
- **Technology**: Node.js + AWS SDK + Cross-Account Services
- **Purpose**: Provisions account infrastructure based on subscription tier
- **Responsibilities**:
  - **Public Accounts**: Creates entries in shared ACCOUNT_PUBLIC DynamoDB table
  - **Private Accounts**: Deploys dedicated CloudFormation stack in account account
  - **Cross-Account**: Assumes IAM roles in account accounts for resource creation
  - **Registry Updates**: Updates account status in admin account registry
- **Workflow**: Triggered by Step Functions during account creation

#### **delete-infra-worker/**
- **Technology**: Node.js + AWS SDK + Cross-Account Services  
- **Purpose**: Deprovisions account infrastructure and performs cleanup
- **Responsibilities**:
  - **Public Accounts**: Removes account entries from ACCOUNT_PUBLIC table
  - **Private Accounts**: Deletes CloudFormation stack from account account
  - **Registry Cleanup**: Updates account status to 'deleted' in admin registry
  - **Cross-Account**: Uses assumed roles for safe resource deletion
- **Workflow**: Triggered by Step Functions during account deletion

#### **poll-infra-worker/**
- **Technology**: Node.js + AWS SDK + CloudFormation Polling
- **Purpose**: Monitors infrastructure deployment/deletion status
- **Responsibilities**:
  - **Public Accounts**: Immediate completion (no CloudFormation polling needed)
  - **Private Accounts**: Polls CloudFormation stack status until completion
  - **Status Updates**: Real-time account registry updates with operation progress
  - **Operation Awareness**: Handles both CREATE and DELETE operations correctly
  - **Timeout Handling**: Manages polling limits and failure scenarios
- **Workflow**: Continuously polls until infrastructure operations complete

## 🏢 Tenancy Models

### 🌐 Public Accounts (Shared Infrastructure)
- **Data Isolation**: Logical separation using account ID within shared table
- **Infrastructure**: Single shared DynamoDB table (ACCOUNT_PUBLIC)
- **Cost Model**: Lower cost due to shared resources
- **Provisioning Time**: Instant (simple table entry creation)
- **Managed By**: create-infra-worker and delete-infra-worker

### 🔒 Private Accounts (Dedicated Infrastructure)  
- **Data Isolation**: Physical separation with completely dedicated resources
- **Infrastructure**: Dedicated DynamoDB tables, API Gateway, Lambda functions per account
- **Cost Model**: Higher cost due to dedicated AWS resources
- **Provisioning Time**: 5-10 minutes (CloudFormation stack deployment)
- **Managed By**: CloudFormation stacks in separate account AWS accounts

## 🚀 Getting Started

### Prerequisites
- **AWS CLI** v2.28.21+ with profiles configured
- **Terraform** v1.5+
- **Node.js** v18+ and npm
- **PowerShell** 5.1+ (Windows) or PowerShell Core 7+ (Cross-platform)

### Quick Deployment

1. **Deploy Infrastructure**
   ```powershell
   cd admin-portal-iac
   terraform init -backend-config="backend-dev.conf"
   terraform apply -var-file="environments\dev.tfvars"
   ```

2. **Build Frontend** 
   ```powershell
   cd admin-portal-fe
   npm install
   npm run build:prod
   ```

3. **Install Backend Dependencies**
   ```powershell
   cd admin-portal-be
   npm install
   ```

4. **Install Worker Dependencies**
   ```powershell
   # Install for each worker
   cd create-infra-worker && npm install
   cd delete-infra-worker && npm install  
   cd poll-infra-worker && npm install
   ```

### Configuration

Key environment variables managed by Terraform:
- `ACCOUNT_REGISTRY_TABLE`: DynamoDB table for account metadata
- `ACCOUNT_PUBLIC_TABLE`: Shared table for public account data
- `CROSS_ACCOUNT_ROLE_ARN`: IAM role for account account access
- `STEP_FUNCTIONS_ARN`: Step Functions state machine for orchestration

##  Development & Testing

### Local Development
```powershell
# Frontend development server
cd admin-portal-fe
npm start

# Backend with local testing
cd admin-portal-be  
npm run start:local

# Test individual worker functions
cd create-infra-worker
node index.js
```
