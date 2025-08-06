"""
Main script to fetch Google Sheets headers and data
Simple command-line interface
"""

import sys
from sheets_fetcher import SheetsFetcher
from utils import print_headers, print_sheet_info, save_to_json, extract_sheet_id_from_url


def main():
    """Main function to run the Google Sheets fetcher"""
    
    print("🚀 Google Sheets Header Fetcher")
    print("=" * 40)
    
    # Check if credentials file exists
    credentials_file = input("Enter credentials file path (or press Enter for 'credentials.json'): ").strip()
    if not credentials_file:
        credentials_file = 'credentials.json'
    
    # Get spreadsheet ID or URL
    spreadsheet_input = input("Enter Google Sheets ID or URL: ").strip()
    if not spreadsheet_input:
        print("❌ No spreadsheet ID or URL provided")
        return
    
    # Extract ID from URL if needed
    if 'spreadsheets' in spreadsheet_input:
        spreadsheet_id = extract_sheet_id_from_url(spreadsheet_input)
        if not spreadsheet_id:
            return
        print(f"📎 Extracted ID: {spreadsheet_id}")
    else:
        spreadsheet_id = spreadsheet_input
    
    # Initialize fetcher
    fetcher = SheetsFetcher(credentials_file)
    
    # Connect to Google Sheets
    if not fetcher.connect():
        print("❌ Failed to connect to Google Sheets API")
        return
    
    # Get sheet information
    print("\n🔍 Fetching sheet information...")
    sheet_info = fetcher.get_sheet_info(spreadsheet_id)
    if sheet_info:
        print_sheet_info(sheet_info)
    else:
        print("❌ Failed to get sheet information")
        return
    
    # Ask which sheet to process
    if len(sheet_info['sheets']) > 1:
        print("\n📋 Available sheets:")
        for i, sheet in enumerate(sheet_info['sheets'], 1):
            print(f"{i}. {sheet['name']}")
        
        try:
            choice = input("\nEnter sheet number (or press Enter for first sheet): ").strip()
            if choice:
                sheet_index = int(choice) - 1
                if 0 <= sheet_index < len(sheet_info['sheets']):
                    sheet_name = sheet_info['sheets'][sheet_index]['name']
                else:
                    print("❌ Invalid sheet number")
                    return
            else:
                sheet_name = sheet_info['sheets'][0]['name']
        except ValueError:
            print("❌ Invalid input")
            return
    else:
        sheet_name = sheet_info['sheets'][0]['name']
    
    print(f"\n📄 Processing sheet: {sheet_name}")
    
    # Get headers
    print("\n🔍 Fetching headers...")
    headers = fetcher.get_headers(spreadsheet_id, sheet_name)
    if headers:
        print_headers(headers)
        
        # Ask if user wants to save headers
        save_choice = input("\nSave headers to JSON file? (y/n): ").strip().lower()
        if save_choice == 'y':
            filename = input("Enter filename (or press Enter for 'headers.json'): ").strip()
            if not filename:
                filename = 'headers.json'
            save_to_json(headers, filename)
    else:
        print("❌ Failed to get headers")
        return
    
    # Ask if user wants to get all data
    data_choice = input("\nFetch all data from sheet? (y/n): ").strip().lower()
    if data_choice == 'y':
        print("\n🔍 Fetching all data...")
        all_data = fetcher.get_all_data(spreadsheet_id, sheet_name)
        if all_data:
            print(f"✅ Fetched {len(all_data)} rows")
            
            # Show first few rows as preview
            if len(all_data) > 0:
                print("\n👀 Preview (first 3 rows):")
                for i, row in enumerate(all_data[:3]):
                    print(f"Row {i+1}: {row}")
            
            # Ask if user wants to save all data
            save_all_choice = input("\nSave all data to JSON file? (y/n): ").strip().lower()
            if save_all_choice == 'y':
                filename = input("Enter filename (or press Enter for 'sheet_data.json'): ").strip()
                if not filename:
                    filename = 'sheet_data.json'
                
                # Create structured data
                structured_data = {
                    'spreadsheet_title': sheet_info['title'],
                    'sheet_name': sheet_name,
                    'headers': headers,
                    'data': all_data,
                    'total_rows': len(all_data)
                }
                save_to_json(structured_data, filename)
        else:
            print("❌ Failed to get data")
    
    print("\n✅ Done!")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 Goodbye!")
    except Exception as e:
        print(f"\n❌ An error occurred: {e}")
        sys.exit(1)
