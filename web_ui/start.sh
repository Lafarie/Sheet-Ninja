#!/bin/bash

# Start script for GitLab ↔ Google Sheets Sync Web UI
# This script sets up and runs the Flask web application

set -e  # Exit on any error

echo "🚀 Starting GitLab ↔ Google Sheets Sync Web UI"
echo "================================================"

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "📁 Project root: $PROJECT_ROOT"
echo "🌐 Web UI directory: $SCRIPT_DIR"

# Check if virtual environment exists
VENV_DIR="$PROJECT_ROOT/venv"
if [ ! -d "$VENV_DIR" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
fi

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source "$VENV_DIR/bin/activate"

# Install/upgrade pip
echo "📦 Updating pip..."
pip install --upgrade pip

# Install requirements
echo "📦 Installing requirements..."
pip install -r "$SCRIPT_DIR/requirements.txt"

# Check if .env file exists
ENV_FILE="$PROJECT_ROOT/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "⚠️  No .env file found. Creating from template..."
    if [ -f "$PROJECT_ROOT/env.example" ]; then
        cp "$PROJECT_ROOT/env.example" "$ENV_FILE"
        echo "📋 Please edit $ENV_FILE with your actual configuration values"
    else
        echo "❌ No env.example template found"
    fi
fi

# Check if service account file exists
SERVICE_ACCOUNT_FILE="$PROJECT_ROOT/service_account.json"
if [ ! -f "$SERVICE_ACCOUNT_FILE" ]; then
    echo "⚠️  No service_account.json found"
    echo "💡 Please download your Google Service Account key and place it at:"
    echo "   $SERVICE_ACCOUNT_FILE"
fi

# Set Flask environment variables
export FLASK_APP="$SCRIPT_DIR/app.py"
export FLASK_ENV="development"
export FLASK_DEBUG="1"

echo ""
echo "✅ Setup complete!"
echo ""
echo "🌐 Starting web server..."
echo "📱 The web interface will be available at:"
echo "   Local:    http://localhost:5001"
echo "   Network:  http://$(hostname -I | awk '{print $1}'):5001"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Change to the web UI directory and start the Flask app
cd "$SCRIPT_DIR"
python app.py
