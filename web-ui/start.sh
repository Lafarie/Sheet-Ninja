#!/bin/bash

# Google Sheets Manager - Quick Start Script
echo "🚀 Starting Google Sheets Manager..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "Download from: https://nodejs.org/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Navigate to the web-ui directory
cd "$(dirname "$0")"

echo "📂 Current directory: $(pwd)"

# Install dependencies if package.json exists and node_modules doesn't exist
if [ -f "package.json" ] && [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
fi

# Start the server
echo "🌐 Starting server..."
echo "📱 The application will be available at: http://localhost:3000"
echo "🛑 Press Ctrl+C to stop the server"
echo ""

# Use the production script for the HTML file
if [ -f "script-production.js" ]; then
    echo "🔄 Switching to production script..."
    cp script.js script-demo.js
    cp script-production.js script.js
fi

# Start the Node.js server
npm start

# Restore demo script when done
if [ -f "script-demo.js" ]; then
    echo "🔄 Restoring demo script..."
    cp script-demo.js script.js
    rm script-demo.js
fi
