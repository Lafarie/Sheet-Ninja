"""
Flask web server with Google Sheets API and GitLab integration
Enhanced with improved error handling, progress tracking, and configuration management
"""

from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
import time
import threading
from datetime import datetime
from google.oauth2 import service_account
from googleapiclient.discovery import build
import logging
from gitlab_integration import GitLabIntegration, validate_gitlab_config, get_gitlab_setup_instructions

# Configure enhanced logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configuration
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Google Sheets API configuration
SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']

# Global sync status tracking
sync_status = {
    'running': False,
    'step': 'idle',
    'progress': 0,
    'message': '',
    'output': '',
    'error': None,
    'start_time': None,
    'results': None
}

class GoogleSheetsService:
    def __init__(self):
        self.service = None
        self.credentials = None
        self.service_account_info = None
    
    def authenticate(self, credentials_data):
        """Authenticate with Google Sheets API using provided credentials"""
        try:
            self.service_account_info = credentials_data
            self.credentials = service_account.Credentials.from_service_account_info(
                credentials_data, scopes=SCOPES
            )
            self.service = build('sheets', 'v4', credentials=self.credentials)
            
            # Test the connection
            test_response = self.service.spreadsheets().get(
                spreadsheetId='1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'  # Public test sheet
            ).execute()
            
            return True
        except Exception as e:
            logger.error(f"Authentication failed: {e}")
            self.service = None
            self.credentials = None
            self.service_account_info = None
            return False
    
    def get_service_account_info(self):
        """Get service account information"""
        if self.service_account_info:
            return {
                'service_account': self.service_account_info.get('client_email', 'Unknown'),
                'project_id': self.service_account_info.get('project_id', 'Unknown'),
                'type': self.service_account_info.get('type', 'service_account')
            }
        return None
    
    def get_spreadsheet_info(self, spreadsheet_id):
        """Get spreadsheet metadata including sheet names"""
        try:
            if not self.service:
                raise Exception("Not authenticated")
            
            # Get spreadsheet metadata
            spreadsheet = self.service.spreadsheets().get(
                spreadsheetId=spreadsheet_id
            ).execute()
            
            sheets_info = []
            for sheet in spreadsheet.get('sheets', []):
                sheet_properties = sheet.get('properties', {})
                sheets_info.append({
                    'name': sheet_properties.get('title', 'Unknown'),
                    'id': sheet_properties.get('sheetId', 0),
                    'rows': sheet_properties.get('gridProperties', {}).get('rowCount', 0),
                    'columns': sheet_properties.get('gridProperties', {}).get('columnCount', 0)
                })
            
            return {
                'title': spreadsheet.get('properties', {}).get('title', 'Unknown'),
                'spreadsheet_id': spreadsheet_id,
                'sheets': sheets_info
            }
            
        except Exception as e:
            logger.error(f"Error getting spreadsheet info: {e}")
            raise e
    
    def get_sheet_data(self, spreadsheet_id, sheet_name, range_name=None):
        """Get data from a specific sheet"""
        try:
            if not self.service:
                raise Exception("Not authenticated")
            
            # Set range
            if range_name:
                full_range = f"{sheet_name}!{range_name}"
            else:
                full_range = sheet_name
            
            # Fetch the data
            result = self.service.spreadsheets().values().get(
                spreadsheetId=spreadsheet_id,
                range=full_range
            ).execute()
            
            values = result.get('values', [])
            return values
            
        except Exception as e:
            logger.error(f"Error getting sheet data: {e}")
            raise e

# Global service instances
sheets_service = GoogleSheetsService()
gitlab_service = None

@app.route('/')
def index():
    """Serve the single-page application"""
    return send_from_directory('.', 'single_page.html')

@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static files"""
    return send_from_directory('.', filename)

@app.route('/api/authenticate', methods=['POST'])
def authenticate():
    """Authenticate with Google Sheets API"""
    try:
        data = request.get_json()
        credentials_data = data.get('credentials')
        
        if not credentials_data:
            return jsonify({'error': 'No credentials provided'}), 400
        
        # Validate credentials structure
        required_fields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email', 'client_id']
        missing_fields = [field for field in required_fields if field not in credentials_data]
        
        if missing_fields:
            return jsonify({'error': f'Missing required fields: {", ".join(missing_fields)}'}), 400
        
        if credentials_data.get('type') != 'service_account':
            return jsonify({'error': 'Invalid credential type. Must be "service_account"'}), 400
        
        # Authenticate
        success = sheets_service.authenticate(credentials_data)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Authentication successful',
                'service_account': credentials_data.get('client_email'),
                'project_id': credentials_data.get('project_id')
            })
        else:
            return jsonify({'error': 'Authentication failed'}), 401
            
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/spreadsheet/<spreadsheet_id>/info', methods=['GET'])
def get_spreadsheet_info(spreadsheet_id):
    """Get spreadsheet information"""
    try:
        if not sheets_service.service:
            return jsonify({'error': 'Not authenticated. Please authenticate first.'}), 401
        
        info = sheets_service.get_spreadsheet_info(spreadsheet_id)
        return jsonify(info)
        
    except Exception as e:
        logger.error(f"Error getting spreadsheet info: {e}")
        error_message = str(e)
        
        if '403' in error_message or 'Forbidden' in error_message:
            error_message = 'Access denied. Make sure you\'ve shared the sheet with your service account email.'
        elif '404' in error_message or 'Not found' in error_message:
            error_message = 'Spreadsheet not found. Please check the Sheet ID.'
        elif 'Invalid' in error_message:
            error_message = 'Invalid spreadsheet ID format.'
        
        return jsonify({'error': error_message}), 400

@app.route('/api/spreadsheet/<spreadsheet_id>/sheet/<sheet_name>/headers', methods=['GET'])
def get_headers(spreadsheet_id, sheet_name):
    """Get headers from a sheet"""
    try:
        if not sheets_service.service:
            return jsonify({'error': 'Not authenticated. Please authenticate first.'}), 401
        
        # Get first row (headers)
        data = sheets_service.get_sheet_data(spreadsheet_id, sheet_name, 'A1:Z1')
        
        if not data:
            return jsonify({'error': 'No data found in the specified range'}), 404
        
        headers = data[0] if data else []
        
        return jsonify({
            'headers': headers,
            'count': len(headers),
            'sheet_name': sheet_name
        })
        
    except Exception as e:
        logger.error(f"Error getting headers: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/spreadsheet/<spreadsheet_id>/sheet/<sheet_name>/data', methods=['GET'])
def get_sheet_data(spreadsheet_id, sheet_name):
    """Get all data from a sheet"""
    try:
        if not sheets_service.service:
            return jsonify({'error': 'Not authenticated. Please authenticate first.'}), 401
        
        # Get limit from query parameter
        limit = request.args.get('limit', type=int)
        
        # Get all data
        data = sheets_service.get_sheet_data(spreadsheet_id, sheet_name)
        
        if not data:
            return jsonify({'error': 'No data found'}), 404
        
        # Apply limit if specified
        if limit and limit > 0:
            data = data[:limit + 1]  # +1 to include headers
        
        return jsonify({
            'data': data,
            'headers': data[0] if data else [],
            'rows': len(data) - 1 if data else 0,
            'sheet_name': sheet_name,
            'limited': bool(limit and len(data) > limit)
        })
        
    except Exception as e:
        logger.error(f"Error getting sheet data: {e}")
        return jsonify({'error': str(e)}), 500

def get_gitlab_config():
    """Get GitLab configuration from environment or config file"""
    import os
    
    # Try to get from environment variables first
    gitlab_url = os.getenv('GITLAB_URL')
    gitlab_token = os.getenv('GITLAB_TOKEN')
    
    if gitlab_url and gitlab_token:
        return {
            'url': gitlab_url,
            'token': gitlab_token
        }
    
    # Try to read from config file
    try:
        config_file = os.path.join(os.path.dirname(__file__), 'gitlab_config.json')
        if os.path.exists(config_file):
            with open(config_file, 'r') as f:
                config = json.load(f)
                return config
    except Exception as e:
        logger.error(f"Error reading GitLab config: {str(e)}")
    
    return None

@app.route('/api/gitlab/config', methods=['POST'])
def save_gitlab_config():
    """Save GitLab configuration"""
    try:
        data = request.json
        gitlab_url = data.get('gitlab_url')
        access_token = data.get('access_token')
        
        if not gitlab_url or not access_token:
            return jsonify({'error': 'GitLab URL and access token are required'}), 400
        
        # Validate config
        gitlab = GitLabIntegration(gitlab_url, access_token)
        test_result = gitlab.test_connection()
        
        if not test_result['success']:
            return jsonify({'error': f'GitLab connection failed: {test_result["error"]}'}), 400
        
        # Save config to file
        config = {
            'url': gitlab_url,
            'token': access_token
        }
        
        config_file = os.path.join(os.path.dirname(__file__), 'gitlab_config.json')
        with open(config_file, 'w') as f:
            json.dump(config, f)
        
        return jsonify({
            'success': True,
            'user': test_result.get('user'),
            'username': test_result.get('username')
        })
        
    except Exception as e:
        logger.error(f"Error saving GitLab config: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/gitlab/config', methods=['GET'])
def get_gitlab_config_status():
    """Check if GitLab is configured"""
    try:
        config = get_gitlab_config()
        if config:
            gitlab = GitLabIntegration(config['url'], config['token'])
            test_result = gitlab.test_connection()
            
            if test_result['success']:
                return jsonify({
                    'configured': True,
                    'user': test_result.get('user'),
                    'username': test_result.get('username'),
                    'url': config['url']
                })
            else:
                return jsonify({
                    'configured': False,
                    'error': test_result.get('error')
                })
        else:
            return jsonify({'configured': False})
            
    except Exception as e:
        logger.error(f"Error checking GitLab config: {str(e)}")
        return jsonify({'configured': False, 'error': str(e)})

@app.route('/api/gitlab/setup', methods=['GET'])
def gitlab_setup():
    """Get GitLab setup instructions"""
    return jsonify(get_gitlab_setup_instructions())

@app.route('/api/gitlab/authenticate', methods=['POST'])
def gitlab_authenticate():
    """Authenticate with GitLab"""
    global gitlab_service
    
    try:
        data = request.get_json()
        gitlab_url = data.get('gitlab_url', '').strip()
        access_token = data.get('access_token', '').strip()
        
        # Validate configuration
        validation = validate_gitlab_config(gitlab_url, access_token)
        if not validation['success']:
            return jsonify({'error': validation['error']}), 400
        
        # Test connection
        gitlab_service = GitLabIntegration(gitlab_url, access_token)
        test_result = gitlab_service.test_connection()
        
        if test_result['success']:
            return jsonify({
                'success': True,
                'message': 'GitLab authentication successful',
                'user': test_result['user'],
                'username': test_result['username']
            })
        else:
            gitlab_service = None
            return jsonify({'error': test_result['error']}), 401
            
    except Exception as e:
        gitlab_service = None
        logger.error(f"GitLab authentication error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/gitlab/projects', methods=['GET'])
def gitlab_projects():
    """Get GitLab projects"""
    global gitlab_service
    
    if not gitlab_service:
        return jsonify({'error': 'GitLab not authenticated. Please authenticate first.'}), 401
    
    try:
        result = gitlab_service.get_projects()
        if result['success']:
            return jsonify(result)
        else:
            return jsonify({'error': result['error']}), 400
    except Exception as e:
        logger.error(f"Error fetching GitLab projects: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/gitlab/project/<int:project_id>/issues', methods=['GET'])
def gitlab_project_issues(project_id):
    """Get issues from GitLab project"""
    global gitlab_service
    
    if not gitlab_service:
        return jsonify({'error': 'GitLab not authenticated. Please authenticate first.'}), 401
    
    try:
        state = request.args.get('state', 'opened')
        result = gitlab_service.get_project_issues(project_id, state)
        if result['success']:
            return jsonify(result)
        else:
            return jsonify({'error': result['error']}), 400
    except Exception as e:
        logger.error(f"Error fetching GitLab issues: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/gitlab/analyze-columns', methods=['POST'])
def gitlab_analyze_columns():
    """Analyze sheet columns for GitLab field mapping"""
    global gitlab_service
    
    if not gitlab_service:
        return jsonify({'error': 'GitLab not authenticated. Please authenticate first.'}), 401
    
    if not sheets_service.service:
        return jsonify({'error': 'Google Sheets not authenticated. Please authenticate first.'}), 401
    
    try:
        data = request.get_json()
        spreadsheet_id = data.get('spreadsheet_id')
        sheet_name = data.get('sheet_name')
        
        if not all([spreadsheet_id, sheet_name]):
            return jsonify({'error': 'Missing required parameters: spreadsheet_id, sheet_name'}), 400
        
        # Get sheet data (just first few rows for analysis)
        sheet_data = sheets_service.get_sheet_data(spreadsheet_id, sheet_name, f"{sheet_name}!A1:Z10")
        if not sheet_data:
            return jsonify({'error': 'No data found in the specified sheet'}), 404
        
        # Analyze columns
        result = gitlab_service.analyze_sheet_columns(sheet_data)
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error analyzing columns: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/gitlab/analyze-columns', methods=['POST'])
def analyze_gitlab_columns():
    try:
        data = request.json
        spreadsheet_id = data.get('spreadsheet_id')
        sheet_name = data.get('sheet_name')
        
        if not spreadsheet_id or not sheet_name:
            return jsonify({'error': 'Missing spreadsheet_id or sheet_name'}), 400
        
        # Get sheet data
        result = get_sheet_data(spreadsheet_id, sheet_name)
        if not result.get('success'):
            return jsonify({'error': result.get('error')}), 400
        
        # Analyze columns using GitLab integration
        gitlab_config = get_gitlab_config()
        if not gitlab_config:
            return jsonify({'error': 'GitLab not configured'}), 400
        
        gitlab = GitLabIntegration(gitlab_config['url'], gitlab_config['token'])
        analysis = gitlab.analyze_sheet_columns(result['data'])
        
        return jsonify(analysis)
    except Exception as e:
        logger.error(f"Error analyzing columns: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/gitlab/project/<int:project_id>/data', methods=['GET'])
def get_gitlab_project_data(project_id):
    try:
        gitlab_config = get_gitlab_config()
        if not gitlab_config:
            return jsonify({'error': 'GitLab not configured'}), 400
        
        gitlab = GitLabIntegration(gitlab_config['url'], gitlab_config['token'])
        result = gitlab.get_all_project_data(project_id)
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error fetching project data: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/gitlab/create-issues-mapped', methods=['POST'])
def create_gitlab_issues_mapped():
    try:
        data = request.json
        project_id = data.get('project_id')
        spreadsheet_id = data.get('spreadsheet_id')
        sheet_name = data.get('sheet_name')
        field_mapping = data.get('field_mapping', {})
        date_filter = data.get('date_filter')
        milestone_id = data.get('milestone_id')
        assignee_ids = data.get('assignee_ids', [])
        label_names = data.get('label_names', [])
        
        if not project_id or not spreadsheet_id or not sheet_name:
            return jsonify({'error': 'Missing required parameters'}), 400
        
        # Get sheet data
        result = get_sheet_data(spreadsheet_id, sheet_name)
        if not result.get('success'):
            return jsonify({'error': result.get('error')}), 400
        
        # Create issues using GitLab integration
        gitlab_config = get_gitlab_config()
        if not gitlab_config:
            return jsonify({'error': 'GitLab not configured'}), 400
        
        gitlab = GitLabIntegration(gitlab_config['url'], gitlab_config['token'])
        result = gitlab.create_issues_with_options(
            project_id, 
            result['data'], 
            field_mapping, 
            date_filter,
            milestone_id,
            assignee_ids,
            label_names
        )
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error creating mapped issues: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/gitlab/create-issues', methods=['POST'])
def gitlab_create_issues():
    """Create GitLab issues from Google Sheets data"""
    global gitlab_service
    
    if not gitlab_service:
        return jsonify({'error': 'GitLab not authenticated. Please authenticate first.'}), 401
    
    if not sheets_service.service:
        return jsonify({'error': 'Google Sheets not authenticated. Please authenticate first.'}), 401
    
    try:
        data = request.get_json()
        project_id = data.get('project_id')
        spreadsheet_id = data.get('spreadsheet_id')
        sheet_name = data.get('sheet_name')
        
        if not all([project_id, spreadsheet_id, sheet_name]):
            return jsonify({'error': 'Missing required parameters: project_id, spreadsheet_id, sheet_name'}), 400
        
        # Get sheet data
        sheet_data = sheets_service.get_sheet_data(spreadsheet_id, sheet_name)
        if not sheet_data:
            return jsonify({'error': 'No data found in the specified sheet'}), 404
        
        # Create issues
        result = gitlab_service.create_issues_from_sheet(project_id, sheet_data)
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error creating GitLab issues: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'Google Sheets API Server with GitLab Integration',
        'authenticated': {
            'google_sheets': sheets_service.service is not None,
            'gitlab': gitlab_service is not None
        },
        'version': '2.0.0'
    })

@app.route('/api/sync-status', methods=['GET'])
def get_sync_status():
    """Get current sync status"""
    global sync_status
    return jsonify(sync_status)

@app.route('/api/sync/start', methods=['POST'])
def start_sync():
    """Start the sync process"""
    global sync_status
    
    if sync_status['running']:
        return jsonify({'error': 'Sync is already running'}), 400
    
    try:
        data = request.get_json()
        
        # Reset sync status
        sync_status.update({
            'running': True,
            'step': 'sync-start',
            'progress': 0,
            'message': 'Starting sync process...',
            'output': '',
            'error': None,
            'start_time': time.time(),
            'results': None
        })
        
        # Start sync in background thread
        def run_sync():
            try:
                sync_status.update({
                    'step': 'reading-sheet',
                    'progress': 25,
                    'message': 'Reading Google Sheets data...'
                })
                
                # Simulate sync process steps
                time.sleep(2)
                
                sync_status.update({
                    'step': 'creating-issues',
                    'progress': 50,
                    'message': 'Creating GitLab issues...'
                })
                
                time.sleep(3)
                
                sync_status.update({
                    'step': 'updating-sheet',
                    'progress': 75,
                    'message': 'Updating sheet with issue IDs...'
                })
                
                time.sleep(2)
                
                sync_status.update({
                    'running': False,
                    'step': 'completed',
                    'progress': 100,
                    'message': 'Sync completed successfully!',
                    'output': 'Sample sync completed with mock data',
                    'results': {
                        'created': 5,
                        'updated': 2,
                        'errors': 0
                    }
                })
                
            except Exception as e:
                sync_status.update({
                    'running': False,
                    'step': 'error',
                    'progress': 0,
                    'message': f'Sync failed: {str(e)}',
                    'error': str(e)
                })
        
        # Start the sync thread
        sync_thread = threading.Thread(target=run_sync)
        sync_thread.daemon = True
        sync_thread.start()
        
        return jsonify({'status': 'started', 'message': 'Sync process started successfully'})
        
    except Exception as e:
        sync_status.update({
            'running': False,
            'error': str(e)
        })
        return jsonify({'error': str(e)}), 500

@app.route('/api/sync/stop', methods=['POST'])
def stop_sync():
    """Stop the sync process"""
    global sync_status
    
    sync_status.update({
        'running': False,
        'step': 'stopped',
        'message': 'Sync stopped by user',
        'error': None
    })
    
    return jsonify({'status': 'stopped', 'message': 'Sync process stopped'})

@app.errorhandler(404)
def not_found(error):
    """Custom 404 handler"""
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    """Custom 500 handler"""
    logger.error(f"Internal server error: {error}")
    return jsonify({'error': 'Internal server error'}), 500

@app.errorhandler(413)
def file_too_large(error):
    """Custom 413 handler for file size"""
    return jsonify({'error': 'File too large. Maximum size is 16MB'}), 413

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    
    print("🚀 Google Sheets Web Client")
    print("=" * 40)
    print(f"📡 Server running on http://localhost:{port}")
    print("🌐 Open your browser to start using the app")
    print("📤 Upload your Google Sheets API credentials")
    print("📊 Fetch real spreadsheet data")
    print("💡 Press Ctrl+C to stop the server")
    print()
    
    app.run(host='0.0.0.0', port=port, debug=True)
