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
                        "values": [
                            {"userEnteredValue": "Rush Buffet"},
                            {"userEnteredValue": "Retailer"},
                            {"userEnteredValue": "Ticket Generator"}
                        ]
                    },
                    "inputMessage": "Select a project.",
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
                        "values": [
                            {"userEnteredValue": "Development"},
                            {"userEnteredValue": "Bug Fix"},
                            {"userEnteredValue": "Testing"},
                            {"userEnteredValue": "Deployment"},
                            {"userEnteredValue": "R&D"},
                            {"userEnteredValue": "App Release"},
                            {"userEnteredValue": "Support Service"}
                        ]
                    },
                    "inputMessage": "Select a specific project type.",
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
    
    def add_conditional_formatting(self):
        """Add conditional formatting with colors for dropdown values"""
        sheet_id = self.get_sheet_id()
        
        requests = [
            # Project Name Colors (Column C)
            {
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
                                "values": [{"userEnteredValue": "Rush Buffet"}]
                            },
                            "format": {
                                "backgroundColor": {"red": 1.0, "green": 0.8, "blue": 0.8}  # Light Red
                            }
                        }
                    },
                    "index": 0
                }
            },
            {
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
                                "values": [{"userEnteredValue": "Retailer"}]
                            },
                            "format": {
                                "backgroundColor": {"red": 0.8, "green": 1.0, "blue": 0.8}  # Light Green
                            }
                        }
                    },
                    "index": 0
                }
            },
            {
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
                                "values": [{"userEnteredValue": "Ticket Generator"}]
                            },
                            "format": {
                                "backgroundColor": {"red": 0.8, "green": 0.8, "blue": 1.0}  # Light Blue
                            }
                        }
                    },
                    "index": 0
                }
            },
            # Specific Project Type Colors (Column D)
            {
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
                                "values": [{"userEnteredValue": "Development"}]
                            },
                            "format": {
                                "backgroundColor": {"red": 0.9, "green": 1.0, "blue": 0.9}  # Very Light Green
                            }
                        }
                    },
                    "index": 0
                }
            },
            {
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
                                "values": [{"userEnteredValue": "Bug Fix"}]
                            },
                            "format": {
                                "backgroundColor": {"red": 1.0, "green": 0.9, "blue": 0.9}  # Very Light Red
                            }
                        }
                    },
                    "index": 0
                }
            },
            {
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
                                "values": [{"userEnteredValue": "Testing"}]
                            },
                            "format": {
                                "backgroundColor": {"red": 1.0, "green": 1.0, "blue": 0.8}  # Light Yellow
                            }
                        }
                    },
                    "index": 0
                }
            },
            {
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
                                "values": [{"userEnteredValue": "Deployment"}]
                            },
                            "format": {
                                "backgroundColor": {"red": 0.9, "green": 0.9, "blue": 1.0}  # Very Light Blue
                            }
                        }
                    },
                    "index": 0
                }
            },
            # Status Colors (Column G)
            {
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
                                "values": [{"userEnteredValue": "Pending"}]
                            },
                            "format": {
                                "backgroundColor": {"red": 1.0, "green": 0.95, "blue": 0.8}  # Light Orange
                            }
                        }
                    },
                    "index": 0
                }
            },
            {
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
                                "values": [{"userEnteredValue": "In Progress"}]
                            },
                            "format": {
                                "backgroundColor": {"red": 0.8, "green": 0.9, "blue": 1.0}  # Light Blue
                            }
                        }
                    },
                    "index": 0
                }
            },
            {
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
                                "values": [{"userEnteredValue": "Completed"}]
                            },
                            "format": {
                                "backgroundColor": {"red": 0.8, "green": 1.0, "blue": 0.8}  # Light Green
                            }
                        }
                    },
                    "index": 0
                }
            }
        ]
        
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
            print("   • Rush Buffet (🔴 Light Red)")
            print("   • Retailer (🟢 Light Green)")
            print("   • Ticket Generator (🔵 Light Blue)")
            print("📋 Specific Project Name column (D) dropdown options:")
            print("   • Development (🟢 Very Light Green)")
            print("   • Bug Fix (🔴 Very Light Red)")
            print("   • Testing (🟡 Light Yellow)")
            print("   • Deployment (🔵 Very Light Blue)")
            print("   • R&D")
            print("   • App Release")
            print("   • Support Service")
            print("📋 Status column (G) dropdown options:")
            print("   • Pending (🟠 Light Orange)")
            print("   • In Progress (🔵 Light Blue)")
            print("   • Completed (🟢 Light Green)")
            print(f"\n🔗 Open: https://docs.google.com/spreadsheets/d/{self.spreadsheet_id}")
            
        except Exception as e:
            print(f"❌ Setup failed: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    setup = SimpleSheetDropdown()
    setup.setup_sheet()
