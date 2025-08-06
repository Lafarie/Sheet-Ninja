# Google Sheets Header Fetcher

A simple Python application to fetch Google Sheets details like headers and data using the Google Sheets API.

## Files Structure

- `main.py` - Main script with command-line interface
- `auth.py` - Google Sheets API authentication handler
- `sheets_fetcher.py` - Core functionality to fetch sheet data
- `config.py` - Configuration settings
- `utils.py` - Helper utilities and formatting functions
- `upload_form.html` - Simple web interface for uploading credentials
- `requirements.txt` - Python dependencies

## Setup Instructions

1. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Get Google Sheets API Credentials**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Google Sheets API
   - Create a Service Account
   - Download the JSON credentials file
   - Save it as `credentials.json` in this directory

3. **Share Your Google Sheet**
   - Open your Google Sheet
   - Click "Share" button
   - Add the service account email (from credentials.json) with "Viewer" permission

## Usage

### Command Line Interface
```bash
python main.py
```

The script will prompt you for:
- Credentials file path (default: credentials.json)
- Google Sheets ID or URL
- Which sheet to process (if multiple sheets exist)

### Web Interface
1. Open `upload_form.html` in your browser
2. Upload your credentials JSON file
3. Enter your Google Sheets ID or URL
4. Click "Process Sheet"

## Features

- ✅ Fetch sheet headers (first row)
- ✅ Get basic sheet information (title, dimensions, sheet names)
- ✅ Fetch all data from a sheet
- ✅ Save results to JSON files
- ✅ Simple web interface for credential upload
- ✅ Support for both Sheets ID and full URL
- ✅ Multiple sheets handling
- ✅ Error handling and user-friendly messages

## Example Output

```
🚀 Google Sheets Header Fetcher
========================================

📊 Spreadsheet: My Sample Sheet
============================================================
📄 Sheet: Sheet1
   Rows: 100
   Columns: 10
   ID: 0
----------------------------------------

📋 Sheet Headers:
--------------------------------------------------
 1. Name
 2. Email
 3. Phone
 4. Department
 5. Salary
--------------------------------------------------
```

## Security Notes

- Keep your `credentials.json` file secure
- Don't commit credentials to version control
- The web interface runs locally and doesn't send data to any server
- Only share sheets with the minimum required permissions
