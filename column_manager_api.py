"""
Column Manager API for Web UI
Provides API endpoints for detecting headers and managing column mappings
"""

import os
import json
import threading
import subprocess
import tempfile
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import config
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import sys

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

class ColumnManagerAPI:
    def __init__(self, spreadsheet_id=None, service_account_file=None, worksheet_name=None):
        self.spreadsheet_id = spreadsheet_id
        self.worksheet_name = worksheet_name
        
        # Handle service account file path
        if service_account_file:
            self.service_account_file = service_account_file
            print(f"🔐 Using provided service account file: {self.service_account_file}")
        else:
            # Check for uploaded file in temp location
            is_docker = os.path.exists('/app') and os.getenv('DOCKER_ENV') == 'true'
            if is_docker:
                temp_file = '/app/public/uploads/temp/service_account.json'
            else:
                temp_file = os.path.join(os.getcwd(), 'uploads', 'temp', 'service_account.json')
            
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
            credentials = service_account.Credentials.from_service_account_file(
                self.service_account_file,
                scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
            )
            return build('sheets', 'v4', credentials=credentials)
        except Exception as e:
            print(f"❌ Authentication error: {e}")
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
            
            result = self.service.spreadsheets().values().get(
                spreadsheetId=target_spreadsheet,
                range=f"{target_worksheet}!1:1"
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
        
        if not spreadsheet_id:
            return jsonify({
                'success': False,
                'error': 'Spreadsheet ID is required'
            }), 400
        
        # Initialize manager if needed
        if not manager:
            manager = ColumnManagerAPI(spreadsheet_id=spreadsheet_id)
        
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
            
            return jsonify({
                'success': True,
                'sheet_names': sheet_names,
                'count': len(sheet_names)
            })
            
        except HttpError as e:
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
            # Determine if running in Docker or locally
            is_docker = os.path.exists('/app') and os.getenv('DOCKER_ENV') == 'true'
            
            if is_docker:
                # Docker environment - save to public/uploads/temp directory
                temp_dir = '/app/public/uploads/temp'
                os.makedirs(temp_dir, exist_ok=True)
                file_path = os.path.join(temp_dir, 'service_account.json')
            else:
                # Local development - save to uploads/temp directory
                temp_dir = os.path.join(os.getcwd(), 'uploads', 'temp')
                os.makedirs(temp_dir, exist_ok=True)
                file_path = os.path.join(temp_dir, 'service_account.json')
            
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
        required_fields = ['gitlab_url', 'gitlab_token', 'project_id', 'spreadsheet_id', 'worksheet_name']
        for field in required_fields:
            if not data.get(field):
                print(f"❌ Missing required field: {field}")
                return jsonify({'success': False, 'error': f'Missing required field: {field}'}), 400
        
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
        project_id = data['project_id']
        spreadsheet_id = data['spreadsheet_id']
        worksheet_name = data['worksheet_name']
        default_assignee = data.get('default_assignee', '')
        default_milestone = data.get('default_milestone', '')
        default_label = data.get('default_label', '')
        enable_date_filter = data.get('enable_date_filter', False)
        start_date = data.get('start_date', '')
        end_date = data.get('end_date', '')
        enable_auto_close = data.get('enable_auto_close', False)

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
        
        # Determine if running in Docker or locally
        is_docker = os.path.exists('/app') and os.getenv('DOCKER_ENV') == 'true'
        
        if is_docker:
            # Docker environment paths
            temp_env_file = '/app/temp/sync.env'
            temp_columns_file = '/app/temp/custom_columns.json'
            final_env_file = '/app/.env'
            final_columns_file = '/app/custom_columns.json'
        else:
            # Local development paths
            temp_env_file = os.path.join(os.getcwd(), 'temp_sync.env')
            temp_columns_file = os.path.join(os.getcwd(), 'temp_custom_columns.json')
            final_env_file = os.path.join(os.getcwd(), '.env')
            final_columns_file = os.path.join(os.getcwd(), 'custom_columns.json')
        
        # Create temp directory if it doesn't exist (for Docker)
        if is_docker:
            os.makedirs('/app/temp', exist_ok=True)
        
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
        
        # Start the sync process in a separate thread
        def run_sync():
            global sync_process, sync_status
            
            try:
                sync_status['status'] = 'running'
                sync_status['progress'] = {'message': 'Reading Google Sheet...', 'current': 0, 'total': 0}
                
                # Copy temporary files to expected locations for the sync script
                import shutil
                try:
                    shutil.copy(temp_env_file, final_env_file)
                    shutil.copy(temp_columns_file, final_columns_file)
                except Exception as e:
                    print(f"Warning: Could not copy temp files: {e}")
                
                # Start the sheets_to_gitlab.py process
                sync_process = subprocess.Popen(
                    [sys.executable, 'sheets_to_gitlab.py'],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    universal_newlines=True,
                    env={
                        **os.environ,
                        'ENV_FILE': final_env_file,
                        'COLUMNS_FILE': final_columns_file
                    }
                )
                
                # Monitor the process output
                output_lines = []
                for line in iter(sync_process.stdout.readline, ''):
                    if line:
                        output_lines.append(line.strip())
                        sync_status['output'] = '\n'.join(output_lines[-50:])  # Keep last 50 lines
                        
                        # Update progress based on output
                        if 'Processing row' in line:
                            try:
                                # Extract progress from output like "Processing row 5 of 25"
                                parts = line.split()
                                if len(parts) >= 5:
                                    current = int(parts[2])
                                    total = int(parts[4])
                                    sync_status['progress'] = {
                                        'message': 'Creating GitLab issues...',
                                        'current': current,
                                        'total': total
                                    }
                            except:
                                pass
                        elif 'Created issue' in line:
                            sync_status['progress']['message'] = 'Creating GitLab issues...'
                        elif 'Error' in line or 'Failed' in line:
                            sync_status['progress']['message'] = 'Encountered errors...'
                
                # Wait for process to complete
                return_code = sync_process.wait()
                
                if return_code == 0:
                    sync_status['status'] = 'completed'
                    sync_status['progress'] = {'message': 'Sync completed successfully!', 'current': 0, 'total': 0}
                else:
                    sync_status['status'] = 'failed'
                    sync_status['error'] = f'Process exited with code {return_code}'
                
            except Exception as e:
                sync_status['status'] = 'failed'
                sync_status['error'] = str(e)
            finally:
                sync_process = None
        
        # Start the sync thread
        sync_thread = threading.Thread(target=run_sync, daemon=True)
        sync_thread.start()
        
        print("✅ Sync process started successfully")
        return jsonify({'success': True, 'message': 'Sync process started'})
        
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
    """API endpoint to stop the running sync process"""
    global sync_process, sync_status
    
    try:
        # Check if there's a running process
        if sync_process and sync_process.poll() is None:
            # Process is running, terminate it
            sync_process.terminate()
            sync_status['status'] = 'stopped'
            sync_status['progress'] = {'message': 'Sync process stopped', 'current': 0, 'total': 0}
            sync_status['error'] = None
            return jsonify({'success': True, 'message': 'Sync process stopped'})
        elif sync_status['status'] in ['starting', 'running']:
            # Process might be starting or in transition, mark as stopped
            sync_status['status'] = 'stopped'
            sync_status['progress'] = {'message': 'Sync process stopped', 'current': 0, 'total': 0}
            sync_status['error'] = None
            return jsonify({'success': True, 'message': 'Sync process stopped'})
        else:
            # No process running, but don't return an error
            return jsonify({'success': True, 'message': 'No sync process was running'})
            
    except Exception as e:
        # Even if there's an error, try to reset the status
        sync_status['status'] = 'stopped'
        sync_status['error'] = str(e)
        return jsonify({'success': False, 'error': str(e)}), 500

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