# 🐳 Docker Deployment Guide

This guide will help you deploy the GitLab ↔ Google Sheets Sync application using Docker.

## 📋 Prerequisites

- Docker installed on your system
- Docker Compose installed
- GitLab API token
- Google Service Account credentials

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd <your-repo-directory>
```

### 2. Run the Deployment Script
```bash
./deploy.sh
```

This script will:
- ✅ Check Docker installation
- ✅ Create necessary directories
- ✅ Set up configuration files
- ✅ Build and start the container
- ✅ Verify the application is running

## 📁 Directory Structure

After running the deployment script, you'll have this structure:

```
your-project/
├── config/
│   ├── .env                    # Environment configuration
│   └── service_account.json    # Google Service Account credentials
├── logs/                       # Application logs
├── uploads/                    # File uploads
├── Dockerfile                  # Docker configuration
├── docker-compose.yml          # Docker Compose configuration
├── deploy.sh                   # Deployment script
└── ... (other project files)
```

## ⚙️ Manual Configuration

### 1. Create Configuration Directory
```bash
mkdir -p config logs uploads
```

### 2. Set Up Environment File
```bash
# Copy the example environment file
cp .env.example config/.env

# Edit with your actual values
nano config/.env
```

### 3. Add Google Service Account
```bash
# Place your service_account.json in the config directory
cp /path/to/your/service_account.json config/service_account.json
```

## 🔧 Configuration Files

### Environment File (`config/.env`)

```env
# GitLab Configuration
GITLAB_TOKEN=your_gitlab_token_here
GITLAB_URL=https://sourcecontrol.hsenidmobile.com/api/v4/
PROJECT_ID=263

# Google Sheets Configuration
SPREADSHEET_ID=your_spreadsheet_id_here
WORKSHEET_NAME=Sheet1
SERVICE_ACCOUNT_FILE=service_account.json

# GitLab Issue Settings
DEFAULT_ASSIGNEE=@username
DEFAULT_MILESTONE=%milestone_name
DEFAULT_DUE_DATE=
DEFAULT_LABEL=~label_name

# Date Range Filter Settings
ENABLE_DATE_FILTER=false
START_DATE=
END_DATE=

# Task Closing Settings
ENABLE_AUTO_CLOSE=true

# Service Account Link Configuration
SERVICE_ACCOUNT_LINK=https://github.com/Lafarie/scripts/tree/v2?tab=readme-ov-file#3-set-up-google-service-account

# Server Configuration (for deployment)
API_SERVER_URL=http://localhost:5001
UI_SERVER_URL=http://localhost:8000
```

### Google Service Account (`config/service_account.json`)

Download from [Google Cloud Console](https://console.cloud.google.com/apis/credentials) and place in `config/service_account.json`.

## 🐳 Docker Commands

### Build the Image
```bash
docker-compose build
```

### Start the Application
```bash
docker-compose up -d
```

### View Logs
```bash
# All logs
docker-compose logs -f

# Specific service logs
docker-compose logs -f gitlab-sheets-sync
```

### Stop the Application
```bash
docker-compose down
```

### Restart the Application
```bash
docker-compose restart
```

### Update the Application
```bash
docker-compose pull
docker-compose up -d
```

## 🌐 Access the Application

Once running, access your application at:

- **Setup UI**: http://localhost:8000/setup_ui.html
- **API**: http://localhost:5001

## 🔍 Troubleshooting

### Container Won't Start
```bash
# Check container status
docker-compose ps

# View detailed logs
docker-compose logs gitlab-sheets-sync

# Check if ports are available
netstat -tulpn | grep :5001
netstat -tulpn | grep :8000
```

### Permission Issues
```bash
# Fix file permissions
sudo chown -R $USER:$USER config/ logs/ uploads/

# Make deployment script executable
chmod +x deploy.sh
```

### Configuration Issues
```bash
# Verify .env file exists
ls -la config/.env

# Check service account file
ls -la config/service_account.json

# Validate JSON syntax
python -m json.tool config/service_account.json
```

### Health Check Failing
```bash
# Check if API is responding
curl http://localhost:5001/api/config

# Check container health
docker inspect gitlab-sheets-sync | grep Health -A 10
```

## 🔒 Security Considerations

### File Permissions
- The container runs as a non-root user (`appuser`)
- Configuration files are mounted as read-only (`:ro`)
- Sensitive files are excluded from the Docker image

### Network Security
- Only necessary ports are exposed (5001, 8000)
- Internal network isolation with Docker networks
- Health checks ensure service availability

### Environment Variables
- Sensitive data is stored in external `.env` file
- No secrets are baked into the Docker image
- Environment variables are properly escaped

## 📊 Monitoring

### Health Checks
The container includes health checks that verify:
- API endpoint availability
- Service responsiveness
- Container status

### Logs
- Application logs are persisted to `./logs/`
- Docker logs are available via `docker-compose logs`
- Log rotation is handled by Docker

## 🔄 Updates and Maintenance

### Update Application
```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Backup Configuration
```bash
# Backup configuration files
tar -czf backup-$(date +%Y%m%d).tar.gz config/ logs/
```

### Clean Up
```bash
# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# Remove unused networks
docker network prune
```

## 🚀 Production Deployment

For production deployment, consider:

1. **Reverse Proxy**: Use nginx or Apache as reverse proxy
2. **SSL/TLS**: Enable HTTPS with Let's Encrypt
3. **Load Balancer**: For high availability
4. **Monitoring**: Add Prometheus/Grafana monitoring
5. **Backup**: Regular backups of configuration and data

### Example Production docker-compose.yml
```yaml
version: '3.8'

services:
  gitlab-sheets-sync:
    build: .
    container_name: gitlab-sheets-sync
    ports:
      - "127.0.0.1:5001:5001"  # Bind to localhost only
      - "127.0.0.1:8000:8000"  # Bind to localhost only
    volumes:
      - ./config/.env:/app/.env:ro
      - ./config/service_account.json:/app/service_account.json:ro
      - ./logs:/app/logs
      - ./uploads:/app/uploads
    environment:
      - PYTHONUNBUFFERED=1
    restart: unless-stopped
    networks:
      - internal

  nginx:
    image: nginx:alpine
    container_name: nginx-proxy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - gitlab-sheets-sync
    networks:
      - internal
      - external

networks:
  internal:
    driver: bridge
  external:
    driver: bridge
```

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review the logs: `docker-compose logs -f`
3. Verify configuration files
4. Check Docker and Docker Compose versions
5. Ensure all prerequisites are met

## 📝 Changelog

- **v1.0.0**: Initial Docker support
- Multi-stage build for optimized images
- External configuration mounting
- Health checks and monitoring
- Security hardening with non-root user 