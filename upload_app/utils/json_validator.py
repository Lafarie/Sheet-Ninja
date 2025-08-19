"""
JSON validation utilities for Google Sheets API service account files
Validates structure and required fields for service accounts
"""

class JSONValidator:
    """Validates JSON content for Google Service Account credentials"""
    
    def __init__(self):
        self.required_service_account_fields = [
            'type',
            'project_id',
            'private_key_id',
            'private_key',
            'client_email',
            'client_id',
            'auth_uri',
            'token_uri'
        ]
    
    def validate_service_account(self, json_data):
        """Validate Google Service Account JSON structure"""
        try:
            # Check if data is a dictionary
            if not isinstance(json_data, dict):
                return {
                    'valid': False,
                    'error': 'JSON content must be an object/dictionary'
                }
            
            # Check for required fields
            missing_fields = []
            for field in self.required_service_account_fields:
                if field not in json_data:
                    missing_fields.append(field)
            
            if missing_fields:
                return {
                    'valid': False,
                    'error': f'Missing required service account fields: {", ".join(missing_fields)}'
                }
            
            # Validate specific field values
            validation_errors = []
            
            # Check type field
            if json_data.get('type') != 'service_account':
                validation_errors.append('Type must be "service_account"')
            
            # Check email format
            client_email = json_data.get('client_email', '')
            if '@' not in client_email or not client_email.endswith('.iam.gserviceaccount.com'):
                validation_errors.append('Invalid client_email format for service account')
            
            # Check private key format
            private_key = json_data.get('private_key', '')
            if not private_key.startswith('-----BEGIN PRIVATE KEY-----'):
                validation_errors.append('Invalid private_key format')
            
            # Check URI fields
            auth_uri = json_data.get('auth_uri', '')
            token_uri = json_data.get('token_uri', '')
            
            if not auth_uri.startswith('https://'):
                validation_errors.append('auth_uri must be a valid HTTPS URL')
            
            if not token_uri.startswith('https://'):
                validation_errors.append('token_uri must be a valid HTTPS URL')
            
            # Check project_id format
            project_id = json_data.get('project_id', '')
            if not project_id or len(project_id) < 3:
                validation_errors.append('project_id must be a valid Google Cloud project ID')
            
            if validation_errors:
                return {
                    'valid': False,
                    'error': '; '.join(validation_errors)
                }
            
            return {
                'valid': True,
                'message': 'Valid Google Service Account JSON',
                'details': {
                    'project_id': json_data.get('project_id'),
                    'client_email': json_data.get('client_email'),
                    'client_id': json_data.get('client_id')
                }
            }
            
        except Exception as e:
            return {
                'valid': False,
                'error': f'Validation error: {str(e)}'
            }
    
    def validate_json_syntax(self, json_string):
        """Validate JSON syntax without checking service account structure"""
        try:
            import json
            json.loads(json_string)
            return {
                'valid': True,
                'message': 'Valid JSON syntax'
            }
        except json.JSONDecodeError as e:
            return {
                'valid': False,
                'error': f'Invalid JSON syntax: {str(e)}'
            }
    
    def get_validation_summary(self, json_data):
        """Get a detailed validation summary"""
        summary = {
            'total_fields': len(json_data) if isinstance(json_data, dict) else 0,
            'required_fields_present': 0,
            'required_fields_missing': [],
            'additional_fields': [],
            'field_types': {}
        }
        
        if not isinstance(json_data, dict):
            return summary
        
        # Check required fields
        for field in self.required_service_account_fields:
            if field in json_data:
                summary['required_fields_present'] += 1
                summary['field_types'][field] = type(json_data[field]).__name__
            else:
                summary['required_fields_missing'].append(field)
        
        # Find additional fields
        for field in json_data:
            if field not in self.required_service_account_fields:
                summary['additional_fields'].append(field)
                summary['field_types'][field] = type(json_data[field]).__name__
        
        return summary
