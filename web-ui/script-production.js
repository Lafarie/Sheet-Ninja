// Production JavaScript file that works with the Node.js backend
// This replaces the mock data with real API calls

// Global variables
let sessionId = null;
let selectedSheetId = null;
let selectedWorksheetName = null;
let selectedSheetData = null;

// API base URL
const API_BASE = window.location.origin;

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

async function processFile(file) {
    if (!file.name.endsWith('.json')) {
        showToast('Please select a valid JSON file', 'error');
        return;
    }
    
    try {
        showToast('Uploading and validating credentials...', 'success');
        
        const formData = new FormData();
        formData.append('serviceAccount', file);
        
        const response = await fetch(`${API_BASE}/upload-credentials`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Upload failed');
        }
        
        sessionId = result.sessionId;
        displayFileInfo(file, result.clientEmail);
        loadGoogleSheets();
        
    } catch (error) {
        showToast('Error processing file: ' + error.message, 'error');
    }
}

function displayFileInfo(file, clientEmail) {
    fileName.textContent = file.name;
    fileSize.textContent = `${(file.size / 1024).toFixed(2)} KB • ${clientEmail}`;
    fileInfo.style.display = 'block';
    uploadArea.style.display = 'none';
}

function removeFile() {
    sessionId = null;
    selectedSheetId = null;
    selectedWorksheetName = null;
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

// Google Sheets API functions
async function loadGoogleSheets() {
    if (!sessionId) {
        showToast('No valid session found', 'error');
        return;
    }
    
    sheetsLoading.style.display = 'block';
    sheetsGrid.innerHTML = '';
    noSheets.style.display = 'none';
    sheetsStep.classList.remove('disabled');
    
    try {
        const response = await fetch(`${API_BASE}/api/sheets/${sessionId}`);
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to load sheets');
        }
        
        sheetsLoading.style.display = 'none';
        
        if (result.sheets.length === 0) {
            noSheets.style.display = 'block';
        } else {
            displaySheets(result.sheets);
            showToast(`Found ${result.sheets.length} Google Sheets`, 'success');
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
        
        const modifiedDate = new Date(sheet.modifiedTime).toLocaleDateString();
        
        sheetCard.innerHTML = `
            <h3><i class="fas fa-table"></i> ${sheet.name}</h3>
            <p><strong>ID:</strong> ${sheet.id}</p>
            <p><strong>Modified:</strong> ${modifiedDate}</p>
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
    if (!sessionId || !selectedSheetId) {
        showToast('No valid session or sheet selected', 'error');
        return;
    }
    
    worksheetsLoading.style.display = 'block';
    worksheetsList.innerHTML = '';
    selectedSheetInfo.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE}/api/sheets/${sessionId}/${selectedSheetId}/worksheets`);
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to load worksheets');
        }
        
        worksheetsLoading.style.display = 'none';
        displayWorksheets(result.worksheets);
        
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
    selectedWorksheetName = worksheet.name;
    
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
    if (!sessionId || !selectedSheetId || !selectedWorksheetName) {
        showToast('Missing session, sheet, or worksheet selection', 'error');
        return;
    }
    
    dataLoading.style.display = 'block';
    dataContainer.innerHTML = '';
    
    try {
        const response = await fetch(`${API_BASE}/api/sheets/${sessionId}/${selectedSheetId}/${encodeURIComponent(selectedWorksheetName)}/data`);
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to fetch data');
        }
        
        dataLoading.style.display = 'none';
        displaySheetData(result.data, result.range);
        showToast('Sheet data fetched successfully', 'success');
        
    } catch (error) {
        dataLoading.style.display = 'none';
        showToast('Error fetching data: ' + error.message, 'error');
    }
}

function displaySheetData(data, range) {
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
        th.textContent = header || 'Empty';
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create body
    const tbody = document.createElement('tbody');
    for (let i = 1; i < data.length; i++) {
        const row = document.createElement('tr');
        data[i].forEach((cell, index) => {
            const td = document.createElement('td');
            td.textContent = cell || '';
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
        <p><strong>Range:</strong> ${range}</p>
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

// Export functions for external use
window.GoogleSheetsManager = {
    removeFile,
    fetchSheetData,
    openInGoogleSheets,
    showToast
};
