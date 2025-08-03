"""
Column Manager Web UI
A user-friendly web interface for managing Google Sheets column mappings
"""

from flask import Flask, render_template, request, jsonify, redirect, url_for
import os
import json
import config
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'

class ColumnManagerUI:
    def __init__(self):
        self.spreadsheet_id = config.SPREADSHEET_ID
        self.service = self._authenticate()
        self.current_config = config.COLUMN_CONFIG.copy()
    
    def _authenticate(self):
        """Authenticate with Google Sheets"""
        try:
            credentials = service_account.Credentials.from_service_account_file(
                config.SERVICE_ACCOUNT_FILE,
                scopes=config.SCOPES
            )
            return build('sheets', 'v4', credentials=credentials)
        except Exception as e:
            print(f"❌ Authentication error: {e}")
            return None
    
    def detect_current_headers(self):
        """Auto-detect current headers from the Google Sheet"""
        try:
            if not self.service:
                return []
            
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=f"{config.WORKSHEET_NAME}!1:1"
            ).execute()
            
            values = result.get('values', [])
            if values:
                headers = values[0]
                return headers
            else:
                return []
        except Exception as e:
            print(f"❌ Error detecting headers: {e}")
            return []
    
    def auto_map_columns(self):
        """Automatically map columns based on detected headers"""
        detected_headers = self.detect_current_headers()
        if not detected_headers:
            return {}
        
        mapping_suggestions = {}
        
        for i, header in enumerate(detected_headers, 1):
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
                if 1 <= new_index <= len(detected_headers):
                    updated_config[key]["index"] = new_index
                    updated_config[key]["header"] = detected_headers[new_index - 1]
        
        # Save updated configuration
        if config.save_column_config(updated_config):
            # Reload config in memory
            config.COLUMN_CONFIG = updated_config
            config.COLUMNS = {key: value["index"] for key, value in updated_config.items()}
            config.SHEET_HEADERS = config.get_sheet_headers()
            return True
        return False

# Global instance
manager = ColumnManagerUI()

@app.route('/')
def index():
    """Main page with column configuration"""
    detected_headers = manager.detect_current_headers()
    auto_mappings = manager.auto_map_columns()
    
    # Get current configuration in order
    current_config = []
    for key, config_data in config.get_column_order():
        current_config.append({
            'key': key,
            'index': config_data['index'],
            'header': config_data['header'],
            'required': config_data.get('required', False),
            'description': config_data.get('description', ''),
            'data_type': config_data.get('data_type', 'text')
        })
    
    return render_template('column_manager.html',
                         headers=detected_headers,
                         current_config=current_config,
                         auto_mappings=auto_mappings)

@app.route('/api/headers')
def get_headers():
    """API endpoint to get current headers"""
    headers = manager.detect_current_headers()
    return jsonify({'headers': headers})

@app.route('/api/auto-map')
def auto_map():
    """API endpoint for auto-mapping"""
    mappings = manager.auto_map_columns()
    return jsonify({'mappings': mappings})

@app.route('/api/apply-mapping', methods=['POST'])
def apply_mapping():
    """API endpoint to apply column mappings"""
    try:
        mapping_data = request.json
        success = manager.apply_mapping(mapping_data)
        return jsonify({'success': success})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/validate')
def validate_config():
    """API endpoint to validate current configuration"""
    detected_headers = manager.detect_current_headers()
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
        'valid': len(issues) == 0,
        'issues': issues,
        'header_count': len(detected_headers)
    })

if __name__ == '__main__':
    print("🌐 Starting Column Manager Web UI...")
    print("📱 Open your browser and go to: http://localhost:5000")
    print("🔧 Press Ctrl+C to stop the server")
    app.run(debug=True, host='0.0.0.0', port=5000) 