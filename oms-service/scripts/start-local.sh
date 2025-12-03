#!/bin/bash

echo "Starting OMS Service locally..."

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Start the server
node server.js
