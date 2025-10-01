@echo off

REM Set fake AWS credentials for DynamoDB Local
set AWS_ACCESS_KEY_ID=fake
set AWS_SECRET_ACCESS_KEY=fake
set AWS_DEFAULT_REGION=us-east-1

REM Set environment for the Node.js app
set ENV=local

echo 🔧 Environment variables set for DynamoDB Local development
echo    AWS_ACCESS_KEY_ID: %AWS_ACCESS_KEY_ID%
echo    AWS_SECRET_ACCESS_KEY: %AWS_SECRET_ACCESS_KEY%
echo    AWS_DEFAULT_REGION: %AWS_DEFAULT_REGION%
echo    ENV: %ENV%
echo.

REM Run the Node.js application
node ./app.js | npx pino-pretty
