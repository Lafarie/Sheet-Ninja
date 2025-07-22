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
DEFAULT_ASSIGNEE = os.getenv('DEFAULT_ASSIGNEE', 'farhad.l')
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

# Configurable Dropdown Options
# Project Name Options with associated GitLab Project IDs and Repository Paths
PROJECT_OPTIONS = {
    "Rush Buffet": {
        "display": "Rush Buffet", 
        "project_id": "263",
        "repo_path": "appigo/rush-buffet"
    },
    "Retailer": {
        "display": "Retailer", 
        "project_id": "264",
        "repo_path": "appigo/retailer"
    }, 
    "Ticket Generator": {
        "display": "Ticket Generator", 
        "project_id": "265",
        "repo_path": "appigo/ticket-generator"
    }
}

# Specific Project Name Options (configurable)
SPECIFIC_PROJECT_OPTIONS = [
    "Development",
    "Bug Fix", 
    "Testing",
    "Deployment",
    "R&D",
    "App Release",
    "Support Service"
]

# Status dropdown options (configurable)
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

# Helper Functions
def get_project_id_by_name(project_name):
    """Get GitLab project ID based on project name from dropdown"""
    # Remove emoji if present for backward compatibility
    clean_name = project_name.strip()
    
    # Direct lookup first
    if clean_name in PROJECT_OPTIONS:
        return PROJECT_OPTIONS[clean_name]["project_id"]
    
    # Fallback: search by display name or partial match
    for key, value in PROJECT_OPTIONS.items():
        if clean_name in key or clean_name in value["display"]:
            return value["project_id"]
    
    # Default fallback to existing PROJECT_ID
    return PROJECT_ID

def get_project_display_names():
    """Get list of project display names for dropdown"""
    return [value["display"] for value in PROJECT_OPTIONS.values()]

def get_project_keys():
    """Get list of project keys for dropdown values"""
    return list(PROJECT_OPTIONS.keys())

def get_repo_path_by_name(project_name):
    """Get GitLab repository path based on project name from dropdown"""
    # Remove emoji if present for backward compatibility
    clean_name = project_name.strip()
    
    # Direct lookup first
    if clean_name in PROJECT_OPTIONS:
        return PROJECT_OPTIONS[clean_name]["repo_path"]
    
    # Fallback: search by display name or partial match
    for key, value in PROJECT_OPTIONS.items():
        if clean_name in key or clean_name in value["display"]:
            return value["repo_path"]
    
    # Default fallback to ticket-generator (most common)
    return "appigo/ticket-generator"

def get_gitlab_issue_url(project_name, issue_id):
    """Generate GitLab issue URL based on project name and issue ID"""
    repo_path = get_repo_path_by_name(project_name)
    base_url = GITLAB_URL.replace('/api/v4/', '')  # Remove API path to get base URL
    return f"{base_url}{repo_path}/-/issues/{issue_id}"
