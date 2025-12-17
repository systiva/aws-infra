#!/bin/bash

# OMS Service Lambda Package Builder
# Creates a deployment package for AWS Lambda

echo "==================================="
echo "OMS Service Lambda Package Builder"
echo "==================================="

# Configuration
SERVICE_DIR="$(pwd)"
PACKAGE_DIR="$SERVICE_DIR/package"
OUTPUT_DIR="$SERVICE_DIR/../admin-portal-iac/lambda-packages"
ZIP_FILE="oms-service.zip"

# Clean up previous builds
echo ""
echo "Step 1: Cleaning up previous builds..."
rm -rf "$PACKAGE_DIR"
rm -f "$OUTPUT_DIR/$ZIP_FILE"
mkdir -p "$PACKAGE_DIR"
mkdir -p "$OUTPUT_DIR"

# Copy source files
echo ""
echo "Step 2: Copying source files..."
cp -r src "$PACKAGE_DIR/"
cp app.js "$PACKAGE_DIR/"
cp index.js "$PACKAGE_DIR/"
cp config.js "$PACKAGE_DIR/"
cp logger.js "$PACKAGE_DIR/"
cp package.json "$PACKAGE_DIR/"

# Install production dependencies
echo ""
echo "Step 3: Installing production dependencies..."
cd "$PACKAGE_DIR"
npm install --production --quiet

# Create ZIP file
echo ""
echo "Step 4: Creating ZIP package..."
cd "$PACKAGE_DIR"
zip -r "$OUTPUT_DIR/$ZIP_FILE" . -q

# Clean up
echo ""
echo "Step 5: Cleaning up temporary files..."
cd "$SERVICE_DIR"
rm -rf "$PACKAGE_DIR"

# Get file size
FILESIZE=$(du -h "$OUTPUT_DIR/$ZIP_FILE" | cut -f1)

echo ""
echo "==================================="
echo "✅ Package created successfully!"
echo "==================================="
echo "Location: $OUTPUT_DIR/$ZIP_FILE"
echo "Size: $FILESIZE"
echo ""
echo "Next steps:"
echo "1. Navigate to admin-portal-iac directory"
echo "2. Run: terraform init"
echo "3. Run: terraform apply -var-file=environments/dev.tfvars"
echo ""
