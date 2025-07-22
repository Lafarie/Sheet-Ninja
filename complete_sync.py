"""
Complete Sync Script - Runs both directions
This script combines both GitLab to Sheets and Sheets to GitLab sync
"""

from gitlab_to_sheets import GitLabToSheets
from sheets_to_gitlab import SheetsToGitLab
import time

def main():
    print("🚀 Starting Complete GitLab ↔ Google Sheets Sync")
    print("=" * 50)
    
    # # Step 1: Sync GitLab issues to Google Sheets
    # print("\n📥 Step 1: Syncing GitLab → Google Sheets")
    # gitlab_sync = GitLabToSheets()
    # gitlab_sync.sync_gitlab_to_sheets()
    
    # # Wait a bit before next step
    # print("\n⏳ Waiting 3 seconds...")
    # time.sleep(3)
    
    # Step 2: Sync Google Sheets changes back to GitLab
    print("\n📤 Step 2: Syncing Google Sheets → GitLab")
    sheets_sync = SheetsToGitLab()
    sheets_sync.sync_sheets_to_gitlab()
    
    print("\n🎉 Complete sync finished!")
    print("=" * 50)

if __name__ == "__main__":
    main()
