# Installation & Setup Guide

This guide will help you set up the GitLab ↔ Google Sheets Sync tool with the new Web UI.

## 🎯 Quick Start (Recommended)

### Option 1: Web UI (Easiest)
```bash
# From the project root directory
python demo.py
```

This will:
- Set up a virtual environment
- Install all dependencies
- Launch the web interface
- Open your browser automatically

### Option 2: Direct Web UI Launch
```bash
cd web_ui
python run.py
```

## 📋 Prerequisites

### Required Software
- **Python 3.7+** (Check with `python --version`)
- **Git** (for cloning the repository)
- **Web browser** (Chrome, Firefox, Safari, etc.)

### Required Accounts & Access
1. **GitLab Account** with:
   - Access to your project
   - Permission to create personal access tokens

2. **Google Account** with:
   - Access to Google Sheets
   - Permission to create Google Cloud projects

## 🔧 Detailed Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd scripts
```

### 2. Set Up GitLab Access

1. **Get your GitLab Personal Access Token:**
   - Go to GitLab → User Settings → Access Tokens
   - Create new token with `api` scope
   - Copy the token (save it securely!)

2. **Find your Project ID:**
   - Go to your GitLab project
   - Look in Settings → General → Project ID

### 3. Set Up Google Sheets Access

1. **Create a Google Cloud Project:**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select existing one

2. **Enable Google Sheets API:**
   - In the Cloud Console, go to APIs & Services → Library
   - Search for "Google Sheets API" and enable it

3. **Create Service Account:**
   - Go to APIs & Services → Credentials
   - Click "Create Credentials" → "Service Account"
   - Fill in the details and create
   - Click on the created service account
   - Go to "Keys" tab → "Add Key" → "Create New Key" → JSON
   - Download the JSON file and save as `service_account.json` in the project root

4. **Share Your Google Sheet:**
   - Open your Google Sheet
   - Click "Share" button
   - Add the service account email (from the JSON file) with "Editor" permissions
   - Copy the Spreadsheet ID from the URL

### 4. Launch the Web UI

```bash
# Option 1: Demo launcher (recommended)
python demo.py

# Option 2: Direct launch
cd web_ui
python run.py

# Option 3: Shell script (Linux/macOS)
cd web_ui
./start.sh
```

### 5. Configure via Web Interface

1. **Open Browser:** Go to http://localhost:5000
2. **Configuration:** Click "Configuration" and fill in:
   - GitLab token and URL
   - Google Sheets ID and service account file path
   - Default settings for new issues
3. **Test Connections:** Use the "Test" page to verify everything works
4. **Column Mapping:** Configure how data maps between GitLab and Sheets
5. **Start Syncing:** Use the "Sync" page to perform synchronization

## 🛠️ Manual Installation (Alternative)

If the automatic setup doesn't work:

### 1. Create Virtual Environment
```bash
python3 -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate
```

### 2. Install Dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Set Up Configuration
```bash
# Copy template
cp env.example .env

# Edit with your values
nano .env  # Linux/macOS
notepad .env  # Windows
```

### 4. Run the Application
```bash
cd web_ui
python app.py
```

## 🔍 Troubleshooting

### Common Issues

**1. "Permission denied" on start.sh**
```bash
chmod +x web_ui/start.sh
```

**2. "Port 5000 already in use"**
- Edit `web_ui/app.py` and change the port:
```python
app.run(debug=True, host='0.0.0.0', port=5001)
```

**3. "Module not found" errors**
- Make sure you're in the right directory
- Check that virtual environment is activated
- Reinstall dependencies: `pip install -r requirements.txt`

**4. Google Sheets "Permission denied"**
- Make sure you shared the sheet with the service account email
- Verify the service account JSON file is in the right location
- Check that Google Sheets API is enabled in Google Cloud Console

**5. GitLab "401 Unauthorized"**
- Verify your GitLab token is correct
- Check that the token has 'api' scope
- Ensure the GitLab URL includes '/api/v4/' at the end

### Getting Help

1. **Check the Web UI Test page** - It provides detailed diagnostics
2. **Review the sync output logs** - They show exactly what's happening
3. **Use the built-in troubleshooting guides** - Available in the web interface

## 🎯 Next Steps

Once everything is set up:

1. **Test your connections** using the Test page
2. **Configure column mappings** to match your sheet structure
3. **Run a small test sync** to verify everything works
4. **Set up regular syncing** as needed

## 📁 File Structure

After setup, your project should look like:
```
scripts/
├── .env                    # Your configuration (don't commit!)
├── service_account.json    # Google credentials (don't commit!)
├── config.py              # Configuration loader
├── column_manager.py       # Column mapping tools
├── sheets_to_gitlab.py     # Sync logic
├── gitlab_to_sheets.py     # Sync logic
├── demo.py                 # Web UI launcher
├── web_ui/                 # Web interface
│   ├── app.py             # Flask application
│   ├── run.py             # Launcher script
│   ├── start.sh           # Shell script launcher
│   └── templates/         # HTML templates
└── venv/                   # Virtual environment
```

Enjoy your new web-based GitLab ↔ Google Sheets sync tool! 🚀
