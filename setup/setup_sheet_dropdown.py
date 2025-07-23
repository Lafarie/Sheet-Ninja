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
    
    def add_project_dropdown(self):
        """Add dropdown to Column C (Project Name)"""
        sheet_id = self.get_sheet_id()
        
        # Get configurable project options from config
        project_values = [{"userEnteredValue": key} for key in config.get_project_keys()]
        
        requests = [{
            "setDataValidation": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": 1,  # Start from row 2 (skip header)
                    "endRowIndex": 1000,  # Apply to first 1000 rows
                    "startColumnIndex": 2,  # Column C (0-indexed)
                    "endColumnIndex": 3   # Only Column C
                },
                "rule": {
                    "condition": {
                        "type": "ONE_OF_LIST",
                        "values": project_values
                    },
                    "inputMessage": "🎯 Select a project from the list",
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
        
        print("✅ Dropdown added to Column C (Project Name)")
        return True

    def add_specific_project_dropdown(self):
        """Add dropdown to Column D (Specific Project Name)"""
        sheet_id = self.get_sheet_id()
        
        # Get configurable specific project options from config
        specific_project_values = [{"userEnteredValue": option} for option in config.SPECIFIC_PROJECT_OPTIONS]
        
        requests = [{
            "setDataValidation": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": 1,  # Start from row 2 (skip header)
                    "endRowIndex": 1000,  # Apply to first 1000 rows
                    "startColumnIndex": 3,  # Column D (0-indexed)
                    "endColumnIndex": 4   # Only Column D
                },
                "rule": {
                    "condition": {
                        "type": "ONE_OF_LIST",
                        "values": specific_project_values
                    },
                    "inputMessage": "🔧 Select a specific project type",
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
        
        print("✅ Dropdown added to Column D (Specific Project Name)")
        return True

    def add_dropdown(self):
        """Add dropdown to Column G (Status)"""
        sheet_id = self.get_sheet_id()
        
        # Get configurable status options from config
        status_values = [{"userEnteredValue": option} for option in config.STATUS_OPTIONS]
        
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
                        "values": status_values
                    },
                    "inputMessage": "📊 Update the task status",
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
    
    def add_conditional_formatting(self):
        """Add conditional formatting with colors for dropdown values"""
        sheet_id = self.get_sheet_id()
        
        requests = []
        
        # Project Name Colors (Column C) - Dynamic based on config
        project_colors = [
            {"red": 1.0, "green": 0.8, "blue": 0.8},  # Light Red
            {"red": 0.8, "green": 1.0, "blue": 0.8},  # Light Green  
            {"red": 0.8, "green": 0.8, "blue": 1.0}   # Light Blue
        ]
        
        for i, project_key in enumerate(config.get_project_keys()):
            color = project_colors[i % len(project_colors)]  # Cycle through colors
            requests.append({
                "addConditionalFormatRule": {
                    "rule": {
                        "ranges": [{
                            "sheetId": sheet_id,
                            "startRowIndex": 1,
                            "endRowIndex": 1000,
                            "startColumnIndex": 2,
                            "endColumnIndex": 3
                        }],
                        "booleanRule": {
                            "condition": {
                                "type": "TEXT_EQ",
                                "values": [{"userEnteredValue": project_key}]
                            },
                            "format": {
                                "backgroundColor": color
                            }
                        }
                    },
                    "index": 0
                }
            })
        
        # Specific Project Type Colors (Column D) - Dynamic based on config
        specific_colors = [
            {"red": 0.9, "green": 1.0, "blue": 0.9},  # Very Light Green
            {"red": 1.0, "green": 0.9, "blue": 0.9},  # Very Light Red
            {"red": 1.0, "green": 1.0, "blue": 0.8},  # Light Yellow
            {"red": 0.9, "green": 0.9, "blue": 1.0},  # Very Light Blue
            {"red": 0.95, "green": 0.95, "blue": 0.95},  # Light Gray
            {"red": 0.9, "green": 1.0, "blue": 0.95},  # Light Mint
            {"red": 1.0, "green": 0.95, "blue": 0.9}   # Light Peach
        ]
        
        for i, specific_option in enumerate(config.SPECIFIC_PROJECT_OPTIONS):
            color = specific_colors[i % len(specific_colors)]  # Cycle through colors
            requests.append({
                "addConditionalFormatRule": {
                    "rule": {
                        "ranges": [{
                            "sheetId": sheet_id,
                            "startRowIndex": 1,
                            "endRowIndex": 1000,
                            "startColumnIndex": 3,
                            "endColumnIndex": 4
                        }],
                        "booleanRule": {
                            "condition": {
                                "type": "TEXT_EQ",
                                "values": [{"userEnteredValue": specific_option}]
                            },
                            "format": {
                                "backgroundColor": color
                            }
                        }
                    },
                    "index": 0
                }
            })
        
        # Status Colors (Column G) - Dynamic based on config
        status_colors = [
            {"red": 1.0, "green": 0.95, "blue": 0.8},  # Light Orange (Pending)
            {"red": 0.8, "green": 0.9, "blue": 1.0},   # Light Blue (In Progress)
            {"red": 0.8, "green": 1.0, "blue": 0.8}    # Light Green (Completed)
        ]
        
        for i, status_option in enumerate(config.STATUS_OPTIONS):
            color = status_colors[i % len(status_colors)]  # Cycle through colors
            requests.append({
                "addConditionalFormatRule": {
                    "rule": {
                        "ranges": [{
                            "sheetId": sheet_id,
                            "startRowIndex": 1,
                            "endRowIndex": 1000,
                            "startColumnIndex": 6,
                            "endColumnIndex": 7
                        }],
                        "booleanRule": {
                            "condition": {
                                "type": "TEXT_EQ",
                                "values": [{"userEnteredValue": status_option}]
                            },
                            "format": {
                                "backgroundColor": color
                            }
                        }
                    },
                    "index": 0
                }
            })
        
        body = {"requests": requests}
        
        result = self.service.spreadsheets().batchUpdate(
            spreadsheetId=self.spreadsheet_id,
            body=body
        ).execute()
        
        print("✅ Conditional formatting with colors applied!")
        return True
    
    def setup_sheet(self):
        """Complete setup"""
        print("🔄 Setting up Google Sheet...")
        print(f"📊 Spreadsheet ID: {self.spreadsheet_id}")
        print(f"📋 Worksheet: {config.WORKSHEET_NAME}")
        
        try:
            # Add headers
            self.add_headers()
            
            # Add Project Name dropdown
            self.add_project_dropdown()
            
            # Add Specific Project Name dropdown
            self.add_specific_project_dropdown()
            
            # Add Status dropdown
            self.add_dropdown()
            
            # Add color formatting
            self.add_conditional_formatting()
            
            print("\n🎉 Setup completed successfully!")
            print("📋 Project Name column (C) dropdown options:")
            for project_key in config.get_project_keys():
                project_id = config.get_project_id_by_name(project_key)
                print(f"   • {project_key} (ID: {project_id})")
            
            print("📋 Specific Project Name column (D) dropdown options:")
            for option in config.SPECIFIC_PROJECT_OPTIONS:
                print(f"   • {option}")
            
            print("📋 Status column (G) dropdown options:")
            for option in config.STATUS_OPTIONS:
                print(f"   • {option}")
            
            print(f"\n🔗 Open: https://docs.google.com/spreadsheets/d/{self.spreadsheet_id}")
            print("\n� To modify dropdown options, edit the config.py file:")
            print("   - PROJECT_OPTIONS: Project names with GitLab project IDs")
            print("   - SPECIFIC_PROJECT_OPTIONS: Task types")
            print("   - STATUS_OPTIONS: Status values")
            
        except Exception as e:
            print(f"❌ Setup failed: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    setup = SimpleSheetDropdown()
    setup.setup_sheet()
