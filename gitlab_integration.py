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
    
    def get_project_milestones(self, project_id):
        """Get list of milestones for a project"""
        try:
            response = requests.get(
                f"{self.gitlab_url}/api/v4/projects/{project_id}/milestones",
                headers=self.headers,
                params={'state': 'active', 'per_page': 100},
                timeout=10
            )
            if response.status_code == 200:
                milestones = response.json()
                return {
                    'success': True,
                    'milestones': [
                        {
                            'id': m['id'],
                            'title': m['title'],
                            'description': m.get('description', ''),
                            'state': m['state'],
                            'due_date': m.get('due_date'),
                            'web_url': m.get('web_url')
                        }
                        for m in milestones
                    ]
                }
            else:
                return {
                    'success': False,
                    'error': f'Failed to fetch milestones: {response.status_code}'
                }
        except Exception as e:
            return {
                'success': False,
                'error': f'Error fetching milestones: {str(e)}'
            }
    
    def get_project_labels(self, project_id):
        """Get list of labels for a project"""
        try:
            response = requests.get(
                f"{self.gitlab_url}/api/v4/projects/{project_id}/labels",
                headers=self.headers,
                params={'per_page': 100},
                timeout=10
            )
            if response.status_code == 200:
                labels = response.json()
                return {
                    'success': True,
                    'labels': [
                        {
                            'id': l['id'],
                            'name': l['name'],
                            'description': l.get('description', ''),
                            'color': l['color'],
                            'text_color': l.get('text_color', '#FFFFFF')
                        }
                        for l in labels
                    ]
                }
            else:
                return {
                    'success': False,
                    'error': f'Failed to fetch labels: {response.status_code}'
                }
        except Exception as e:
            return {
                'success': False,
                'error': f'Error fetching labels: {str(e)}'
            }
    
    def get_project_members(self, project_id):
        """Get list of project members who can be assigned to issues"""
        try:
            response = requests.get(
                f"{self.gitlab_url}/api/v4/projects/{project_id}/members",
                headers=self.headers,
                params={'per_page': 100},
                timeout=10
            )
            if response.status_code == 200:
                members = response.json()
                return {
                    'success': True,
                    'members': [
                        {
                            'id': m['id'],
                            'username': m['username'],
                            'name': m['name'],
                            'email': m.get('email', ''),
                            'avatar_url': m.get('avatar_url', ''),
                            'access_level': m['access_level'],
                            'access_level_name': self._get_access_level_name(m['access_level'])
                        }
                        for m in members
                        if m['access_level'] >= 20  # Reporter level or higher
                    ]
                }
            else:
                return {
                    'success': False,
                    'error': f'Failed to fetch members: {response.status_code}'
                }
        except Exception as e:
            return {
                'success': False,
                'error': f'Error fetching members: {str(e)}'
            }
    
    def _get_access_level_name(self, access_level):
        """Convert access level number to name"""
        levels = {
            10: 'Guest',
            20: 'Reporter',
            30: 'Developer',
            40: 'Maintainer',
            50: 'Owner'
        }
        return levels.get(access_level, 'Unknown')
    
    def get_all_project_data(self, project_id):
        """Get all project data: milestones, labels, and members"""
        try:
            milestones_result = self.get_project_milestones(project_id)
            labels_result = self.get_project_labels(project_id)
            members_result = self.get_project_members(project_id)
            
            return {
                'success': True,
                'milestones': milestones_result.get('milestones', []) if milestones_result['success'] else [],
                'labels': labels_result.get('labels', []) if labels_result['success'] else [],
                'members': members_result.get('members', []) if members_result['success'] else [],
                'errors': {
                    'milestones': None if milestones_result['success'] else milestones_result.get('error'),
                    'labels': None if labels_result['success'] else labels_result.get('error'),
                    'members': None if members_result['success'] else members_result.get('error')
                }
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Error fetching project data: {str(e)}'
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
    
    def create_simple_issue(self, project_id, title, description, labels=None):
        """
        Create a simple GitLab issue (for backward compatibility)
        
        Args:
            project_id (int): GitLab project ID
            title (str): Issue title
            description (str): Issue description
            labels (list): List of label names
        """
        try:
            payload = {
                'title': title[:255],  # GitLab title limit
                'description': description
            }
            
            if labels:
                payload['labels'] = ','.join(labels) if isinstance(labels, list) else str(labels)
            
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
                        'web_url': issue['web_url'],
                        'labels': labels or []
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

    def create_issue(self, project_id, issue_data, milestone_id=None, assignee_ids=None, label_names=None):
        """
        Create a single GitLab issue with enhanced mapping and multiple assignees/labels
        
        Args:
            project_id (int): GitLab project ID
            issue_data (dict): Issue data from sheet with mapping
            milestone_id (int): Optional milestone ID
            assignee_ids (list): Optional list of user IDs to assign
            label_names (list): Optional list of additional label names
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
            
            # Custom labels from sheet
            if issue_data.get('labels'):
                custom_labels = [label.strip() for label in issue_data['labels'].split(',') if label.strip()]
                labels.extend(custom_labels)
            
            # Additional labels from parameter
            if label_names:
                labels.extend(label_names)
            
            # Remove duplicates and empty labels
            labels = list(set([label for label in labels if label.strip()]))
            
            # Create issue payload
            payload = {
                'title': title,
                'description': description,
                'labels': ','.join(labels) if labels else None
            }
            
            # Add milestone if provided
            if milestone_id:
                payload['milestone_id'] = milestone_id
            
            # Add assignees if provided
            if assignee_ids:
                if len(assignee_ids) == 1:
                    payload['assignee_id'] = assignee_ids[0]
                else:
                    payload['assignee_ids'] = assignee_ids
            
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
                        'labels': labels,
                        'assignees': issue.get('assignees', []),
                        'milestone': issue.get('milestone')
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
    
    def create_issues_with_options(self, project_id, sheet_data, field_mapping, date_filter=None, 
                                 milestone_id=None, assignee_ids=None, label_names=None):
        """
        Create multiple GitLab issues from Google Sheets data with options
        
        Args:
            project_id (int): GitLab project ID
            sheet_data (list): Google Sheets data
            field_mapping (dict): Field mapping configuration
            date_filter (dict): Optional date filtering
            milestone_id (int): Optional milestone ID for all issues
            assignee_ids (list): Optional list of assignee IDs for all issues
            label_names (list): Optional list of additional labels for all issues
        """
        # Parse sheet data with mapping
        parse_result = self.parse_sheet_data_with_mapping(sheet_data, field_mapping, date_filter)
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
            result = self.create_issue(project_id, issue_data, milestone_id, assignee_ids, label_names)
            
            if result['success']:
                results['successful'] += 1
                results['created_issues'].append({
                    'row': issue_data['row_number'],
                    'title': issue_data['title'][:50] + ('...' if len(issue_data['title']) > 50 else ''),
                    'issue_url': result['issue']['url'],
                    'issue_id': result['issue']['iid'],
                    'labels': result['issue']['labels'],
                    'assignees': [a.get('name', a.get('username', '')) for a in result['issue'].get('assignees', [])],
                    'milestone': result['issue'].get('milestone', {}).get('title') if result['issue'].get('milestone') else None
                })
            else:
                results['failed'] += 1
                results['errors'].append({
                    'row': issue_data['row_number'],
                    'title': issue_data['title'][:50] + ('...' if len(issue_data['title']) > 50 else ''),
                    'error': result['error']
                })
        
        results['success'] = True
        return results
    

    def parse_sheet_data_to_issues(self, sheet_data, field_mapping=None, date_filter=None):
        """Parse Google Sheets data into GitLab issue format"""
        if not sheet_data or len(sheet_data) < 2:
            return []

        headers = sheet_data[0]
        data_rows = sheet_data[1:]
        
        # Apply date filtering if specified
        if date_filter and date_filter.get('date_column') is not None:
            filtered_rows = []
            date_col = date_filter['date_column']
            start_date = datetime.strptime(date_filter['start_date'], '%Y-%m-%d').date()
            end_date = datetime.strptime(date_filter['end_date'], '%Y-%m-%d').date()
            
            for row in data_rows:
                if date_col < len(row) and row[date_col]:
                    try:
                        # Parse date from various formats
                        row_date_str = str(row[date_col]).strip()
                        if row_date_str:
                            # Try different date formats
                            for fmt in ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%Y-%m-%d %H:%M:%S']:
                                try:
                                    row_date = datetime.strptime(row_date_str, fmt).date()
                                    if start_date <= row_date <= end_date:
                                        filtered_rows.append(row)
                                    break
                                except ValueError:
                                    continue
                    except:
                        continue
            data_rows = filtered_rows

        issues = []
        
        for row_index, row in enumerate(data_rows, start=2):  # Start at 2 since row 1 is headers
            # Use field mapping if provided, otherwise use default column mapping
            if field_mapping:
                title = row[field_mapping.get('title', 0)] if field_mapping.get('title') is not None else 'No title'
                description_parts = []
                
                # Add mapped fields to description
                for field, col_index in field_mapping.items():
                    if field != 'title' and col_index < len(row) and row[col_index]:
                        field_name = headers[col_index] if col_index < len(headers) else field
                        description_parts.append(f"**{field_name}:** {row[col_index]}")
                
                # Add unmapped columns to description
                mapped_indices = set(field_mapping.values())
                for col_index, value in enumerate(row):
                    if col_index not in mapped_indices and value:
                        col_name = headers[col_index] if col_index < len(headers) else f"Column {col_index + 1}"
                        description_parts.append(f"**{col_name}:** {value}")
                
                description = "\n".join(description_parts)
                
                # Extract other fields
                assignee = field_mapping.get('assignee')
                status = field_mapping.get('status')
                priority = field_mapping.get('priority')
                project_name = field_mapping.get('project')
                
            else:
                # Default mapping based on expected header structure
                task_desc_idx = next((i for i, h in enumerate(headers) if 'task' in h.lower() and 'description' in h.lower()), 4)
                status_idx = next((i for i, h in enumerate(headers) if 'status' in h.lower()), 5)
                project_idx = next((i for i, h in enumerate(headers) if 'project' in h.lower() and 'name' in h.lower()), 2)
                
                title = row[task_desc_idx] if task_desc_idx < len(row) else f"Task from row {row_index}"
                status = row[status_idx] if status_idx < len(row) else "Unknown"
                project_name = row[project_idx] if project_idx < len(row) else "Unknown"
                
                # Build description from all fields
                description_parts = []
                for i, (header, value) in enumerate(zip(headers, row)):
                    if value and i != task_desc_idx:  # Don't duplicate title in description
                        description_parts.append(f"**{header}:** {value}")
                description = "\n".join(description_parts)
                
                assignee = None
                priority = None

            # Generate labels
            labels = []
            
            # Status-based labels
            if status:
                status_lower = str(status).lower()
                if 'complete' in status_lower or 'done' in status_lower:
                    labels.append('completed')
                elif 'progress' in status_lower or 'working' in status_lower:
                    labels.append('in-progress')
                elif 'pending' in status_lower:
                    labels.append('pending')
                elif 'new' in status_lower or 'open' in status_lower:
                    labels.append('new')
                else:
                    labels.append(status_lower.replace(' ', '-'))
            
            # Priority-based labels
            if priority:
                priority_lower = str(priority).lower()
                if 'high' in priority_lower or 'urgent' in priority_lower:
                    labels.append('high-priority')
                elif 'low' in priority_lower:
                    labels.append('low-priority')
                elif 'medium' in priority_lower:
                    labels.append('medium-priority')
            
            # Project-based labels
            if project_name and str(project_name).lower() != 'unknown':
                project_label = f"project:{str(project_name).replace(' ', '-').lower()}"
                labels.append(project_label)
            
            # Add source label
            labels.append('google-sheets')
            
            issues.append({
                'title': str(title).strip(),
                'description': description,
                'labels': labels,
                'assignee': assignee,
                'row': row_index
            })
        
        return issues


    def create_issues_from_sheet(self, project_id, sheet_data, batch_size=5):
        """
        Create multiple GitLab issues from Google Sheets data
        
        Args:
            project_id (int): GitLab project ID
            sheet_data (list): Google Sheets data
            batch_size (int): Number of issues to create at once
        """
        # Parse sheet data
        issues_data = self.parse_sheet_data_to_issues(sheet_data)
        if not issues_data:
            return {
                'success': False,
                'error': 'No valid issues found in sheet data'
            }
        
        results = {
            'total_processed': len(issues_data),
            'successful': 0,
            'failed': 0,
            'created_issues': [],
            'errors': []
        }
        
        for issue_data in issues_data:
            # Create issue using the simple create_issue method
            result = self.create_simple_issue(
                project_id=project_id,
                title=issue_data['title'],
                description=issue_data['description'],
                labels=issue_data['labels']
            )
            
            if result['success']:
                results['successful'] += 1
                results['created_issues'].append({
                    'row': issue_data['row'],
                    'title': issue_data['title'][:50] + ('...' if len(issue_data['title']) > 50 else ''),
                    'issue_url': result['issue']['web_url'],
                    'issue_id': result['issue']['iid'],
                    'labels': result['issue']['labels']
                })
            else:
                results['failed'] += 1
                results['errors'].append({
                    'row': issue_data['row'],
                    'title': issue_data['title'][:50] + ('...' if len(issue_data['title']) > 50 else ''),
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
