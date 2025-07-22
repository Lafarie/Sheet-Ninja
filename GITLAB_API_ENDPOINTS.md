# GitLab API Endpoints Documentation

This document provides comprehensive documentation for all GitLab API endpoints used in the GitLab ↔ Google Sheets sync scripts.

## Table of Contents
- [Authentication](#authentication)
- [Base Configuration](#base-configuration)
- [API Endpoints](#api-endpoints)
  - [Get Project Issues](#get-project-issues)
  - [Create Issue](#create-issue)
  - [Update Issue](#update-issue)
  - [Add Time Tracking](#add-time-tracking)
- [Quick Actions Reference](#quick-actions-reference)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)

## Authentication

All GitLab API requests require authentication using a **Private Token**.

```http
Headers:
PRIVATE-TOKEN: your-gitlab-token-here
```

**Setup:**
1. Go to your GitLab instance → User Settings → Access Tokens
2. Create a new personal access token with `api` scope
3. Add the token to your `config.py` file

## Base Configuration

```python
# From config.py
GITLAB_URL = "https://sourcecontrol.hsenidmobile.com/"
PROJECT_ID = "65"
GITLAB_TOKEN = "your-token-here"
```

## API Endpoints

### Get Project Issues

**Endpoint:** `GET /projects/{id}/issues`

**Purpose:** Retrieve all issues from a specific GitLab project.

**URL Structure:**
```
{GITLAB_URL}/projects/{PROJECT_ID}/issues
```

**Example Request:**
```http
GET https://sourcecontrol.hsenidmobile.com/projects/65/issues
Headers:
  PRIVATE-TOKEN: your-gitlab-token-here
```

**Response Format:**
```json
[
  {
    "id": 123,
    "iid": 1,
    "title": "Create a Script to fetch data",
    "description": "Project details and requirements",
    "state": "opened",
    "created_at": "2025-01-17T10:00:00.000Z",
    "updated_at": "2025-01-17T12:00:00.000Z",
    "assignee": {
      "username": "farhad.l"
    },
    "milestone": {
      "title": "Sprint 1"
    },
    "labels": ["task"]
  }
]
```

**Usage in Code:**
```python
# From gitlab_to_sheets.py
def get_gitlab_issues(self):
    url = f"{config.GITLAB_URL}/projects/{config.PROJECT_ID}/issues"
    headers = {"PRIVATE-TOKEN": config.GITLAB_TOKEN}
    response = requests.get(url, headers=headers, timeout=30)
```

---

### Create Issue

**Endpoint:** `POST /projects/{id}/issues`

**Purpose:** Create a new issue in the GitLab project with automatic quick actions.

**URL Structure:**
```
{GITLAB_URL}/projects/{PROJECT_ID}/issues
```

**Required Parameters:**
- `title` (string) - Issue title
- `description` (string) - Issue description with quick actions

**Example Request:**
```http
POST https://sourcecontrol.hsenidmobile.com/projects/65/issues
Headers:
  PRIVATE-TOKEN: your-gitlab-token-here
Content-Type: application/x-www-form-urlencoded

title=Create a Script to fetch data
description=**Project:** Retailer%0A**Specific Project:** Support Service%0A**Main Task:** Main Task%0A**Sub Task:** Create a Script to fetch data%0A%0A/assign @farhad.l@appigo.co%0A/estimate 8h%0A/milestone %milestone-name%0A/label ~task
```

**Example Response:**
```json
{
  "id": 456,
  "iid": 2,
  "title": "Create a Script to fetch data",
  "description": "Project details with quick actions",
  "state": "opened",
  "web_url": "https://sourcecontrol.hsenidmobile.com/project/-/issues/2"
}
```

**Quick Actions Applied Automatically:**
- `/assign @farhad.l@appigo.co` - Assigns the issue
- `/estimate 8h` - Sets time estimation
- `/milestone %milestone-name` - Sets milestone
- `/label ~task` - Adds label

**Usage in Code:**
```python
# From sheets_to_gitlab.py
def create_gitlab_issue(self, title, description="", project_name="", planned_estimation=""):
    url = f"{config.GITLAB_URL}/projects/{config.PROJECT_ID}/issues"
    headers = {"PRIVATE-TOKEN": config.GITLAB_TOKEN}
    
    data = {
        "title": title,
        "description": full_description  # Includes quick actions
    }
    
    response = requests.post(url, headers=headers, data=data, timeout=30)
```

---

### Update Issue

**Endpoint:** `PUT /projects/{id}/issues/{issue_iid}`

**Purpose:** Update an existing issue, primarily used to close completed issues.

**URL Structure:**
```
{GITLAB_URL}/projects/{PROJECT_ID}/issues/{issue_iid}
```

**Parameters:**
- `state_event` (string) - Action to perform: `"close"` or `"reopen"`

**Example Request:**
```http
PUT https://sourcecontrol.hsenidmobile.com/projects/65/issues/2
Headers:
  PRIVATE-TOKEN: your-gitlab-token-here
Content-Type: application/x-www-form-urlencoded

state_event=close
```

**Example Response:**
```json
{
  "id": 456,
  "iid": 2,
  "title": "Create a Script to fetch data",
  "state": "closed",
  "closed_at": "2025-01-17T15:30:00.000Z"
}
```

**Usage in Code:**
```python
# From sheets_to_gitlab.py
def close_gitlab_issue(self, issue_id):
    url = f"{config.GITLAB_URL}/projects/{config.PROJECT_ID}/issues/{issue_id}"
    headers = {"PRIVATE-TOKEN": config.GITLAB_TOKEN}
    data = {"state_event": "close"}
    
    response = requests.put(url, headers=headers, data=data, timeout=30)
```

**Triggers:**
- When Google Sheets status column = "Completed"

---

### Add Time Tracking

**Endpoint:** `POST /projects/{id}/issues/{issue_iid}/add_spent_time`

**Purpose:** Add time spent on an issue for time tracking purposes.

**URL Structure:**
```
{GITLAB_URL}/projects/{PROJECT_ID}/issues/{issue_iid}/add_spent_time
```

**Parameters:**
- `duration` (string) - Time duration (e.g., "8h", "2d", "30m")
- `comment` (string) - Optional comment about the time entry

**Example Request:**
```http
POST https://sourcecontrol.hsenidmobile.com/projects/65/issues/2/add_spent_time
Headers:
  PRIVATE-TOKEN: your-gitlab-token-here
Content-Type: application/x-www-form-urlencoded

duration=8h
comment=Time logged from Google Sheets: 8 hours
```

**Example Response:**
```json
{
  "human_time_estimate": "8h",
  "human_total_time_spent": "8h",
  "time_estimate": 28800,
  "total_time_spent": 28800
}
```

**Usage in Code:**
```python
# From sheets_to_gitlab.py
def add_time_to_gitlab(self, issue_id, hours):
    url = f"{config.GITLAB_URL}/projects/{config.PROJECT_ID}/issues/{issue_id}/add_spent_time"
    headers = {"PRIVATE-TOKEN": config.GITLAB_TOKEN}
    data = {
        "duration": f"{hours}h",
        "comment": f"Time logged from Google Sheets: {hours} hours"
    }
    
    response = requests.post(url, headers=headers, data=data, timeout=30)
```

**Data Source:**
- Time values come from "Actual Estimation (H)" column in Google Sheets

## Quick Actions Reference

When creating issues, the following quick actions are automatically applied:

| Quick Action | Purpose | Configurable In |
|-------------|---------|-----------------|
| `/assign @username` | Assigns issue to user | `config.DEFAULT_ASSIGNEE` |
| `/estimate Xh` | Sets time estimation | `config.DEFAULT_ESTIMATE` or from Planned Estimation column |
| `/milestone %name` | Sets milestone | `config.DEFAULT_MILESTONE` |
| `/due YYYY-MM-DD` | Sets due date | `config.DEFAULT_DUE_DATE` |
| `/label ~labelname` | Adds label | `config.DEFAULT_LABEL` |

**Configuration Example:**
```python
# In config.py
DEFAULT_ASSIGNEE = "@farhad.l@appigo.co"
DEFAULT_ESTIMATE = "8h"
DEFAULT_MILESTONE = "%milestone-name"
DEFAULT_DUE_DATE = ""
DEFAULT_LABEL = "~task"
```

## Error Handling

All API calls include comprehensive error handling:

**Common Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Project or issue not found
- `422 Unprocessable Entity` - Invalid data format

**Error Handling Pattern:**
```python
try:
    response = requests.post(url, headers=headers, data=data, timeout=30)
    if response.status_code == 201:  # or 200
        # Success handling
        return response.json()
    else:
        print(f"❌ API Error: {response.status_code} - {response.text}")
        return None
except Exception as e:
    print(f"❌ Request Error: {e}")
    return None
```

## Rate Limits

**GitLab Rate Limits:**
- Default: 600 requests per minute per user
- Varies by GitLab instance configuration

**Best Practices:**
- All requests include 30-second timeout
- Sequential processing of sheet rows (no bulk operations)
- 3-second delay between sync directions in complete sync

## Status Mapping

**Google Sheets → GitLab Actions:**

| Sheet Status | GitLab Action | API Endpoint Used |
|-------------|---------------|-------------------|
| "Completed" | Close issue | `PUT /issues/{id}` with `state_event=close` |
| "In Progress" | Keep open | No action (informational log only) |
| Empty GIT ID + Sub Task | Create new issue | `POST /issues` |

## Security Notes

1. **Token Security:**
   - Never commit tokens to version control
   - Use environment variables or secure config files
   - Regularly rotate access tokens

2. **Permissions Required:**
   - `api` scope for full API access
   - Developer role or higher on the target project

3. **Data Validation:**
   - All user inputs are validated before API calls
   - Timeout protection on all requests
   - Error logging without exposing sensitive data

## Testing the API

**Test GitLab Connection:**
```bash
curl -H "PRIVATE-TOKEN: your-token" "https://sourcecontrol.hsenidmobile.com/projects/65/issues"
```

**Test Issue Creation:**
```bash
curl -X POST -H "PRIVATE-TOKEN: your-token" \
  -d "title=Test Issue&description=Test description" \
  "https://sourcecontrol.hsenidmobile.com/projects/65/issues"
```

---

*This documentation covers all GitLab API endpoints used in the GitLab ↔ Google Sheets sync scripts. For the latest GitLab API documentation, visit: https://docs.gitlab.com/ee/api/* 