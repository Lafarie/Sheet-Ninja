const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Configure multer for file uploads
const upload = multer({ 
    dest: 'uploads/',
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/json') {
            cb(null, true);
        } else {
            cb(new Error('Only JSON files are allowed!'), false);
        }
    }
});

// Store service account credentials temporarily (in production, use proper session management)
let serviceAccountCredentials = {};

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Upload service account JSON
app.post('/upload-credentials', upload.single('serviceAccount'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const credentials = JSON.parse(fs.readFileSync(req.file.path, 'utf8'));
        
        // Validate service account structure
        if (!credentials.client_email || !credentials.private_key || !credentials.project_id) {
            return res.status(400).json({ error: 'Invalid service account JSON structure' });
        }

        // Store credentials (use proper session management in production)
        const sessionId = Date.now().toString();
        serviceAccountCredentials[sessionId] = credentials;

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        res.json({ 
            success: true, 
            sessionId: sessionId,
            clientEmail: credentials.client_email 
        });
    } catch (error) {
        console.error('Error processing credentials:', error);
        res.status(500).json({ error: 'Failed to process credentials' });
    }
});

// Get Google Sheets
app.get('/api/sheets/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const credentials = serviceAccountCredentials[sessionId];
        
        if (!credentials) {
            return res.status(401).json({ error: 'Invalid session or credentials not found' });
        }

        // Initialize Google Sheets API
        const auth = new google.auth.GoogleAuth({
            credentials: credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const drive = google.drive({ version: 'v3', auth });
        
        // Get all spreadsheet files
        const response = await drive.files.list({
            q: "mimeType='application/vnd.google-apps.spreadsheet'",
            fields: 'files(id, name, webViewLink, createdTime, modifiedTime)',
            orderBy: 'modifiedTime desc'
        });

        const sheets = response.data.files.map(file => ({
            id: file.id,
            name: file.name,
            url: file.webViewLink,
            createdTime: file.createdTime,
            modifiedTime: file.modifiedTime
        }));

        res.json({ sheets });
    } catch (error) {
        console.error('Error fetching sheets:', error);
        res.status(500).json({ error: 'Failed to fetch sheets: ' + error.message });
    }
});

// Get worksheets from a specific sheet
app.get('/api/sheets/:sessionId/:sheetId/worksheets', async (req, res) => {
    try {
        const { sessionId, sheetId } = req.params;
        const credentials = serviceAccountCredentials[sessionId];
        
        if (!credentials) {
            return res.status(401).json({ error: 'Invalid session or credentials not found' });
        }

        // Initialize Google Sheets API
        const auth = new google.auth.GoogleAuth({
            credentials: credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        
        // Get spreadsheet metadata
        const response = await sheets.spreadsheets.get({
            spreadsheetId: sheetId,
            fields: 'sheets(properties(sheetId,title,gridProperties))'
        });

        const worksheets = response.data.sheets.map(sheet => ({
            id: sheet.properties.sheetId,
            name: sheet.properties.title,
            rowCount: sheet.properties.gridProperties.rowCount,
            columnCount: sheet.properties.gridProperties.columnCount
        }));

        res.json({ worksheets });
    } catch (error) {
        console.error('Error fetching worksheets:', error);
        res.status(500).json({ error: 'Failed to fetch worksheets: ' + error.message });
    }
});

// Get data from a specific worksheet
app.get('/api/sheets/:sessionId/:sheetId/:worksheetName/data', async (req, res) => {
    try {
        const { sessionId, sheetId, worksheetName } = req.params;
        const { range = 'A1:Z1000' } = req.query;
        const credentials = serviceAccountCredentials[sessionId];
        
        if (!credentials) {
            return res.status(401).json({ error: 'Invalid session or credentials not found' });
        }

        // Initialize Google Sheets API
        const auth = new google.auth.GoogleAuth({
            credentials: credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        
        // Get data from the worksheet
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `${worksheetName}!${range}`,
        });

        const data = response.data.values || [];
        
        res.json({ 
            data,
            range: response.data.range,
            majorDimension: response.data.majorDimension
        });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Failed to fetch data: ' + error.message });
    }
});

// Clean up old sessions (simple cleanup, use proper session management in production)
setInterval(() => {
    const now = Date.now();
    Object.keys(serviceAccountCredentials).forEach(sessionId => {
        // Remove sessions older than 1 hour
        if (now - parseInt(sessionId) > 3600000) {
            delete serviceAccountCredentials[sessionId];
        }
    });
}, 300000); // Run every 5 minutes

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large' });
        }
    }
    res.status(500).json({ error: error.message });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Google Sheets Manager server running on http://localhost:${PORT}`);
    console.log(`📁 Serving files from: ${__dirname}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
