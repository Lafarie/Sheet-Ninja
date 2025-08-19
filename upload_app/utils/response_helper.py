"""
Response helper utilities for consistent API responses
Provides standardized success and error responses
"""

from flask import jsonify
from datetime import datetime

class ResponseHelper:
    """Helper class for creating consistent API responses"""
    
    def __init__(self):
        self.default_headers = {
            'Content-Type': 'application/json'
        }
    
    def success(self, message, data=None, status_code=200):
        """Create a success response"""
        response_data = {
            'success': True,
            'message': message,
            'timestamp': datetime.now().isoformat()
        }
        
        if data is not None:
            response_data['data'] = data
        
        return jsonify(response_data), status_code
    
    def error(self, message, status_code=400, error_code=None):
        """Create an error response"""
        response_data = {
            'success': False,
            'error': message,
            'timestamp': datetime.now().isoformat()
        }
        
        if error_code:
            response_data['error_code'] = error_code
        
        return jsonify(response_data), status_code
    
    def validation_error(self, field_errors):
        """Create a validation error response with field-specific errors"""
        return self.error(
            'Validation failed',
            400,
            {
                'type': 'validation_error',
                'fields': field_errors
            }
        )
    
    def file_error(self, message, file_info=None):
        """Create a file-specific error response"""
        error_data = {
            'type': 'file_error',
            'message': message
        }
        
        if file_info:
            error_data['file_info'] = file_info
        
        return self.error(message, 400, error_data)
    
    def server_error(self, message='Internal server error'):
        """Create a server error response"""
        return self.error(message, 500, {'type': 'server_error'})
    
    def not_found(self, resource='Resource'):
        """Create a not found response"""
        return self.error(f'{resource} not found', 404, {'type': 'not_found'})
    
    def unauthorized(self, message='Unauthorized access'):
        """Create an unauthorized response"""
        return self.error(message, 401, {'type': 'unauthorized'})
    
    def forbidden(self, message='Access forbidden'):
        """Create a forbidden response"""
        return self.error(message, 403, {'type': 'forbidden'})
    
    def rate_limited(self, message='Rate limit exceeded'):
        """Create a rate limit response"""
        return self.error(message, 429, {'type': 'rate_limited'})
    
    def paginated_success(self, message, items, page=1, per_page=10, total=None):
        """Create a paginated success response"""
        if total is None:
            total = len(items)
        
        total_pages = (total + per_page - 1) // per_page
        
        data = {
            'items': items,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'total_pages': total_pages,
                'has_next': page < total_pages,
                'has_prev': page > 1
            }
        }
        
        return self.success(message, data)
    
    def file_upload_success(self, filename, file_info=None):
        """Create a file upload success response"""
        data = {
            'filename': filename,
            'upload_time': datetime.now().isoformat()
        }
        
        if file_info:
            data.update(file_info)
        
        return self.success('File uploaded successfully', data, 201)
