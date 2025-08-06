"""
Google Sheets API authentication handler
"""

import json
import os
from google.oauth2 import service_account
from googleapiclient.discovery import build
from config import SCOPES, SERVICE_ACCOUNT_FILE


class GoogleSheetsAuth:
    """Handle Google Sheets API authentication"""
    
    def __init__(self, credentials_file=None):
        """Initialize with credentials file path"""
        self.credentials_file = credentials_file or SERVICE_ACCOUNT_FILE
        self.service = None
    
    def authenticate(self):
        """Authenticate and create Google Sheets service"""
        try:
            if not os.path.exists(self.credentials_file):
                raise FileNotFoundError(f"Credentials file not found: {self.credentials_file}")
            
            # Load credentials from JSON file
            credentials = service_account.Credentials.from_service_account_file(
                self.credentials_file, scopes=SCOPES
            )
            
            # Build the service
            self.service = build('sheets', 'v4', credentials=credentials)
            print("✅ Successfully authenticated with Google Sheets API")
            return True
            
        except FileNotFoundError as e:
            print(f"❌ Error: {e}")
            return False
        except Exception as e:
            print(f"❌ Authentication failed: {e}")
            return False
    
    def get_service(self):
        """Get the Google Sheets service object"""
        if not self.service:
            if not self.authenticate():
                return None
        return self.service
