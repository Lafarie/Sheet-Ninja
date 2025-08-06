// Global variables
let serviceAccountCredentials = null;
let accessToken = null;
let selectedSheetId = null;
let selectedWorksheetId = null;
let selectedSheetData = null;

// DOM elements
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const sheetsStep = document.getElementById('sheets-step');
const worksheetsStep = document.getElementById('worksheets-step');
const dataStep = document.getElementById('data-step');
const sheetsLoading = document.getElementById('sheetsLoading');
const sheetsGrid = document.getElementById('sheetsGrid');
const noSheets = document.getElementById('noSheets');
const worksheetsLoading = document.getElementById('worksheetsLoading');
const worksheetsList = document.getElementById('worksheetsList');
const selectedSheetInfo = document.getElementById('selectedSheetInfo');
const selectedSheetName = document.getElementById('selectedSheetName');
const dataLoading = document.getElementById('dataLoading');
const dataContainer = document.getElementById('dataContainer');
const toastContainer = document.getElementById('toastContainer');

// Initialize event listeners
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
});

function initializeEventListeners() {
    // File input change
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop functionality
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleFileDrop);
    uploadArea.addEventListener('click', () => fileInput.click());
}

// File handling functions
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        processFile(file);
    }
}

function handleDragOver(event) {
    event.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(event) {
    event.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleFileDrop(event) {
    event.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

function processFile(file) {
    if (!file.name.endsWith('.json')) {
        showToast('Please select a valid JSON file', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const credentials = JSON.parse(e.target.result);
            
            // Validate service account JSON structure
            if (!credentials.client_email || !credentials.private_key || !credentials.project_id) {
                showToast('Invalid service account JSON structure', 'error');
                return;
            }
            
            serviceAccountCredentials = credentials;
            displayFileInfo(file);
            authenticateAndLoadSheets();
            
        } catch (error) {
            showToast('Invalid JSON file format', 'error');
        }
    };
    reader.readAsText(file);
}

function displayFileInfo(file) {
    fileName.textContent = file.name;
    fileSize.textContent = `${(file.size / 1024).toFixed(2)} KB`;
    fileInfo.style.display = 'block';
    uploadArea.style.display = 'none';
}

function removeFile() {
    serviceAccountCredentials = null;
    accessToken = null;
    selectedSheetId = null;
    selectedWorksheetId = null;
    fileInput.value = '';
    fileInfo.style.display = 'none';
    uploadArea.style.display = 'block';
    sheetsStep.classList.add('disabled');
    worksheetsStep.classList.add('disabled');
    dataStep.classList.add('disabled');
    sheetsGrid.innerHTML = '';
    worksheetsList.innerHTML = '';
    dataContainer.innerHTML = '';
}

// Authentication functions
async function authenticateAndLoadSheets() {
    try {
        showToast('Authenticating with Google...', 'success');
        
        // Get access token using service account
        accessToken = await getAccessToken();
        
        if (accessToken) {
            sheetsStep.classList.remove('disabled');
            loadGoogleSheets();
        } else {
            showToast('Authentication failed', 'error');
        }
    } catch (error) {
        showToast('Authentication error: ' + error.message, 'error');
    }
}

async function getAccessToken() {
    try {
        // Create JWT token
        const jwtToken = await createJWTToken();
        
        // Exchange JWT for access token
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: jwtToken
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to get access token');
        }
        
        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error('Error getting access token:', error);
        throw error;
    }
}

async function createJWTToken() {
    // This is a simplified version - in production, you'd want to use a proper JWT library
    // For this demo, we'll use a basic implementation
    const header = {
        alg: 'RS256',
        typ: 'JWT'
    };
    
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: serviceAccountCredentials.client_email,
        scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now
    };
    
    // Note: This is a simplified version. In a real application, you'd need proper RSA signing
    // For demo purposes, we'll use a mock token or handle this server-side
    return await mockJWTCreation(header, payload);
}

async function mockJWTCreation(header, payload) {
    // In a real application, this would be handled server-side with proper RSA signing
    // For demo purposes, we'll create a mock implementation
    
    // For this demo, we'll use the Google Apps Script API or handle auth differently
    showToast('Note: In production, authentication should be handled server-side', 'warning');
    
    // Return a mock token for demo purposes
    // In real implementation, use proper JWT signing with the private key
    const base64Header = btoa(JSON.stringify(header));
    const base64Payload = btoa(JSON.stringify(payload));
    
    // This would normally include proper RSA signature
    return `${base64Header}.${base64Payload}.mock_signature`;
}

// Google Sheets API functions
async function loadGoogleSheets() {
    sheetsLoading.style.display = 'block';
    sheetsGrid.innerHTML = '';
    noSheets.style.display = 'none';
    
    try {
        // For demo purposes, we'll use a different approach since direct API calls need server-side handling
        // In production, you'd make authenticated requests to the Google Sheets API
        
        // Mock data for demonstration
        const mockSheets = [
            {
                id: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
                name: 'Class Data',
                url: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
            },
            {
                id: '1mVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms2',
                name: 'Sales Report 2024',
                url: 'https://docs.google.com/spreadsheets/d/1mVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms2'
            },
            {
                id: '1XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms3',
                name: 'Employee Database',
                url: 'https://docs.google.com/spreadsheets/d/1XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms3'
            }
        ];
        
        sheetsLoading.style.display = 'none';
        
        if (mockSheets.length === 0) {
            noSheets.style.display = 'block';
        } else {
            displaySheets(mockSheets);
            showToast('Google Sheets loaded successfully', 'success');
        }
        
    } catch (error) {
        sheetsLoading.style.display = 'none';
        showToast('Error loading sheets: ' + error.message, 'error');
    }
}

function displaySheets(sheets) {
    sheetsGrid.innerHTML = '';
    
    sheets.forEach(sheet => {
        const sheetCard = document.createElement('div');
        sheetCard.className = 'sheet-card';
        sheetCard.onclick = () => selectSheet(sheet);
        
        sheetCard.innerHTML = `
            <h3><i class="fas fa-table"></i> ${sheet.name}</h3>
            <p>ID: ${sheet.id}</p>
            <p>Click to select this sheet</p>
        `;
        
        sheetsGrid.appendChild(sheetCard);
    });
}

function selectSheet(sheet) {
    selectedSheetId = sheet.id;
    selectedSheetData = sheet;
    
    // Update UI
    document.querySelectorAll('.sheet-card').forEach(card => {
        card.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');
    
    // Enable worksheets step
    worksheetsStep.classList.remove('disabled');
    loadWorksheets(sheet);
    
    showToast(`Selected sheet: ${sheet.name}`, 'success');
}

async function loadWorksheets(sheet) {
    worksheetsLoading.style.display = 'block';
    worksheetsList.innerHTML = '';
    selectedSheetInfo.style.display = 'none';
    
    try {
        // Mock worksheets data for demonstration
        const mockWorksheets = [
            { id: 0, name: 'Sheet1', rowCount: 1000, columnCount: 26 },
            { id: 1, name: 'Data Analysis', rowCount: 500, columnCount: 15 },
            { id: 2, name: 'Summary', rowCount: 100, columnCount: 10 }
        ];
        
        worksheetsLoading.style.display = 'none';
        displayWorksheets(mockWorksheets);
        
    } catch (error) {
        worksheetsLoading.style.display = 'none';
        showToast('Error loading worksheets: ' + error.message, 'error');
    }
}

function displayWorksheets(worksheets) {
    worksheetsList.innerHTML = '';
    
    worksheets.forEach(worksheet => {
        const worksheetItem = document.createElement('div');
        worksheetItem.className = 'worksheet-item';
        worksheetItem.onclick = () => selectWorksheet(worksheet);
        
        worksheetItem.innerHTML = `
            <h4>${worksheet.name}</h4>
            <p>${worksheet.rowCount} rows × ${worksheet.columnCount} columns</p>
        `;
        
        worksheetsList.appendChild(worksheetItem);
    });
}

function selectWorksheet(worksheet) {
    selectedWorksheetId = worksheet.id;
    
    // Update UI
    document.querySelectorAll('.worksheet-item').forEach(item => {
        item.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');
    
    // Show selected sheet info
    selectedSheetName.textContent = `${selectedSheetData.name} - ${worksheet.name}`;
    selectedSheetInfo.style.display = 'block';
    
    // Enable data step
    dataStep.classList.remove('disabled');
    
    showToast(`Selected worksheet: ${worksheet.name}`, 'success');
}

async function fetchSheetData() {
    dataLoading.style.display = 'block';
    dataContainer.innerHTML = '';
    
    try {
        // Mock data for demonstration
        const mockData = [
            ['Name', 'Email', 'Age', 'Department', 'Salary'],
            ['John Doe', 'john.doe@example.com', '30', 'Engineering', '$75,000'],
            ['Jane Smith', 'jane.smith@example.com', '28', 'Marketing', '$65,000'],
            ['Bob Johnson', 'bob.johnson@example.com', '35', 'Sales', '$70,000'],
            ['Alice Brown', 'alice.brown@example.com', '32', 'HR', '$60,000'],
            ['Charlie Wilson', 'charlie.wilson@example.com', '29', 'Engineering', '$80,000']
        ];
        
        dataLoading.style.display = 'none';
        displaySheetData(mockData);
        showToast('Sheet data fetched successfully', 'success');
        
    } catch (error) {
        dataLoading.style.display = 'none';
        showToast('Error fetching data: ' + error.message, 'error');
    }
}

function displaySheetData(data) {
    if (!data || data.length === 0) {
        dataContainer.innerHTML = '<p>No data found in the selected worksheet.</p>';
        return;
    }
    
    const table = document.createElement('table');
    table.className = 'data-table';
    
    // Create header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    data[0].forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create body
    const tbody = document.createElement('tbody');
    for (let i = 1; i < data.length; i++) {
        const row = document.createElement('tr');
        data[i].forEach(cell => {
            const td = document.createElement('td');
            td.textContent = cell;
            row.appendChild(td);
        });
        tbody.appendChild(row);
    }
    table.appendChild(tbody);
    
    // Add summary info
    const summary = document.createElement('div');
    summary.style.marginBottom = '20px';
    summary.innerHTML = `
        <p><strong>Data Summary:</strong> ${data.length - 1} rows × ${data[0].length} columns</p>
    `;
    
    dataContainer.appendChild(summary);
    dataContainer.appendChild(table);
}

function openInGoogleSheets() {
    if (selectedSheetData && selectedSheetData.url) {
        window.open(selectedSheetData.url, '_blank');
    } else {
        showToast('No sheet URL available', 'error');
    }
}

// Toast notification function
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fas fa-check-circle';
    if (type === 'error') icon = 'fas fa-exclamation-circle';
    if (type === 'warning') icon = 'fas fa-exclamation-triangle';
    
    toast.innerHTML = `
        <i class="${icon}"></i>
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Show toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 5000);
}

// Utility functions
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Export functions for external use
window.GoogleSheetsManager = {
    removeFile,
    fetchSheetData,
    openInGoogleSheets,
    showToast
};
