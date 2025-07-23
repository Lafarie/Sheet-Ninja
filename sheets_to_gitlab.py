"""
Google Sheets to GitLab Sync with Service Account Authentication
This script reads changes from Google Sheets and updates GitLab using Service Account credentials
- Creates GitLab issues for sub-tasks that don't have GIT ID
- Updates existing issues based on status
- Closes completed issues
"""

import requests
from datetime import datetime, timedelta
import config
import os
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import re

class SheetsToGitLab:
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
    
    def create_gitlab_issue(self, title, description="", project_name="", planned_estimation="", actual_estimation="", actual_end_date=""):
        """Create a new GitLab issue using the exact API format"""
        # Get the correct project ID based on project name
        if project_name:
            project_id = config.get_project_id_by_name(project_name)
            print(f"📋 Using project ID {project_id} for project: {project_name}")
        else:
            project_id = config.PROJECT_ID
            print(f"📋 Using default project ID: {project_id}")
        
        url = f"{config.GITLAB_URL}projects/{project_id}/issues"
        headers = {
            "PRIVATE-TOKEN": config.GITLAB_TOKEN,
            "Content-Type": "application/json"
        }
        
        # Extract values from sheet with fallback to defaults
        estimate_value = planned_estimation if planned_estimation else config.DEFAULT_ESTIMATE.replace('h', '')
        milestone_value = project_name if project_name else config.DEFAULT_MILESTONE
        due_date_value = actual_end_date if actual_end_date else config.DEFAULT_DUE_DATE
        actual_estimation_value = actual_estimation if actual_estimation else config.DEFAULT_ESTIMATE.replace('h', '')
        label_value = config.DEFAULT_LABEL
        
        # Build dynamic description with actual values from sheet
        description_parts = [
            f"/assign {config.DEFAULT_ASSIGNEE}",
            f"/estimate {estimate_value}",
            f"/spend {actual_estimation_value}"
        ]
        
        if milestone_value:
            description_parts.append(f"/milestone %\"{milestone_value}\"")
        
        if due_date_value:
            description_parts.append(f"/due {due_date_value}")

        if label_value:
            description_parts.append(f"/label {label_value}")
        
        dynamic_description = " \n".join(description_parts)
        print(f"📋 Quick actions to apply:\n{dynamic_description}")
        
        # Use JSON format as specified
        data = {
            "title": title,
            "description": dynamic_description
        }
        
        try:
            response = requests.post(url, headers=headers, json=data, timeout=30)
            if response.status_code == 201:
                issue_data = response.json()
                issue_id = issue_data['iid']
                print(f"✅ Created GitLab issue #{issue_id}: {title}")
                print(f"   🏗️ Project ID: {project_id} ({project_name})")
                return issue_id
            else:
                print(f"❌ Failed to create GitLab issue (Status: {response.status_code})")
                print(f"   Response: {response.text}")
                return None
        except Exception as e:
            print(f"❌ Error creating GitLab issue: {e}")
            return None
    
    def update_git_id_in_sheet(self, row_number, git_id, project_name="", actual_end_date=""):
        """Update the GIT ID in the Google Sheet with clickable link only if different"""
        try:
            cell_range = f"{config.WORKSHEET_NAME}!B{row_number + 2}"  # +2 for header and 0-index
            
            # Check current value first to avoid unnecessary updates
            current_values = self.get_sheet_values(cell_range)
            if current_values and len(current_values) > 0 and len(current_values[0]) > 0:
                current_value = str(current_values[0][0]).strip()
                # Extract just the number from hyperlink formula if it exists
                if current_value.startswith('=HYPERLINK('):
                    # Extract the display text (git_id) from hyperlink formula
                    match = re.search(r'=HYPERLINK\("[^"]*",\s*"([^"]*)"\)', current_value)
                    if match:
                        current_git_id = match.group(1).strip()
                        if current_git_id == str(git_id):
                            print(f"ℹ️ GIT ID {git_id} already exists in row {row_number + 2} - skipping update")
                            return
                elif current_value == str(git_id):
                    print(f"ℹ️ GIT ID {git_id} already exists in row {row_number + 2} - skipping update")
                    return
            
            # Generate dynamic issue URL based on project name
            if project_name:
                issue_url = config.get_gitlab_issue_url(project_name, git_id)
                print(f"🔗 Generated URL for {project_name}: {issue_url}")
            else:
                # Fallback to default repo path
                issue_url = f"https://sourcecontrol.hsenidmobile.com/appigo/ticket-generator/-/issues/{git_id}"
                print(f"🔗 Using default URL: {issue_url}")
            
            # Create a clickable link using Google Sheets HYPERLINK formula
            link_formula = f'=HYPERLINK("{issue_url}", "{git_id}")'
            
            # Update with formula to create clickable link
            body = {
                'values': [[link_formula]]
            }
            
            result = self.service.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range=cell_range,
                valueInputOption='USER_ENTERED',  # This allows formulas to be processed
                body=body
            ).execute()
            
            print(f"✅ Updated GIT ID in row {row_number + 2}: {issue_url} (clickable link)")
            
            # Check if next day is weekend and color row red
            self.check_and_color_weekend_row(row_number + 2)
            
        except Exception as e:
            print(f"❌ Error updating GIT ID in sheet: {e}")
    
    def check_and_color_weekend_row(self, row_number):
        """Check if tomorrow is weekend and color the row red"""
        try:
            tomorrow = datetime.now() + timedelta(days=1)
            # weekday() returns 0-6 where 5=Saturday, 6=Sunday
            if tomorrow.weekday() >= 5:  # Weekend (Saturday or Sunday)
                self.color_row_red(row_number)
                print(f"🎨 Colored row {row_number} red (next day is weekend)")
        except Exception as e:
            print(f"❌ Error checking weekend: {e}")
    
    def color_row_red(self, row_number):
        """Color entire row red using Google Sheets API"""
        try:
            # Convert to 0-based index for API
            row_index = row_number - 1
            
            request_body = {
                'requests': [
                    {
                        'repeatCell': {
                            'range': {
                                'sheetId': 0,  # First sheet
                                'startRowIndex': row_index,
                                'endRowIndex': row_index + 1,
                                'startColumnIndex': 0,
                                'endColumnIndex': 11  # Columns A-K
                            },
                            'cell': {
                                'userEnteredFormat': {
                                    'backgroundColor': {
                                        'red': 1.0,
                                        'green': 0.8,
                                        'blue': 0.8
                                    }
                                }
                            },
                            'fields': 'userEnteredFormat.backgroundColor'
                        }
                    }
                ]
            }
            
            self.service.spreadsheets().batchUpdate(
                spreadsheetId=self.spreadsheet_id,
                body=request_body
            ).execute()
            
        except Exception as e:
            print(f"❌ Error coloring row: {e}")
    
    def get_gitlab_issue_details(self, issue_id, project_name=""):
        """Get current GitLab issue details for comparison before updates"""
        # Get the correct project ID based on project name
        if project_name:
            project_id = config.get_project_id_by_name(project_name)
        else:
            project_id = config.PROJECT_ID
        
        url = f"{config.GITLAB_URL}projects/{project_id}/issues/{issue_id}"
        headers = {"PRIVATE-TOKEN": config.GITLAB_TOKEN}
        
        try:
            response = requests.get(url, headers=headers, timeout=30)
            if response.status_code == 200:
                issue_data = response.json()
                # print(f"🔍 Debug - Issue #{issue_id} REST API response: {issue_data}")
                
                # Get time stats from the nested time_stats object
                time_stats = issue_data.get('time_stats', {})
                total_time_spent = time_stats.get('total_time_spent', 0)
                
                return {
                    'state': issue_data.get('state'),
                    'title': issue_data.get('title'),
                    'total_time_spent': total_time_spent,  # in seconds from time_stats
                    'time_stats': time_stats,
                    'description': issue_data.get('description', ''),
                    'due_date': issue_data.get('due_date', '')  # Include due date for comparison
                }
            else:
                print(f"❌ Failed to get issue #{issue_id} details (Status: {response.status_code})")
                return None
        except Exception as e:
            print(f"❌ Error getting issue #{issue_id} details: {e}")
            return None
    
    def close_gitlab_issue(self, issue_id, project_name="", actual_end_date=""):
        """Close GitLab issue only if it's not already closed, optionally set due date first"""
        # Check current state first
        current_details = self.get_gitlab_issue_details(issue_id, project_name)
        if not current_details:
            return False
        
        if current_details['state'] == 'closed':
            print(f"ℹ️ Issue #{issue_id} is already closed - skipping")
            return True
        
        # Get the correct project ID based on project name
        if project_name:
            project_id = config.get_project_id_by_name(project_name)
        else:
            project_id = config.PROJECT_ID
        
        url = f"{config.GITLAB_URL}projects/{project_id}/issues/{issue_id}"
        headers = {
            "PRIVATE-TOKEN": config.GITLAB_TOKEN,
            "Content-Type": "application/json"
        }
        
        # Build update data - close the issue and optionally set due date
        data = {
            "state_event": "close"
        }
        
        # If actual_end_date is provided, set it as the due date when closing
        if actual_end_date:
            try:
                if '-' in actual_end_date and len(actual_end_date.split('-')) == 3:
                    parts = actual_end_date.split('-')
                    if len(parts[0]) == 2:  # DD-MM-YYYY format
                        formatted_date = f"{parts[2]}-{parts[1]}-{parts[0]}"  # Convert to YYYY-MM-DD
                    else:  # Already YYYY-MM-DD format
                        formatted_date = actual_end_date
                else:
                    formatted_date = actual_end_date
                
                current_due_date = current_details.get('due_date', '')
                if formatted_date != current_due_date:
                    data['due_date'] = formatted_date
                    print(f"📅 Setting due date on close: {current_due_date} → {formatted_date}")
            except Exception as e:
                print(f"⚠️ Error processing due date {actual_end_date}: {e}")
        
        try:
            response = requests.put(url, headers=headers, json=data, timeout=30)
            if response.status_code == 200:
                updates = ["closed"]
                if 'due_date' in data:
                    updates.append("due date updated")
                print(f"✅ Successfully {' and '.join(updates)} GitLab issue #{issue_id} in project {project_id}")
                return True
            else:
                print(f"❌ Failed to close issue #{issue_id} (Status: {response.status_code})")
                print(f"   Response: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Error closing issue #{issue_id}: {e}")
            return False
    
    
    def update_gitlab_issue(self, issue_id, title=None, description=None, state_event=None, project_name="", actual_end_date=""):
        """Update GitLab issue only if values have changed"""
        # Check current state first
        current_details = self.get_gitlab_issue_details(issue_id, project_name)
        if not current_details:
            return False
        
        # Check what actually needs updating
        updates_needed = {}
        
        if title and title != current_details['title']:
            updates_needed['title'] = title
        
        if description and description != current_details['description']:
            updates_needed['description'] = description
        
        # Handle due date update (actual_end_date in sheets maps to due_date in GitLab)
        if actual_end_date:
            # Convert date format if needed (assume DD-MM-YYYY from sheets to YYYY-MM-DD for GitLab)
            try:
                if '-' in actual_end_date and len(actual_end_date.split('-')) == 3:
                    parts = actual_end_date.split('-')
                    if len(parts[0]) == 2:  # DD-MM-YYYY format
                        formatted_date = f"{parts[2]}-{parts[1]}-{parts[0]}"  # Convert to YYYY-MM-DD
                    else:  # Already YYYY-MM-DD format
                        formatted_date = actual_end_date
                else:
                    formatted_date = actual_end_date
                
                current_due_date = current_details.get('due_date', '')
                if formatted_date != current_due_date:
                    updates_needed['due_date'] = formatted_date
                    print(f"📅 Due date will be updated: {current_due_date} → {formatted_date}")
            except Exception as e:
                print(f"⚠️ Error processing due date {actual_end_date}: {e}")
        
        if state_event:
            if state_event == "close" and current_details['state'] == 'closed':
                print(f"ℹ️ Issue #{issue_id} is already closed - skipping")
                return True
            elif state_event == "reopen" and current_details['state'] == 'opened':
                print(f"ℹ️ Issue #{issue_id} is already open - checking for other updates")
                # Don't return here, continue to check for other updates like due_date
            else:
                updates_needed['state_event'] = state_event
        
        if not updates_needed:
            print(f"ℹ️ No updates needed for issue #{issue_id} - values unchanged")
            return True
        
        # Get the correct project ID based on project name
        if project_name:
            project_id = config.get_project_id_by_name(project_name)
        else:
            project_id = config.PROJECT_ID
        
        url = f"{config.GITLAB_URL}projects/{project_id}/issues/{issue_id}"
        headers = {
            "PRIVATE-TOKEN": config.GITLAB_TOKEN,
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.put(url, headers=headers, json=updates_needed, timeout=30)
            if response.status_code == 200:
                action = "updated"
                if state_event == "close":
                    action = "closed"
                elif state_event == "reopen":
                    if 'state_event' in updates_needed:
                        action = "reopened"
                    # If no state_event in updates_needed, it was already open so just say "updated"
                
                updated_fields = list(updates_needed.keys())
                print(f"✅ Successfully {action} GitLab issue #{issue_id} in project {project_id}")
                print(f"   📝 Updated fields: {', '.join(updated_fields)}")
                return True
            else:
                print(f"❌ Failed to update issue #{issue_id} (Status: {response.status_code})")
                print(f"   Response: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Error updating issue #{issue_id}: {e}")
            return False
    
    def add_time_to_gitlab(self, issue_id, hours, project_name=""):
        """Add time spent to GitLab issue only if not already logged"""
        if not hours or hours <= 0:
            return False
        
        # Check current time spent first
        current_details = self.get_gitlab_issue_details(issue_id, project_name)
        if not current_details:
            return False
        
        # Convert hours to seconds for comparison
        hours_in_seconds = float(hours) * 3600
        current_time_spent = current_details.get('total_time_spent', 0)
        
        # Check if this amount of time (or more) has already been logged
        if current_time_spent >= hours_in_seconds:
            print(f"ℹ️ Issue #{issue_id} already has {current_time_spent/3600:.1f}h logged (≥{hours}h) - skipping time addition")
            return True
        
        # Calculate the difference to add
        time_to_add = hours_in_seconds - current_time_spent
        hours_to_add = time_to_add / 3600
        
        # Get the correct project ID based on project name
        if project_name:
            project_id = config.get_project_id_by_name(project_name)
        else:
            project_id = config.PROJECT_ID
            
        url = f"{config.GITLAB_URL}/projects/{project_id}/issues/{issue_id}/add_spent_time"
        headers = {"PRIVATE-TOKEN": config.GITLAB_TOKEN}
        data = {
            "duration": f"{hours_to_add:.1f}h",
            "comment": f"Time logged from Google Sheets: +{hours_to_add:.1f}h (total target: {hours}h)"
        }
        
        try:
            response = requests.post(url, headers=headers, data=data, timeout=30)
            if response.status_code == 201:
                print(f"✅ Added {hours_to_add:.1f}h to issue #{issue_id} in project {project_id}")
                print(f"   ⏱️ Previous: {current_time_spent/3600:.1f}h → Target: {hours}h")
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
            git_id = record.get('GIT ID', '').strip().replace('#', '')  # Remove # from hyperlink
            sub_task = record.get('Sub Task', '').strip()
            status = record.get('Status', '').strip()
            main_task = record.get('Main Task', '').strip()
            project_name = record.get('Project Name', '').strip()
            specific_project = record.get('Specific Project Name', '').strip()
            actual_estimation = record.get('Actual Estimation (H)', '').strip()
            planned_estimation = record.get('Planned Estimation (H)', '').strip()
            actual_end_date = record.get('Actual End Date', '').strip()
            
            if not sub_task:  # Skip rows without sub-task
                continue
            
            print(f"\n📝 Processing row {row_index + 2}: {sub_task}")
            
            # Check if GIT ID exists
            if not git_id:
                # Create new GitLab issue using sub-task as title
                title = sub_task
                
                new_git_id = self.create_gitlab_issue(title, "", project_name, planned_estimation, actual_estimation, actual_end_date)
                if new_git_id:
                    # Update the sheet with new GIT ID
                    self.update_git_id_in_sheet(row_index, new_git_id, project_name)
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
                                self.add_time_to_gitlab(git_id_int, hours, project_name)
                        except (ValueError, TypeError):
                            print(f"⚠️ Invalid time format for issue #{git_id}: {actual_estimation}")
                    
                    # Handle status and due date updates
                    
                    # Handle status changes
                    if status.lower() == "completed":
                        self.close_gitlab_issue(git_id_int, project_name, actual_end_date)
                    else:
                        # For non-completed issues, check if state or due date needs updating
                        self.update_gitlab_issue(git_id_int, state_event="reopen", project_name=project_name, actual_end_date=actual_end_date)
                
                except (ValueError, TypeError):
                    print(f"⚠️ Invalid GIT ID format: {git_id}")
        
        print("\n✅ Sync completed!")

if __name__ == "__main__":
    sync = SheetsToGitLab()
    sync.sync_sheets_to_gitlab()
