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
    
    def analyze_sheet_columns(self, sheet_data):
        """
        Analyze sheet columns and suggest mappings for GitLab fields
        
        Returns column analysis and mapping suggestions
        """
        if not sheet_data or len(sheet_data) < 1:
            return {'success': False, 'error': 'No data to analyze'}
        
        headers = sheet_data[0]
        
        # Define common field patterns for auto-detection
        field_patterns = {
            'title': ['task description', 'description', 'task', 'title', 'issue', 'work item'],
            'assignee': ['assignee', 'assigned to', 'owner', 'developer', 'responsible'],
            'status': ['status', 'state', 'progress', 'stage'],
            'priority': ['priority', 'importance', 'severity'],
            'labels': ['labels', 'tags', 'category', 'type'],
            'due_date': ['due date', 'end date', 'deadline', 'target date', 'actual end date'],
            'start_date': ['start date', 'begin date', 'actual start date', 'created date'],
            'estimation': ['estimation', 'planned', 'hours', 'time', 'effort', 'planned estimation'],
            'project': ['project', 'project name', 'specific project name'],
            'git_id': ['git id', 'id', 'reference', 'ticket id'],
            'milestone': ['milestone', 'version', 'release', 'sprint']
        }
        
        # Analyze each header
        column_analysis = []
        suggestions = {}
        
        for idx, header in enumerate(headers):
            header_lower = header.lower().strip()
            
            analysis = {
                'index': idx,
                'header': header,
                'suggestions': [],
                'confidence': 0
            }
            
            # Check against patterns
            for field_type, patterns in field_patterns.items():
                for pattern in patterns:
                    if pattern in header_lower:
                        confidence = 100 if pattern == header_lower else 80
                        analysis['suggestions'].append({
                            'field': field_type,
                            'confidence': confidence,
                            'reason': f"Matches pattern '{pattern}'"
                        })
                        
                        # Keep highest confidence suggestion
                        if confidence > analysis['confidence']:
                            analysis['confidence'] = confidence
                            if field_type not in suggestions or confidence > suggestions[field_type]['confidence']:
                                suggestions[field_type] = {
                                    'index': idx,
                                    'header': header,
                                    'confidence': confidence
                                }
            
            # If no patterns matched, suggest based on position and content
            if not analysis['suggestions']:
                if idx == 0:
                    analysis['suggestions'].append({
                        'field': 'title',
                        'confidence': 30,
                        'reason': 'First column (common for titles)'
                    })
                elif 'date' in header_lower:
                    analysis['suggestions'].append({
                        'field': 'due_date',
                        'confidence': 50,
                        'reason': 'Contains "date"'
                    })
            
            column_analysis.append(analysis)
        
        return {
            'success': True,
            'columns': column_analysis,
            'suggestions': suggestions,
            'total_columns': len(headers)
        }
    
    def filter_data_by_date_range(self, sheet_data, date_column_index, start_date, end_date):
        """
        Filter sheet data by date range
        
        Args:
            sheet_data: Full sheet data including headers
            date_column_index: Index of the date column to filter by
            start_date: Start date (YYYY-MM-DD format)
            end_date: End date (YYYY-MM-DD format)
        """
        if not sheet_data or len(sheet_data) < 2:
            return {'success': False, 'error': 'No data to filter'}
        
        if date_column_index < 0 or date_column_index >= len(sheet_data[0]):
            return {'success': False, 'error': 'Invalid date column index'}
        
        try:
            from datetime import datetime
            start_dt = datetime.strptime(start_date, '%Y-%m-%d')
            end_dt = datetime.strptime(end_date, '%Y-%m-%d')
            
            headers = sheet_data[0]
            filtered_rows = [headers]  # Keep headers
            
            for row in sheet_data[1:]:
                if len(row) > date_column_index:
                    date_value = row[date_column_index].strip()
                    if date_value:
                        try:
                            # Try different date formats
                            row_date = None
                            for date_format in ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%Y-%m-%d %H:%M:%S']:
                                try:
                                    row_date = datetime.strptime(date_value, date_format)
                                    break
                                except ValueError:
                                    continue
                            
                            if row_date and start_dt <= row_date <= end_dt:
                                filtered_rows.append(row)
                        except ValueError:
                            # If date parsing fails, include the row
                            continue
            
            return {
                'success': True,
                'filtered_data': filtered_rows,
                'original_count': len(sheet_data) - 1,
                'filtered_count': len(filtered_rows) - 1
            }
            
        except Exception as e:
            return {'success': False, 'error': f'Date filtering error: {str(e)}'}
    
    def parse_sheet_data_with_mapping(self, sheet_data, field_mapping, date_filter=None):
        """
        Parse Google Sheets data with custom field mapping
        
        Args:
            sheet_data: Sheet data including headers
            field_mapping: Dict mapping GitLab fields to column indices
            date_filter: Optional dict with date_column, start_date, end_date
        """
        try:
            # Apply date filter if specified
            if date_filter:
                filter_result = self.filter_data_by_date_range(
                    sheet_data, 
                    date_filter['date_column'], 
                    date_filter['start_date'], 
                    date_filter['end_date']
                )
                if filter_result['success']:
                    sheet_data = filter_result['filtered_data']
                else:
                    return filter_result
            
            if not sheet_data or len(sheet_data) < 2:
                return {'success': False, 'error': 'No data to process after filtering'}
            
            headers = sheet_data[0]
            rows = sheet_data[1:]
            
            issues = []
            for row_idx, row in enumerate(rows, start=2):
                try:
                    issue_data = {
                        'title': self._get_mapped_value(row, field_mapping, 'title', 'Untitled Task'),
                        'description_parts': {},
                        'assignee': self._get_mapped_value(row, field_mapping, 'assignee'),
                        'status': self._get_mapped_value(row, field_mapping, 'status'),
                        'priority': self._get_mapped_value(row, field_mapping, 'priority'),
                        'labels': self._get_mapped_value(row, field_mapping, 'labels'),
                        'due_date': self._get_mapped_value(row, field_mapping, 'due_date'),
                        'start_date': self._get_mapped_value(row, field_mapping, 'start_date'),
                        'estimation': self._get_mapped_value(row, field_mapping, 'estimation'),
                        'project': self._get_mapped_value(row, field_mapping, 'project'),
                        'git_id': self._get_mapped_value(row, field_mapping, 'git_id'),
                        'milestone': self._get_mapped_value(row, field_mapping, 'milestone'),
                        'row_number': row_idx
                    }
                    
                    # Add all unmapped fields to description
                    for idx, header in enumerate(headers):
                        if idx not in field_mapping.values() and idx < len(row) and row[idx]:
                            issue_data['description_parts'][header] = row[idx]
                    
                    # Skip rows without title
                    if not issue_data['title'] or issue_data['title'] == 'Untitled Task':
                        continue
                    
                    issues.append(issue_data)
                    
                except Exception as e:
                    logger.warning(f"Error parsing row {row_idx}: {str(e)}")
                    continue
            
            return {'success': True, 'issues': issues}
            
        except Exception as e:
            return {'success': False, 'error': f'Parsing error: {str(e)}'}
    
    def _get_mapped_value(self, row, field_mapping, field_name, default=''):
        """Get value from row using field mapping"""
        try:
            index = field_mapping.get(field_name, -1)
            if index >= 0 and index < len(row):
                return row[index].strip() if row[index] else default
            return default
        except (IndexError, AttributeError):
            return default
    
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
        Create a single GitLab issue with enhanced mapping
        
        Args:
            project_id (int): GitLab project ID
            issue_data (dict): Issue data from sheet with mapping
        """
        try:
            # Prepare issue title
            title = issue_data['title'][:255]  # GitLab title limit
            
            # Prepare issue description
            description_parts = []
            
            # Add mapped fields to description
            if issue_data.get('project'):
                description_parts.append(f"**Project:** {issue_data['project']}")
            
            if issue_data.get('git_id'):
                description_parts.append(f"**Reference ID:** {issue_data['git_id']}")
            
            if issue_data.get('start_date'):
                description_parts.append(f"**Start Date:** {issue_data['start_date']}")
            
            if issue_data.get('due_date'):
                description_parts.append(f"**Due Date:** {issue_data['due_date']}")
            
            if issue_data.get('estimation'):
                description_parts.append(f"**Estimated Time:** {issue_data['estimation']}")
            
            if issue_data.get('assignee'):
                description_parts.append(f"**Assignee:** {issue_data['assignee']}")
            
            if issue_data.get('priority'):
                description_parts.append(f"**Priority:** {issue_data['priority']}")
            
            # Add other unmapped fields
            if issue_data.get('description_parts'):
                description_parts.append("\n**Additional Information:**")
                for field_name, field_value in issue_data['description_parts'].items():
                    if field_value:
                        description_parts.append(f"**{field_name}:** {field_value}")
            
            description_parts.append(f"\n**Source:** Row {issue_data['row_number']} from Google Sheets")
            description_parts.append(f"**Created:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            
            description = "\n\n".join(description_parts)
            
            # Prepare labels
            labels = []
            
            # Status-based labels
            status_lower = issue_data.get('status', '').lower()
            if 'complete' in status_lower or 'done' in status_lower or 'closed' in status_lower:
                labels.append('completed')
            elif 'progress' in status_lower or 'working' in status_lower or 'active' in status_lower:
                labels.append('in-progress')
            elif 'pending' in status_lower or 'waiting' in status_lower:
                labels.append('pending')
            elif 'new' in status_lower or 'open' in status_lower:
                labels.append('new')
            
            # Priority-based labels
            priority_lower = issue_data.get('priority', '').lower()
            if 'high' in priority_lower or 'urgent' in priority_lower:
                labels.append('high-priority')
            elif 'low' in priority_lower:
                labels.append('low-priority')
            elif 'medium' in priority_lower:
                labels.append('medium-priority')
            
            # Project-based labels
            if issue_data.get('project'):
                project_label = issue_data['project'].replace(' ', '-').lower()[:50]  # GitLab label limit
                labels.append(f"project:{project_label}")
            
            # Custom labels
            if issue_data.get('labels'):
                custom_labels = [label.strip() for label in issue_data['labels'].split(',') if label.strip()]
                labels.extend(custom_labels)
            
            # Create issue payload
            payload = {
                'title': title,
                'description': description,
                'labels': ','.join(labels) if labels else None
            }
            
            # Add assignee if provided and valid
            if issue_data.get('assignee'):
                # For now, we'll add assignee info to description
                # GitLab API requires user ID for assignee, not username
                pass
            
            # Add milestone if provided
            if issue_data.get('milestone'):
                # Would need milestone ID, for now add to description
                pass
            
            # Add due date if provided and valid
            if issue_data.get('due_date'):
                try:
                    # Parse and format due date for GitLab
                    from datetime import datetime
                    for date_format in ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y']:
                        try:
                            due_dt = datetime.strptime(issue_data['due_date'], date_format)
                            payload['due_date'] = due_dt.strftime('%Y-%m-%d')
                            break
                        except ValueError:
                            continue
                except:
                    pass
            
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
                        'url': issue['web_url'],
                        'labels': labels
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
