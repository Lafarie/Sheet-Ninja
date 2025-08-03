#!/usr/bin/env python3
"""
Setup helper for GitLab ↔ Google Sheets Sync
Creates basic configuration files to get started
"""

import os
from pathlib import Path

def create_env_file():
    """Create a basic .env file"""
    env_content = '''# GitLab ↔ Google Sheets Sync Configuration
# Fill in your actual values below

# ============================
# GitLab Settings (Required)
# ============================
GITLAB_TOKEN=your-gitlab-token-here
GITLAB_URL=https://sourcecontrol.hsenidmobile.com/api/v4/
PROJECT_ID=263

# ============================
# Google Sheets Settings (Required)
# ============================
SPREADSHEET_ID=your-google-sheet-id-here
WORKSHEET_NAME=Sheet1
SERVICE_ACCOUNT_FILE=service_account.json

# ============================
# GitLab Issue Template Settings (Optional)
# ============================
DEFAULT_ASSIGNEE=farhad.l
DEFAULT_ESTIMATE=8h
DEFAULT_MILESTONE=%milestone-name
DEFAULT_DUE_DATE=
DEFAULT_LABEL=~task

# ============================
# Instructions:
# ============================
# 1. Replace 'your-gitlab-token-here' with your GitLab personal access token
# 2. Replace 'your-google-sheet-id-here' with your Google Sheets ID
# 3. Download your Google service account JSON file as 'service_account.json'
# 4. Save this file and restart the web application
'''
    
    project_root = Path(__file__).parent
    env_file = project_root / '.env'
    
    with open(env_file, 'w') as f:
        f.write(env_content)
    
    print(f"✅ Created .env file at: {env_file}")
    return env_file

def main():
    print("🔧 GitLab ↔ Google Sheets Sync Setup Helper")
    print("=" * 50)
    
    project_root = Path(__file__).parent
    env_file = project_root / '.env'
    service_account_file = project_root / 'service_account.json'
    
    print(f"📁 Project directory: {project_root}")
    print()
    
    # Check .env file
    if not env_file.exists():
        print("📝 Creating .env configuration file...")
        create_env_file()
    else:
        print("✅ .env file already exists")
    
    print()
    
    # Check service account file
    if not service_account_file.exists():
        print("⚠️  Google Service Account file missing")
        print(f"📥 Please download your service account JSON file to:")
        print(f"   {service_account_file}")
        print()
        print("💡 How to get the service account file:")
        print("   1. Go to Google Cloud Console (console.cloud.google.com)")
        print("   2. Select your project or create a new one")
        print("   3. Enable Google Sheets API")
        print("   4. Go to IAM & Admin → Service Accounts")
        print("   5. Create a new service account")
        print("   6. Download the JSON key file")
        print("   7. Rename it to 'service_account.json' and place it in the project root")
    else:
        print("✅ Google Service Account file found")
    
    print()
    print("🚀 Next Steps:")
    print("1. Edit the .env file with your actual credentials")
    print("2. Download the Google service account JSON file")
    print("3. Start the web UI:")
    print("   cd web_ui")
    print("   python run.py")
    print("4. Open http://localhost:5001 in your browser")
    print()
    print("📚 For detailed setup instructions, see INSTALL.md")

if __name__ == "__main__":
    main()
