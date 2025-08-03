"""
Flask Web UI for GitLab ↔ Google Sheets Sync Configuration
Provides a user-friendly interface for managing sync settings and column mappings
"""

from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
import json
import os
import sys
import traceback
import importlib
from datetime import datetime

# Add parent directory to Python path to import config
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set web UI mode to prevent config errors
os.environ['WEB_UI_MODE'] = '1'

try:
    import config
    from column_manager import ColumnManager
    from sheets_to_gitlab import SheetsToGitLab
    from gitlab_to_sheets import GitLabToSheets
except ImportError as e:
    print(f"Import error: {e}")
    print("Make sure you're running from the correct directory and all dependencies are installed.")
    config = None
    ColumnManager = None
    SheetsToGitLab = None
    GitLabToSheets = None

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-this'  # Change this in production

class WebUIManager:
    def __init__(self):
        self.config_file = os.path.join(config.ROOT_DIR, '.env')
        self.column_manager = None
        self.sheets_sync = None
        self.gitlab_sync = None
        
    def initialize_services(self):
        """Initialize sync services with error handling"""
        try:
            if ColumnManager is None:
                return False
                
            # Check if service account file exists in parent directory
            project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            service_account_file = os.path.join(project_root, 'service_account.json')
            
            if not os.path.exists(service_account_file):
                print(f"❌ Service account file not found at: {service_account_file}")
                return False
                
            # Temporarily set the correct path for the service account file
            original_path = getattr(config, 'SERVICE_ACCOUNT_FILE', 'service_account.json')
            config.SERVICE_ACCOUNT_FILE = service_account_file
            
            self.column_manager = ColumnManager()
            
            # Restore original path
            config.SERVICE_ACCOUNT_FILE = original_path
            
            return True
        except Exception as e:
            print(f"❌ Service initialization failed: {e}")
            return False
    
    def get_env_variables(self):
        """Get current environment variables"""
        if config is None:
            return {}
            
        env_vars = {
            'GITLAB_TOKEN': getattr(config, 'GITLAB_TOKEN', '') or '',
            'GITLAB_URL': getattr(config, 'GITLAB_URL', '') or '',
            'PROJECT_ID': getattr(config, 'PROJECT_ID', '') or '',
            'SPREADSHEET_ID': getattr(config, 'SPREADSHEET_ID', '') or '',
            'WORKSHEET_NAME': getattr(config, 'WORKSHEET_NAME', '') or '',
            'SERVICE_ACCOUNT_FILE': getattr(config, 'SERVICE_ACCOUNT_FILE', '') or '',
            'DEFAULT_ASSIGNEE': getattr(config, 'DEFAULT_ASSIGNEE', '') or '',
            'DEFAULT_ESTIMATE': getattr(config, 'DEFAULT_ESTIMATE', '') or '',
            'DEFAULT_MILESTONE': getattr(config, 'DEFAULT_MILESTONE', '') or '',
            'DEFAULT_DUE_DATE': getattr(config, 'DEFAULT_DUE_DATE', '') or '',
            'DEFAULT_LABEL': getattr(config, 'DEFAULT_LABEL', '') or ''
        }
        return env_vars
    
    def update_env_file(self, form_data):
        """Update .env file with new values"""
        try:
            env_content = []
            
            # Read existing .env file if it exists
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r') as f:
                    existing_lines = f.readlines()
                
                # Update existing variables
                updated_vars = set()
                for line in existing_lines:
                    if '=' in line and not line.strip().startswith('#'):
                        var_name = line.split('=')[0].strip()
                        if var_name in form_data:
                            env_content.append(f"{var_name}={form_data[var_name]}\n")
                            updated_vars.add(var_name)
                        else:
                            env_content.append(line)
                    else:
                        env_content.append(line)
                
                # Add new variables
                for var_name, var_value in form_data.items():
                    if var_name not in updated_vars:
                        env_content.append(f"{var_name}={var_value}\n")
            else:
                # Create new .env file
                for var_name, var_value in form_data.items():
                    env_content.append(f"{var_name}={var_value}\n")
            
            # Write updated content
            with open(self.config_file, 'w') as f:
                f.writelines(env_content)
            
            return True
        except Exception as e:
            print(f"❌ Error updating .env file: {e}")
            return False

ui_manager = WebUIManager()

@app.route('/')
def index():
    """Main dashboard"""
    # Check if services can be initialized
    services_status = ui_manager.initialize_services()
    env_vars = ui_manager.get_env_variables()
    
    # Check configuration completeness
    required_vars = ['GITLAB_TOKEN', 'SPREADSHEET_ID']
    missing_vars = [var for var in required_vars if not env_vars.get(var)]
    
    return render_template('index.html', 
                         services_status=services_status,
                         env_vars=env_vars,
                         missing_vars=missing_vars,
                         config_complete=len(missing_vars) == 0)

@app.route('/config')
def config_page():
    """Configuration page"""
    env_vars = ui_manager.get_env_variables()
    return render_template('config.html', env_vars=env_vars)

@app.route('/config/save', methods=['POST'])
def save_config():
    """Save configuration"""
    try:
        form_data = request.form.to_dict()
        
        if ui_manager.update_env_file(form_data):
            flash('Configuration saved successfully!', 'success')
            
            # Reload config module to pick up new environment variables
            import importlib
            importlib.reload(config)
            
            # Re-initialize services with new config
            ui_manager.initialize_services()
        else:
            flash('Failed to save configuration', 'error')
            
    except Exception as e:
        flash(f'Error saving configuration: {str(e)}', 'error')
    
    return redirect(url_for('config_page'))

@app.route('/columns')
def columns_page():
    """Column management page"""
    try:
        if not ui_manager.initialize_services():
            flash('Cannot connect to Google Sheets. Please check your configuration.', 'error')
            return redirect(url_for('config_page'))
        
        # Reload config to get latest changes
        import importlib
        importlib.reload(config)
        
        # Get current column configuration
        column_config = config.COLUMN_CONFIG
        
        # Try to detect headers with better error handling
        detected_headers = []
        detection_error = None
        try:
            detected_headers = ui_manager.column_manager.detect_current_headers()
            print(f"🔍 Detected headers: {detected_headers}")
        except Exception as e:
            detection_error = str(e)
            print(f"❌ Error detecting headers: {e}")
        
        return render_template('columns.html', 
                             column_config=column_config,
                             detected_headers=detected_headers,
                             detection_error=detection_error,
                             project_options=config.PROJECT_OPTIONS,
                             specific_project_options=config.SPECIFIC_PROJECT_OPTIONS,
                             status_options=config.STATUS_OPTIONS)
                             
    except Exception as e:
        flash(f'Error loading column configuration: {str(e)}', 'error')
        return redirect(url_for('index'))

@app.route('/columns/auto-map', methods=['POST'])
def auto_map_columns():
    """Auto-map columns based on detected headers"""
    try:
        if not ui_manager.initialize_services():
            return jsonify({'success': False, 'error': 'Cannot connect to Google Sheets'})
        
        mapping_suggestions = ui_manager.column_manager.auto_map_columns()
        
        if mapping_suggestions:
            # Apply the mapping
            success = ui_manager.column_manager.apply_mapping(mapping_suggestions, auto_apply=True)
            
            if success:
                # Reload the config module to pick up changes
                import importlib
                importlib.reload(config)
                
                return jsonify({'success': True, 'message': 'Columns auto-mapped successfully'})
            else:
                return jsonify({'success': False, 'error': 'Failed to apply column mapping'})
        else:
            return jsonify({'success': False, 'error': 'No mapping suggestions found'})
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/columns/save', methods=['POST'])
def save_columns():
    """Save column configuration"""
    try:
        column_data = request.json
        
        # Update column configuration
        updated_config = config.COLUMN_CONFIG.copy()
        
        for column_key, column_info in column_data.items():
            if column_key in updated_config:
                updated_config[column_key]['index'] = int(column_info['index'])
                updated_config[column_key]['header'] = column_info['header']
                # Handle additional properties if they exist
                if 'data_type' in column_info:
                    updated_config[column_key]['data_type'] = column_info['data_type']
                if 'required' in column_info:
                    updated_config[column_key]['required'] = column_info['required']
        
        # Save configuration
        if config.save_column_config(updated_config):
            # Reload config in memory - this is the key fix!
            importlib.reload(config)
            
            # Reinitialize services with new config
            ui_manager.initialize_services()
            
            return jsonify({'success': True, 'message': 'Column configuration saved successfully'})
        else:
            return jsonify({'success': False, 'error': 'Failed to save configuration'})
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/sync')
def sync_page():
    """Sync operations page"""
    return render_template('sync.html')

@app.route('/sync/sheets-to-gitlab', methods=['POST'])
def sync_sheets_to_gitlab():
    """Perform Sheets to GitLab sync"""
    try:
        if not ui_manager.initialize_services():
            return jsonify({'success': False, 'error': 'Cannot initialize sync services'})
        
        # Initialize sheets sync
        sheets_sync = SheetsToGitLab()
        
        # Perform sync (capture output)
        import io
        import contextlib
        
        output_buffer = io.StringIO()
        with contextlib.redirect_stdout(output_buffer):
            sheets_sync.sync_sheets_to_gitlab()
        
        output = output_buffer.getvalue()
        
        return jsonify({
            'success': True, 
            'message': 'Sheets to GitLab sync completed',
            'output': output
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e), 'traceback': traceback.format_exc()})

@app.route('/sync/gitlab-to-sheets', methods=['POST'])
def sync_gitlab_to_sheets():
    """Perform GitLab to Sheets sync"""
    try:
        if not ui_manager.initialize_services():
            return jsonify({'success': False, 'error': 'Cannot initialize sync services'})
        
        # Initialize gitlab sync
        gitlab_sync = GitLabToSheets()
        
        # Perform sync (capture output)
        import io
        import contextlib
        
        output_buffer = io.StringIO()
        with contextlib.redirect_stdout(output_buffer):
            gitlab_sync.sync_gitlab_to_sheets()
        
        output = output_buffer.getvalue()
        
        return jsonify({
            'success': True, 
            'message': 'GitLab to Sheets sync completed',
            'output': output
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e), 'traceback': traceback.format_exc()})

@app.route('/sync/complete', methods=['POST'])
def complete_sync():
    """Perform complete bidirectional sync"""
    try:
        if not ui_manager.initialize_services():
            return jsonify({'success': False, 'error': 'Cannot initialize sync services'})
        
        # Import complete sync
        sys.path.append(config.ROOT_DIR)
        import complete_sync
        
        # Perform complete sync (capture output)
        import io
        import contextlib
        
        output_buffer = io.StringIO()
        with contextlib.redirect_stdout(output_buffer):
            complete_sync.main()
        
        output = output_buffer.getvalue()
        
        return jsonify({
            'success': True, 
            'message': 'Complete sync finished',
            'output': output
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e), 'traceback': traceback.format_exc()})

@app.route('/test')
def test_page():
    """Test connections page"""
    return render_template('test.html')

@app.route('/test/gitlab', methods=['POST'])
def test_gitlab():
    """Test GitLab connection"""
    try:
        import requests
        
        url = f"{config.GITLAB_URL}projects/{config.PROJECT_ID}"
        headers = {"PRIVATE-TOKEN": config.GITLAB_TOKEN}
        
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            project_data = response.json()
            return jsonify({
                'success': True,
                'message': 'GitLab connection successful',
                'data': {
                    'project_name': project_data.get('name', 'Unknown'),
                    'project_id': project_data.get('id', 'Unknown'),
                    'web_url': project_data.get('web_url', 'Unknown')
                }
            })
        else:
            return jsonify({
                'success': False,
                'error': f'GitLab API returned status {response.status_code}'
            })
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/test/sheets', methods=['POST'])
def test_sheets():
    """Test Google Sheets connection"""
    try:
        if not ui_manager.initialize_services():
            return jsonify({'success': False, 'error': 'Cannot initialize Google Sheets connection'})
        
        # Try to read headers
        headers = ui_manager.column_manager.detect_current_headers()
        
        return jsonify({
            'success': True,
            'message': 'Google Sheets connection successful',
            'data': {
                'headers_count': len(headers),
                'headers': headers[:10],  # First 10 headers
                'spreadsheet_id': config.SPREADSHEET_ID,
                'worksheet_name': config.WORKSHEET_NAME
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/status')
def api_status():
    """API endpoint for system status"""
    try:
        env_vars = ui_manager.get_env_variables()
        required_vars = ['GITLAB_TOKEN', 'SPREADSHEET_ID']
        missing_vars = [var for var in required_vars if not env_vars.get(var)]
        
        return jsonify({
            'configured': len(missing_vars) == 0,
            'missing_vars': missing_vars,
            'services_available': ui_manager.initialize_services(),
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({'error': str(e)})

@app.route('/api/columns')
def api_columns():
    """API endpoint to get current column configuration"""
    try:
        # Reload config to get latest changes
        import importlib
        importlib.reload(config)
        
        return jsonify({
            'success': True,
            'column_config': config.COLUMN_CONFIG,
            'project_options': config.PROJECT_OPTIONS,
            'specific_project_options': config.SPECIFIC_PROJECT_OPTIONS,
            'status_options': config.STATUS_OPTIONS
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/debug/sheet', methods=['POST'])
def debug_sheet():
    """Debug endpoint to inspect sheet structure"""
    try:
        if not ui_manager.initialize_services():
            return jsonify({'success': False, 'error': 'Cannot initialize services'})
        
        # Get detailed sheet information
        sheet_info = {}
        
        # Try to read the first few rows directly
        try:
            service = ui_manager.column_manager.service
            spreadsheet_id = config.SPREADSHEET_ID
            worksheet_name = config.WORKSHEET_NAME
            
            # Read first 5 rows to see structure
            range_name = f"{worksheet_name}!A1:Z5"
            result = service.spreadsheets().values().get(
                spreadsheetId=spreadsheet_id,
                range=range_name
            ).execute()
            
            values = result.get('values', [])
            sheet_info['raw_data'] = values
            sheet_info['total_rows'] = len(values)
            sheet_info['first_row'] = values[0] if values else []
            sheet_info['has_data'] = len(values) > 0
            
        except Exception as e:
            sheet_info['error'] = str(e)
        
        # Try header detection
        try:
            detected_headers = ui_manager.column_manager.detect_current_headers()
            sheet_info['detected_headers'] = detected_headers
        except Exception as e:
            sheet_info['header_detection_error'] = str(e)
        
        return jsonify({
            'success': True,
            'sheet_info': sheet_info,
            'config': {
                'spreadsheet_id': config.SPREADSHEET_ID,
                'worksheet_name': config.WORKSHEET_NAME
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/debug/sheet-structure', methods=['POST'])
def debug_sheet_structure():
    """Get detailed sheet structure information"""
    try:
        if not ui_manager.initialize_services():
            return jsonify({'success': False, 'error': 'Cannot initialize services'})
        
        service = ui_manager.column_manager.service
        spreadsheet_id = config.SPREADSHEET_ID
        worksheet_name = config.WORKSHEET_NAME
        
        # Get sheet metadata
        sheet_metadata = service.spreadsheets().get(
            spreadsheetId=spreadsheet_id
        ).execute()
        
        # Get sheet data (more rows for analysis)
        range_name = f"{worksheet_name}!A1:Z10"
        values_result = service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=range_name
        ).execute()
        
        values = values_result.get('values', [])
        
        data = {
            'sheet_info': {
                'title': sheet_metadata.get('properties', {}).get('title', 'Unknown'),
                'id': spreadsheet_id,
                'locale': sheet_metadata.get('properties', {}).get('locale', 'Unknown'),
                'worksheet_name': worksheet_name
            },
            'raw_data': values,
            'headers': values[0] if values else [],
            'data_rows': len(values) - 1 if values else 0,
            'column_count': len(values[0]) if values else 0,
            'sample_rows': values[1:6] if len(values) > 1 else []
        }
        
        return jsonify({"success": True, "data": data})
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/columns/add', methods=['POST'])
def add_column():
    """Add a new column to the configuration"""
    try:
        data = request.get_json()
        column_name = data.get('column_name')
        column_config = data.get('config', {})
        
        if not column_name:
            return jsonify({"success": False, "error": "Column name is required"})
        
        # Load current column configuration
        current_config = config.COLUMN_CONFIG.copy()
        
        # Add new column
        current_config[column_name] = {
            'index': column_config.get('index', 1),
            'header': column_config.get('header', column_name),
            'data_type': column_config.get('data_type', 'text'),
            'required': column_config.get('required', False),
            'description': column_config.get('description', f'Custom column: {column_name}'),
            'example': column_config.get('example', '')
        }
        
        # Save updated configuration
        if config.save_column_config(current_config):
            # Reload the configuration
            importlib.reload(config)
            return jsonify({
                "success": True, 
                "message": f"Column '{column_name}' added successfully"
            })
        else:
            return jsonify({"success": False, "error": "Failed to save column configuration"})
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/columns/remove', methods=['POST'])
def remove_column():
    """Remove a column from the configuration"""
    try:
        data = request.get_json()
        column_name = data.get('column_name')
        
        if not column_name:
            return jsonify({"success": False, "error": "Column name is required"})
        
        # Load current column configuration
        current_config = config.COLUMN_CONFIG.copy()
        
        # Check if column exists and is not required
        if column_name not in current_config:
            return jsonify({"success": False, "error": f"Column '{column_name}' not found"})
        
        if current_config[column_name].get('required', False):
            return jsonify({"success": False, "error": f"Cannot remove required column '{column_name}'"})
        
        # Remove column
        del current_config[column_name]
        
        # Save updated configuration
        if config.save_column_config(current_config):
            # Reload the configuration
            importlib.reload(config)
            return jsonify({
                "success": True, 
                "message": f"Column '{column_name}' removed successfully"
            })
        else:
            return jsonify({"success": False, "error": "Failed to save column configuration"})
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/setup/headers', methods=['POST'])
def setup_headers():
    """Setup proper column headers in the Google Sheet"""
    try:
        if not ui_manager.initialize_services():
            return jsonify({'success': False, 'error': 'Cannot initialize services'})
        
        # Define the proper headers based on config
        headers = []
        for column_key, column_info in config.COLUMN_CONFIG.items():
            headers.append(column_info['header'])
        
        # Write headers to the first row
        service = ui_manager.column_manager.service
        spreadsheet_id = config.SPREADSHEET_ID
        worksheet_name = config.WORKSHEET_NAME
        
        # Clear the first row first
        range_name = f"{worksheet_name}!1:1"
        service.spreadsheets().values().clear(
            spreadsheetId=spreadsheet_id,
            range=range_name
        ).execute()
        
        # Write new headers
        range_name = f"{worksheet_name}!A1"
        body = {
            'values': [headers]
        }
        
        result = service.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range=range_name,
            valueInputOption='RAW',
            body=body
        ).execute()
        
        return jsonify({
            'success': True,
            'message': f'Successfully set up {len(headers)} column headers',
            'headers': headers,
            'updated_cells': result.get('updatedCells', 0)
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
