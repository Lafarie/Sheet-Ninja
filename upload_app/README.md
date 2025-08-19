# JSON Upload Application

A simple, organized Flask application for uploading and validating Google Sheets API service account JSON files.

## 🎯 Purpose

This application provides a clean interface for uploading Google Sheets API service account credentials in JSON format, with proper validation and file handling.

## 📁 Project Structure

```
upload_app/
├── app.py                 # Main Flask application
├── templates/
│   └── upload.html        # HTML interface
├── utils/
│   ├── __init__.py       # Package initialization
│   ├── file_handler.py   # File operations
│   ├── json_validator.py # JSON validation
│   └── response_helper.py # API response formatting
└── uploads/              # Directory for uploaded files (auto-created)
```

## 🚀 How to Run

### 1. Install Dependencies
```bash
pip install flask flask-cors
```

### 2. Start the Server
```bash
cd upload_app
python app.py
```

### 3. Access the Application
Open your browser and go to: `http://localhost:8000`

## 🌟 Features

### Simple UI
- **Drag & Drop**: Drop JSON files directly onto the upload area
- **File Browser**: Click to browse and select files
- **Paste Content**: Paste JSON content directly into textarea
- **Responsive Design**: Works on desktop, tablet, and mobile

### File Validation
- **JSON Syntax**: Validates proper JSON format
- **Service Account Structure**: Checks for required Google Service Account fields
- **File Type**: Only accepts .json files
- **File Size**: Maximum 1MB file size limit

### Organization
- **Modular Code**: Separated into logical components
- **Clean Architecture**: Easy to understand and maintain
- **Error Handling**: Comprehensive error messages
- **API Endpoints**: RESTful API design

## 🔧 API Endpoints

- `GET /` - Main upload page
- `POST /api/upload` - Upload JSON file
- `POST /api/validate` - Validate JSON content
- `GET /api/health` - Health check
- `GET /api/files` - List uploaded files
- `DELETE /api/clear` - Clear all uploads

## 📊 What Gets Validated

The application validates that the JSON file contains all required Google Service Account fields:

- `type` (must be "service_account")
- `project_id`
- `private_key_id`
- `private_key`
- `client_email`
- `client_id`
- `auth_uri`
- `token_uri`

## 🎨 UI Components

### Upload Zone
- Visual drag-and-drop area with hover effects
- File type and size validation
- Progress indicators

### Status Messages
- Success notifications (green)
- Error messages (red)
- Info messages (blue)
- Auto-dismiss for non-critical messages

### File Information Display
- Service account details
- Project information
- Validation status
- Upload metadata

## 🔒 Security Features

- File type validation
- File size limits
- JSON structure validation
- Input sanitization
- Error message sanitization

## 💡 Usage Tips

1. **Upload Method**: You can either drag & drop files or use the file browser
2. **Paste Option**: For quick testing, paste JSON content directly
3. **Validation**: All files are validated before saving
4. **File Management**: View uploaded files and clear when needed
5. **Mobile Friendly**: The interface works well on mobile devices

## 🛠️ Technical Details

### Flask Application
- Uses Flask for the web framework
- CORS enabled for cross-origin requests
- Modular structure with utility classes

### File Handling
- Automatic directory creation
- File metadata tracking
- Safe file operations
- Error recovery

### Response Format
- Consistent JSON API responses
- Detailed error messages
- Timestamp tracking
- Status codes

This simple application provides a clean, user-friendly way to upload and validate Google Sheets API service account JSON files with proper organization and error handling.
