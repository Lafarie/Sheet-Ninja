# Configuration file for GitLab ↔ Google Sheets Sync
# Sensitive values are loaded from environment variables or .env file

import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# GitLab Settings (from environment variables)
GITLAB_URL = os.getenv('GITLAB_URL', 'https://sourcecontrol.hsenidmobile.com/api/v4/')
PROJECT_ID = os.getenv('PROJECT_ID', '263')
GITLAB_TOKEN = os.getenv('GITLAB_TOKEN')  # Required - no default

if not GITLAB_TOKEN:
    raise ValueError("GITLAB_TOKEN environment variable is required. Please set it in your .env file.")

# Google Sheets Settings (from environment variables)
SPREADSHEET_ID = os.getenv('SPREADSHEET_ID')  # Required - no default
WORKSHEET_NAME = os.getenv('WORKSHEET_NAME', 'Sheet1')

if not SPREADSHEET_ID:
    raise ValueError("SPREADSHEET_ID environment variable is required. Please set it in your .env file.")

# Service Account Authentication (from environment variables)
SERVICE_ACCOUNT_FILE = os.getenv('SERVICE_ACCOUNT_FILE', 'service_account.json')

# Google Sheets API Scopes
SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets'  # Full read/write access to spreadsheets
]

# GitLab Issue Template Settings (from environment variables with defaults)
DEFAULT_ASSIGNEE = os.getenv('DEFAULT_ASSIGNEE', '@farhad.l@appigo.co')
DEFAULT_ESTIMATE = os.getenv('DEFAULT_ESTIMATE', '8h')
DEFAULT_MILESTONE = os.getenv('DEFAULT_MILESTONE', '%milestone-name')
DEFAULT_DUE_DATE = os.getenv('DEFAULT_DUE_DATE', '')
DEFAULT_LABEL = os.getenv('DEFAULT_LABEL', '~task')

# Sheet Column Mapping (your actual Google Sheet columns)
COLUMNS = {
    "DATE": 1,                      # Column A - Date
    "GIT_ID": 2,                    # Column B - GIT ID
    "PROJECT_NAME": 3,              # Column C - Project Name
    "SPECIFIC_PROJECT": 4,          # Column D - Specific Project Name
    "MAIN_TASK": 5,                 # Column E - Main Task
    "SUB_TASK": 6,                  # Column F - Sub Task
    "STATUS": 7,                    # Column G - Status
    "START_DATE": 8,                # Column H - Actual Start Date
    "PLANNED_ESTIMATION": 9,        # Column I - Planned Estimation (H)
    "ACTUAL_ESTIMATION": 10,        # Column J - Actual Estimation (H)
    "END_DATE": 11                  # Column K - Actual End Date
}

# Status mappings (updated for dropdown options)
CLOSE_STATUSES = ["Completed", "Cancelled"]
OPEN_STATUSES = ["Not Started", "In Progress", "Under Review", "Testing", "On Hold"]

# Status dropdown options (for sheet setup)
STATUS_OPTIONS = [
    "Not Started",
    "In Progress", 
    "Under Review",
    "Testing",
    "Completed",
    "On Hold",
    "Cancelled"
]

# Headers for your Google Sheet
SHEET_HEADERS = [
    "Date", "GIT ID", "Project Name", "Specific Project Name", 
    "Main Task", "Sub Task", "Status", "Actual Start Date", 
    "Planned Estimation (H)", "Actual Estimation (H)", "Actual End Date"
]
