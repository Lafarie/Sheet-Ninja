"""
Configuration settings for Google Sheets API
"""

# Google Sheets API configuration
SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']
SERVICE_ACCOUNT_FILE = 'credentials.json'

# Default values
DEFAULT_RANGE = 'A1:Z1'  # First row to get headers
