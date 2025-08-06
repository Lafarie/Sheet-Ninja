"""
Helper utilities for Google Sheets operations
"""

import json
import os


def save_to_json(data, filename):
    """Save data to JSON file"""
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"✅ Data saved to {filename}")
        return True
    except Exception as e:
        print(f"❌ Error saving to JSON: {e}")
        return False


def load_from_json(filename):
    """Load data from JSON file"""
    try:
        if not os.path.exists(filename):
            print(f"❌ File not found: {filename}")
            return None
        
        with open(filename, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"✅ Data loaded from {filename}")
        return data
    except Exception as e:
        print(f"❌ Error loading from JSON: {e}")
        return None


def print_headers(headers):
    """Print headers in a nice format"""
    if not headers:
        print("❌ No headers to display")
        return
    
    print("\n📋 Sheet Headers:")
    print("-" * 50)
    for i, header in enumerate(headers, 1):
        print(f"{i:2d}. {header}")
    print("-" * 50)


def print_sheet_info(sheet_info):
    """Print sheet information in a nice format"""
    if not sheet_info:
        print("❌ No sheet information to display")
        return
    
    print(f"\n📊 Spreadsheet: {sheet_info['title']}")
    print("=" * 60)
    
    for sheet in sheet_info['sheets']:
        print(f"📄 Sheet: {sheet['name']}")
        print(f"   Rows: {sheet['rows']}")
        print(f"   Columns: {sheet['columns']}")
        print(f"   ID: {sheet['id']}")
        print("-" * 40)


def extract_sheet_id_from_url(url):
    """Extract spreadsheet ID from Google Sheets URL"""
    try:
        # Handle different URL formats
        if '/spreadsheets/d/' in url:
            start = url.find('/spreadsheets/d/') + len('/spreadsheets/d/')
            end = url.find('/', start)
            if end == -1:
                end = url.find('#', start)
            if end == -1:
                end = len(url)
            return url[start:end]
        else:
            print("❌ Invalid Google Sheets URL format")
            return None
    except Exception as e:
        print(f"❌ Error extracting sheet ID: {e}")
        return None
