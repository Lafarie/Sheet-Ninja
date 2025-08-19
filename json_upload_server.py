#!/usr/bin/env python3
"""
Simple Flask server for JSON file upload
Creates a web server to handle Google Sheets API service account JSON uploads
"""

from flask import Flask, render_template_string, request, jsonify
from flask_cors import CORS
import os
import json

app = Flask(__name__)
CORS(app)

# Configuration
PORT = 8000
UPLOAD_FOLDER = 'uploads'

# Ensure upload directory exists
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@app.route('/')
def index():
    """Serve the JSON upload page"""
    try:
        with open('upload_json.html', 'r', encoding='utf-8') as f:
            html_content = f.read()
        return html_content
    except FileNotFoundError:
        return """
        <h1>Error: upload_json.html not found</h1>
        <p>Please make sure upload_json.html is in the same directory as this server file.</p>
        """, 404

@app.route('/api/upload', methods=['POST'])
def upload_json():
    """Handle JSON file upload"""
    try:
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No file provided'
            }), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({
                'success': False,
                'error': 'No file selected'
            }), 400
        
        if not file.filename.lower().endswith('.json'):
            return jsonify({
                'success': False,
                'error': 'File must be a JSON file'
            }), 400
        
        # Read and validate JSON content
        try:
            content = file.read().decode('utf-8')
            json_data = json.loads(content)
        except json.JSONDecodeError as e:
            return jsonify({
                'success': False,
                'error': f'Invalid JSON format: {str(e)}'
            }), 400
        except UnicodeDecodeError:
            return jsonify({
                'success': False,
                'error': 'File encoding not supported. Please use UTF-8 encoded JSON files.'
            }), 400
        
        # Validate Google Service Account structure
        required_fields = [
            'type',
            'project_id',
            'private_key_id',
            'private_key',
            'client_email',
            'client_id',
            'auth_uri',
            'token_uri'
        ]
        
        missing_fields = [field for field in required_fields if field not in json_data]
        
        if missing_fields:
            return jsonify({
                'success': False,
                'error': f'Missing required service account fields: {", ".join(missing_fields)}'
            }), 400
        
        if json_data.get('type') != 'service_account':
            return jsonify({
                'success': False,
                'error': 'This is not a valid Google Service Account JSON file'
            }), 400
        
        # Save the file
        filename = 'service_account.json'
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, indent=2)
        
        return jsonify({
            'success': True,
            'message': 'Service account JSON uploaded successfully',
            'file_info': {
                'filename': filename,
                'project_id': json_data.get('project_id'),
                'client_email': json_data.get('client_email'),
                'client_id': json_data.get('client_id')
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Server error: {str(e)}'
        }), 500

@app.route('/api/validate', methods=['POST'])
def validate_json():
    """Validate JSON content without saving"""
    try:
        data = request.get_json()
        
        if not data or 'content' not in data:
            return jsonify({
                'success': False,
                'error': 'No JSON content provided'
            }), 400
        
        try:
            json_data = json.loads(data['content'])
        except json.JSONDecodeError as e:
            return jsonify({
                'success': False,
                'error': f'Invalid JSON format: {str(e)}'
            }), 400
        
        # Validate Google Service Account structure
        required_fields = [
            'type',
            'project_id',
            'private_key_id',
            'private_key',
            'client_email',
            'client_id',
            'auth_uri',
            'token_uri'
        ]
        
        missing_fields = [field for field in required_fields if field not in json_data]
        
        if missing_fields:
            return jsonify({
                'success': False,
                'error': f'Missing required service account fields: {", ".join(missing_fields)}'
            }), 400
        
        if json_data.get('type') != 'service_account':
            return jsonify({
                'success': False,
                'error': 'This is not a valid Google Service Account JSON file'
            }), 400
        
        return jsonify({
            'success': True,
            'message': 'Valid Google Service Account JSON',
            'file_info': {
                'project_id': json_data.get('project_id'),
                'client_email': json_data.get('client_email'),
                'client_id': json_data.get('client_id')
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Server error: {str(e)}'
        }), 500

@app.route('/api/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'success': True,
        'status': 'healthy',
        'message': 'JSON Upload Server is running'
    })

@app.route('/api/files')
def list_files():
    """List uploaded files"""
    try:
        files = []
        if os.path.exists(UPLOAD_FOLDER):
            for filename in os.listdir(UPLOAD_FOLDER):
                if filename.endswith('.json'):
                    filepath = os.path.join(UPLOAD_FOLDER, filename)
                    stat = os.stat(filepath)
                    files.append({
                        'name': filename,
                        'size': stat.st_size,
                        'modified': stat.st_mtime
                    })
        
        return jsonify({
            'success': True,
            'files': files
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Error listing files: {str(e)}'
        }), 500

if __name__ == '__main__':
    print("🚀 Starting JSON Upload Server...")
    print(f"📡 Server available at: http://localhost:{PORT}")
    print(f"🌐 Open your browser and go to: http://localhost:{PORT}")
    print()
    print("🔧 Available endpoints:")
    print(f"  GET  / - Main upload page")
    print(f"  POST /api/upload - Upload JSON file")
    print(f"  POST /api/validate - Validate JSON content")
    print(f"  GET  /api/health - Health check")
    print(f"  GET  /api/files - List uploaded files")
    print()
    print("📁 Uploaded files will be saved in the 'uploads' directory")
    print("Press Ctrl+C to stop the server")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=PORT, debug=False)
