#!/usr/bin/env python3
"""
Main server application for JSON file upload
Organized and modular Flask application for handling Google Sheets API service account uploads
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import json
from datetime import datetime

# Import components
from utils.file_handler import FileHandler
from utils.json_validator import JSONValidator
from utils.response_helper import ResponseHelper

def create_app():
    """Create and configure the Flask application"""
    app = Flask(__name__)
    CORS(app)
    
    # Configuration
    app.config['UPLOAD_FOLDER'] = 'uploads'
    app.config['MAX_CONTENT_LENGTH'] = 1 * 1024 * 1024  # 1MB max file size
    
    # Initialize components
    file_handler = FileHandler(app.config['UPLOAD_FOLDER'])
    json_validator = JSONValidator()
    response_helper = ResponseHelper()
    
    # Ensure upload directory exists
    file_handler.ensure_upload_directory()
    
    @app.route('/')
    def index():
        """Serve the main upload page"""
        return send_from_directory('.', 'templates/upload.html')
    
    @app.route('/api/upload', methods=['POST'])
    def upload_json():
        """Handle JSON file upload with validation"""
        try:
            # Check if file is present
            if 'file' not in request.files:
                return response_helper.error('No file provided', 400)
            
            file = request.files['file']
            
            if file.filename == '':
                return response_helper.error('No file selected', 400)
            
            # Validate file extension
            if not file_handler.is_valid_json_file(file.filename):
                return response_helper.error('File must be a JSON file', 400)
            
            # Read and parse JSON content
            try:
                content = file.read().decode('utf-8')
                json_data = json.loads(content)
            except json.JSONDecodeError as e:
                return response_helper.error(f'Invalid JSON format: {str(e)}', 400)
            except UnicodeDecodeError:
                return response_helper.error('File encoding not supported. Please use UTF-8 encoded JSON files.', 400)
            
            # Validate service account structure
            validation_result = json_validator.validate_service_account(json_data)
            if not validation_result['valid']:
                return response_helper.error(validation_result['error'], 400)
            
            # Save the file
            save_result = file_handler.save_json_file(json_data, 'service_account.json')
            if not save_result['success']:
                return response_helper.error(save_result['error'], 500)
            
            return response_helper.success(
                'Service account JSON uploaded successfully',
                {
                    'filename': 'service_account.json',
                    'project_id': json_data.get('project_id'),
                    'client_email': json_data.get('client_email'),
                    'client_id': json_data.get('client_id'),
                    'uploaded_at': datetime.now().isoformat()
                }
            )
            
        except Exception as e:
            return response_helper.error(f'Server error: {str(e)}', 500)
    
    @app.route('/api/validate', methods=['POST'])
    def validate_json():
        """Validate JSON content without saving"""
        try:
            data = request.get_json()
            
            if not data or 'content' not in data:
                return response_helper.error('No JSON content provided', 400)
            
            try:
                json_data = json.loads(data['content'])
            except json.JSONDecodeError as e:
                return response_helper.error(f'Invalid JSON format: {str(e)}', 400)
            
            # Validate service account structure
            validation_result = json_validator.validate_service_account(json_data)
            if not validation_result['valid']:
                return response_helper.error(validation_result['error'], 400)
            
            return response_helper.success(
                'Valid Google Service Account JSON',
                {
                    'project_id': json_data.get('project_id'),
                    'client_email': json_data.get('client_email'),
                    'client_id': json_data.get('client_id'),
                    'validated_at': datetime.now().isoformat()
                }
            )
            
        except Exception as e:
            return response_helper.error(f'Server error: {str(e)}', 500)
    
    @app.route('/api/health')
    def health_check():
        """Health check endpoint"""
        return response_helper.success('JSON Upload Server is running', {
            'status': 'healthy',
            'timestamp': datetime.now().isoformat()
        })
    
    @app.route('/api/files')
    def list_files():
        """List uploaded files"""
        try:
            files = file_handler.list_uploaded_files()
            return response_helper.success('Files retrieved successfully', {'files': files})
        except Exception as e:
            return response_helper.error(f'Error listing files: {str(e)}', 500)
    
    @app.route('/api/clear', methods=['DELETE'])
    def clear_uploads():
        """Clear all uploaded files"""
        try:
            result = file_handler.clear_uploads()
            if result['success']:
                return response_helper.success(f"Cleared {result['count']} files")
            else:
                return response_helper.error(result['error'], 500)
        except Exception as e:
            return response_helper.error(f'Error clearing uploads: {str(e)}', 500)
    
    return app

if __name__ == '__main__':
    # Create the application
    app = create_app()
    
    # Server configuration
    PORT = 8000
    HOST = '0.0.0.0'
    
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
    print(f"  DELETE /api/clear - Clear all uploads")
    print()
    print("📁 Uploaded files will be saved in the 'uploads' directory")
    print("🏗️ Organized structure with modular components")
    print("Press Ctrl+C to stop the server")
    print("=" * 60)
    
    app.run(host=HOST, port=PORT, debug=False)
