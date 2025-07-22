"""
Working Google Sheets Dropdown Setup
Simplified version that we know works
"""

import config
import os
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

class SimpleSheetDropdown:
    def __init__(self):
        self.spreadsheet_id = config.SPREADSHEET_ID
        self.service = self._authenticate()
        print("✅ Connected to Google Sheets API")
    
    def _authenticate(self):
        """Authenticate with Google Sheets"""
        credentials = service_account.Credentials.from_service_account_file(
            config.SERVICE_ACCOUNT_FILE,
            scopes=config.SCOPES
        )
        return build('sheets', 'v4', credentials=credentials)
    
    def get_sheet_id(self):
        """Get the sheet ID for the target worksheet"""
        spreadsheet = self.service.spreadsheets().get(spreadsheetId=self.spreadsheet_id).execute()
        sheets = spreadsheet.get('sheets', [])
        
        for sheet in sheets:
            if sheet['properties']['title'] == config.WORKSHEET_NAME:
                return sheet['properties']['sheetId']
        
        raise ValueError(f"Worksheet '{config.WORKSHEET_NAME}' not found")
    
    def add_headers(self):
        """Add headers to the sheet"""
        try:
            # Add headers
            self.service.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range=f"{config.WORKSHEET_NAME}!1:1",
                valueInputOption='RAW',
                body={'values': [config.SHEET_HEADERS]}
            ).execute()
            print("✅ Headers added/updated")
        except Exception as e:
            print(f"⚠️ Headers update failed: {e}")
    
    def add_dropdown(self):
        """Add dropdown to Column G (Status)"""
        sheet_id = self.get_sheet_id()
        
        requests = [{
            "setDataValidation": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": 1,  # Start from row 2 (skip header)
                    "endRowIndex": 1000,  # Apply to first 1000 rows
                    "startColumnIndex": 6,  # Column G (0-indexed)
                    "endColumnIndex": 7   # Only Column G
                },
                "rule": {
                    "condition": {
                        "type": "ONE_OF_LIST",
                        "values": [
                            {"userEnteredValue": "Pending"},
                            {"userEnteredValue": "In Progress"},
                            {"userEnteredValue": "Completed"}
                        ]
                    },
                    "inputMessage": "Select a status.",
                    "strict": True,
                    "showCustomUi": True
                }
            }
        }]
        
        body = {"requests": requests}
        
        result = self.service.spreadsheets().batchUpdate(
            spreadsheetId=self.spreadsheet_id,
            body=body
        ).execute()
        
        print("✅ Dropdown added to Column G (Status)")
        return True
    
    def setup_sheet(self):
        """Complete setup"""
        print("🔄 Setting up Google Sheet...")
        print(f"📊 Spreadsheet ID: {self.spreadsheet_id}")
        print(f"📋 Worksheet: {config.WORKSHEET_NAME}")
        
        try:
            # Add headers
            self.add_headers()
            
            # Add dropdown
            self.add_dropdown()
            
            print("\n🎉 Setup completed successfully!")
            print("📋 Status column (G) now has dropdown with options:")
            print("   • Pending")
            print("   • In Progress") 
            print("   • Completed")
            print(f"\n🔗 Open: https://docs.google.com/spreadsheets/d/{self.spreadsheet_id}")
            
        except Exception as e:
            print(f"❌ Setup failed: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    setup = SimpleSheetDropdown()
    setup.setup_sheet()
