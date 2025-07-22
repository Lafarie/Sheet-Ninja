"""
GitLab to Google Sheets Sync with Service Account Authentication and CSV Export Fallback
This script syncs GitLab issues to Google Sheets using Service Account credentials
If Service Account fails, exports to CSV as backup
"""

import requests
import csv
from datetime import datetime
import config
import os
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

class GitLabToSheets:
    def __init__(self):
        self.spreadsheet_id = config.SPREADSHEET_ID
        self.service = None
        self.can_write_to_sheets = False
        self._authenticate_google_sheets()
    
    def _authenticate_google_sheets(self):
        """Authenticate with Google Sheets using Service Account"""
        try:
            # Check if service account file exists
            if not os.path.exists(config.SERVICE_ACCOUNT_FILE):
                print(f"⚠️ Service account file not found: {config.SERVICE_ACCOUNT_FILE}")
                print("📄 Will use CSV export instead")
                return
            
            # Create credentials from service account file
            credentials = service_account.Credentials.from_service_account_file(
                config.SERVICE_ACCOUNT_FILE,
                scopes=config.SCOPES
            )
            
            # Build the service
            self.service = build('sheets', 'v4', credentials=credentials)
            print("✅ Connected to Google Sheets API with Service Account")
            
            # Test access
            self.test_sheet_access()
            
        except Exception as e:
            print(f"⚠️ Failed to authenticate with Google Sheets: {e}")
            print(f"📄 Will use CSV export instead")
            self.service = None
            self.can_write_to_sheets = False
    
    def test_sheet_access(self):
        """Test if we can access the Google Sheet"""
        if not self.service:
            self.can_write_to_sheets = False
            return
            
        try:
            # Test read access
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=f"{config.WORKSHEET_NAME}!A1:A1"
            ).execute()
            
            print("✅ Sheet read access: OK")
            
            # Test write access
            test_range = f"{config.WORKSHEET_NAME}!Z1"
            try:
                self.service.spreadsheets().values().update(
                    spreadsheetId=self.spreadsheet_id,
                    range=test_range,
                    valueInputOption='RAW',
                    body={'values': [["test"]]}
                ).execute()
                
                print("✅ Sheet write access: OK")
                self.can_write_to_sheets = True
                
                # Clean up test
                self.service.spreadsheets().values().update(
                    spreadsheetId=self.spreadsheet_id,
                    range=test_range,
                    valueInputOption='RAW',
                    body={'values': [[""]]}
                ).execute()
                
            except HttpError as e:
                print(f"❌ Sheet write access: FAILED - {e}")
                print("📄 Will use CSV export instead")
                self.can_write_to_sheets = False
                
        except HttpError as e:
            print(f"❌ Sheet read access: FAILED - {e}")
            print("📄 Will use CSV export instead")
            self.can_write_to_sheets = False
        except Exception as e:
            print(f"❌ Sheet access test failed: {e}")
            print("📄 Will use CSV export instead")
            self.can_write_to_sheets = False
    
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
        if not self.service:
            return []
            
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
        if not self.service:
            return False
            
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
        if not self.service:
            return False
            
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
    
    def export_to_csv(self, issues):
        """Export issues to CSV as backup when Sheets access fails"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"gitlab_issues_{timestamp}.csv"
        
        try:
            with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
                writer = csv.writer(csvfile)
                
                # Write headers
                writer.writerow(config.SHEET_HEADERS)
                
                # Write issue data
                for issue in issues:
                    today = datetime.now().strftime("%d-%m-%Y")
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
                    writer.writerow(row_data)
            
            print(f"✅ Exported {len(issues)} issues to {filename}")
            print(f"📁 You can import this CSV file to your Google Sheet manually")
            return filename
            
        except Exception as e:
            print(f"❌ Error exporting to CSV: {e}")
            return None
    
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
        
        if self.can_write_to_sheets:
            # Direct sheet sync
            print("📝 Syncing directly to Google Sheets...")
            
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
            
            print(f"\n✅ Direct sync completed!")
            print(f"   📝 Updated: {updated_count} existing issues")
            print(f"   ➕ Added: {new_count} new issues")
            
        else:
            # Export to CSV instead
            print("📄 Google Sheets write access unavailable, exporting to CSV...")
            csv_file = self.export_to_csv(issues)
            if csv_file:
                print(f"\n🎯 Next Steps:")
                print(f"1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/{config.SPREADSHEET_ID}")
                print(f"2. Go to File → Import → Upload → Select {csv_file}")
                print(f"3. Choose 'Replace spreadsheet' or 'Insert new sheet(s)'")

if __name__ == "__main__":
    sync = GitLabToSheets()
    sync.sync_gitlab_to_sheets() 