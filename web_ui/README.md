# GitLab ↔ Google Sheets Sync - Web UI

A modern web interface for managing your GitLab and Google Sheets synchronization.

## Features

### 📊 Dashboard
- System status overview
- Configuration completeness check
- Quick access to all features
- Real-time connection status

### ⚙️ Configuration Management
- GitLab API settings (URL, token, project ID)
- Google Sheets integration (spreadsheet ID, service account)
- Issue template defaults (assignee, estimates, labels)
- Easy-to-use web forms with validation

### 🗂️ Dynamic Column Mapping
- Auto-detect headers from your Google Sheet
- Drag-and-drop column reordering
- Visual column configuration interface
- Support for different data types (date, text, number, dropdown)
- Real-time validation

### 🔄 Sync Operations
- Sheets → GitLab sync (create/update issues)
- GitLab → Sheets sync (update status/tracking)
- Complete bidirectional synchronization
- Real-time sync progress monitoring
- Detailed output logs

### 🧪 Connection Testing
- Test GitLab API connectivity
- Verify Google Sheets access
- Detailed error diagnostics
- Troubleshooting guides

## Quick Start

### 1. Run the Web UI

```bash
# Navigate to the web UI directory
cd web_ui

# Start the application (this will set up everything automatically)
./start.sh
```

The start script will:
- Create a virtual environment
- Install dependencies
- Set up configuration files
- Start the Flask web server

### 2. Access the Web Interface

Open your browser and go to:
- **Local:** http://localhost:5000
- **Network:** http://[your-ip]:5000

### 3. Configure Your Settings

1. **Configuration Page**: Set up GitLab and Google Sheets credentials
2. **Test Connections**: Verify your setup works
3. **Column Mapping**: Configure how data maps between systems
4. **Start Syncing**: Perform synchronization operations

## Configuration

### GitLab Settings
- **GitLab Token**: Personal access token with 'api' scope
- **GitLab URL**: Your GitLab instance API URL (e.g., `https://gitlab.com/api/v4/`)
- **Project ID**: GitLab project identifier

### Google Sheets Settings
- **Spreadsheet ID**: From your Google Sheets URL
- **Worksheet Name**: Name of the sheet tab (default: 'Sheet1')
- **Service Account File**: Path to your Google service account JSON file

### Issue Defaults
- **Default Assignee**: GitLab username for new issues
- **Default Estimate**: Time estimation format (e.g., '8h')
- **Default Milestone**: Milestone name for new issues
- **Default Label**: Label to apply to new issues

## Features in Detail

### Auto Column Detection
The web UI can automatically detect headers in your Google Sheet and suggest column mappings. This makes setup much easier and reduces configuration errors.

### Real-time Sync Monitoring
Watch sync operations in real-time with:
- Progress indicators
- Detailed output logs
- Error reporting
- Success confirmations

### Responsive Design
The interface works great on:
- Desktop computers
- Tablets
- Mobile devices

### Built-in Help
- Troubleshooting guides
- Configuration examples
- Error explanations
- Best practices

## Security

- Sensitive data (tokens, passwords) are masked in the UI
- Configuration is stored securely in environment files
- Service account files are kept local to your system

## Technology Stack

- **Backend**: Python Flask
- **Frontend**: Bootstrap 5, jQuery
- **Icons**: Font Awesome
- **APIs**: GitLab API, Google Sheets API

## Troubleshooting

### Port Already in Use
If port 5000 is busy, edit `app.py` and change:
```python
app.run(debug=True, host='0.0.0.0', port=5001)  # Use different port
```

### Permission Issues
Make sure the start script is executable:
```bash
chmod +x start.sh
```

### Dependencies
If you encounter dependency issues, manually install:
```bash
pip install flask requests pandas google-api-python-client google-auth python-dotenv
```

## Manual Installation

If the start script doesn't work, you can set up manually:

```bash
# Create virtual environment
python3 -m venv ../venv
source ../venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set up environment file
cp ../env.example ../.env
# Edit .env with your values

# Run the application
python app.py
```

## Development

To modify the web interface:

1. **Templates**: Edit HTML files in `templates/`
2. **Styles**: Modify CSS in the `<style>` sections or add external stylesheets
3. **Functionality**: Update Python logic in `app.py`
4. **Dependencies**: Add new packages to `requirements.txt`

The Flask development server auto-reloads when you make changes.

## Support

For issues or questions:
1. Check the built-in troubleshooting guides
2. Test your connections using the Test page
3. Review the sync output logs for detailed error information
4. Ensure your configuration is complete and valid
