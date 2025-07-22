"""
GitLab to Google Sheets Sync with Service Account Authentication
This script syncs GitLab issues to Google Sheets using Service Account credentials
Updates existing sheet with GitLab issues data
"""

import requests
from datetime import datetime
import config
import os
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

class GitLabToSheets:
    def __init__(self):
        self.spreadsheet_id = config.SPREADSHEET_ID
        self.service = self._authenticate_google_sheets()
        print("✅ Connected to Google Sheets API with Service Account")
    
    def _authenticate_google_sheets(self):
        """Authenticate with Google Sheets using Service Account"""
        try:
            # Check if service account file exists
            if not os.path.exists(config.SERVICE_ACCOUNT_FILE):
                raise FileNotFoundError(f"Service account file not found: {config.SERVICE_ACCOUNT_FILE}")
            
            # Create credentials from service account file
            credentials = service_account.Credentials.from_service_account_file(
                config.SERVICE_ACCOUNT_FILE,
                scopes=config.SCOPES
            )
            
            # Build the service
            service = build('sheets', 'v4', credentials=credentials)
            return service
            
        except Exception as e:
            print(f"❌ Failed to authenticate with Google Sheets: {e}")
            print(f"💡 Make sure '{config.SERVICE_ACCOUNT_FILE}' exists and contains valid service account credentials")
            raise
    
    def get_gitlab_issues(self):
        """Get all issues from GitLab project"""
        url = f"{config.GITLAB_URL}projects/{config.PROJECT_ID}/issues"
        headers = {"PRIVATE-TOKEN": config.GITLAB_TOKEN}
        
        try:
            response = requests.get(url, headers=headers, timeout=30)
            if response.status_code == 200:
                issues = response.json()
                print(f"✅ Found {len(issues)} issues in GitLab")
                return issues
            else:
                print(f"❌ Failed to get GitLab issues (Status: {response.status_code})")
                print(f"   Response: {response.text}")
                return []
        except Exception as e:
            print(f"❌ Error getting GitLab issues: {e}")
            return []
    
    def get_sheet_values(self, range_name):
        """Get values from Google Sheet using Service Account"""
        try:
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=range_name
            ).execute()
            
            values = result.get('values', [])
            return values
            
        except HttpError as e:
            print(f"❌ Failed to get sheet values: {e}")
            return []
        except Exception as e:
            print(f"❌ Error getting sheet values: {e}")
            return []
    
    def update_sheet_values(self, range_name, values):
        """Update Google Sheet values using Service Account"""
        try:
            body = {
                'values': values
            }
            
            result = self.service.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range=range_name,
                valueInputOption='RAW',
                body=body
            ).execute()
            
            return True
            
        except HttpError as e:
            print(f"❌ Failed to update sheet: {e}")
            return False
        except Exception as e:
            print(f"❌ Error updating sheet: {e}")
            return False
    
    def append_sheet_values(self, range_name, values):
        """Append values to Google Sheet using Service Account"""
        try:
            body = {
                'values': values
            }
            
            result = self.service.spreadsheets().values().append(
                spreadsheetId=self.spreadsheet_id,
                range=range_name,
                valueInputOption='RAW',
                body=body
            ).execute()
            
            return True
            
        except HttpError as e:
            print(f"❌ Failed to append to sheet: {e}")
            return False
        except Exception as e:
            print(f"❌ Error appending to sheet: {e}")
            return False
    
    def find_issue_in_sheet(self, issue_id):
        """Find if GitLab issue already exists in sheet"""
        try:
            all_values = self.get_sheet_values(f"{config.WORKSHEET_NAME}!A:K")
            
            for i, row in enumerate(all_values):
                if len(row) > 1 and str(row[1]).strip() == str(issue_id):  # Column B (GIT ID)
                    return i + 1  # Return 1-indexed row number
            return None
        except Exception as e:
            print(f"❌ Error searching for issue in sheet: {e}")
            return None
    
    def update_existing_row(self, row_num, issue):
        """Update existing row with GitLab issue data"""
        try:
            # Update Main Task (Column E) and Status (Column G)
            main_task_range = f"{config.WORKSHEET_NAME}!E{row_num}"
            status_range = f"{config.WORKSHEET_NAME}!G{row_num}"
            
            self.update_sheet_values(main_task_range, [[issue.get('title', '')]])
            self.update_sheet_values(status_range, [[issue.get('state', '')]])
            
            print(f"✅ Updated existing row {row_num} for issue #{issue.get('iid')}")
        except Exception as e:
            print(f"❌ Error updating row {row_num}: {e}")
    
    def add_new_issue_row(self, issue):
        """Add new row for GitLab issue (minimal data)"""
        try:
            today = datetime.now().strftime("%d-%m-%Y")
            
            # Add basic row - user will fill in project details manually
            row_data = [
                today,                              # Date
                issue.get('iid', ''),              # GIT ID
                '',                                 # Project Name (to be filled)
                '',                                 # Specific Project Name (to be filled)
                issue.get('title', ''),            # Main Task
                '',                                 # Sub Task (to be filled)
                issue.get('state', ''),            # Status
                today,                              # Actual Start Date
                '',                                 # Planned Estimation (to be filled)
                '',                                 # Actual Estimation (to be filled)
                ''                                  # Actual End Date (to be filled)
            ]
            
            self.append_sheet_values(f"{config.WORKSHEET_NAME}!A:K", [row_data])
            print(f"✅ Added new row for GitLab issue #{issue.get('iid')}: {issue.get('title')}")
            
        except Exception as e:
            print(f"❌ Error adding new row for issue: {e}")
    
    def sync_gitlab_to_sheets(self):
        """Main function to sync GitLab issues to Google Sheets"""
        print("🔄 Starting GitLab to Google Sheets sync...")
        
        issues = self.get_gitlab_issues()
        if not issues:
            print("❌ No issues found")
            return
        
        # Check if sheet has headers, add them if not
        try:
            first_row = self.get_sheet_values(f"{config.WORKSHEET_NAME}!1:1")
            if not first_row or not first_row[0] or first_row[0][0] != "Date":
                print("📝 Adding headers to sheet...")
                self.update_sheet_values(f"{config.WORKSHEET_NAME}!1:1", [config.SHEET_HEADERS])
        except Exception as e:
            print(f"⚠️ Could not check/add headers: {e}")
        
        updated_count = 0
        new_count = 0
        
        for issue in issues:
            issue_id = issue.get('iid')
            
            # Check if issue already exists in sheet
            existing_row = self.find_issue_in_sheet(issue_id)
            
            if existing_row:
                # Update existing row
                self.update_existing_row(existing_row, issue)
                updated_count += 1
            else:
                # Add new row
                self.add_new_issue_row(issue)
                new_count += 1
        
        print(f"\n✅ Sync completed!")
        print(f"   📝 Updated: {updated_count} existing issues")
        print(f"   ➕ Added: {new_count} new issues")

if __name__ == "__main__":
    sync = GitLabToSheets()
    sync.sync_gitlab_to_sheets()
