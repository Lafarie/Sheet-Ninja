"""
GitLab Integration for creating issues/tasks from Google Sheets data
"""

import requests
import json
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class GitLabIntegration:
    def __init__(self, gitlab_url, access_token):
        """
        Initialize GitLab integration
        
        Args:
            gitlab_url (str): GitLab instance URL (e.g., 'https://gitlab.com')
            access_token (str): GitLab personal access token
        """
        self.gitlab_url = gitlab_url.rstrip('/')
        self.access_token = access_token
        self.headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
    
    def test_connection(self):
        """Test GitLab API connection"""
        try:
            response = requests.get(
                f"{self.gitlab_url}/api/v4/user",
                headers=self.headers,
                timeout=10
            )
            if response.status_code == 200:
                user_data = response.json()
                return {
                    'success': True,
                    'user': user_data.get('name', 'Unknown'),
                    'username': user_data.get('username', 'Unknown')
                }
            else:
                return {
                    'success': False,
                    'error': f'Authentication failed: {response.status_code}'
                }
        except Exception as e:
            return {
                'success': False,
                'error': f'Connection error: {str(e)}'
            }
    
    def get_projects(self):
        """Get list of GitLab projects"""
        try:
            response = requests.get(
                f"{self.gitlab_url}/api/v4/projects",
                headers=self.headers,
                params={'membership': True, 'per_page': 100},
                timeout=10
            )
            if response.status_code == 200:
                projects = response.json()
                return {
                    'success': True,
                    'projects': [
                        {
                            'id': p['id'],
                            'name': p['name'],
                            'path': p['path_with_namespace'],
                            'url': p['web_url']
                        }
                        for p in projects
                    ]
                }
            else:
                return {
                    'success': False,
                    'error': f'Failed to fetch projects: {response.status_code}'
                }
        except Exception as e:
            return {
                'success': False,
                'error': f'Error fetching projects: {str(e)}'
            }
    
    def parse_sheet_data_to_issues(self, sheet_data):
        """
        Parse Google Sheets data into GitLab issue format
        
        Expected headers: Date, GIT ID, Project Name, Specific Project Name, 
                         Task Description, Status, Actual Start Date, 
                         Planned Estimation (H), Actual Spent Time (H), Actual End Date
        """
        if not sheet_data or len(sheet_data) < 2:
            return {'success': False, 'error': 'No data to process'}
        
        headers = sheet_data[0]
        rows = sheet_data[1:]
        
        # Map headers to indices
        header_map = {header.strip().lower(): idx for idx, header in enumerate(headers)}
        
        issues = []
        for row_idx, row in enumerate(rows, start=2):  # Start from 2 (row 1 is headers)
            try:
                # Extract data from row
                issue_data = {
                    'date': self._get_cell_value(row, header_map, 'date'),
                    'git_id': self._get_cell_value(row, header_map, 'git id'),
                    'project_name': self._get_cell_value(row, header_map, 'project name'),
                    'specific_project_name': self._get_cell_value(row, header_map, 'specific project name'),
                    'task_description': self._get_cell_value(row, header_map, 'task description'),
                    'status': self._get_cell_value(row, header_map, 'status'),
                    'start_date': self._get_cell_value(row, header_map, 'actual start date'),
                    'planned_hours': self._get_cell_value(row, header_map, 'planned estimation (h)'),
                    'actual_hours': self._get_cell_value(row, header_map, 'actual spent time (h)'),
                    'end_date': self._get_cell_value(row, header_map, 'actual end date'),
                    'row_number': row_idx
                }
                
                # Skip rows without essential data
                if not issue_data['task_description']:
                    continue
                
                issues.append(issue_data)
                
            except Exception as e:
                logger.warning(f"Error parsing row {row_idx}: {str(e)}")
                continue
        
        return {'success': True, 'issues': issues}
    
    def _get_cell_value(self, row, header_map, header_key):
        """Safely get cell value from row"""
        try:
            index = header_map.get(header_key, -1)
            if index >= 0 and index < len(row):
                return row[index].strip() if row[index] else ''
            return ''
        except (IndexError, AttributeError):
            return ''
    
    def create_issue(self, project_id, issue_data):
        """
        Create a single GitLab issue
        
        Args:
            project_id (int): GitLab project ID
            issue_data (dict): Issue data from sheet
        """
        try:
            # Prepare issue title
            title = issue_data['task_description'][:255]  # GitLab title limit
            
            # Prepare issue description
            description_parts = []
            
            if issue_data['specific_project_name']:
                description_parts.append(f"**Specific Project:** {issue_data['specific_project_name']}")
            
            if issue_data['git_id']:
                description_parts.append(f"**Git ID:** {issue_data['git_id']}")
            
            if issue_data['start_date']:
                description_parts.append(f"**Start Date:** {issue_data['start_date']}")
            
            if issue_data['end_date']:
                description_parts.append(f"**End Date:** {issue_data['end_date']}")
            
            if issue_data['planned_hours']:
                description_parts.append(f"**Planned Time:** {issue_data['planned_hours']} hours")
            
            if issue_data['actual_hours']:
                description_parts.append(f"**Actual Time:** {issue_data['actual_hours']} hours")
            
            if issue_data['status']:
                description_parts.append(f"**Status:** {issue_data['status']}")
            
            description_parts.append(f"\n**Original Row:** {issue_data['row_number']}")
            description_parts.append(f"**Created from Google Sheets on:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            
            description = "\n\n".join(description_parts)
            
            # Prepare labels based on status
            labels = []
            status_lower = issue_data['status'].lower() if issue_data['status'] else ''
            
            if 'complete' in status_lower or 'done' in status_lower:
                labels.append('completed')
            elif 'progress' in status_lower or 'working' in status_lower:
                labels.append('in-progress')
            elif 'pending' in status_lower or 'waiting' in status_lower:
                labels.append('pending')
            
            if issue_data['project_name']:
                labels.append(f"project:{issue_data['project_name'].replace(' ', '-').lower()}")
            
            # Create issue payload
            payload = {
                'title': title,
                'description': description,
                'labels': ','.join(labels) if labels else None
            }
            
            # Make API request
            response = requests.post(
                f"{self.gitlab_url}/api/v4/projects/{project_id}/issues",
                headers=self.headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 201:
                issue = response.json()
                return {
                    'success': True,
                    'issue': {
                        'id': issue['id'],
                        'iid': issue['iid'],
                        'title': issue['title'],
                        'url': issue['web_url']
                    }
                }
            else:
                return {
                    'success': False,
                    'error': f'Failed to create issue: {response.status_code} - {response.text}'
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': f'Error creating issue: {str(e)}'
            }
    
    def create_issues_from_sheet(self, project_id, sheet_data, batch_size=5):
        """
        Create multiple GitLab issues from Google Sheets data
        
        Args:
            project_id (int): GitLab project ID
            sheet_data (list): Google Sheets data
            batch_size (int): Number of issues to create at once
        """
        # Parse sheet data
        parse_result = self.parse_sheet_data_to_issues(sheet_data)
        if not parse_result['success']:
            return parse_result
        
        issues_data = parse_result['issues']
        results = {
            'total_processed': len(issues_data),
            'successful': 0,
            'failed': 0,
            'created_issues': [],
            'errors': []
        }
        
        for issue_data in issues_data:
            result = self.create_issue(project_id, issue_data)
            
            if result['success']:
                results['successful'] += 1
                results['created_issues'].append({
                    'row': issue_data['row_number'],
                    'title': issue_data['task_description'][:50] + '...',
                    'issue_url': result['issue']['url'],
                    'issue_id': result['issue']['iid']
                })
            else:
                results['failed'] += 1
                results['errors'].append({
                    'row': issue_data['row_number'],
                    'title': issue_data['task_description'][:50] + '...',
                    'error': result['error']
                })
        
        results['success'] = True
        return results
    
    def get_project_issues(self, project_id, state='opened'):
        """Get existing issues from a GitLab project"""
        try:
            response = requests.get(
                f"{self.gitlab_url}/api/v4/projects/{project_id}/issues",
                headers=self.headers,
                params={'state': state, 'per_page': 100},
                timeout=10
            )
            
            if response.status_code == 200:
                issues = response.json()
                return {
                    'success': True,
                    'issues': [
                        {
                            'id': issue['id'],
                            'iid': issue['iid'],
                            'title': issue['title'],
                            'state': issue['state'],
                            'url': issue['web_url'],
                            'created_at': issue['created_at'],
                            'labels': issue['labels']
                        }
                        for issue in issues
                    ]
                }
            else:
                return {
                    'success': False,
                    'error': f'Failed to fetch issues: {response.status_code}'
                }
        except Exception as e:
            return {
                'success': False,
                'error': f'Error fetching issues: {str(e)}'
            }


def validate_gitlab_config(gitlab_url, access_token):
    """Validate GitLab configuration"""
    if not gitlab_url or not access_token:
        return {
            'success': False,
            'error': 'GitLab URL and access token are required'
        }
    
    if not gitlab_url.startswith(('http://', 'https://')):
        return {
            'success': False,
            'error': 'GitLab URL must start with http:// or https://'
        }
    
    return {'success': True}


def get_gitlab_setup_instructions():
    """Get instructions for setting up GitLab integration"""
    return {
        'steps': [
            {
                'step': 1,
                'title': 'Get GitLab Personal Access Token',
                'description': 'Go to GitLab → Settings → Access Tokens',
                'details': [
                    'Create a new token with "api" scope',
                    'Copy the token (you won\'t see it again)',
                    'Keep it secure'
                ]
            },
            {
                'step': 2,
                'title': 'Identify GitLab URL',
                'description': 'Use your GitLab instance URL',
                'details': [
                    'For GitLab.com: https://gitlab.com',
                    'For self-hosted: https://your-gitlab-domain.com',
                    'Include protocol (https://)'
                ]
            },
            {
                'step': 3,
                'title': 'Select Target Project',
                'description': 'Choose which project to create issues in',
                'details': [
                    'Must have Developer or higher access',
                    'Issues must be enabled in project settings',
                    'Can be any project you have access to'
                ]
            }
        ],
        'required_permissions': [
            'Developer role or higher in target project',
            'Issues feature enabled in project',
            'Personal access token with "api" scope'
        ]
    }
