"""
Simple Google Sheets to GitLab Sync
This script reads changes from Google Sheets and updates GitLab using direct API key access
- Creates GitLab issues for sub-tasks that don't have GIT ID
- Updates existing issues based on status
- Closes completed issues
"""

import requests
from datetime import datetime
import config

class SheetsToGitLab:
    def __init__(self):
        self.base_url = f"https://sheets.googleapis.com/v4/spreadsheets/{config.SPREADSHEET_ID}"
        self.api_key = config.GOOGLE_SHEETS_API_KEY
        print("✅ Connected to Google Sheets API")
    
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
    
    def get_sheet_data(self):
        """Get all data from Google Sheet"""
        try:
            # Get all values including headers
            all_values = self.get_sheet_values(f"{config.WORKSHEET_NAME}!A:K")
            if len(all_values) < 2:  # No data rows
                return []
            
            headers = all_values[0]
            data_rows = all_values[1:]
            
            records = []
            for row in data_rows:
                # Pad row with empty strings if it's shorter than headers
                padded_row = row + [''] * (len(headers) - len(row))
                record = dict(zip(headers, padded_row))
                records.append(record)
            
            print(f"✅ Found {len(records)} rows in Google Sheet")
            return records
        except Exception as e:
            print(f"❌ Error reading Google Sheet: {e}")
            return []
    
    def create_gitlab_issue(self, title, description="", project_name="", planned_estimation=""):
        """Create a new GitLab issue with specific template"""
        url = f"{config.GITLAB_URL}/projects/{config.PROJECT_ID}/issues"
        headers = {"PRIVATE-TOKEN": config.GITLAB_TOKEN}
        
        # Build description with GitLab quick actions
        quick_actions = []
        quick_actions.append(f"/assign {config.DEFAULT_ASSIGNEE}")
        
        # Use planned estimation from sheet or default
        estimate = planned_estimation if planned_estimation else config.DEFAULT_ESTIMATE
        quick_actions.append(f"/estimate {estimate}")
        
        if config.DEFAULT_MILESTONE:
            quick_actions.append(f"/milestone {config.DEFAULT_MILESTONE}")
        
        if config.DEFAULT_DUE_DATE:
            quick_actions.append(f"/due {config.DEFAULT_DUE_DATE}")
        
        if config.DEFAULT_LABEL:
            quick_actions.append(f"/label {config.DEFAULT_LABEL}")
        
        # Combine description with quick actions
        full_description = description
        if quick_actions:
            full_description += "\n\n" + "\n".join(quick_actions)
        
        data = {
            "title": title,
            "description": full_description
        }
        
        try:
            response = requests.post(url, headers=headers, data=data, timeout=30)
            if response.status_code == 201:
                issue_data = response.json()
                issue_id = issue_data['iid']
                print(f"✅ Created GitLab issue #{issue_id}: {title}")
                print(f"   📋 Applied quick actions: {', '.join(quick_actions)}")
                return issue_id
            else:
                print(f"❌ Failed to create GitLab issue: {response.text}")
                return None
        except Exception as e:
            print(f"❌ Error creating GitLab issue: {e}")
            return None
    
    def update_git_id_in_sheet(self, row_number, git_id):
        """Update the GIT ID in the Google Sheet"""
        try:
            cell_range = f"{config.WORKSHEET_NAME}!B{row_number + 2}"  # +2 for header and 0-index
            self.update_sheet_values(cell_range, [[str(git_id)]])
            print(f"✅ Updated GIT ID in row {row_number + 2}: {git_id}")
        except Exception as e:
            print(f"❌ Error updating GIT ID in sheet: {e}")
    
    def close_gitlab_issue(self, issue_id):
        """Close GitLab issue"""
        url = f"{config.GITLAB_URL}/projects/{config.PROJECT_ID}/issues/{issue_id}"
        headers = {"PRIVATE-TOKEN": config.GITLAB_TOKEN}
        data = {"state_event": "close"}
        
        try:
            response = requests.put(url, headers=headers, data=data, timeout=30)
            if response.status_code == 200:
                print(f"✅ Closed GitLab issue #{issue_id}")
                return True
            else:
                print(f"❌ Failed to close issue #{issue_id}: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Error closing issue #{issue_id}: {e}")
            return False
    
    def add_time_to_gitlab(self, issue_id, hours):
        """Add time spent to GitLab issue"""
        if not hours or hours <= 0:
            return False
            
        url = f"{config.GITLAB_URL}/projects/{config.PROJECT_ID}/issues/{issue_id}/add_spent_time"
        headers = {"PRIVATE-TOKEN": config.GITLAB_TOKEN}
        data = {
            "duration": f"{hours}h",
            "comment": f"Time logged from Google Sheets: {hours} hours"
        }
        
        try:
            response = requests.post(url, headers=headers, data=data, timeout=30)
            if response.status_code == 201:
                print(f"✅ Added {hours}h to issue #{issue_id}")
                return True
            else:
                print(f"❌ Failed to add time to issue #{issue_id}: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Error adding time to issue #{issue_id}: {e}")
            return False
    
    def sync_sheets_to_gitlab(self):
        """Main function to sync Google Sheets changes to GitLab"""
        print("🔄 Starting Google Sheets to GitLab sync...")
        
        records = self.get_sheet_data()
        if not records:
            print("❌ No data found in Google Sheet")
            return
        
        for row_index, record in enumerate(records):
            git_id = record.get('GIT ID', '').strip()
            sub_task = record.get('Sub Task', '').strip()
            status = record.get('Status', '').strip()
            main_task = record.get('Main Task', '').strip()
            project_name = record.get('Project Name', '').strip()
            specific_project = record.get('Specific Project Name', '').strip()
            actual_estimation = record.get('Actual Estimation (H)', '').strip()
            planned_estimation = record.get('Planned Estimation (H)', '').strip()
            
            if not sub_task:  # Skip rows without sub-task
                continue
            
            print(f"\n📝 Processing row {row_index + 2}: {sub_task}")
            
            # Check if GIT ID exists
            if not git_id:
                # Create new GitLab issue using sub-task as title
                title = sub_task
                description = f"**Project:** {project_name}\n**Specific Project:** {specific_project}\n**Main Task:** {main_task}\n**Sub Task:** {sub_task}"
                
                new_git_id = self.create_gitlab_issue(title, description, project_name, planned_estimation)
                if new_git_id:
                    # Update the sheet with new GIT ID
                    self.update_git_id_in_sheet(row_index, new_git_id)
                    git_id = str(new_git_id)
            
            # Process existing or newly created issue
            if git_id:
                try:
                    git_id_int = int(git_id)
                    
                    # Add time if specified
                    if actual_estimation:
                        try:
                            hours = float(actual_estimation)
                            if hours > 0:
                                self.add_time_to_gitlab(git_id_int, hours)
                        except (ValueError, TypeError):
                            print(f"⚠️ Invalid time format for issue #{git_id}: {actual_estimation}")
                    
                    # Handle status
                    if status.lower() == "completed":
                        self.close_gitlab_issue(git_id_int)
                    elif status.lower() == "in progress":
                        print(f"📋 Issue #{git_id} is in progress - keeping open")
                
                except (ValueError, TypeError):
                    print(f"⚠️ Invalid GIT ID format: {git_id}")
        
        print("\n✅ Sync completed!")

if __name__ == "__main__":
    sync = SheetsToGitLab()
    sync.sync_sheets_to_gitlab()
