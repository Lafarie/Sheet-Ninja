# Google Sheets Manager Web UI

A modern, user-friendly web interface for managing Google Sheets using service account authentication. This application allows you to upload a Google Service Account JSON file, browse your accessible Google Sheets, select worksheets, and view data in a beautiful, responsive interface.

## Features

- 🎨 **Modern, Responsive Design** - Beautiful UI that works on all devices
- 📁 **Drag & Drop File Upload** - Easy service account JSON file upload
- 🔐 **Secure Authentication** - Google Service Account integration
- 📊 **Sheet Browser** - Browse and select from your accessible Google Sheets
- 📝 **Worksheet Selection** - Choose specific worksheets within sheets
- 📈 **Data Visualization** - View sheet data in a clean, tabular format
- 🚀 **Real-time Feedback** - Toast notifications for user actions
- 📱 **Mobile Friendly** - Fully responsive design

## Setup Instructions

### 1. Google Cloud Console Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Sheets API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click "Enable"

### 2. Create Service Account

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Fill in the service account details:
   - Service account name: `sheets-manager`
   - Description: `Service account for Google Sheets Manager`
4. Click "Create and Continue"
5. Assign roles (optional, or skip this step)
6. Click "Done"

### 3. Generate Service Account Key

1. In the Credentials page, find your newly created service account
2. Click on the service account email
3. Go to the "Keys" tab
4. Click "Add Key" > "Create new key"
5. Select "JSON" format
6. Click "Create"
7. The JSON file will be downloaded to your computer

### 4. Share Google Sheets

For the service account to access your Google Sheets:

1. Open your Google Sheet
2. Click "Share" button
3. Add the service account email (found in the JSON file under `client_email`)
4. Give "Viewer" or "Editor" permissions as needed
5. Click "Send"

### 5. Run the Application

1. Clone or download this repository
2. Open `index.html` in a web browser
3. Upload your service account JSON file
4. Browse and select your Google Sheets!

## File Structure

```
web-ui/
├── index.html          # Main HTML file with UI structure
├── styles.css          # CSS styles for modern, responsive design
├── script.js           # JavaScript functionality and Google Sheets integration
└── README.md           # This file
```

## How to Use

### Step 1: Upload Service Account JSON
- Drag and drop your service account JSON file onto the upload area
- Or click "Choose File" to select the file manually
- The file will be validated for proper structure

### Step 2: Select Google Sheet
- Once authenticated, your accessible Google Sheets will be displayed
- Click on any sheet card to select it
- The selected sheet will be highlighted

### Step 3: Select Worksheet
- Choose from the available worksheets within the selected sheet
- Each worksheet shows row and column counts
- Click to select the desired worksheet

### Step 4: View Data
- Click "Fetch Data" to retrieve and display the worksheet data
- Data is presented in a clean, scrollable table
- Use "Open in Google Sheets" to view in the original Google Sheets interface

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never commit service account JSON files to version control**
2. **Store credentials securely** - consider using environment variables in production
3. **Limit service account permissions** to only what's necessary
4. **Use HTTPS** in production environments
5. **Consider implementing server-side authentication** for production use

## Browser Compatibility

- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Edge 80+

## Customization

The application is built with modularity in mind. You can easily customize:

- **Colors and Themes**: Modify the CSS variables in `styles.css`
- **Layout**: Adjust the grid layouts and card designs
- **Functionality**: Extend the JavaScript in `script.js`
- **API Integration**: Modify the Google Sheets API calls for additional features

## Troubleshooting

### Common Issues

1. **"Authentication failed"**
   - Verify your service account JSON file is valid
   - Ensure the Google Sheets API is enabled in your Google Cloud project

2. **"No sheets found"**
   - Make sure you've shared your Google Sheets with the service account email
   - Check that the service account has the correct permissions

3. **"Invalid JSON file format"**
   - Ensure you're uploading the correct service account JSON file
   - Verify the file hasn't been corrupted

### Debug Mode

Open browser developer tools (F12) to see console logs and network requests for debugging.

## Contributing

Feel free to contribute to this project by:
- Reporting bugs
- Suggesting new features
- Submitting pull requests
- Improving documentation

## License

This project is open source and available under the MIT License.

---

Made with ❤️ for better Google Sheets management
