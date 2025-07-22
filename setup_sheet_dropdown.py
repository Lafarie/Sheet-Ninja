"""
Setup Google Sheets Dropdown for Status Column
This script adds data validation dropdown to the Status column (Column G)
Now uses environment variables for configuration
"""

import config
import os
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

class SheetDropdownSetup:
    def __init__(self):
        # Validate required environment variables
        if not config.SPREADSHEET_ID:
            print("❌ Error: SPREADSHEET_ID not found in environment variables")
            print("💡 Make sure you have created a .env file with your configuration")
            raise ValueError("Missing required environment variables")
            
        self.spreadsheet_id = config.SPREADSHEET_ID
        self.service = self._authenticate_google_sheets()
        print("✅ Connected to Google Sheets API with Service Account")
    
    def _authenticate_google_sheets(self):
        """Authenticate with Google Sheets using Service Account"""
        try:
            if not os.path.exists(config.SERVICE_ACCOUNT_FILE):
                raise FileNotFoundError(f"Service account file not found: {config.SERVICE_ACCOUNT_FILE}")
            
            credentials = service_account.Credentials.from_service_account_file(
                config.SERVICE_ACCOUNT_FILE,
                scopes=config.SCOPES
            )
            
            service = build('sheets', 'v4', credentials=credentials)
            return service
            
        except Exception as e:
            print(f"❌ Failed to authenticate with Google Sheets: {e}")
            raise
    
    def get_sheet_id(self, sheet_name):
        """Get the sheet ID for a specific worksheet"""
        try:
            spreadsheet = self.service.spreadsheets().get(spreadsheetId=self.spreadsheet_id).execute()
            sheets = spreadsheet.get('sheets', [])
            
            for sheet in sheets:
                if sheet['properties']['title'] == sheet_name:
                    return sheet['properties']['sheetId']
            
            print(f"❌ Sheet '{sheet_name}' not found")
            return None
            
        except Exception as e:
            print(f"❌ Error getting sheet ID: {e}")
            return None
    
    def add_project_name_dropdown(self):
        """Add dropdown validation to Project Name column (Column C)"""
        try:
            sheet_id = self.get_sheet_id(config.WORKSHEET_NAME)
            if not sheet_id:
                return False
            
            # Create data validation rule for Project Name
            requests = [{
                "setDataValidation": {
                    "range": {
                        "sheetId": sheet_id,
                        "startRowIndex": 1,  # Start from row 2 (skip header)
                        "endRowIndex": 1000,  # Apply to first 1000 rows
                        "startColumnIndex": 2,  # Column C (0-indexed, so 2 = C)
                        "endColumnIndex": 3   # Only Column C
                    },
                    "rule": {
                        "condition": {
                            "type": "ONE_OF_LIST",
                            "values": [
                                {
                                    "userEnteredValue": "retailer"
                                },
                                {
                                    "userEnteredValue": "rush"
                                },
                                {
                                    "userEnteredValue": "ticket-generator"
                                }
                            ]
                        },
                        "inputMessage": "Select a project.",
                        "strict": True,
                        "showCustomUi": True
                    }
                }
            }]
            
            # Apply the validation
            body = {"requests": requests}
            
            result = self.service.spreadsheets().batchUpdate(
                spreadsheetId=self.spreadsheet_id,
                body=body
            ).execute()
            
            print("✅ Project Name dropdown added to Column C successfully!")
            print("📋 Available options: retailer, rush, ticket-generator")
            return True
            
        except HttpError as e:
            print(f"❌ Failed to add Project Name dropdown: {e}")
            return False
        except Exception as e:
            print(f"❌ Error adding Project Name dropdown: {e}")
            return False

    def add_status_dropdown(self):
        """Add dropdown validation to Status column (Column G)"""
        try:
            sheet_id = self.get_sheet_id(config.WORKSHEET_NAME)
            if not sheet_id:
                return False
            
            # Create data validation rule using Gemini's format
            requests = [{
                "setDataValidation": {
                    "range": {
                        "sheetId": sheet_id,
                        "startRowIndex": 1,  # Start from row 2 (skip header)
                        "endRowIndex": 1000,  # Apply to first 1000 rows
                        "startColumnIndex": 6,  # Column G (0-indexed, so 6 = G)
                        "endColumnIndex": 7   # Only Column G
                    },
                    "rule": {
                        "condition": {
                            "type": "ONE_OF_LIST",
                            "values": [
                                {
                                    "userEnteredValue": "Pending"
                                },
                                {
                                    "userEnteredValue": "In Progress"
                                },
                                {
                                    "userEnteredValue": "Completed"
                                }
                            ]
                        },
                        "inputMessage": "Select a status.",
                        "strict": True,
                        "showCustomUi": True
                    }
                }
            }]
            
            # Apply the validation
            body = {"requests": requests}
            
            result = self.service.spreadsheets().batchUpdate(
                spreadsheetId=self.spreadsheet_id,
                body=body
            ).execute()
            
            print("✅ Status dropdown added to Column G successfully!")
            print("📋 Available options: Pending, In Progress, Completed")
            return True
            
        except HttpError as e:
            print(f"❌ Failed to add dropdown: {e}")
            return False
        except Exception as e:
            print(f"❌ Error adding dropdown: {e}")
            return False
    
    def add_sheet_headers(self):
        """Add headers to the sheet if they don't exist"""
        try:
            # Check if headers exist
            first_row = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=f"{config.WORKSHEET_NAME}!1:1"
            ).execute()
            
            values = first_row.get('values', [])
            if not values or not values[0] or values[0][0] != "Date":
                print("📝 Adding headers to sheet...")
                
                # Add headers
                self.service.spreadsheets().values().update(
                    spreadsheetId=self.spreadsheet_id,
                    range=f"{config.WORKSHEET_NAME}!1:1",
                    valueInputOption='RAW',
                    body={'values': [config.SHEET_HEADERS]}
                ).execute()
                
                print("✅ Headers added successfully!")
            else:
                print("✅ Headers already exist")
                
        except Exception as e:
            print(f"❌ Error adding headers: {e}")
    
    def format_project_column(self):
        """Apply formatting to the project name column"""
        try:
            sheet_id = self.get_sheet_id(config.WORKSHEET_NAME)
            if not sheet_id:
                return False
            
            # Format the project name column
            requests = [{
                "repeatCell": {
                    "range": {
                        "sheetId": sheet_id,
                        "startRowIndex": 1,  # Start from row 2 (skip header)
                        "endRowIndex": 1000,
                        "startColumnIndex": 2,  # Column C
                        "endColumnIndex": 3
                    },
                    "cell": {
                        "userEnteredFormat": {
                            "horizontalAlignment": "CENTER",
                            "textFormat": {
                                "bold": True
                            }
                        }
                    },
                    "fields": "userEnteredFormat(horizontalAlignment,textFormat)"
                }
            }]
            
            body = {"requests": requests}
            
            self.service.spreadsheets().batchUpdate(
                spreadsheetId=self.spreadsheet_id,
                body=body
            ).execute()
            
            print("✅ Project Name column formatting applied!")
            
        except Exception as e:
            print(f"❌ Error formatting Project Name column: {e}")

    def format_status_column(self):
        """Apply formatting to the status column"""
        try:
            sheet_id = self.get_sheet_id(config.WORKSHEET_NAME)
            if not sheet_id:
                return False
            
            # Format the status column
            requests = [{
                "repeatCell": {
                    "range": {
                        "sheetId": sheet_id,
                        "startRowIndex": 1,  # Start from row 2 (skip header)
                        "endRowIndex": 1000,
                        "startColumnIndex": 6,  # Column G
                        "endColumnIndex": 7
                    },
                    "cell": {
                        "userEnteredFormat": {
                            "horizontalAlignment": "CENTER",
                            "textFormat": {
                                "bold": True
                            }
                        }
                    },
                    "fields": "userEnteredFormat(horizontalAlignment,textFormat)"
                }
            }]
            
            body = {"requests": requests}
            
            self.service.spreadsheets().batchUpdate(
                spreadsheetId=self.spreadsheet_id,
                body=body
            ).execute()
            
            print("✅ Status column formatting applied!")
            
        except Exception as e:
            print(f"❌ Error formatting column: {e}")
    
    def setup_complete_sheet(self):
        """Complete setup: headers, dropdowns, and formatting"""
        print("🔄 Setting up Google Sheet with dropdowns...")
        print(f"📊 Spreadsheet ID: {self.spreadsheet_id}")
        print(f"📋 Worksheet: {config.WORKSHEET_NAME}")
        
        # Add headers
        self.add_sheet_headers()
        
        # Add Project Name dropdown
        project_success = self.add_project_name_dropdown()
        if project_success:
            self.format_project_column()
        
        # Add status dropdown
        status_success = self.add_status_dropdown()
        if status_success:
            self.format_status_column()
        
        if project_success and status_success:
            print("\n🎉 Sheet setup completed!")
            print("📋 Project Name column (C) dropdown options:")
            print("   • retailer")
            print("   • rush")
            print("   • ticket-generator")
            print("📋 Status column (G) dropdown options:")
            print("   • Pending")
            print("   • In Progress") 
            print("   • Completed")
            print(f"\n🔗 Open your sheet: https://docs.google.com/spreadsheets/d/{self.spreadsheet_id}")
            
            return True
        else:
            print("❌ Failed to set up all dropdowns")
            return False

if __name__ == "__main__":
    try:
        setup = SheetDropdownSetup()
        setup.setup_complete_sheet()
    except Exception as e:
        print(f"\n❌ Setup failed: {e}")
        print("\n💡 Make sure you have:")
        print("1. Created a .env file with your configuration")
        print("2. Set up Service Account authentication")
        print("3. Shared your Google Sheet with the service account")
        print("4. Run: pip install -r requirements.txt") 