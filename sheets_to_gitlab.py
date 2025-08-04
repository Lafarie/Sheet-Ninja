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
from dotenv import load_dotenv

# Create a session for better WAF handling
session = requests.Session()
session.headers.update({
    'User-Agent': 'GitLab-Sheets-Sync/1.0',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
})

# Load environment variables from the temporary .env file created by the API
# Check for environment variables first, then fall back to centralized paths
env_file = os.getenv('ENV_FILE')
if not env_file:
    env_file = config.PATHS['env_file']

if os.path.exists(env_file):
    # Clear any existing environment variables that might interfere
    for key in ['SPREADSHEET_ID', 'WORKSHEET_NAME', 'GITLAB_URL', 'GITLAB_TOKEN', 'PROJECT_ID', 
                'DEFAULT_ASSIGNEE', 'DEFAULT_MILESTONE', 'DEFAULT_LABEL']:
        if key in os.environ:
            del os.environ[key]
    
    load_dotenv(env_file, override=True)
    print(f"✅ Loaded environment from file: {env_file}")
    
    # Debug: Check what's actually in the environment
    print("🔍 Debug - Environment variables loaded:")
    print(f"   SPREADSHEET_ID: {os.getenv('SPREADSHEET_ID', 'NOT_SET')}")
    print(f"   WORKSHEET_NAME: {os.getenv('WORKSHEET_NAME', 'NOT_SET')}")
    print(f"   GITLAB_URL: {os.getenv('GITLAB_URL', 'NOT_SET')}")
    print(f"   PROJECT_ID: {os.getenv('PROJECT_ID', 'NOT_SET')}")
    
    # Manual fallback: Read the file directly if load_dotenv didn't work
    if os.getenv('SPREADSHEET_ID') == 'NOT_SET' or os.getenv('SPREADSHEET_ID') == config.SPREADSHEET_ID:
        print("⚠️ load_dotenv didn't work, trying manual file reading...")
        try:
            with open(env_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        os.environ[key] = value
                        print(f"   Manually set {key}={value}")
        except Exception as e:
            print(f"❌ Error reading env file manually: {e}")
else:
    print(f"⚠️ Environment file not found: {env_file}")
    print("Using default config values")

# Get environment variables with fallback to config ONLY if not set in env file
SPREADSHEET_ID = os.getenv('SPREADSHEET_ID')
if not SPREADSHEET_ID:
    SPREADSHEET_ID = config.SPREADSHEET_ID

WORKSHEET_NAME = os.getenv('WORKSHEET_NAME')
if not WORKSHEET_NAME:
    WORKSHEET_NAME = config.WORKSHEET_NAME

GITLAB_URL = os.getenv('GITLAB_URL')
if not GITLAB_URL:
    GITLAB_URL = config.GITLAB_URL

GITLAB_TOKEN = os.getenv('GITLAB_TOKEN')
if not GITLAB_TOKEN:
    GITLAB_TOKEN = config.GITLAB_TOKEN

PROJECT_ID = os.getenv('PROJECT_ID')
if not PROJECT_ID:
    PROJECT_ID = config.PROJECT_ID

DEFAULT_ASSIGNEE = os.getenv('DEFAULT_ASSIGNEE', config.DEFAULT_ASSIGNEE)
DEFAULT_MILESTONE = os.getenv('DEFAULT_MILESTONE', config.DEFAULT_MILESTONE)
DEFAULT_LABEL = os.getenv('DEFAULT_LABEL', config.DEFAULT_LABEL)
ENABLE_DATE_FILTER = os.getenv('ENABLE_DATE_FILTER', 'false').lower() == 'true'
START_DATE = os.getenv('START_DATE', '')
END_DATE = os.getenv('END_DATE', '')
ENABLE_AUTO_CLOSE = os.getenv('ENABLE_AUTO_CLOSE', 'true').lower() == 'true'

# Debug: Check what values we're actually using
print("🔍 Debug - Final values being used:")
print(f"   SPREADSHEET_ID: {SPREADSHEET_ID}")
print(f"   WORKSHEET_NAME: {WORKSHEET_NAME}")
print(f"   GITLAB_URL: {GITLAB_URL}")
print(f"   PROJECT_ID: {PROJECT_ID}")

class SheetsToGitLab:
    def __init__(self):
        # Use the environment variables loaded at module level
        self.spreadsheet_id = SPREADSHEET_ID
        self.worksheet_name = WORKSHEET_NAME
        self.service = self._authenticate_google_sheets()
        print("✅ Connected to Google Sheets API with Service Account")
        print(f"📊 Using Spreadsheet ID: {self.spreadsheet_id}")
        print(f"📋 Using Worksheet Name: {self.worksheet_name}")
    
    def _authenticate_google_sheets(self):
        """Authenticate with Google Sheets using Service Account"""
        try:
            # Use centralized path configuration
            service_account_file = config.PATHS['service_account_file']
            
            # If uploaded file doesn't exist, fall back to default
            if not os.path.exists(service_account_file):
                service_account_file = config.SERVICE_ACCOUNT_FILE
            
            # Check if service account file exists
            if not os.path.exists(service_account_file):
                raise FileNotFoundError(f"Service account file not found: {service_account_file}")
            
            print(f"🔐 Using service account file: {service_account_file}")
            
            # Create credentials from service account file
            credentials = service_account.Credentials.from_service_account_file(
                service_account_file,
                scopes=config.SCOPES
            )
            
            # Build the service
            service = build('sheets', 'v4', credentials=credentials)
            return service
            
        except Exception as e:
            print(f"❌ Failed to authenticate with Google Sheets: {e}")
            print(f"💡 Make sure the service account file exists and contains valid credentials")
            raise
    
    def get_sheet_values(self, range_name):
        """Get values from Google Sheet using Service Account"""
        try:
            print(f"🔍 Attempting to get values from range: {range_name}")
            print(f"📊 Spreadsheet ID: {self.spreadsheet_id}")
            
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=range_name
            ).execute()
            
            values = result.get('values', [])
            # print(f"📋 Retrieved {len(values)} rows from sheet")
            
            if values:
                print(f"📝 First row (headers): {values[0]}")
                if len(values) > 1:
                    print(f"📝 {len(values) - 1} active rows of data found")
                else:
                    print("⚠️ Only headers found, no data rows")
            else:
                print("⚠️ No values returned from sheet")
            
            return values
            
        except HttpError as e:
            print(f"❌ Failed to get sheet values: {e}")
            print(f"🔍 HTTP Error details: {e.resp.status} - {e.resp.reason}")
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
        """Get all data from Google Sheet with dynamic column mapping"""
        try:
            # Get all values including headers
            all_values = self.get_sheet_values(f"{self.worksheet_name}!A:Z")  # Extended range to handle more columns
            
            # If no data found, try a smaller range
            if not all_values or len(all_values) < 2:
                print("🔄 Trying smaller range A:J...")
                all_values = self.get_sheet_values(f"{self.worksheet_name}!A:J")
            
            # If still no data, try just the first few rows
            if not all_values or len(all_values) < 2:
                print("🔄 Trying first 10 rows...")
                all_values = self.get_sheet_values(f"{self.worksheet_name}!A1:Z10")
            
            if len(all_values) < 2:  # No data rows
                print("⚠️ No data rows found in sheet")
                print(f"🔍 Worksheet name: {self.worksheet_name}")
                print(f"🔍 Spreadsheet ID: {self.spreadsheet_id}")
                return []
            
            detected_headers = all_values[0]
            data_rows = all_values[1:]
            
            # Validate column configuration against detected headers
            print(f"🔍 Detected {len(detected_headers)} columns in sheet")
            
            # Auto-detect column mapping if headers don't match
            column_mapping = {}
            mismatched_columns = []
            
            for key, column_config in config.COLUMN_CONFIG.items():
                expected_index = column_config["index"]
                expected_header = column_config["header"]
                
                # Check if the expected column exists and matches
                if expected_index <= len(detected_headers):
                    actual_header = detected_headers[expected_index - 1]
                    if actual_header.lower().strip() == expected_header.lower().strip():
                        column_mapping[key] = expected_index - 1  # Convert to 0-based index
                    else:
                        mismatched_columns.append(f"{key}: expected '{expected_header}' but found '{actual_header}' in column {expected_index}")
                        # Try to find by header name
                        for i, header in enumerate(detected_headers):
                            if header.lower().strip() == expected_header.lower().strip():
                                column_mapping[key] = i
                                print(f"🔍 Auto-mapped {key} from column {expected_index} to column {i + 1}")
                                break
                else:
                    mismatched_columns.append(f"{key}: column {expected_index} doesn't exist (only {len(detected_headers)} columns)")
            
            if mismatched_columns:
                print("⚠️ Column mapping issues detected:")
                for issue in mismatched_columns:
                    print(f"   {issue}")
                print("💡 Consider running column_manager.py to fix column mappings")
            
            # Parse data rows with dynamic mapping
            records = []
            for row_index, row in enumerate(data_rows):
                # Pad row with empty strings if it's shorter than detected headers
                padded_row = row + [''] * (len(detected_headers) - len(row))
                
                # Create record using dynamic column mapping
                record = {}
                for key, column_index in column_mapping.items():
                    if column_index < len(padded_row):
                        record[key] = padded_row[column_index]
                    else:
                        record[key] = ""
                
                # Add row index for reference
                record['_row_index'] = row_index
                records.append(record)
            
            # print(f"✅ Found {len(records)} rows in Google Sheet")
            print(f"📊 Successfully mapped {len(column_mapping)} columns")
            return records
            
        except Exception as e:
            print(f"❌ Error reading Google Sheet: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    def create_gitlab_issue(self, title, description="", project_name="", planned_estimation="", actual_estimation="", actual_end_date=""):
        """Create a new GitLab issue"""
        try:
            # Use module-level environment variables
            gitlab_url = GITLAB_URL
            gitlab_token = GITLAB_TOKEN
            project_id = PROJECT_ID
            default_assignee = DEFAULT_ASSIGNEE
            default_milestone = DEFAULT_MILESTONE
            default_label = DEFAULT_LABEL
            
            # Prepare issue data
            issue_data = {
                'title': title,
                'description': description,
                'project_id': project_id
            }
            
            # Add assignee if specified
            if default_assignee:
                issue_data['assignee_ids'] = [default_assignee.replace('@', '')]
            
            # Add milestone if specified
            if default_milestone:
                issue_data['milestone_id'] = default_milestone.replace('%', '')  # Remove % prefix
            
            # Add label if specified
            if default_label:
                issue_data['labels'] = [default_label.replace('~', '')]  # Remove ~ prefix
            
            # Make the API request with retry logic
            headers = {
                'PRIVATE-TOKEN': gitlab_token,
                'Content-Type': 'application/json',
                'User-Agent': 'GitLab-Sheets-Sync/1.0',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
            
            # Try up to 3 times with delays
            for attempt in range(3):
                if attempt > 0:
                    print(f"│   🔄 Retry attempt {attempt + 1}/3...")
                    import time
                    time.sleep(2)  # Wait 2 seconds between retries
                
                response = session.post(
                    f"{gitlab_url}projects/{project_id}/issues",
                    headers=headers,
                    json=issue_data,
                    timeout=30
                )
                
                # Handle WAF challenges
                if self.handle_waf_challenge(response):
                    if attempt < 2:  # Retry after WAF challenge
                        continue
                
                # Accept both 201 (Created) and 202 (Accepted) as success
                if response.status_code in [201, 202]:
                    if response.status_code == 201 and response.json():
                        issue = response.json()
                        issue_id = issue['iid']
                        print(f"│   ✅ Created issue #{issue_id}: {title}")
                    else:
                        # For 202 status, we need to extract the issue ID from the response or headers
                        # Try to get the issue ID from the Location header or response
                        location_header = response.headers.get('Location', '')
                        if location_header:
                            # Extract issue ID from Location header like: /api/v4/projects/98/issues/1234
                            issue_id_match = re.search(r'/issues/(\d+)$', location_header)
                            if issue_id_match:
                                issue_id = issue_id_match.group(1)
                                print(f"│   ✅ Created issue #{issue_id}: {title} (Status: 202)")
                            else:
                                print(f"│   ⚠️ Issue created (Status: 202) but couldn't extract ID from Location header: {location_header}")
                                return None
                        else:
                            # For 202 status without Location header, we'll need to search for the issue
                            print(f"│   ⚠️ Issue created (Status: 202) but no Location header found")
                            print(f"│   🔍 Response headers: {dict(response.headers)}")
                            print(f"│   🔍 Response body: {response.text}")
                            # Try to extract from response body if it contains JSON
                            try:
                                if response.text and response.text.strip():
                                    response_data = response.json()
                                    if 'iid' in response_data:
                                        issue_id = response_data['iid']
                                        print(f"│   ✅ Created issue #{issue_id}: {title} (Status: 202 - extracted from response)")
                                    else:
                                        print(f"│   ⚠️ Issue created (Status: 202) but no issue ID in response")
                                        return None
                                else:
                                    print(f"│   ⚠️ Issue created (Status: 202) but empty response body")
                                    # Wait a bit before searching to allow the issue to be created
                                    print(f"│   ⏳ Waiting 3 seconds before searching for created issue...")
                                    import time
                                    time.sleep(3)
                                    # Try to find the issue by title as a last resort
                                    print(f"│   🔍 Searching for created issue by title...")
                                    found_issue_id = self.find_issue_by_title(title, project_id)
                                    if found_issue_id:
                                        issue_id = found_issue_id
                                        print(f"│   ✅ Found created issue #{issue_id}: {title} (Status: 202 - found by search)")
                                    else:
                                        print(f"│   ❌ Could not find created issue by title - sync may be incomplete")
                                        return None
                            except Exception as e:
                                print(f"│   ⚠️ Issue created (Status: 202) but couldn't parse response: {e}")
                                # Wait a bit before searching to allow the issue to be created
                                print(f"│   ⏳ Waiting 3 seconds before searching for created issue...")
                                import time
                                time.sleep(3)
                                # Try to find the issue by title as a last resort
                                print(f"│   🔍 Searching for created issue by title...")
                                found_issue_id = self.find_issue_by_title(title, project_id)
                                if found_issue_id:
                                    issue_id = found_issue_id
                                    print(f"│   ✅ Found created issue #{issue_id}: {title} (Status: 202 - found by search)")
                                else:
                                    print(f"│   ❌ Could not find created issue by title - sync may be incomplete")
                                    return None
                    
                    # Add time estimation if provided
                    if planned_estimation:
                        self.add_time_to_gitlab(issue_id, planned_estimation, project_name)
                    
                    # Add actual time if provided
                    if actual_estimation:
                        self.add_time_to_gitlab(issue_id, actual_estimation, project_name)
                    
                    return str(issue_id)
                else:
                    print(f"│   ❌ Failed to create issue (Status: {response.status_code}) Response: {response.text}")
                    if attempt < 2:  # Don't print retry message on last attempt
                        continue
                    else:
                        return None
            else:
                print(f"│   ❌ Failed to create issue after 3 attempts")
                return None
                
        except Exception as e:
            print(f"│   ❌ Error creating GitLab issue: {e}")
            return None
    
    def update_git_id_in_sheet(self, row_number, git_id, project_name="", actual_end_date=""):
        """Update the GIT ID in the Google Sheet with clickable link only if different"""
        try:
            # Get the correct column for GIT_ID from the configuration
            git_id_column_index = None
            for key, column_config in config.COLUMN_CONFIG.items():
                if key == 'GIT_ID':
                    git_id_column_index = column_config["index"] - 1  # Convert to 0-based index
                    break
            
            if git_id_column_index is None:
                print(f"❌ GIT_ID column not found in configuration")
                return
            
            # Convert column index to letter (A=0, B=1, C=2, etc.)
            column_letter = chr(65 + git_id_column_index)  # 65 is ASCII for 'A'
            cell_range = f"{self.worksheet_name}!{column_letter}{row_number + 2}"  # +2 for header and 0-index
            
            print(f"🔍 Updating GIT ID in cell {cell_range} (column {column_letter}, row {row_number + 2})")
            
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
                            print(f"ℹ️ GIT ID {git_id} already exists in {cell_range} - skipping update")
                            return
                elif current_value == str(git_id):
                    print(f"ℹ️ GIT ID {git_id} already exists in {cell_range} - skipping update")
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
            
            print(f"✅ Updated GIT ID in {cell_range}: {issue_url} (clickable link)")
            
            # Color only the GIT_ID column cell to highlight it
            self.color_cell_green(row_number + 2, git_id_column_index)
            
        except Exception as e:
            print(f"❌ Error updating GIT ID in sheet: {e}")
            import traceback
            traceback.print_exc()
    
    def check_and_color_weekend_row(self, row_number):
        """Check if tomorrow is weekend and color the row red"""
        # This function is no longer used - removed for cleaner code
        pass
    
    def _get_sheet_id(self):
        """Get the sheet ID for the current worksheet"""
        try:
            # Get spreadsheet metadata
            result = self.service.spreadsheets().get(
                spreadsheetId=self.spreadsheet_id,
                fields='sheets.properties'
            ).execute()
            
            sheets = result.get('sheets', [])
            for sheet in sheets:
                properties = sheet.get('properties', {})
                if properties.get('title') == self.worksheet_name:
                    return properties.get('sheetId')
            
            return None
            
        except Exception as e:
            print(f"❌ Error getting sheet ID: {e}")
            return None
    
    def color_row_red(self, row_number):
        """Color entire row red using Google Sheets API"""
        # This function is no longer used - removed for cleaner code
        pass
    
    def color_row_green(self, row_number):
        """Color entire row green to highlight successful updates"""
        # This function is no longer used - removed for cleaner code
        pass
    
    def color_cell_green(self, row_number, column_index):
        """Color a specific cell green to highlight successful updates"""
        try:
            # Get the correct sheet ID first
            sheet_id = self._get_sheet_id()
            if sheet_id is None:
                print(f"❌ Could not find sheet ID for worksheet: {self.worksheet_name}")
                return
            
            # Convert to 0-based index for API
            row_index = row_number - 1
            column_index_0_based = column_index
            
            request_body = {
                'requests': [
                    {
                        'repeatCell': {
                            'range': {
                                'sheetId': sheet_id,  # Use dynamic sheet ID
                                'startRowIndex': row_index,
                                'endRowIndex': row_index + 1,
                                'startColumnIndex': column_index_0_based,
                                'endColumnIndex': column_index_0_based + 1
                            },
                            'cell': {
                                'userEnteredFormat': {
                                    'backgroundColor': {
                                        'red': 0.8,
                                        'green': 1.0,
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
            
            print(f"🎨 Colored cell {chr(65 + column_index)}{row_number} green (GIT ID updated)")
            
        except Exception as e:
            print(f"❌ Error coloring cell green: {e}")
    
    def get_gitlab_issue_details(self, issue_id, project_name=""):
        """Get GitLab issue details"""
        try:
            # Use module-level environment variables
            gitlab_url = GITLAB_URL
            gitlab_token = GITLAB_TOKEN
            project_id = PROJECT_ID
            
            headers = {
                'PRIVATE-TOKEN': gitlab_token,
                'Content-Type': 'application/json'
            }
            
            response = requests.get(
                f"{gitlab_url}projects/{project_id}/issues/{issue_id}",
                headers=headers
            )
            
            # Accept both 200 (OK) and 202 (Accepted) as success
            if response.status_code in [200, 202]:
                if response.status_code == 200 and response.json():
                    return response.json()
                else:
                    # For 202 status, the issue might be processing
                    print(f"│   ⚠️ Issue #{issue_id} is being processed (Status: 202)")
                    return None
            else:
                print(f"│   ❌ Failed to get issue details (Status: {response.status_code})")
                return None
                
        except Exception as e:
            print(f"│   ❌ Error getting issue details: {e}")
            return None
    
    def close_gitlab_issue(self, issue_id, project_name="", actual_end_date=""):
        """Close a GitLab issue"""
        try:
            # Use module-level environment variables
            gitlab_url = GITLAB_URL
            gitlab_token = GITLAB_TOKEN
            project_id = PROJECT_ID
            
            headers = {
                'PRIVATE-TOKEN': gitlab_token,
                'Content-Type': 'application/json'
            }
            
            # Close the issue
            data = {'state_event': 'close'}
            
            response = requests.put(
                f"{gitlab_url}projects/{project_id}/issues/{issue_id}",
                headers=headers,
                json=data
            )
            
            # Accept both 200 (OK) and 202 (Accepted) as success
            if response.status_code in [200, 202]:
                if response.status_code == 200:
                    print(f"│   ✅ Closed issue #{issue_id}")
                else:
                    print(f"│   ✅ Closed issue #{issue_id} (Status: 202 - Accepted)")
                return True
            else:
                print(f"│   ❌ Failed to close issue #{issue_id} (Status: {response.status_code})")
                return False
                
        except Exception as e:
            print(f"│   ❌ Error closing issue #{issue_id}: {e}")
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
            # Accept both 200 (OK) and 202 (Accepted) as success
            if response.status_code in [200, 202]:
                action = "updated"
                if state_event == "close":
                    action = "closed"
                elif state_event == "reopen":
                    if 'state_event' in updates_needed:
                        action = "reopened"
                    # If no state_event in updates_needed, it was already open so just say "updated"
                
                updated_fields = list(updates_needed.keys())
                if response.status_code == 200:
                    print(f"✅ Successfully {action} GitLab issue #{issue_id} in project {project_id}")
                else:
                    print(f"✅ Successfully {action} GitLab issue #{issue_id} in project {project_id} (Status: 202 - Accepted)")
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
        """Add time to GitLab issue"""
        try:
            # Use module-level environment variables
            gitlab_url = GITLAB_URL
            gitlab_token = GITLAB_TOKEN
            project_id = PROJECT_ID
            
            headers = {
                'PRIVATE-TOKEN': gitlab_token,
                'Content-Type': 'application/json'
            }
            
            # Add time using the GitLab API
            data = {'duration': f"{hours}h"}
            
            response = requests.post(
                f"{gitlab_url}projects/{project_id}/issues/{issue_id}/add_spent_time",
                headers=headers,
                json=data
            )
            
            # Accept both 201 (Created) and 202 (Accepted) as success
            if response.status_code in [201, 202]:
                if response.status_code == 201:
                    print(f"│   ⏱️ Added {hours}h to issue #{issue_id}")
                else:
                    print(f"│   ⏱️ Added {hours}h to issue #{issue_id} (Status: 202 - Accepted)")
                return True
            else:
                print(f"│   ❌ Failed to add time to issue #{issue_id} (Status: {response.status_code})")
                return False
                
        except Exception as e:
            print(f"│   ❌ Error adding time to issue #{issue_id}: {e}")
            return False
    
    def sync_sheets_to_gitlab(self):
        """Main sync function - reads Google Sheet and creates/updates GitLab issues"""
        print("🔄 Starting Google Sheets to GitLab sync...")
        
        # Use module-level environment variables
        gitlab_url = GITLAB_URL
        gitlab_token = GITLAB_TOKEN
        project_id = PROJECT_ID
        default_assignee = DEFAULT_ASSIGNEE
        default_milestone = DEFAULT_MILESTONE
        default_label = DEFAULT_LABEL
        enable_date_filter = ENABLE_DATE_FILTER
        start_date = START_DATE
        end_date = END_DATE
        enable_auto_close = ENABLE_AUTO_CLOSE
        
        print(f"📊 GitLab URL: {gitlab_url}")
        print(f"📊 Project ID: {project_id}")
        print(f"📊 Default Assignee: {default_assignee}")
        print(f"📊 Default Milestone: {default_milestone}")
        print(f"📊 Default Label: {default_label}")
        print(f"📊 Date Filter Enabled: {enable_date_filter}")
        print(f"📊 Auto Close Enabled: {enable_auto_close}")
        
        # Check if date filtering is enabled
        if enable_date_filter and start_date and end_date:
            try:
                start_date_obj = datetime.strptime(start_date, '%Y-%m-%d').date()
                end_date_obj = datetime.strptime(end_date, '%Y-%m-%d').date()
                print(f"│   📅 Date filter enabled: {start_date_obj} to {end_date_obj}")
            except ValueError as e:
                print(f"│   ⚠️ Invalid date format: {e}")
                enable_date_filter = False
        else:
            enable_date_filter = False
            print("│   📅 Date filter disabled - processing all tasks")
        
        records = self.get_sheet_data()
        if not records:
            print("❌ No data found in Google Sheet")
            print("└─ ❌ Sync Failed - No data available")
            return
        
        # Check if there are any tasks to process
        tasks_to_process = 0
        for record in records:
            git_id = record.get('GIT_ID', '').strip().replace('#', '')
            project_name = record.get('PROJECT_NAME', '').strip()
            main_task = record.get('MAIN_TASK', '').strip()
            
            # Only count tasks that have no GIT_ID AND have both Project Name and Main Task
            if not git_id and project_name and main_task:
                tasks_to_process += 1
        
        if tasks_to_process == 0:
            print("⚠️ No tasks to process - all tasks already have GIT_ID or missing required fields")
            print("└─ ✅ Sync completed - no new tasks to create")
            return
        
        # Filter records by date if enabled
        if enable_date_filter:
            filtered_records = []
            for record in records:
                date_str = record.get('DATE', '').strip()
                if date_str:
                    try:
                        # Try different date formats
                        task_date = None
                        for date_format in ['%Y-%m-%d', '%d-%m-%Y', '%m/%d/%Y', '%d/%m/%Y']:
                            try:
                                task_date = datetime.strptime(date_str, date_format).date()
                                break
                            except ValueError:
                                continue
                        
                        if task_date and start_date_obj <= task_date <= end_date_obj:
                            filtered_records.append(record)
                        else:
                            print(f"│   ⏭️ Skipping row {record.get('_row_index', '?') + 2}: date {date_str} outside range")
                    except Exception as e:
                        print(f"│   ⚠️ Error parsing date '{date_str}': {e}")
                        # Include records with invalid dates if they don't have GIT_ID
                        if not record.get('GIT_ID', '').strip():
                            filtered_records.append(record)
                else:
                    # Include records without dates if they don't have GIT_ID
                    if not record.get('GIT_ID', '').strip():
                        filtered_records.append(record)
            
            records = filtered_records
            print(f"│   📊 Filtered to {len(records)} tasks within date range")
        
        # Recalculate tasks to process after filtering
        tasks_to_process = 0
        for record in records:
            git_id = record.get('GIT_ID', '').strip().replace('#', '')
            project_name = record.get('PROJECT_NAME', '').strip()
            main_task = record.get('MAIN_TASK', '').strip()
            
            # Only count tasks that have no GIT_ID AND have both Project Name and Main Task
            if not git_id and project_name and main_task:
                tasks_to_process += 1
        
        if tasks_to_process == 0:
            print("⚠️ No tasks to process after filtering - all tasks already have GIT_ID")
            print("└─ ✅ Sync completed - no new tasks to create")
            return
        
        # print(f"│   ✅ Found {len(records)} tasks to process")
        print(f"│   ✅ Found {tasks_to_process} tasks to process (no GIT_ID + Project Name + Main Task)")
        print("│")
        print("├─ 🎯 Creating GitLab Issues...")
        
        tasks_to_create = 0
        tasks_to_update = 0
        
        # First pass: count tasks that need creation vs update
        skipped_ranges = []  # Track ranges of skipped rows
        current_skip_start = None
        
        for record in records:
            git_id = record.get('GIT_ID', '').strip().replace('#', '')
            project_name = record.get('PROJECT_NAME', '').strip()
            main_task = record.get('MAIN_TASK', '').strip()
            row_index = record.get('_row_index', 0) + 2  # Convert to actual row number
            
            if not git_id:
                # Only count as task to create if both Project Name and Task Description are present
                if project_name and main_task:
                    # If we were tracking a skip range, close it
                    if current_skip_start is not None:
                        if current_skip_start == row_index - 1:
                            skipped_ranges.append(str(current_skip_start))
                        else:
                            skipped_ranges.append(f"{current_skip_start}-{row_index - 1}")
                        current_skip_start = None
                    tasks_to_create += 1
                else:
                    # Start or continue tracking a skip range
                    if current_skip_start is None:
                        current_skip_start = row_index
            else:
                # If we were tracking a skip range, close it
                if current_skip_start is not None:
                    if current_skip_start == row_index - 1:
                        skipped_ranges.append(str(current_skip_start))
                    else:
                        skipped_ranges.append(f"{current_skip_start}-{row_index - 1}")
                    current_skip_start = None
                tasks_to_update += 1
        
        # Close any remaining skip range
        if current_skip_start is not None:
            last_row = len(records) + 1
            if current_skip_start == last_row:
                skipped_ranges.append(str(current_skip_start))
            else:
                skipped_ranges.append(f"{current_skip_start}-{last_row}")
        
        # Show skipped row ranges if any
        if skipped_ranges:
            print(f"│   ⏭️ Skipped rows (missing Project Name or Task Description): {', '.join(skipped_ranges)}")
        
        print(f"│   📋 Tasks to create: {tasks_to_create}")
        print(f"│   🔄 Tasks to update: {tasks_to_update}")
        print("│")
        
        # If no tasks to create, stop here
        if tasks_to_create == 0:
            print("⚠️ No new tasks to create - all tasks already have GIT_ID")
            print("└─ ✅ Sync completed - no new tasks to create")
            return
        
        created_count = 0
        updated_count = 0
        
        for row_index, record in enumerate(records):
            # Use dynamic column mapping to extract values
            git_id = record.get('GIT_ID', '').strip().replace('#', '')  # Remove # from hyperlink
            sub_task = record.get('SUB_TASK', '').strip()
            status = record.get('STATUS', '').strip()
            main_task = record.get('MAIN_TASK', '').strip()
            project_name = record.get('PROJECT_NAME', '').strip()
            specific_project = record.get('SPECIFIC_PROJECT', '').strip()
            actual_estimation = record.get('ACTUAL_ESTIMATION', '').strip()
            planned_estimation = record.get('PLANNED_ESTIMATION', '').strip()
            actual_end_date = record.get('END_DATE', '').strip()
            
            # Get the actual row index from the record
            actual_row_index = record.get('_row_index', row_index)
            
            if not main_task:  # Skip rows without main task
                continue
            
            # Only process tasks that need to be created (no GIT_ID AND have required fields)
            if not git_id:
                # Check if both Project Name and Task Description are present
                if not project_name or not main_task:
                    continue
                    
                print(f"│   📝 Processing row {actual_row_index + 2}: {main_task[:50]}{'...' if len(main_task) > 50 else ''}")
                
                # Create new GitLab issue using main-task as title
                title = main_task
                
                print(f"│   🆕 Creating new issue...")
                new_git_id = self.create_gitlab_issue(title, sub_task, project_name, planned_estimation, actual_estimation, actual_end_date)
                if new_git_id:
                    created_count += 1
                    print(f"│   ✅ Created issue #{new_git_id}")
                    
                    # Check if auto-close is enabled and status indicates completion
                    if enable_auto_close and status and status.lower() in ['closed', 'done', 'completed', 'finished']:
                        print(f"│   🔒 Closing newly created issue #{new_git_id}")
                        self.close_gitlab_issue(new_git_id, project_name, actual_end_date)
                    
                    # Update the sheet with new GIT ID
                    print(f"│   📝 Updating Sheet with GIT ID...")
                    self.update_git_id_in_sheet(actual_row_index, new_git_id, project_name)
                    git_id = str(new_git_id)
                else:
                    print(f"│   ❌ Failed to create issue")
                
                # Show progress for tasks being created
                print(f"│   ── Progress: {created_count}/{tasks_to_create} new issues created")
            else:
                # Process existing tasks for status updates and closing
                try:
                    git_id_int = int(git_id)
                    updated_count += 1
                    print(f"│   🔄 Processing existing issue #{git_id}")
                    
                    # Add time if specified
                    if actual_estimation:
                        try:
                            hours = float(actual_estimation)
                            if hours > 0:
                                print(f"│   ⏱️ Adding {hours}h to issue #{git_id}")
                                self.add_time_to_gitlab(git_id_int, hours, project_name)
                        except ValueError:
                            print(f"│   ⚠️ Invalid actual estimation format: {actual_estimation}")
                    
                    # Update issue status if specified
                    if status:
                        print(f"│   📊 Updating status to: {status}")
                        # Convert common status values to GitLab state events
                        state_event = None
                        status_lower = status.lower().strip()
                        
                        if status_lower in ['done', 'completed', 'finished', 'closed']:
                            state_event = 'close'
                        elif status_lower in ['open', 'reopen', 'in progress', 'started']:
                            state_event = 'reopen'
                        elif status_lower in ['cancel', 'cancelled', 'abandoned']:
                            state_event = 'close'  # GitLab doesn't have cancel, so we close it
                        else:
                            print(f"│   ⚠️ Unknown status '{status}' - skipping status update")
                            state_event = None
                        
                        if state_event:
                            self.update_gitlab_issue(git_id_int, state_event=state_event, project_name=project_name)
                    
                    # Close issue if status indicates completion
                    if status and status.lower() in ['closed', 'done', 'completed', 'finished']:
                        # Check if auto-close is enabled
                        if enable_auto_close:
                            print(f"│   🔒 Closing issue #{git_id}")
                            self.close_gitlab_issue(git_id_int, project_name, actual_end_date)
                        else:
                            print(f"│   ⏸️ Auto-close disabled - issue #{git_id} remains open")
                
                except ValueError:
                    print(f"│   ⚠️ Invalid Git ID format: {git_id}")
                except Exception as e:
                    print(f"│   ❌ Error processing issue {git_id}: {e}")
                
                # Show progress for tasks being updated
                print(f"│   ── Progress: {updated_count}/{tasks_to_update} existing issues updated")
        
        print("│")
        print("├─ 📊 Sync Summary:")
        print(f"│   ✅ Created: {created_count} new issues")
        print(f"│   🔄 Updated: {updated_count} existing issues")
        print(f"│   📋 Total processed: {created_count + updated_count} tasks")
        print("│")
        print("└─ ✅ Sync Completed")
        
        # Provide helpful feedback about column mapping
        print("\n💡 Column Management Tips:")
        print("   • If columns are not syncing correctly, run: python column_manager.py")
        print("   • Use auto-detection to map columns automatically")
        print("   • Configure custom column mappings interactively")
        print(f"   • Current configuration uses {len(config.COLUMNS)} mapped columns")

    def find_issue_by_title(self, title, project_id):
        """Search for an issue by title in the project"""
        try:
            headers = {
                'PRIVATE-TOKEN': GITLAB_TOKEN,
                'Content-Type': 'application/json',
                'User-Agent': 'GitLab-Sheets-Sync/1.0',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
            
            # Search for issues with the exact title
            response = session.get(
                f"{GITLAB_URL}projects/{project_id}/issues",
                headers=headers,
                params={'search': title, 'state': 'opened'}
            )
            
            print(f"│   🔍 Search response status: {response.status_code}")
            print(f"│   🔍 Search response headers: {dict(response.headers)}")
            
            if response.status_code in [200, 202]:
                # Check if response is actually JSON
                if response.text and response.text.strip():
                    try:
                        issues = response.json()
                        if issues:
                            for issue in issues:
                                if issue['title'] == title:
                                    print(f"│   ✅ Found issue #{issue['iid']} by title search")
                                    return issue['iid']
                        else:
                            print(f"│   ⚠️ No issues found with title: {title}")
                    except Exception as e:
                        print(f"│   ⚠️ Could not parse search response as JSON: {e}")
                        print(f"│   🔍 Search response body: {response.text[:200]}...")
                else:
                    print(f"│   ⚠️ Empty search response body")
            else:
                print(f"│   ❌ Search failed with status: {response.status_code}")
                print(f"│   🔍 Search response body: {response.text[:200]}...")
            
            # If search fails, try a different approach - get all open issues and filter
            print(f"│   🔍 Trying alternative search method...")
            response = session.get(
                f"{GITLAB_URL}projects/{project_id}/issues",
                headers=headers,
                params={'state': 'opened', 'per_page': 100}
            )
            
            if response.status_code in [200, 202]:
                if response.text and response.text.strip():
                    try:
                        issues = response.json()
                        if issues:
                            for issue in issues:
                                if issue['title'] == title:
                                    print(f"│   ✅ Found issue #{issue['iid']} by alternative search")
                                    return issue['iid']
                        else:
                            print(f"│   ⚠️ No open issues found in project")
                    except Exception as e:
                        print(f"│   ⚠️ Could not parse alternative search response: {e}")
                else:
                    print(f"│   ⚠️ Empty alternative search response")
            else:
                print(f"│   ❌ Alternative search failed with status: {response.status_code}")
            
            print(f"│   ❌ Could not find issue with title: {title}")
            return None
            
        except Exception as e:
            print(f"│   ❌ Error searching for issue by title: {e}")
            return None

    def handle_waf_challenge(self, response):
        """Handle WAF challenges by detecting them and adding delays"""
        if 'x-amzn-waf-action' in response.headers:
            waf_action = response.headers.get('x-amzn-waf-action', '')
            if waf_action == 'challenge':
                print(f"│   🛡️ WAF challenge detected, waiting 5 seconds...")
                time.sleep(5)
                return True
        return False

if __name__ == "__main__":
    sync = SheetsToGitLab()
    sync.sync_sheets_to_gitlab()
