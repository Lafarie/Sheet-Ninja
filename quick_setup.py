#!/usr/bin/env python3
"""
Quick Setup Helper for GitLab ↔ Google Sheets Sync
This script helps you get started with the environment setup
"""

import os
import shutil
import sys

def check_requirements():
    """Check if requirements are installed"""
    try:
        import dotenv
        import google.oauth2
        import googleapiclient
        print("✅ All required packages are installed")
        return True
    except ImportError as e:
        print(f"❌ Missing required packages: {e}")
        print("💡 Run: pip install -r requirements.txt")
        return False

def create_env_file():
    """Create .env file from template"""
    env_file = ".env"
    template_file = "env.example"
    
    if os.path.exists(env_file):
        response = input(f"⚠️  {env_file} already exists. Overwrite? (y/N): ")
        if response.lower() != 'y':
            print("📝 Keeping existing .env file")
            return True
    
    if not os.path.exists(template_file):
        print(f"❌ Template file {template_file} not found")
        return False
    
    try:
        shutil.copy(template_file, env_file)
        print(f"✅ Created {env_file} from template")
        print(f"📝 Please edit {env_file} with your actual values")
        return True
    except Exception as e:
        print(f"❌ Failed to create {env_file}: {e}")
        return False

def check_service_account():
    """Check if service account file exists"""
    service_account_file = "service_account.json"
    
    if os.path.exists(service_account_file):
        print("✅ Service account file found")
        return True
    else:
        print(f"⚠️  Service account file '{service_account_file}' not found")
        print("💡 Download it from Google Cloud Console and place it here")
        return False

def validate_env_file():
    """Validate that required environment variables are set"""
    env_file = ".env"
    
    if not os.path.exists(env_file):
        print(f"❌ {env_file} file not found")
        return False
    
    required_vars = ['GITLAB_TOKEN', 'SPREADSHEET_ID']
    missing_vars = []
    
    with open(env_file, 'r') as f:
        content = f.read()
        
        for var in required_vars:
            if f"{var}=your-" in content or f"{var}=" in content and f"{var}=\n" in content:
                missing_vars.append(var)
    
    if missing_vars:
        print(f"⚠️  Please set these variables in {env_file}:")
        for var in missing_vars:
            print(f"   • {var}")
        return False
    else:
        print("✅ Required environment variables are set")
        return True

def test_configuration():
    """Test if the configuration works"""
    try:
        import config
        print("✅ Configuration loaded successfully")
        print(f"📊 Spreadsheet ID: {config.SPREADSHEET_ID[:20]}...")
        print(f"📋 Worksheet: {config.WORKSHEET_NAME}")
        print(f"🔧 GitLab Project: {config.PROJECT_ID}")
        return True
    except Exception as e:
        print(f"❌ Configuration test failed: {e}")
        return False

def main():
    """Main setup process"""
    print("🚀 GitLab ↔ Google Sheets Sync - Quick Setup")
    print("=" * 50)
    
    steps = [
        ("1. Checking requirements", check_requirements),
        ("2. Creating .env file", create_env_file),
        ("3. Checking service account", check_service_account),
        ("4. Validating environment variables", validate_env_file),
        ("5. Testing configuration", test_configuration),
    ]
    
    all_good = True
    
    for step_name, step_func in steps:
        print(f"\n{step_name}...")
        if not step_func():
            all_good = False
    
    print("\n" + "=" * 50)
    
    if all_good:
        print("🎉 Setup completed successfully!")
        print("\n📋 Next steps:")
        print("1. Share your Google Sheet with the service account email")
        print("2. Run: python setup_sheet_dropdown.py")
        print("3. Run: python gitlab_to_sheets.py")
    else:
        print("⚠️  Setup incomplete. Please fix the issues above.")
        print("\n💡 Common solutions:")
        print("• Run: pip install -r requirements.txt")
        print("• Edit .env with your actual values")
        print("• Download service_account.json from Google Cloud Console")
        print("• Check the README.md for detailed instructions")

if __name__ == "__main__":
    main() 