"""
Google Sheets data fetcher
"""

from auth import GoogleSheetsAuth
from config import DEFAULT_RANGE


class SheetsFetcher:
    """Fetch data from Google Sheets"""
    
    def __init__(self, credentials_file=None):
        """Initialize with authentication"""
        self.auth = GoogleSheetsAuth(credentials_file)
        self.service = None
    
    def connect(self):
        """Connect to Google Sheets API"""
        self.service = self.auth.get_service()
        return self.service is not None
    
    def get_sheet_info(self, spreadsheet_id):
        """Get basic information about the spreadsheet"""
        try:
            if not self.service:
                if not self.connect():
                    return None
            
            # Get spreadsheet metadata
            spreadsheet = self.service.spreadsheets().get(
                spreadsheetId=spreadsheet_id
            ).execute()
            
            sheets_info = []
            for sheet in spreadsheet.get('sheets', []):
                sheet_properties = sheet.get('properties', {})
                sheets_info.append({
                    'name': sheet_properties.get('title', 'Unknown'),
                    'id': sheet_properties.get('sheetId', 0),
                    'rows': sheet_properties.get('gridProperties', {}).get('rowCount', 0),
                    'columns': sheet_properties.get('gridProperties', {}).get('columnCount', 0)
                })
            
            return {
                'title': spreadsheet.get('properties', {}).get('title', 'Unknown'),
                'sheets': sheets_info
            }
            
        except Exception as e:
            print(f"❌ Error getting sheet info: {e}")
            return None
    
    def get_headers(self, spreadsheet_id, sheet_name=None, range_name=None):
        """Get headers from the first row of a sheet"""
        try:
            if not self.service:
                if not self.connect():
                    return None
            
            # If no sheet name provided, use the first sheet
            if not sheet_name:
                sheet_info = self.get_sheet_info(spreadsheet_id)
                if sheet_info and sheet_info['sheets']:
                    sheet_name = sheet_info['sheets'][0]['name']
                else:
                    print("❌ No sheets found in spreadsheet")
                    return None
            
            # Set range to get headers (first row)
            if not range_name:
                range_name = f"{sheet_name}!{DEFAULT_RANGE}"
            else:
                range_name = f"{sheet_name}!{range_name}"
            
            # Fetch the data
            result = self.service.spreadsheets().values().get(
                spreadsheetId=spreadsheet_id,
                range=range_name
            ).execute()
            
            values = result.get('values', [])
            
            if not values:
                print("❌ No data found in the specified range")
                return None
            
            headers = values[0] if values else []
            print(f"✅ Found {len(headers)} headers")
            return headers
            
        except Exception as e:
            print(f"❌ Error getting headers: {e}")
            return None
    
    def get_all_data(self, spreadsheet_id, sheet_name=None, range_name=None):
        """Get all data from a sheet"""
        try:
            if not self.service:
                if not self.connect():
                    return None
            
            # If no sheet name provided, use the first sheet
            if not sheet_name:
                sheet_info = self.get_sheet_info(spreadsheet_id)
                if sheet_info and sheet_info['sheets']:
                    sheet_name = sheet_info['sheets'][0]['name']
                else:
                    print("❌ No sheets found in spreadsheet")
                    return None
            
            # Set range to get all data
            if not range_name:
                range_name = sheet_name
            else:
                range_name = f"{sheet_name}!{range_name}"
            
            # Fetch the data
            result = self.service.spreadsheets().values().get(
                spreadsheetId=spreadsheet_id,
                range=range_name
            ).execute()
            
            values = result.get('values', [])
            
            if not values:
                print("❌ No data found")
                return None
            
            print(f"✅ Found {len(values)} rows of data")
            return values
            
        except Exception as e:
            print(f"❌ Error getting data: {e}")
            return None
