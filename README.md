# Google Sheets Web Client

🚀 **Complete web-based solution** to fetch Google Sheets data directly from your browser. No command line needed!

## 🌟 Features

- ✅ **Modern Web Interface** - Beautiful, responsive design
- ✅ **No Command Line** - Everything runs in your browser
- ✅ **Drag & Drop Upload** - Easy credential file upload
- ✅ **Real-time Validation** - Instant feedback on credentials
- ✅ **Data Preview** - See your data before downloading
- ✅ **JSON Export** - Download headers and data as JSON
- ✅ **Multiple Sheets Support** - Handle spreadsheets with multiple sheets
- ✅ **Secure** - Credentials processed locally in browser

## 📁 Files Structure

### Web Interface Files
- `web_client.html` - **🎨 Main web application** (Advanced UI)
- `flask_server.py` - **🚀 Flask server** with real Google Sheets API
- `web_server.py` - Simple HTTP server (demo mode)
- `index.html` - Simple web interface
- `upload_form.html` - Basic upload form

### Python Backend (Optional)
- `upload_json.py` - Interactive script for uploading JSON credentials
- `main.py` - Command-line interface
- `auth.py` - Google Sheets API authentication handler
- `sheets_fetcher.py` - Core functionality to fetch sheet data
- `config.py` - Configuration settings
- `utils.py` - Helper utilities and JSON validation functions
- `requirements.txt` - Python dependencies

## 🚀 Quick Start (Web Interface)

**Real Google Sheets Integration - Updated!**

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Get Google Sheets API credentials** (see setup below)

3. **Run the Flask server:**
   ```bash
   python flask_server.py
   ```

4. **Open your browser** to `http://localhost:5000`

5. **Upload your credentials** and fetch real sheet data!

### Alternative: Simple Web Server (Demo Mode)
```bash
python web_server.py
```
This serves static HTML files with simulated data for demonstration.

## 📖 Detailed Setup

### Step 1: Get Google Sheets API Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google Sheets API
4. Create a Service Account
5. Download the JSON credentials file

### Step 2: Share Your Google Sheet
1. Open your Google Sheet
2. Click "Share" button  
3. Add the service account email (from credentials.json) with "Viewer" permission

### Step 3: Run the Application

#### Option A: Flask Server (Real Google Sheets API)
```bash
# Install dependencies
pip install -r requirements.txt

# Run Flask server
python flask_server.py
```
Then visit `http://localhost:5000` for **real Google Sheets integration**.

#### Option B: Simple Web Server (Demo Mode)
```bash
python web_server.py
```
Then visit `http://localhost:8000` for demonstration with mock data.

#### Option C: Command Line
```bash
# Run interactive version
python upload_json.py

# Or run classic version
python main.py
```

3. **Share Your Google Sheet**
   - Open your Google Sheet
   - Click "Share" button
   - Add the service account email (from credentials.json) with "Viewer" permission

## 🎯 Usage Guide

### Web Interface Usage
1. **Start the server:** `python web_server.py`
2. **Step 1:** Upload your Google Sheets API credentials JSON file
3. **Step 2:** Enter your Google Sheets URL or ID
4. **Step 3:** Select a sheet and fetch headers or all data
5. **Download:** Get your data as JSON files

### Available Interfaces
- **Main Interface:** `http://localhost:8000` - Full-featured web app
- **Simple Interface:** `http://localhost:8000/simple` - Basic functionality  
- **Upload Form:** `http://localhost:8000/upload` - Credential upload only

### Command Line Usage (Optional)

#### Method 1: Interactive JSON Upload (Recommended)
```bash
python upload_json.py
```

#### Method 2: Traditional Command Line
```bash
python main.py
```

Both methods support:
- File path input for credentials
- Direct JSON paste
- Google Sheets URL or ID input
- Multiple sheet selection
- Data export to JSON

## 🌐 Web Features

### 🎨 Modern Interface
- **Responsive Design** - Works on desktop, tablet, and mobile
- **Step-by-step Wizard** - Guided process with progress tracking
- **Drag & Drop** - Easy file uploads
- **Real-time Validation** - Instant feedback on input

### 📊 Data Handling
- **Sheet Selection** - Choose from multiple sheets in a workbook
- **Data Preview** - See your data before downloading
- **Export Options** - Download headers only or full data
- **JSON Format** - Clean, structured data export

### 🔒 Security
- **Local Processing** - Credentials never leave your browser
- **No Server Storage** - Files processed in memory only
- **Secure Validation** - Proper credential format checking

## 📱 Example Screenshots

### Web Interface Flow
```
🔐 Step 1: Upload Credentials
   ↓
📊 Step 2: Connect to Sheet  
   ↓
📈 Step 3: Fetch & Download Data
```

## 🛠️ Technical Details

### Web Technology Stack
- **Frontend:** Pure HTML5, CSS3, JavaScript (ES6+)
- **Styling:** Modern CSS with gradients, animations, flexbox/grid
- **Backend:** Python HTTP server (optional, for local serving)
- **APIs:** Google Sheets API v4 (simulated in demo)

### Browser Compatibility
- ✅ Chrome 70+
- ✅ Firefox 65+
- ✅ Safari 12+
- ✅ Edge 79+

## 🚨 Important Notes

### Real vs Demo Mode

#### ✅ **Flask Server (RECOMMENDED)** - `python flask_server.py`
- **Real Google Sheets API integration**
- **Actual sheet names and data**
- **Live credential authentication**
- **Production-ready backend**

#### 📺 **Simple Web Server** - `python web_server.py`  
- **Demo mode with simulated data**
- **For demonstration purposes**
- **No real API calls**

### Security Considerations
- Keep your `credentials.json` file secure
- Don't commit credentials to version control
- The Flask server processes credentials server-side securely
- Only share sheets with minimum required permissions

### Troubleshooting
- **"Wrong sheet names"**: Use the Flask server (`flask_server.py`) for real data
- **403 Forbidden**: Make sure you've shared the sheet with your service account email
- **404 Not Found**: Check that the spreadsheet ID is correct
- **Server errors**: Ensure Flask dependencies are installed (`pip install -r requirements.txt`)

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
