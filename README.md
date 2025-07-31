# GitLab ↔ Google Sheets Sync Scripts

Scripts to sync GitLab issues with Google Sheets using Service Account authentication and environment variables for secure configuration.

## ✨ New Features

### � Dynamic Column Management
- **Flexible column mapping** that adapts to sheet changes
- **Auto-detection** of column positions and headers
- **Interactive configuration** tool for custom setups
- **Validation** to ensure everything works correctly

### 🎯 Quick Setup Tool
Run `python quick_setup.py` for guided setup and configuration management.

## �🚀 Quick Setup

### 1. One-Command Setup
```bash
# Install dependencies and run guided setup
pip install -r requirements.txt
python quick_setup.py
```

### 2. Manual Setup

#### Install Dependencies
```bash
pip install -r requirements.txt
```

#### Environment Variables Setup
```bash
# Copy the template
cp env.example .env

# Edit .env with your actual values
notepad .env  # Windows
nano .env     # Linux/Mac
```

Fill in your `.env` file with:
```env
# Required Values
GITLAB_TOKEN=your-gitlab-token-here
SPREADSHEET_ID=your-google-sheet-id-here

# Optional Values (have defaults)
GITLAB_URL=https://sourcecontrol.hsenidmobile.com/api/v4/
PROJECT_ID=263
WORKSHEET_NAME=Sheet1
SERVICE_ACCOUNT_FILE=service_account.json
DEFAULT_ASSIGNEE=@your.email@company.com
```

#### Column Configuration
```bash
# Configure your Google Sheet columns dynamically
python column_manager.py

# Choose option 1 for auto-detection
# Choose option 2 for interactive setup
```

### 3. Set up Google Service Account

**Step 3.1: Create Service Account**
- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Create a new project or select an existing one
- Enable the Google Sheets API:
  - Go to APIs & Services → Library
  - Search for "Google Sheets API" and enable it
- Create Service Account credentials:
  - Go to APIs & Services → Credentials
  - Click "Create Credentials" → "Service Account"
  - Fill in service account details and click "Create"
  - Skip optional steps and click "Done"

**Step 3.2: Download Credentials**
- Click on the created service account
- Go to "Keys" tab → "Add Key" → "Create new key"
- Choose "JSON" format and download the file
- Rename the file to `service_account.json`
- Place it in the same directory as your scripts

**Step 3.3: Share Google Sheet with Service Account**
- Open your Google Sheet
- Click "Share" button
- Add the service account email (found in the JSON file as `client_email`)
- Give it "Editor" permission
- Click "Send"

### 4. Get GitLab Personal Access Token
- Go to your GitLab instance → User Settings → Access Tokens
- Create a new personal access token with `api` scope
- Copy the token and add it to your `.env` file

### 5. Test the Setup
```bash
python gitlab_to_sheets.py
```

## 🔧 Usage

### Quick Start (Recommended)
```bash
# Guided setup and management
python quick_setup.py
```

### Column Management
```bash
# Auto-detect and configure columns
python column_manager.py

# Options available:
# 1. Auto-detect columns from your sheet
# 2. Interactive column setup
# 3. Validate current configuration
# 4. Export/import configurations
```

### Sync Operations
```bash
# Sync GitLab → Google Sheets
python gitlab_to_sheets.py

# Sync Google Sheets → GitLab
python sheets_to_gitlab.py

# Complete Bidirectional Sync
python complete_sync.py
```

### Sheet Setup
```bash
# Setup dropdowns and formatting
python setup/setup_sheet_dropdown.py
```

## 🔄 Dynamic Column System

### Key Features
- **Adaptive**: Automatically adapts to column position changes
- **Auto-detection**: Finds columns by header names
- **Validation**: Checks configuration against actual sheet
- **Interactive**: Step-by-step configuration wizard

### Column Configuration
The system stores column mappings in `custom_columns.json`:
```json
{
  "PROJECT_NAME": {
    "index": 3,
    "header": "Project Name",
    "required": true,
    "data_type": "dropdown"
  }
}
```

### When Columns Change
1. Run `python column_manager.py`
2. Choose "Auto-detect and map columns"
3. Review and apply suggested mappings
4. Validate the new configuration

### Migration from Fixed Columns
If upgrading from the old system:
1. Backup your sheet
2. Run `python column_manager.py`
3. Use auto-detection
4. Test with a small dataset first

📚 **Detailed Guide**: See [DYNAMIC_COLUMNS.md](DYNAMIC_COLUMNS.md) for complete documentation.

## 🔒 Security Features

### Environment Variables
All sensitive data is stored in environment variables:
- ✅ **No hardcoded tokens** in source code
- ✅ **`.env` file excluded** from version control
- ✅ **Automatic validation** of required variables
- ✅ **Safe to commit** code without exposing secrets

### Protected Files
The `.gitignore` automatically excludes:
- `.env` files (environment variables)
- `service_account.json` (Google credentials)
- `*.json` files (all JSON credentials)
- Python cache and build files

## 📊 Google Sheet Format

Your Google Sheet should have these columns:
- **A**: Date
- **B**: GIT ID  
- **C**: Project Name
- **D**: Specific Project Name
- **E**: Main Task
- **F**: Sub Task
- **G**: Status (with dropdown)
- **H**: Actual Start Date
- **I**: Planned Estimation (H)
- **J**: Actual Estimation (H)
- **K**: Actual End Date

## 📋 Status Dropdown Options

The Status column (G) includes a dropdown with:
- **Not Started**
- **In Progress** 
- **Under Review**
- **Testing**
- **Completed**
- **On Hold**
- **Cancelled**

## 🔄 How It Works

### Sheets → GitLab:
- **Creates GitLab issues** for sub-tasks that don't have a GIT ID
- **Uses Sub Task as the issue title**
- **Updates the GIT ID column** when new issues are created
- **Applies GitLab quick actions** automatically (assign, estimate, milestone, etc.)
- **Closes issues** when status is "Completed" or "Cancelled"
- **Adds time tracking** from "Actual Estimation (H)" column
- **Keeps issues open** for other statuses

### GitLab → Sheets:
- **Updates existing rows** with GitLab issue data
- **Adds new rows** for new GitLab issues (with basic info)
- **Preserves user data** (project names, estimations, etc.)
- **CSV Export fallback** if Service Account fails

## ⚠️ Environment Variables Reference

### Required Variables
```env
GITLAB_TOKEN          # GitLab Personal Access Token (api scope)
SPREADSHEET_ID        # Google Sheet ID from URL
```

### Optional Variables (with defaults)
```env
GITLAB_URL           # Default: https://sourcecontrol.hsenidmobile.com/api/v4/
PROJECT_ID           # Default: 263
WORKSHEET_NAME       # Default: Sheet1
SERVICE_ACCOUNT_FILE # Default: service_account.json
DEFAULT_ASSIGNEE     # Default: @farhad.l@appigo.co
DEFAULT_ESTIMATE     # Default: 8h
DEFAULT_MILESTONE    # Default: %milestone-name
DEFAULT_DUE_DATE     # Default: (empty)
DEFAULT_LABEL        # Default: ~task
```

## 🚨 Troubleshooting

### Environment Variable Issues
1. **"GITLAB_TOKEN environment variable is required"**
   - Create a `.env` file from `env.example`
   - Add your GitLab token to the `.env` file

2. **"SPREADSHEET_ID environment variable is required"**
   - Add your Google Sheet ID to the `.env` file
   - Get ID from the sheet URL: `/d/[SPREADSHEET_ID]/edit`

### Service Account Issues
1. **"Service account file not found"**
   - Ensure `service_account.json` is in the script directory
   - Check the `SERVICE_ACCOUNT_FILE` path in your `.env`

2. **"The caller does not have permission"**
   - Share the Google Sheet with the service account email
   - Give the service account "Editor" permission

### GitLab Issues
1. **"Expecting value: line 1 column 1"**
   - Check your `GITLAB_URL` includes `/api/v4`
   - Verify your `GITLAB_TOKEN` has `api` scope
   - Ensure the `PROJECT_ID` is correct

## 📁 File Structure

```
scripts/
├── config.py                    # Configuration (loads from environment)
├── gitlab_to_sheets.py          # GitLab → Sheets sync
├── sheets_to_gitlab.py          # Sheets → GitLab sync
├── gitlab_to_sheets_fixed.py    # Robust version with CSV fallback
├── setup_sheet_dropdown.py     # Setup status dropdown
├── complete_sync.py             # Complete bidirectional sync
├── requirements.txt             # Python dependencies
├── env.example                  # Environment variables template
├── .env                         # Your actual environment variables (create this)
├── service_account.json         # Google Service Account credentials (create this)
└── .gitignore                   # Excludes sensitive files
```

## 🎯 Security Best Practices

1. **Never commit `.env` or `service_account.json` files**
2. **Use strong, unique GitLab tokens**
3. **Only share sheets with specific service account**
4. **Regularly review and rotate access tokens**
5. **Keep service account permissions minimal**

---

**🎉 Your GitLab ↔ Google Sheets sync is now secure and production-ready!**
