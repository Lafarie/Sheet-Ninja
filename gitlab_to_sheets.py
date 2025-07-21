"""
Simple GitLab to Google Sheets Sync
This script syncs GitLab issues to Google Sheets using direct API key access
Updates existing sheet with GitLab issues data
"""

import requests
from datetime import datetime
import config

class GitLabToSheets:
    def __init__(self):
        self.base_url = f"https://sheets.googleapis.com/v4/spreadsheets/{config.SPREADSHEET_ID}"
        self.api_key = config.GOOGLE_SHEETS_API_KEY
        print("✅ Connected to Google Sheets API")
    
    def get_gitlab_issues(self):
        """Get all issues from GitLab project"""
        url = f"{config.GITLAB_URL}/projects/{config.PROJECT_ID}/issues"
        headers = {"PRIVATE-TOKEN": config.GITLAB_TOKEN}
        
        try:
            response = requests.get(url, headers=headers, timeout=30)
            if response.status_code == 200:
                issues = response.json()
                print(f"✅ Found {len(issues)} issues in GitLab")
                return issues
            else:
                print(f"❌ Failed to get GitLab issues: {response.text}")
                return []
        except Exception as e:
            print(f"❌ Error getting GitLab issues: {e}")
            return []
    
    def get_sheet_values(self, range_name):
        """Get values from Google Sheet using API key"""
        url = f"{self.base_url}/values/{range_name}?key={self.api_key}"
        
        try:
            response = requests.get(url, timeout=30)
            if response.status_code == 200:
                return response.json().get('values', [])
            else:
                print(f"❌ Failed to get sheet values: {response.text}")
                return []
        except Exception as e:
            print(f"❌ Error getting sheet values: {e}")
            return []
    
    def update_sheet_values(self, range_name, values):
        """Update Google Sheet values using API key"""
        url = f"{self.base_url}/values/{range_name}?valueInputOption=RAW&key={self.api_key}"
        
        data = {
            "values": values
        }
        
        try:
            response = requests.put(url, json=data, timeout=30)
            if response.status_code == 200:
                return True
            else:
                print(f"❌ Failed to update sheet: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Error updating sheet: {e}")
            return False
    
    def append_sheet_values(self, range_name, values):
        """Append values to Google Sheet using API key"""
        url = f"{self.base_url}/values/{range_name}:append?valueInputOption=RAW&key={self.api_key}"
        
        data = {
            "values": values
        }
        
        try:
            response = requests.post(url, json=data, timeout=30)
            if response.status_code == 200:
                return True
            else:
                print(f"❌ Failed to append to sheet: {response.text}")
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
