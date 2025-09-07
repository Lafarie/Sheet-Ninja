"""
Column Manager API for Web UI
Provides API endpoints for detecting headers and managing column mappings
"""

import os
import json
import threading
import subprocess
import tempfile
import requests
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import config
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import sys
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Enable CORS for web UI

# Use configurable API URL
API_BASE_URL = config.API_SERVER_URL

# Global variables for sync process
sync_process = None
sync_status = {
    'status': 'idle',
    'progress': None,
    'output': '',
    'error': None
}

def monitor_sync_process(process):
    """Monitor the sync process and update status"""
    global sync_status
    
    output_lines = []
    for line in iter(process.stdout.readline, ''):
        if line:
            line = line.strip()
            output_lines.append(line)
            sync_status['output'] = '\n'.join(output_lines[-50:])  # Keep last 50 lines
            
            # Update progress based on output
            if 'Starting Google Sheets to GitLab sync' in line:
                sync_status['progress'] = {'message': 'Reading Google Sheet...', 'current': 0, 'total': 0}
            elif 'Creating GitLab Issues' in line:
                sync_status['progress'] = {'message': 'Creating GitLab Issues...', 'current': 0, 'total': 0}
            elif 'Updating Sheet with GIT ID' in line:
                sync_status['progress'] = {'message': 'Updating Sheet with GIT ID...', 'current': 0, 'total': 0}
            elif 'Sync Completed' in line:
                sync_status['status'] = 'completed'
                sync_status['progress'] = {'message': 'Sync completed successfully!', 'current': 0, 'total': 0}
            elif 'Sync Failed' in line:
                sync_status['status'] = 'failed'
                sync_status['error'] = 'Sync process failed'
            elif 'Progress:' in line:
                # Extract progress information
                try:
                    if 'new issues created' in line:
                        parts = line.split('Progress:')[1].split('/')
                        current = int(parts[0].strip())
                        total = int(parts[1].split()[0])
                        sync_status['progress'] = {'message': 'Creating GitLab Issues...', 'current': current, 'total': total}
                    elif 'existing issues updated' in line:
                        parts = line.split('Progress:')[1].split('/')
                        current = int(parts[0].strip())
                        total = int(parts[1].split()[0])
                        sync_status['progress'] = {'message': 'Updating existing issues...', 'current': current, 'total': total}
                except:
                    pass
    
    # Process completed
    return_code = process.wait()
    if return_code == 0:
        sync_status['status'] = 'completed'
        sync_status['progress'] = {'message': 'Sync completed successfully!', 'current': 0, 'total': 0}
    else:
        sync_status['status'] = 'failed'
        sync_status['error'] = f'Sync process failed with return code {return_code}'

class ColumnManagerAPI:
    def __init__(self, spreadsheet_id=None, service_account_file=None, worksheet_name=None):
        self.spreadsheet_id = spreadsheet_id
        self.worksheet_name = worksheet_name
        
        # Handle service account file path
        if service_account_file:
            self.service_account_file = service_account_file
            print(f"🔐 Using provided service account file: {self.service_account_file}")
        else:
            # Use centralized path configuration
            temp_file = config.PATHS['service_account_file']
            
            print(f"🔍 Checking for uploaded service account file: {temp_file}")
            
            if os.path.exists(temp_file):
                self.service_account_file = temp_file
                print(f"✅ Found uploaded service account file: {self.service_account_file}")
            else:
                # Fallback to default location
                self.service_account_file = 'service_account.json'
                print(f"⚠️ No uploaded file found, using default: {self.service_account_file}")
        
        print(f"🔐 Final service account file path: {self.service_account_file}")
        self.service = self._authenticate()
        self.current_config = {}
    
    def _authenticate(self):
        """Authenticate with Google Sheets"""
        try:
            print(f"🔐 Starting authentication with file: {self.service_account_file}")
            
            # Check if file exists
            if not os.path.exists(self.service_account_file):
                print(f"❌ Service account file not found: {self.service_account_file}")
                return None
            
            print(f"✅ Service account file exists, size: {os.path.getsize(self.service_account_file)} bytes")
            
            # Try to load and validate JSON
            try:
                with open(self.service_account_file, 'r') as f:
                    json_content = json.load(f)
                print(f"✅ JSON file is valid, contains keys: {list(json_content.keys())}")
            except json.JSONDecodeError as e:
                print(f"❌ Invalid JSON in service account file: {e}")
                return None
            except Exception as e:
                print(f"❌ Error reading service account file: {e}")
                return None
            
            # Create credentials
            credentials = service_account.Credentials.from_service_account_file(
                self.service_account_file,
                scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
            )
            print(f"✅ Credentials created successfully")
            
            # Build service
            service = build('sheets', 'v4', credentials=credentials)
            print(f"✅ Google Sheets service built successfully")
            
            return service
            
        except Exception as e:
            print(f"❌ Authentication error: {e}")
            print(f"❌ Error type: {type(e).__name__}")
            import traceback
            print(f"❌ Full traceback: {traceback.format_exc()}")
            return None
    
    def detect_current_headers(self, spreadsheet_id=None, worksheet_name=None):
        """Auto-detect current headers from the Google Sheet"""
        try:
            if not self.service:
                return None
            
            target_spreadsheet = spreadsheet_id or self.spreadsheet_id
            target_worksheet = worksheet_name or self.worksheet_name
            
            if not target_spreadsheet or not target_worksheet:
                return None
            
            # Handle worksheet names with special characters properly
            range_name = f"'{target_worksheet}'!1:1"
            
            result = self.service.spreadsheets().values().get(
                spreadsheetId=target_spreadsheet,
                range=range_name
            ).execute()
            
            values = result.get('values', [])
            if values:
                headers = values[0]
                return headers
            else:
                return []
        except Exception as e:
            print(f"❌ Error detecting headers: {e}")
            return None
    
    def auto_map_columns(self, headers):
        """Automatically map columns based on detected headers"""
        if not headers:
            return {}
        
        mapping_suggestions = {}
        
        for i, header in enumerate(headers, 1):
            header_lower = header.strip().lower()
            
            for key, config_data in self.current_config.items():
                config_header = config_data["header"].lower()
                
                # Exact match
                if header_lower == config_header:
                    mapping_suggestions[key] = {
                        "old_index": config_data["index"],
                        "new_index": i,
                        "header": header,
                        "confidence": "exact"
                    }
                    break
                # Partial match
                elif any(word in header_lower for word in config_header.split()):
                    if key not in mapping_suggestions:
                        mapping_suggestions[key] = {
                            "old_index": config_data["index"],
                            "new_index": i,
                            "header": header,
                            "confidence": "partial"
                        }
        
        return mapping_suggestions
    
    def apply_mapping(self, mapping_data):
        """Apply column mappings from UI"""
        if not mapping_data:
            return False
        
        updated_config = self.current_config.copy()
        
        for key, new_index in mapping_data.items():
            if key in updated_config and new_index.isdigit():
                new_index = int(new_index)
                detected_headers = self.detect_current_headers()
                if detected_headers and 1 <= new_index <= len(detected_headers):
                    updated_config[key]["index"] = new_index
                    updated_config[key]["header"] = detected_headers[new_index - 1]
        
        # Save updated configuration
        self.current_config = updated_config
        return True

# Global instance - will be initialized when needed
manager = None

@app.route('/api/health', methods=['GET'])
def health_check():
    """Simple health check endpoint"""
    return jsonify({
        'success': True,
        'status': 'healthy',
        'message': 'GitLab ↔ Google Sheets Sync API is running'
    })

@app.route('/api/detect-headers', methods=['POST'])
def detect_headers():
    """API endpoint to detect headers from a specific worksheet in Google Sheet"""
    global manager
    
    try:
        data = request.json
        spreadsheet_id = data.get('spreadsheet_id')
        worksheet_name = data.get('worksheet_name')
        
        if not spreadsheet_id:
            return jsonify({
                'success': False,
                'error': 'Spreadsheet ID is required'
            }), 400
        
        if not worksheet_name:
            return jsonify({
                'success': False,
                'error': 'Worksheet name is required'
            }), 400
        
        # Initialize manager if needed
        if not manager:
            manager = ColumnManagerAPI(spreadsheet_id=spreadsheet_id, worksheet_name=worksheet_name)
        
        # Get headers from the specific worksheet
        try:
            result = manager.service.spreadsheets().values().get(
                spreadsheetId=spreadsheet_id,
                range=f"{worksheet_name}!1:1"
            ).execute()
            
            values = result.get('values', [])
            if values:
                headers = values[0]
                return jsonify({
                    'success': True,
                    'headers': headers,
                    'count': len(headers),
                    'worksheet': worksheet_name
                })
            else:
                return jsonify({
                    'success': False,
                    'error': f'No data found in worksheet "{worksheet_name}"'
                }), 404
                
        except HttpError as e:
            if e.resp.status == 404:
                return jsonify({
                    'success': False,
                    'error': f'Worksheet "{worksheet_name}" not found in the spreadsheet.'
                }), 404
            elif e.resp.status == 403:
                return jsonify({
                    'success': False,
                    'error': 'Access denied. Please ensure the service account has permission to access this spreadsheet.'
                }), 403
            else:
                return jsonify({
                    'success': False,
                    'error': f'Google Sheets API error: {str(e)}'
                }), 500
                
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/auto-map', methods=['POST'])
def auto_map():
    """API endpoint for auto-mapping columns"""
    global manager
    
    try:
        data = request.json
        headers = data.get('headers', [])
        
        if not manager:
            return jsonify({'success': False, 'error': 'Manager not initialized'}), 400
        
        mappings = manager.auto_map_columns(headers)
        return jsonify({
            'success': True,
            'mappings': mappings,
            'count': len(mappings)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/apply-mapping', methods=['POST'])
def apply_mapping():
    """API endpoint to apply column mappings"""
    global manager
    
    try:
        mapping_data = request.json
        if not manager:
            return jsonify({'success': False, 'error': 'Manager not initialized'}), 400
        
        success = manager.apply_mapping(mapping_data)
        return jsonify({'success': success})
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/validate', methods=['GET'])
def validate_config():
    """API endpoint to validate current configuration"""
    global manager
    
    try:
        if not manager:
            return jsonify({
                'success': False,
                'error': 'Manager not initialized'
            }), 400
        
        detected_headers = manager.detect_current_headers()
        if not detected_headers:
            return jsonify({
                'success': False,
                'error': 'Cannot detect headers from sheet'
            }), 500
        
        issues = []
        
        for key, config_data in manager.current_config.items():
            expected_index = config_data["index"]
            expected_header = config_data["header"]
            required = config_data.get("required", False)
            
            if expected_index > len(detected_headers):
                issues.append(f"Column {expected_index} doesn't exist (only {len(detected_headers)} columns)")
                continue
            
            actual_header = detected_headers[expected_index - 1]
            if actual_header.lower().strip() != expected_header.lower().strip():
                issues.append(f"Expected '{expected_header}' but found '{actual_header}' in column {expected_index}")
        
        return jsonify({
            'success': True,
            'valid': len(issues) == 0,
            'issues': issues,
            'header_count': len(detected_headers)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/config', methods=['GET'])
def get_config():
    """API endpoint to get current column configuration"""
    global manager
    
    try:
        if not manager:
            return jsonify({'success': False, 'error': 'Manager not initialized'}), 400
        
        return jsonify({'success': True, 'config': manager.current_config})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/sheet-names', methods=['POST'])
def get_sheet_names():
    """API endpoint to get available sheet names from Google Spreadsheet"""
    global manager
    
    try:
        data = request.json
        spreadsheet_id = data.get('spreadsheet_id')
        
        print(f"🔍 Sheet names request for spreadsheet: {spreadsheet_id}")
        
        if not spreadsheet_id:
            return jsonify({
                'success': False,
                'error': 'Spreadsheet ID is required'
            }), 400
        
        # Initialize manager if needed
        if not manager:
            print(f"🔄 Initializing ColumnManagerAPI for spreadsheet: {spreadsheet_id}")
            manager = ColumnManagerAPI(spreadsheet_id=spreadsheet_id)
        
        # Check if authentication was successful
        if not manager.service:
            print(f"❌ Authentication failed - service is None")
            return jsonify({
                'success': False,
                'error': 'Service account authentication failed. Please check your service account file.'
            }), 500
        
        print(f"✅ Authentication successful, fetching sheet names...")
        
        # Get sheet names using Google Sheets API
        try:
            result = manager.service.spreadsheets().get(
                spreadsheetId=spreadsheet_id,
                fields='sheets.properties.title'
            ).execute()
            
            sheet_names = []
            for sheet in result.get('sheets', []):
                title = sheet.get('properties', {}).get('title', '')
                if title:
                    sheet_names.append(title)
            
            print(f"✅ Successfully fetched {len(sheet_names)} sheet names: {sheet_names}")
            
            return jsonify({
                'success': True,
                'sheet_names': sheet_names,
                'count': len(sheet_names)
            })
            
        except HttpError as e:
            print(f"❌ Google Sheets API error: {e}")
            if e.resp.status == 404:
                return jsonify({
                    'success': False,
                    'error': 'Spreadsheet not found. Please check the ID and ensure the service account has access.'
                }), 404
            elif e.resp.status == 403:
                return jsonify({
                    'success': False,
                    'error': 'Access denied. Please ensure the service account has permission to access this spreadsheet.'
                }), 403
            else:
                return jsonify({
                    'success': False,
                    'error': f'Google Sheets API error: {str(e)}'
                }), 500
        
    except Exception as e:
        print(f"❌ Unexpected error in get_sheet_names: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/upload-service-account', methods=['POST'])
def upload_service_account():
    """API endpoint to upload service_account.json file"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400
        
        if file and file.filename.endswith('.json'):
            # Use centralized path configuration
            temp_dir = config.PATHS['uploads_temp_dir']
            os.makedirs(temp_dir, exist_ok=True)
            file_path = config.PATHS['service_account_file']
            
            print(f"📁 Saving uploaded file to: {file_path}")
            file.save(file_path)
            print(f"✅ File saved successfully")
            
            # Verify the file is valid JSON
            try:
                with open(file_path, 'r') as f:
                    json.load(f)
                print(f"✅ Service account file uploaded successfully: {file_path}")
                return jsonify({'success': True, 'message': 'Service account file uploaded successfully'})
            except json.JSONDecodeError:
                # Remove invalid file
                os.remove(file_path)
                print(f"❌ Invalid JSON file, removed: {file_path}")
                return jsonify({'success': False, 'error': 'Invalid JSON file'}), 400
        else:
            return jsonify({'success': False, 'error': 'Please upload a valid JSON file'}), 400
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/fetch-projects', methods=['POST'])
def fetch_projects():
    """API endpoint to fetch projects from GitLab"""
    try:
        data = request.json
        gitlab_url = data.get('gitlab_url')
        gitlab_token = data.get('gitlab_token')
        
        if not gitlab_url or not gitlab_token:
            return jsonify({'success': False, 'error': 'GitLab URL and token are required'}), 400
        
        print(f"🔍 Fetching projects from GitLab: {gitlab_url}")
        
        # Clean up GitLab URL (remove trailing slash if present)
        if gitlab_url.endswith('/'):
            gitlab_url = gitlab_url[:-1]
        
        # GitLab API endpoint for projects
        api_url = f"{gitlab_url}/api/v4/projects"
        
        # Make request to GitLab API
        headers = {
            'Authorization': f'Bearer {gitlab_token}',
            'Content-Type': 'application/json'
        }
        
        print(f"🌐 Making request to: {api_url}")
        
        response = requests.get(api_url, headers=headers, timeout=30)
        
        if response.status_code == 401:
            return jsonify({'success': False, 'error': 'Invalid GitLab token. Please check your token.'}), 401
        elif response.status_code == 403:
            return jsonify({'success': False, 'error': 'Access denied. Please check your token permissions.'}), 403
        elif response.status_code == 404:
            return jsonify({'success': False, 'error': 'GitLab instance not found. Please check the URL.'}), 404
        elif response.status_code != 200:
            return jsonify({'success': False, 'error': f'GitLab API error: {response.status_code} - {response.text}'}), response.status_code
        
        projects_data = response.json()
        
        # Extract project information
        projects = []
        for project in projects_data:
            projects.append({
                'id': project.get('id'),
                'name': project.get('name'),
                'path': project.get('path'),
                'full_path': project.get('path_with_namespace'),
                'description': project.get('description', ''),
                'web_url': project.get('web_url'),
                'visibility': project.get('visibility')
            })
        
        print(f"✅ Successfully fetched {len(projects)} projects from GitLab")
        
        return jsonify({
            'success': True,
            'projects': projects,
            'count': len(projects)
        })
        
    except requests.exceptions.Timeout:
        return jsonify({'success': False, 'error': 'Request timeout. GitLab server is not responding.'}), 408
    except requests.exceptions.ConnectionError:
        return jsonify({'success': False, 'error': 'Connection failed. Please check your GitLab URL and network connection.'}), 503
    except Exception as e:
        print(f"❌ Error fetching projects from GitLab: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/detect-project-names', methods=['POST'])
def detect_project_names():
    """API endpoint to detect unique project names from Google Sheet"""
    try:
        data = request.json
        spreadsheet_id = data.get('spreadsheet_id')
        worksheet_name = data.get('worksheet_name')
        
        if not spreadsheet_id or not worksheet_name:
            return jsonify({'success': False, 'error': 'Spreadsheet ID and worksheet name are required'}), 400
        
        # Initialize manager
        global manager
        manager = ColumnManagerAPI(
            spreadsheet_id=spreadsheet_id,
            worksheet_name=worksheet_name
        )
        
        if not manager.service:
            return jsonify({'success': False, 'error': 'Failed to authenticate with Google Sheets'}), 500
        
        # Get all data from the sheet
        # Handle worksheet names with special characters properly
        # Always wrap worksheet names in single quotes to handle special characters
        range_name = f"'{worksheet_name}'!A:Z"
        print(f"🔍 Fetching data with range: {range_name}")
        
        result = manager.service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=range_name
        ).execute()
        
        values = result.get('values', [])
        if len(values) < 2:
            return jsonify({'success': False, 'error': 'No data found in sheet'}), 400
        
        headers = values[0]
        data_rows = values[1:]
        
        # Find the GIT_ID and PROJECT_NAME columns
        git_id_column_index = None
        project_name_column_index = None
        
        # Look for GIT_ID and PROJECT_NAME in headers
        for i, header in enumerate(headers):
            if header:
                header_lower = header.lower().strip()
                print(f"🔍 Checking header {i}: '{header}' -> '{header_lower}'")
                
                # Check for GIT_ID column (could be "ID", "GIT ID", "GIT_ID", etc.)
                if ('git' in header_lower and 'id' in header_lower) or header_lower == 'id':
                    git_id_column_index = i
                    print(f"✅ Found GIT_ID column at index {i}: '{header}'")
                
                # Check for PROJECT_NAME column
                elif 'project' in header_lower and 'name' in header_lower:
                    project_name_column_index = i
                    print(f"✅ Found PROJECT_NAME column at index {i}: '{header}'")
        
        # Fallback to default positions if not found
        if git_id_column_index is None:
            git_id_column_index = 0  # Default to first column (A)
            print(f"⚠️ GIT_ID column not found, using default index {git_id_column_index}")
        
        if project_name_column_index is None:
            project_name_column_index = 1  # Default to second column (B)
            print(f"⚠️ PROJECT_NAME column not found, using default index {project_name_column_index}")
        
        print(f"🔍 GIT_ID column index: {git_id_column_index}")
        print(f"🔍 PROJECT_NAME column index: {project_name_column_index}")
        
        # Extract unique project names only from rows where GIT_ID is empty (tasks to be created)
        project_names = set()
        tasks_to_create_count = 0
        total_rows = 0
        
        for row_index, row in enumerate(data_rows):
            total_rows += 1
            
            # Check if GIT_ID is empty (task not yet created)
            git_id_empty = True
            if len(row) > git_id_column_index:
                git_id = row[git_id_column_index].strip()
                git_id_empty = (git_id == '' or 
                               git_id.lower() in ['', 'git id', 'git_id', 'n/a', 'none', 'null', 'undefined'] or
                               git_id == '0' or git_id == 'N/A')
                
                # Debug logging for first few rows
                if row_index < 5:
                    print(f"🔍 Row {row_index + 2}: GIT_ID='{git_id}' -> Empty: {git_id_empty}")
            else:
                # Row doesn't have enough columns, consider it empty
                git_id_empty = True
                if row_index < 5:
                    print(f"🔍 Row {row_index + 2}: Not enough columns, GIT_ID empty: {git_id_empty}")
            
            # Only extract project name if GIT_ID is empty
            if git_id_empty and len(row) > project_name_column_index:
                project_name = row[project_name_column_index].strip()
                if project_name and project_name.lower() not in ['', 'project name', 'project_name']:
                    project_names.add(project_name)
                    tasks_to_create_count += 1
                    
                    # Debug logging for first few matches
                    if tasks_to_create_count <= 5:
                        print(f"✅ Found task to create: Row {row_index + 2}, Project: '{project_name}', GIT_ID: '{git_id if 'git_id' in locals() else 'N/A'}'")
            elif git_id_empty and len(row) <= project_name_column_index:
                # GIT_ID is empty but no project name column
                if row_index < 5:
                    print(f"⚠️ Row {row_index + 2}: GIT_ID empty but no project name column")
        
        print(f"📊 Analysis: {total_rows} total rows, {tasks_to_create_count} tasks to create, {len(project_names)} unique projects")
        
        return jsonify({
            'success': True,
            'project_names': sorted(list(project_names)),
            'count': len(project_names),
            'total_rows': total_rows,
            'tasks_to_create': tasks_to_create_count,
            'message': f"Detected {len(project_names)} unique projects from {tasks_to_create_count} tasks that need to be created (out of {total_rows} total rows)"
        })
        
    except Exception as e:
        print(f"Error detecting project names: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# Sync process endpoints
@app.route('/api/start-sync', methods=['POST'])
def start_sync():
    """API endpoint to start the sheet_to_gitlab.py sync process"""
    global sync_process, sync_status
    
    try:
        print("🚀 Starting sync process...")
        data = request.json
        print(f"📋 Received data: {list(data.keys())}")
        
        # Validate required fields
        required_fields = ['gitlab_url', 'gitlab_token', 'spreadsheet_id', 'worksheet_name']
        project_mapping_enabled = data.get('project_mapping_enabled', False)
        
        # Only require project_id if project mapping is not enabled
        if not project_mapping_enabled:
            required_fields.append('project_id')
        
        for field in required_fields:
            field_value = data.get(field, '')
            if not field_value or field_value.strip() == '':
                print(f"❌ Missing required field: {field}")
                return jsonify({'success': False, 'error': f'Missing required field: {field}'}), 400
        
        # Additional validation for project mapping mode
        if project_mapping_enabled:
            project_mappings = data.get('project_mappings', {})
            if not project_mappings:
                print("❌ Project mapping enabled but no project mappings provided")
                return jsonify({'success': False, 'error': 'At least one project mapping is required when project mapping is enabled'}), 400
            
            default_assignee = data.get('default_assignee', '')
            if not default_assignee or default_assignee.strip() == '':
                print("❌ Global assignee is required for project mapping")
                return jsonify({'success': False, 'error': 'Global assignee is required for project mapping'}), 400
        
        print("✅ All required fields present")
        
        # Initialize manager with the correct spreadsheet and worksheet
        global manager
        manager = ColumnManagerAPI(
            spreadsheet_id=data['spreadsheet_id'],
            worksheet_name=data['worksheet_name']
        )
        
        if not manager.service:
            print("❌ Failed to authenticate with Google Sheets")
            return jsonify({'success': False, 'error': 'Failed to authenticate with Google Sheets. Please check your service account file.'}), 500
        
        print("✅ Google Sheets authentication successful")
        
        # Generate .env content
        gitlab_token = data['gitlab_token']
        gitlab_url = data['gitlab_url']
        
        # Ensure GitLab URL has the correct format with /api/v4/ suffix
        if not gitlab_url.endswith('/api/v4/'):
            if gitlab_url.endswith('/'):
                gitlab_url = gitlab_url + 'api/v4/'
            else:
                gitlab_url = gitlab_url + '/api/v4/'
        
        project_id = data.get('project_id', '') if not project_mapping_enabled else ''
        spreadsheet_id = data['spreadsheet_id']
        worksheet_name = data['worksheet_name']
        default_assignee = data.get('default_assignee', '')
        default_milestone = data.get('default_milestone', '')
        default_label = data.get('default_label', '')
        enable_date_filter = data.get('enable_date_filter', False)
        start_date = data.get('start_date', '')
        end_date = data.get('end_date', '')
        enable_auto_close = data.get('enable_auto_close', False)
        project_mapping_enabled = data.get('project_mapping_enabled', False)
        project_mappings = data.get('project_mappings', {})

        env_content = f"""# GitLab Configuration
GITLAB_TOKEN={gitlab_token}
GITLAB_URL={gitlab_url}
PROJECT_ID={project_id}

# Google Sheets Configuration
SPREADSHEET_ID={spreadsheet_id}
WORKSHEET_NAME={worksheet_name}
SERVICE_ACCOUNT_FILE=service_account.json

# GitLab Issue Settings
DEFAULT_ASSIGNEE={default_assignee}
DEFAULT_MILESTONE={default_milestone}
DEFAULT_DUE_DATE=
DEFAULT_LABEL={default_label}

# Date Range Filter Settings
ENABLE_DATE_FILTER={str(enable_date_filter).lower()}
START_DATE={start_date}
END_DATE={end_date}

# Task Closing Settings
ENABLE_AUTO_CLOSE={str(enable_auto_close).lower()}

# Project Mapping Settings
PROJECT_MAPPING_ENABLED={str(project_mapping_enabled).lower()}
PROJECT_MAPPINGS={json.dumps(project_mappings)}

# Service Account Link Configuration
SERVICE_ACCOUNT_LINK={config.SERVICE_ACCOUNT_LINK}

# Server Configuration (for deployment)
# Change these URLs when deploying to your server
API_SERVER_URL={API_BASE_URL}
UI_SERVER_URL={config.UI_SERVER_URL}

# For production deployment, update these to your server's URLs:
# API_SERVER_URL=https://your-server.com:5001
# UI_SERVER_URL=https://your-server.com:8000
"""
        
        # Debug logging for milestone
        print(f"🔍 Debug - Milestone from UI: '{data.get('default_milestone', '')}'")
        print(f"🔍 Debug - Assignee from UI: '{data.get('default_assignee', '')}'")
        print(f"🔍 Debug - Label from UI: '{data.get('default_label', '')}'")
        print(f"🔍 Debug - Spreadsheet ID from UI: '{data.get('spreadsheet_id', '')}'")
        print(f"🔍 Debug - Worksheet Name from UI: '{data.get('worksheet_name', '')}'")
        print(f"🔍 Debug - GitLab URL from UI: '{data.get('gitlab_url', '')}'")
        print(f"🔍 Debug - Project ID from UI: '{data.get('project_id', '')}'")
        print(f"🔍 Debug - .env content:\n{env_content}")
        
        # Create temporary custom_columns.json file
        column_config = {}
        detected_headers = []
        
        # First, get the actual headers from the sheet
        try:
            if manager and manager.service:
                result = manager.service.spreadsheets().values().get(
                    spreadsheetId=data['spreadsheet_id'],
                    range=f"{data['worksheet_name']}!1:1"
                ).execute()
                detected_headers = result.get('values', [[]])[0]
        except Exception as e:
            print(f"Warning: Could not detect headers: {e}")
        
        for key, value in data.get('column_mappings', {}).items():
            if value and value.strip():  # Only include mapped columns
                column_index = int(value) - 1  # Convert to 0-based index
                actual_header = detected_headers[column_index] if column_index < len(detected_headers) else f"Column {value}"
                
                column_config[key] = {
                    "index": int(value),
                    "header": actual_header,  # Use actual header name instead of generic "Column X"
                    "required": key in ['DATE', 'PROJECT_NAME', 'MAIN_TASK', 'STATUS'],
                    "data_type": "text",
                    "description": f"Column {value} mapping"
                }
        
        # Use centralized path configuration
        temp_env_file = config.PATHS['env_file']
        temp_columns_file = config.PATHS['columns_file']
        final_env_file = config.PATHS['final_env_file']
        final_columns_file = config.PATHS['final_columns_file']
        
        # Create temp directory if it doesn't exist
        os.makedirs(config.PATHS['temp_dir'], exist_ok=True)
        
        # Write temporary files to writable locations
        with open(temp_env_file, 'w') as f:
            f.write(env_content)
        
        with open(temp_columns_file, 'w') as f:
            json.dump(column_config, f, indent=2)
        
        # Reset sync status
        sync_status.update({
            'status': 'starting',
            'progress': {'message': 'Starting sync process...', 'current': 0, 'total': 0},
            'output': '',
            'error': None
        })
        
        # Start the sync process
        try:
            print(f"🚀 Starting sync process...")
            
            # Use the original sheets_to_gitlab.py sync script
            # Check if we're in Docker or local environment
            if os.path.exists('/app/sheets_to_gitlab.py'):
                sync_script = '/app/sheets_to_gitlab.py'
                env_file_path = '/app/temp/sync.env'
                columns_file_path = '/app/temp/custom_columns.json'
            else:
                # Local environment
                sync_script = 'sheets_to_gitlab.py'
                env_file_path = config.PATHS['env_file']
                columns_file_path = config.PATHS['columns_file']
            
            print(f"📁 Using sync script: {sync_script}")
            print(f"📁 Using env file: {env_file_path}")
            print(f"📁 Using columns file: {columns_file_path}")
            
            # Set environment variables for the subprocess
            env = os.environ.copy()
            env['ENV_FILE'] = env_file_path
            env['COLUMNS_FILE'] = columns_file_path
            
            # Start the sync process with output capture
            process = subprocess.Popen(
                ['python', sync_script],
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True
            )
            
            # Store process info
            global sync_process
            sync_process = process
            
            # Update sync status
            sync_status.update({
                'status': 'running',
                'progress': {'message': 'Starting sync process...', 'current': 0, 'total': 0},
                'output': '',
                'error': None
            })
            
            # Start monitoring the process in a separate thread
            threading.Thread(target=monitor_sync_process, args=(process,), daemon=True).start()
            
            print(f"✅ Sync process started successfully")
            return jsonify({'success': True, 'message': 'Sync process started'})
            
        except Exception as e:
            print(f"❌ Error starting sync process: {e}")
            return jsonify({'success': False, 'error': f'Failed to start sync: {str(e)}'}), 500

    except Exception as e:
        print(f"❌ Error in start_sync: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/sync-status', methods=['GET'])
def get_sync_status():
    """API endpoint to get current sync status"""
    global sync_status
    
    try:
        return jsonify({
            'success': True,
            'status': sync_status['status'],
            'progress': sync_status['progress'],
            'output': sync_status['output'],
            'error': sync_status['error']
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/stop-sync', methods=['POST'])
def stop_sync():
    """Stop the sync process"""
    global sync_process, sync_status
    
    if sync_process and sync_process.poll() is None:
        try:
            sync_process.terminate()
            sync_status['status'] = 'stopped'
            return jsonify({'success': True, 'message': 'Sync process stopped'})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)})
    else:
        return jsonify({'success': False, 'error': 'No sync process running'})

@app.route('/setup_ui.html')
def serve_setup_ui():
    """Serve the setup UI HTML with dynamic API URL injection"""
    try:
        # Read the HTML file
        with open('setup_ui.html', 'r', encoding='utf-8') as f:
            html_content = f.read()
        
        # Replace the hardcoded API_BASE_URL with the dynamic one from config
        # Handle both the production URL and localhost fallback
        html_content = html_content.replace(
            "const API_BASE_URL = 'https://sprout-da.hsenidmobile.com/gitmeter';",
            f"const API_BASE_URL = '{config.API_SERVER_URL}';"
        )
        
        # Also replace the localhost fallback if it exists
        html_content = html_content.replace(
            "const API_BASE_URL = 'http://localhost:5001';",
            f"const API_BASE_URL = '{config.API_SERVER_URL}';"
        )
        
        # Also replace any remaining localhost references
        html_content = html_content.replace(
            "const API_BASE_URL = 'http://localhost:5001'; // This will be dynamically replaced by the server",
            f"const API_BASE_URL = '{config.API_SERVER_URL}'; // Dynamically replaced by the server"
        )
        
        return html_content, 200, {'Content-Type': 'text/html'}
    except Exception as e:
        return f"Error loading setup UI: {str(e)}", 500

@app.route('/overview.html')
def serve_overview():
    """Serve the info HTML page"""
    try:
        # Read the info HTML file
        with open('overview.html', 'r', encoding='utf-8') as f:
            html_content = f.read()
        return html_content, 200, {'Content-Type': 'text/html'}
    except Exception as e:
        return f"Error loading info page: {str(e)}", 500

@app.route('/overview.html/<anchor>')
def serve_overview_anchor(anchor):
    """Serve the info HTML page with anchor support"""
    try:
        # Read the info HTML file
        with open('overview.html', 'r', encoding='utf-8') as f:
            html_content = f.read()
        return html_content, 200, {'Content-Type': 'text/html'}
    except Exception as e:
        return f"Error loading info page: {str(e)}", 500

@app.route('/info.html')
def serve_info():
    """Serve the info HTML page"""
    try:
        # Read the info HTML file
        with open('info.html', 'r', encoding='utf-8') as f:
            html_content = f.read()
        return html_content, 200, {'Content-Type': 'text/html'}
    except Exception as e:
        return f"Error loading info page: {str(e)}", 500

@app.route('/info.html/<anchor>')
def serve_info_anchor(anchor):
    """Serve the info HTML page with anchor support"""
    try:
        # Read the info HTML file
        with open('info.html', 'r', encoding='utf-8') as f:
            html_content = f.read()
        return html_content, 200, {'Content-Type': 'text/html'}
    except Exception as e:
        return f"Error loading info page: {str(e)}", 500

@app.route('/questions.html')
def serve_questions():
    """Serve the info HTML page"""
    try:
        # Read the info HTML file
        with open('questions.html', 'r', encoding='utf-8') as f:
            html_content = f.read()
        return html_content, 200, {'Content-Type': 'text/html'}
    except Exception as e:
        return f"Error loading info page: {str(e)}", 500

@app.route('/questions.html/<anchor>')
def serve_questions_anchor(anchor):
    """Serve the info HTML page with anchor support"""
    try:
        # Read the info HTML file
        with open('questions.html', 'r', encoding='utf-8') as f:
            html_content = f.read()
        return html_content, 200, {'Content-Type': 'text/html'}
    except Exception as e:
        return f"Error loading info page: {str(e)}", 500

@app.route('/api_doc.html')
def serve_api_doc():
    """Serve the info HTML page"""
    try:
        # Read the info HTML file
        with open('api_doc.html', 'r', encoding='utf-8') as f:
            html_content = f.read()
        return html_content, 200, {'Content-Type': 'text/html'}
    except Exception as e:
        return f"Error loading info page: {str(e)}", 500

@app.route('/api_doc.html/<anchor>')
def serve_api_doc_anchor(anchor):
    """Serve the info HTML page with anchor support"""
    try:
        # Read the info HTML file
        with open('api_doc.html', 'r', encoding='utf-8') as f:
            html_content = f.read()
        return html_content, 200, {'Content-Type': 'text/html'}
    except Exception as e:
        return f"Error loading info page: {str(e)}", 500

@app.route('/')
def serve_index():
    """Serve the setup UI as the index page"""
    return serve_setup_ui()

@app.route('/gitmeter')
def serve_gitmeter():
    """Serve the setup UI at the /gitmeter path for ingress routing"""
    return serve_setup_ui()

@app.route('/gitmeter/')
def serve_gitmeter_slash():
    """Serve the setup UI at the /gitmeter/ path"""
    return serve_setup_ui()

@app.route('/gitmeter/setup_ui.html')
def serve_gitmeter_setup_ui():
    """Serve the setup UI at the /gitmeter/setup_ui.html path"""
    return serve_setup_ui()

if __name__ == '__main__':
    print("🚀 Starting Setup API server...")
    print("📡 API available at: http://localhost:5001")
    print("🌐 Access the Setup UI at: http://localhost:8000/setup_ui.html")
    print()
    print("🔧 Available endpoints:")
    print("  GET  /api/health - Health check")
    print("  POST /api/sheet-names - Fetch available sheet names")
    print("  POST /api/detect-headers - Detect headers from worksheet")
    print("  POST /api/auto-map - Auto-map columns")
    print("  POST /api/apply-mapping - Apply column mappings")
    print("  GET  /api/validate - Validate configuration")
    print("  GET  /api/config - Get current configuration")
    print("  POST /api/start-sync - Start sheet to GitLab sync")
    print("  GET  /api/sync-status - Get sync status")
    print("  POST /api/stop-sync - Stop sync process")
    print()
    print("Press Ctrl+C to stop the server")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=5001, debug=False) 