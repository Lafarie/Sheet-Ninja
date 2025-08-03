#!/bin/bash

# GitLab ↔ Google Sheets Sync - Docker Deployment Script
# This script helps you deploy the application using Docker

set -e

echo "🚀 GitLab ↔ Google Sheets Sync - Docker Deployment"
echo "=================================================="
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

print_success "Docker and Docker Compose are installed"

# Create necessary directories
print_status "Creating directory structure..."
mkdir -p config logs uploads

# Check if .env file exists in config directory
if [ ! -f "config/.env" ]; then
    print_warning ".env file not found in config directory"
    print_status "Creating config/.env from .env.example..."
    
    if [ -f ".env.example" ]; then
        cp .env.example config/.env
        print_success "Created config/.env from .env.example"
        print_warning "Please edit config/.env with your actual configuration"
    else
        print_error ".env.example not found. Please create config/.env manually"
        exit 1
    fi
else
    print_success ".env file found in config directory"
fi

# Check if service_account.json exists
if [ ! -f "config/service_account.json" ]; then
    print_warning "service_account.json not found in config directory"
    print_status "Please place your Google Service Account JSON file in config/service_account.json"
    print_status "You can download it from Google Cloud Console"
    print_status "https://console.cloud.google.com/apis/credentials"
    echo
    print_warning "Continuing without service_account.json - you'll need to upload it via the UI"
else
    print_success "service_account.json found in config directory"
fi

# Build and start the container
print_status "Building Docker image..."
docker-compose build

print_status "Starting the application..."
docker-compose up -d

# Wait for the application to start
print_status "Waiting for application to start..."
sleep 10

# Check if the application is running
if curl -f http://localhost:5001/api/health &> /dev/null; then
    print_success "Application is running successfully!"
    echo
    echo "🌐 Access your application:"
    echo "   • Setup UI: http://localhost:8000/setup_ui.html"
    echo "   • API: http://localhost:5001"
    echo
    echo "📁 Configuration files:"
    echo "   • .env: ./config/.env"
    echo "   • service_account.json: ./config/service_account.json"
    echo
    echo "📋 Useful commands:"
    echo "   • View logs: docker-compose logs -f"
    echo "   • Stop: docker-compose down"
    echo "   • Restart: docker-compose restart"
    echo "   • Update: docker-compose pull && docker-compose up -d"
    echo
else
    print_error "Application failed to start. Check logs with: docker-compose logs"
    exit 1
fi 