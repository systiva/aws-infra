# Multi-Tenant POC - Serverless SaaS Platform

A proof-of-concept demonstrating a serverless multi-tenant SaaS platform built on AWS. This system supports both **public** (shared infrastructure) and **private** (dedicated infrastructure) tenancy models with automated provisioning and management workflows.

## 📁 Project Structure

```
multi-tenant-poc/
├── admin-portal-be/          # Backend API services
├── admin-portal-fe/          # React frontend application  
├── admin-portal-iac/         # Infrastructure as Code (Terraform)
├── admin-portal-web-server/  # Lambda web server for hosting frontend
├── create-infra-worker/      # Lambda function for creating tenant infrastructure
├── delete-infra-worker/      # Lambda function for deleting tenant infrastructure
├── poll-infra-worker/        # Lambda function for monitoring infrastructure status
└── README.md                 # This file
```

##  Component Responsibilities

###  Frontend & Backend

#### **admin-portal-fe/**
- **Technology**: React 19 + TypeScript + React Router
- **Purpose**: Web-based admin interface for tenant management
- **Key Features**:
  - Tenant creation and deletion workflows
  - Real-time status monitoring
  - User authentication and session management
  - Responsive UI for tenant operations
- **Build Output**: Static files deployed to Lambda via admin-portal-web-server

#### **admin-portal-be/**
- **Technology**: Node.js + Express + AWS SDK
- **Purpose**: REST API backend providing business logic and data access
- **Key Features**:
  - Tenant CRUD operations
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
  - DynamoDB tables (tenant registry, public tenants)
  - Step Functions state machines
  - IAM roles and security groups
  - S3 buckets for deployment artifacts
- **Environments**: Support for dev/prod with separate tfvars files

### ⚙️ Worker Functions (Lambda)

#### **create-infra-worker/**
- **Technology**: Node.js + AWS SDK + Cross-Account Services
- **Purpose**: Provisions tenant infrastructure based on subscription tier
- **Responsibilities**:
  - **Public Tenants**: Creates entries in shared TENANT_PUBLIC DynamoDB table
  - **Private Tenants**: Deploys dedicated CloudFormation stack in tenant account
  - **Cross-Account**: Assumes IAM roles in tenant accounts for resource creation
  - **Registry Updates**: Updates tenant status in admin account registry
- **Workflow**: Triggered by Step Functions during tenant creation

#### **delete-infra-worker/**
- **Technology**: Node.js + AWS SDK + Cross-Account Services  
- **Purpose**: Deprovisions tenant infrastructure and performs cleanup
- **Responsibilities**:
  - **Public Tenants**: Removes tenant entries from TENANT_PUBLIC table
  - **Private Tenants**: Deletes CloudFormation stack from tenant account
  - **Registry Cleanup**: Updates tenant status to 'deleted' in admin registry
  - **Cross-Account**: Uses assumed roles for safe resource deletion
- **Workflow**: Triggered by Step Functions during tenant deletion

#### **poll-infra-worker/**
- **Technology**: Node.js + AWS SDK + CloudFormation Polling
- **Purpose**: Monitors infrastructure deployment/deletion status
- **Responsibilities**:
  - **Public Tenants**: Immediate completion (no CloudFormation polling needed)
  - **Private Tenants**: Polls CloudFormation stack status until completion
  - **Status Updates**: Real-time tenant registry updates with operation progress
  - **Operation Awareness**: Handles both CREATE and DELETE operations correctly
  - **Timeout Handling**: Manages polling limits and failure scenarios
- **Workflow**: Continuously polls until infrastructure operations complete

## 🏢 Tenancy Models

### 🌐 Public Tenants (Shared Infrastructure)
- **Data Isolation**: Logical separation using tenant ID within shared table
- **Infrastructure**: Single shared DynamoDB table (TENANT_PUBLIC)
- **Cost Model**: Lower cost due to shared resources
- **Provisioning Time**: Instant (simple table entry creation)
- **Managed By**: create-infra-worker and delete-infra-worker

### 🔒 Private Tenants (Dedicated Infrastructure)  
- **Data Isolation**: Physical separation with completely dedicated resources
- **Infrastructure**: Dedicated DynamoDB tables, API Gateway, Lambda functions per tenant
- **Cost Model**: Higher cost due to dedicated AWS resources
- **Provisioning Time**: 5-10 minutes (CloudFormation stack deployment)
- **Managed By**: CloudFormation stacks in separate tenant AWS accounts

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
- `TENANT_REGISTRY_TABLE`: DynamoDB table for tenant metadata
- `TENANT_PUBLIC_TABLE`: Shared table for public tenant data
- `CROSS_ACCOUNT_ROLE_ARN`: IAM role for tenant account access
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
