"""
File handling utilities for JSON upload application
Handles file operations, validation, and storage
"""

import os
import json
from datetime import datetime

class FileHandler:
    """Handles file operations for JSON uploads"""
    
    def __init__(self, upload_folder):
        self.upload_folder = upload_folder
    
    def ensure_upload_directory(self):
        """Create upload directory if it doesn't exist"""
        if not os.path.exists(self.upload_folder):
            os.makedirs(self.upload_folder)
            print(f"📁 Created upload directory: {self.upload_folder}")
    
    def is_valid_json_file(self, filename):
        """Check if file has valid JSON extension"""
        return filename and filename.lower().endswith('.json')
    
    def save_json_file(self, json_data, filename):
        """Save JSON data to file"""
        try:
            filepath = os.path.join(self.upload_folder, filename)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(json_data, f, indent=2)
            
            print(f"💾 Saved JSON file: {filepath}")
            return {
                'success': True,
                'filepath': filepath,
                'size': os.path.getsize(filepath)
            }
            
        except Exception as e:
            print(f"❌ Error saving file: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def list_uploaded_files(self):
        """List all uploaded JSON files with metadata"""
        files = []
        
        if not os.path.exists(self.upload_folder):
            return files
        
        for filename in os.listdir(self.upload_folder):
            if self.is_valid_json_file(filename):
                filepath = os.path.join(self.upload_folder, filename)
                try:
                    stat = os.stat(filepath)
                    files.append({
                        'name': filename,
                        'size': stat.st_size,
                        'size_mb': round(stat.st_size / (1024 * 1024), 2),
                        'modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                        'created': datetime.fromtimestamp(stat.st_ctime).isoformat()
                    })
                except OSError:
                    continue
        
        # Sort by modification time (newest first)
        files.sort(key=lambda x: x['modified'], reverse=True)
        return files
    
    def clear_uploads(self):
        """Clear all uploaded files"""
        try:
            count = 0
            if os.path.exists(self.upload_folder):
                for filename in os.listdir(self.upload_folder):
                    if self.is_valid_json_file(filename):
                        filepath = os.path.join(self.upload_folder, filename)
                        os.remove(filepath)
                        count += 1
            
            print(f"🗑️ Cleared {count} uploaded files")
            return {
                'success': True,
                'count': count
            }
            
        except Exception as e:
            print(f"❌ Error clearing uploads: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_file_info(self, filename):
        """Get detailed information about a specific file"""
        filepath = os.path.join(self.upload_folder, filename)
        
        if not os.path.exists(filepath):
            return None
        
        try:
            stat = os.stat(filepath)
            with open(filepath, 'r', encoding='utf-8') as f:
                json_data = json.load(f)
            
            return {
                'name': filename,
                'size': stat.st_size,
                'size_mb': round(stat.st_size / (1024 * 1024), 2),
                'modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                'created': datetime.fromtimestamp(stat.st_ctime).isoformat(),
                'content_type': json_data.get('type', 'unknown'),
                'project_id': json_data.get('project_id', 'unknown'),
                'client_email': json_data.get('client_email', 'unknown')
            }
            
        except Exception as e:
            print(f"❌ Error getting file info: {e}")
            return None
