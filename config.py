# Configuration file - Edit these values for your setup

# GitLab Settings
GITLAB_URL = "https://sourcecontrol.hsenidmobile.com/"
PROJECT_ID = "65"
GITLAB_TOKEN = ""  # Replace with your actual token

# Google Sheets Settings
SPREADSHEET_ID = "your-google-sheet-id-here"  # Replace with your Google Sheet ID
WORKSHEET_NAME = "Issues"  # Name of the worksheet/tab
GOOGLE_SHEETS_API_KEY = "your-google-sheets-api-key-here"  # Direct API key for personal use

# GitLab Issue Template Settings
DEFAULT_ASSIGNEE = "@farhad.l@appigo.co"
DEFAULT_ESTIMATE = "8h"  # Default estimate in hours
DEFAULT_MILESTONE = "%milestone-name"  # Replace with your milestone name
DEFAULT_DUE_DATE = ""  # Leave empty or set default due date
DEFAULT_LABEL = "~task"  # Replace with your label

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

# Status mappings (based on your requirements)
CLOSE_STATUSES = ["completed"]
OPEN_STATUSES = ["in progress"]

# Headers for your Google Sheet
SHEET_HEADERS = [
    "Date", "GIT ID", "Project Name", "Specific Project Name", 
    "Main Task", "Sub Task", "Status", "Actual Start Date", 
    "Planned Estimation (H)", "Actual Estimation (H)", "Actual End Date"
]
