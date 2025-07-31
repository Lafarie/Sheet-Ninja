#!/usr/bin/env python3
"""
Quick Setup Script for Dynamic Column System
This script helps you get started with the dynamic column management system
"""

import os
import sys
import json
from datetime import datetime

def print_banner():
    print("=" * 60)
    print("🔧 Dynamic Column System - Quick Setup")
    print("=" * 60)
    print()

def check_dependencies():
    """Check if required files exist"""
    print("🔍 Checking dependencies...")
    
    required_files = [
        'config.py',
        'column_manager.py',
        'sheets_to_gitlab.py',
        'setup/setup_sheet_dropdown.py'
    ]
    
    missing_files = []
    for file in required_files:
        if not os.path.exists(file):
            missing_files.append(file)
    
    if missing_files:
        print("❌ Missing required files:")
        for file in missing_files:
            print(f"   - {file}")
        return False
    
    print("✅ All required files found")
    return True

def check_config():
    """Check if configuration is properly set up"""
    print("🔍 Checking configuration...")
    
    try:
        import config
        
        # Check environment variables
        env_vars = ['GITLAB_TOKEN', 'SPREADSHEET_ID']
        missing_vars = []
        
        for var in env_vars:
            if not getattr(config, var, None):
                missing_vars.append(var)
        
        if missing_vars:
            print("⚠️ Missing environment variables:")
            for var in missing_vars:
                print(f"   - {var}")
            print("💡 Please set these in your .env file")
            return False
        
        print("✅ Configuration looks good")
        return True
        
    except ImportError as e:
        print(f"❌ Error importing config: {e}")
        return False

def show_menu():
    """Show main menu options"""
    print("\n📋 What would you like to do?")
    print("-" * 40)
    print("1. 🔧 Set up column mappings")
    print("2. 📊 Validate current configuration")
    print("3. 🎯 Set up Google Sheet dropdowns")
    print("4. 🔄 Run sync test")
    print("5. 📚 View documentation")
    print("6. 🚪 Exit")
    print()

def setup_columns():
    """Launch column manager"""
    print("🔧 Launching column manager...")
    try:
        import column_manager
        column_manager.main()
    except Exception as e:
        print(f"❌ Error launching column manager: {e}")

def validate_config():
    """Validate column configuration"""
    print("📊 Validating configuration...")
    try:
        from column_manager import ColumnManager
        manager = ColumnManager()
        is_valid = manager.validate_configuration()
        
        if is_valid:
            print("✅ Configuration is valid!")
        else:
            print("⚠️ Configuration issues found. Run option 1 to fix them.")
            
    except Exception as e:
        print(f"❌ Error during validation: {e}")

def setup_dropdowns():
    """Set up Google Sheet dropdowns"""
    print("🎯 Setting up Google Sheet dropdowns...")
    try:
        from setup.setup_sheet_dropdown import SimpleSheetDropdown
        setup = SimpleSheetDropdown()
        setup.setup_sheet()
    except Exception as e:
        print(f"❌ Error setting up dropdowns: {e}")

def run_sync_test():
    """Run a test sync to see if everything works"""
    print("🔄 Running sync test...")
    print("⚠️ This will read your Google Sheet and may create GitLab issues!")
    
    confirm = input("Continue? (y/n): ").strip().lower()
    if confirm != 'y':
        print("❌ Test cancelled")
        return
    
    try:
        from sheets_to_gitlab import SheetsToGitLab
        sync = SheetsToGitLab()
        
        # Just read the data without syncing
        records = sync.get_sheet_data()
        print(f"✅ Successfully read {len(records)} records from sheet")
        
        if records:
            print("\n📋 Sample record structure:")
            sample = records[0]
            for key, value in sample.items():
                if not key.startswith('_'):
                    print(f"   {key}: {value}")
        
        print("\n💡 To perform actual sync, run: python sheets_to_gitlab.py")
        
    except Exception as e:
        print(f"❌ Error during sync test: {e}")

def view_docs():
    """Display documentation information"""
    print("📚 Documentation")
    print("-" * 40)
    print("📄 DYNAMIC_COLUMNS.md - Complete guide to the dynamic column system")
    print("📄 README.md - General project documentation")
    print()
    print("🔗 Key concepts:")
    print("   • Dynamic column mapping adapts to sheet changes")
    print("   • Auto-detection suggests column mappings")
    print("   • Interactive setup for custom configurations")
    print("   • Validation ensures everything works correctly")
    print()
    print("🔧 Quick commands:")
    print("   python column_manager.py     - Manage column mappings")
    print("   python sheets_to_gitlab.py   - Run the sync")
    print("   python setup/setup_sheet_dropdown.py - Setup dropdowns")

def create_sample_env():
    """Create a sample .env file if it doesn't exist"""
    env_file = '.env'
    if not os.path.exists(env_file):
        print("📝 Creating sample .env file...")
        sample_content = '''# GitLab Configuration
GITLAB_URL=https://sourcecontrol.hsenidmobile.com/api/v4/
GITLAB_TOKEN=your_gitlab_token_here
PROJECT_ID=263

# Google Sheets Configuration
SPREADSHEET_ID=your_spreadsheet_id_here
WORKSHEET_NAME=Sheet1
SERVICE_ACCOUNT_FILE=service_account.json

# Default Settings
DEFAULT_ASSIGNEE=farhad.l
DEFAULT_ESTIMATE=8h
DEFAULT_MILESTONE=%milestone-name
DEFAULT_DUE_DATE=
DEFAULT_LABEL=~task
'''
        
        with open(env_file, 'w') as f:
            f.write(sample_content)
        
        print(f"✅ Created {env_file}")
        print("💡 Please edit this file with your actual values")
        return True
    return False

def main():
    print_banner()
    
    # Create sample .env if needed
    env_created = create_sample_env()
    if env_created:
        print("⚠️ Please configure your .env file first, then run this script again")
        return
    
    # Check dependencies
    if not check_dependencies():
        print("❌ Please ensure all required files are present")
        return
    
    # Check configuration
    config_ok = check_config()
    if not config_ok:
        print("⚠️ Configuration issues detected. Some features may not work.")
    
    # Main loop
    while True:
        show_menu()
        
        try:
            choice = input("Enter choice (1-6): ").strip()
            
            if choice == '1':
                setup_columns()
            elif choice == '2':
                validate_config()
            elif choice == '3':
                setup_dropdowns()
            elif choice == '4':
                run_sync_test()
            elif choice == '5':
                view_docs()
            elif choice == '6':
                print("👋 Goodbye!")
                break
            else:
                print("❌ Invalid choice. Please try again.")
                
        except KeyboardInterrupt:
            print("\n\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"❌ Error: {e}")
            print("Please try again or check the error message above.")

if __name__ == "__main__":
    main()
