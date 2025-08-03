# Configuration file for GitLab ↔ Google Sheets Sync
# Sensitive values are loaded from environment variables or .env file

import os
from dotenv import load_dotenv

# Get the directory where this config.py file is located (root directory)
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

# Load environment variables from .env file in root directory
load_dotenv(os.path.join(ROOT_DIR, '.env'))

# GitLab Settings (from environment variables)
GITLAB_URL = os.getenv('GITLAB_URL', 'https://sourcecontrol.hsenidmobile.com/api/v4/')
PROJECT_ID = os.getenv('PROJECT_ID', '263')
GITLAB_TOKEN = os.getenv('GITLAB_TOKEN')  # Required - no default

# Only raise error if not in web UI mode
if not GITLAB_TOKEN and not os.getenv('WEB_UI_MODE'):
    print("⚠️  GITLAB_TOKEN not set. Please configure it via the web UI or .env file.")

# Google Sheets Settings (from environment variables)
SPREADSHEET_ID = os.getenv('SPREADSHEET_ID')  # Required - no default
WORKSHEET_NAME = os.getenv('WORKSHEET_NAME', 'Sheet1')

# Only raise error if not in web UI mode
if not SPREADSHEET_ID and not os.getenv('WEB_UI_MODE'):
    print("⚠️  SPREADSHEET_ID not set. Please configure it via the web UI or .env file.")

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

# Dynamic Column Configuration System
# This allows for flexible column mapping that can adapt to sheet changes

# Default column definitions with metadata
DEFAULT_COLUMN_CONFIG = {
    "DATE": {
        "index": 1,
        "header": "Date",
        "required": True,
        "data_type": "date",
        "description": "Task date",
        "example": "2024-01-15"
    },
    "GIT_ID": {
        "index": 2,
        "header": "GIT ID",
        "required": False,
        "data_type": "text",
        "description": "GitLab issue ID",
        "example": "123"
    },
    "PROJECT_NAME": {
        "index": 3,
        "header": "Project Name",
        "required": True,
        "data_type": "dropdown",
        "description": "Project selection",
        "example": "Ticket Generator"
    },
    "SPECIFIC_PROJECT": {
        "index": 4,
        "header": "Specific Project Name",
        "required": False,
        "data_type": "dropdown",
        "description": "Specific project type",
        "example": "Development"
    },
    "MAIN_TASK": {
        "index": 5,
        "header": "Main Task",
        "required": True,
        "data_type": "text",
        "description": "Main task description",
        "example": "User Authentication System"
    },
    "SUB_TASK": {
        "index": 6,
        "header": "Sub Task",
        "required": True,
        "data_type": "text",
        "description": "Sub task description",
        "example": "Implement login API"
    },
    "STATUS": {
        "index": 7,
        "header": "Status",
        "required": True,
        "data_type": "dropdown",
        "description": "Task status",
        "example": "In Progress"
    },
    "START_DATE": {
        "index": 8,
        "header": "Actual Start Date",
        "required": False,
        "data_type": "date",
        "description": "When task was started",
        "example": "2024-01-15"
    },
    "PLANNED_ESTIMATION": {
        "index": 9,
        "header": "Planned Estimation (H)",
        "required": False,
        "data_type": "number",
        "description": "Planned hours",
        "example": "8"
    },
    "ACTUAL_ESTIMATION": {
        "index": 10,
        "header": "Actual Estimation (H)",
        "required": False,
        "data_type": "number",
        "description": "Actual hours spent",
        "example": "10"
    },
    "END_DATE": {
        "index": 11,
        "header": "Actual End Date",
        "required": False,
        "data_type": "date",
        "description": "When task was completed",
        "example": "2024-01-16"
    }
}

# Load custom column configuration if it exists
CUSTOM_COLUMN_CONFIG_FILE = os.path.join(ROOT_DIR, 'custom_columns.json')

def load_column_config():
    """Load column configuration from custom file or use defaults"""
    if os.path.exists(CUSTOM_COLUMN_CONFIG_FILE):
        try:
            import json
            with open(CUSTOM_COLUMN_CONFIG_FILE, 'r') as f:
                custom_config = json.load(f)
                print(f"✅ Loaded custom column configuration from {CUSTOM_COLUMN_CONFIG_FILE}")
                return custom_config
        except Exception as e:
            print(f"⚠️ Error loading custom column config: {e}")
            print("📋 Using default column configuration")
    
    return DEFAULT_COLUMN_CONFIG

def save_column_config(config):
    """Save column configuration to custom file"""
    try:
        import json
        with open(CUSTOM_COLUMN_CONFIG_FILE, 'w') as f:
            json.dump(config, f, indent=2)
        print(f"✅ Saved column configuration to {CUSTOM_COLUMN_CONFIG_FILE}")
        return True
    except Exception as e:
        print(f"❌ Error saving column config: {e}")
        return False

# Load the active column configuration
COLUMN_CONFIG = load_column_config()

# Backward compatibility: Create COLUMNS dict from config
COLUMNS = {key: value["index"] for key, value in COLUMN_CONFIG.items()}

def get_column_by_header(header_name):
    """Get column key by header name (case-insensitive)"""
    header_name = header_name.strip().lower()
    for key, config in COLUMN_CONFIG.items():
        if config["header"].lower() == header_name:
            return key
    return None

def get_header_by_column(column_key):
    """Get header name by column key"""
    if column_key in COLUMN_CONFIG:
        return COLUMN_CONFIG[column_key]["header"]
    return None

def update_column_index(column_key, new_index):
    """Update column index and save configuration"""
    if column_key in COLUMN_CONFIG:
        COLUMN_CONFIG[column_key]["index"] = new_index
        COLUMNS[column_key] = new_index
        save_column_config(COLUMN_CONFIG)
        return True
    return False

def get_required_columns():
    """Get list of required column keys"""
    return [key for key, config in COLUMN_CONFIG.items() if config.get("required", False)]

def get_column_order():
    """Get columns sorted by their index"""
    return sorted(COLUMN_CONFIG.items(), key=lambda x: x[1]["index"])

# Configurable Dropdown Options
# Project Name Options with associated GitLab Project IDs and Repository Paths
PROJECT_OPTIONS = {
    "Rush Buffet": {
        "display": "Rush Buffet", 
        "project_id": "",
        "repo_path": "/appigo/rush-buffet"
    },
    "Retailer": {
        "display": "Retailer", 
        "project_id": "34",
        "repo_path": "/appigo/appigo-mall"
    }, 
    "Ticket Generator": {
        "display": "Ticket Generator", 
        "project_id": "263",
        "repo_path": "/appigo/ticket-generator"
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

# Dynamic Headers generation from column configuration
def get_sheet_headers():
    """Get headers in correct order based on column configuration"""
    ordered_columns = get_column_order()
    return [config["header"] for key, config in ordered_columns]

# Backward compatibility
SHEET_HEADERS = get_sheet_headers()

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
