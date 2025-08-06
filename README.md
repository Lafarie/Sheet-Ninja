# Google Sheets Web Client

🚀 **Modern web-based solution** to fetch Google Sheets data directly from your browser with real API integration!

## 🌟 Features

- ✅ **Modern Web Interface** - Beautiful, responsive design
- ✅ **Real Google Sheets API** - Connects to actual spreadsheets
- ✅ **Drag & Drop Upload** - Easy credential file upload
- ✅ **Live Data Fetching** - Get real sheet names and data
- ✅ **Data Preview** - See your data before downloading
- ✅ **JSON Export** - Download headers and data as JSON
- ✅ **Multiple Sheets Support** - Handle spreadsheets with multiple sheets
- ✅ **Secure** - Credentials processed server-side securely

## 📁 Project Structure

```
📦 Google Sheets Web Client
├── 🎨 web_client.html      # Main web application
├── 🚀 flask_server.py     # Flask backend with Google Sheets API
├── 📋 index.html          # Simple alternative interface
├── 📤 upload_form.html    # Basic upload form
├── 📜 requirements.txt    # Python dependencies
├── 📖 README.md           # This file
└── 🚫 .gitignore         # Git ignore rules
```

## 🚀 **Ready to Use:**

1. **Install dependencies:** `pip install -r requirements.txt`
2. **Start server:** `python flask_server.py`
3. **Open browser:** `http://localhost:8000`
4. **Upload credentials & fetch your Google Sheets data!**

## 📖 Setup Instructions

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
```bash
python flask_server.py
```
Then visit `http://localhost:8000` in your browser.

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
Then visit `http://localhost:8000` for **real Google Sheets integration**.

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

## 🎯 How to Use

### Step-by-Step Web Interface:

1. **📤 Upload Credentials:**
   - Drag & drop your `credentials.json` file
   - Or paste JSON content directly

2. **📊 Connect to Sheet:**
   - Enter your Google Sheets URL or ID
   - View all available sheets in your spreadsheet

3. **📋 Fetch Data:**
   - Select a sheet from the list
   - Get headers only or full data
   - Download as JSON files

### Single Web Interface:
- **Main App:** `http://localhost:8000` - Complete single-page application

## 🌐 API Endpoints

The Flask server provides REST API endpoints:

- `POST /api/authenticate` - Authenticate with credentials
- `GET /api/spreadsheet/{id}/info` - Get spreadsheet information
- `GET /api/spreadsheet/{id}/sheet/{name}/headers` - Get sheet headers
- `GET /api/spreadsheet/{id}/sheet/{name}/data` - Get sheet data
- `GET /api/health` - Health check

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
