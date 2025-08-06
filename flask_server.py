"""
Flask web server with Google Sheets API and GitLab integration
"""

from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
from google.oauth2 import service_account
from googleapiclient.discovery import build
import logging
from gitlab_integration import GitLabIntegration, validate_gitlab_config, get_gitlab_setup_instructions

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Google Sheets API configuration
SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']

class GoogleSheetsService:
    def __init__(self):
        self.service = None
        self.credentials = None
    
    def authenticate(self, credentials_data):
        """Authenticate with Google Sheets API using provided credentials"""
        try:
            self.credentials = service_account.Credentials.from_service_account_info(
                credentials_data, scopes=SCOPES
            )
            self.service = build('sheets', 'v4', credentials=self.credentials)
            return True
        except Exception as e:
            logger.error(f"Authentication failed: {e}")
            return False
    
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
        }
    })

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
