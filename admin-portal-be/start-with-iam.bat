@echo off
echo Starting Admin Portal Backend with AWS DynamoDB...
echo.
echo Prerequisites:
echo 1. AWS CLI configured with appropriate credentials
echo 2. IAM permissions for DynamoDB access
echo 3. Network connectivity to AWS
echo 4. DynamoDB table 'admin-portal-dev-account-registry' exists in AWS
echo.

REM Check if AWS CLI is available
aws sts get-caller-identity >nul 2>&1
if errorlevel 1 (
    echo ERROR: AWS CLI not configured or no valid credentials found
    echo Please run 'aws configure' or set AWS environment variables
    pause
    exit /b 1
)

echo AWS Credentials validated successfully
aws sts get-caller-identity
echo.

REM Check if DynamoDB table exists
echo Checking if DynamoDB table 'admin-portal-dev-account-registry' exists...
aws dynamodb describe-table --table-name admin-portal-dev-account-registry --region us-east-1 >nul 2>&1
if errorlevel 1 (
    echo WARNING: Table 'admin-portal-dev-account-registry' not found in DynamoDB
    echo Please ensure the table exists in your AWS account
    echo.
) else (
    echo Table 'admin-portal-dev-account-registry' found successfully
    echo.
)

REM Set environment variables
set ENV=local
set AWS_DEFAULT_REGION=us-east-1
set PORT=8080

echo Starting server on port %PORT%...
echo Using AWS region: %AWS_DEFAULT_REGION%
echo Connecting to AWS DynamoDB (NOT local DynamoDB)
echo.

npm run local