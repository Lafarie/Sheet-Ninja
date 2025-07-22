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
Content-Type: application/json
```

**Setup:**
1. Go to your GitLab instance → User Settings → Access Tokens
2. Create a new personal access token with `api` scope
3. Add the token to your `.env` file

## Base Configuration

```env
# From .env file
GITLAB_URL=https://sourcecontrol.hsenidmobile.com/api/v4/
PROJECT_ID=263
GITLAB_TOKEN=your-token-here
```

## API Endpoints

### Get Project Issues

**Endpoint:** `GET /api/v4/projects/{id}/issues`

**Purpose:** Retrieve all issues from a specific GitLab project.

**URL Structure:**
```
{GITLAB_URL}projects/{PROJECT_ID}/issues
```

**Example Request:**
```http
GET https://sourcecontrol.hsenidmobile.com/api/v4/projects/263/issues
Headers:
  PRIVATE-TOKEN: your-gitlab-token-here
```

**Response Format:**
```json
[
  {
    "id": 37133,
    "iid": 17,
    "title": "test",
    "description": "test",
    "state": "opened",
    "created_at": "2025-07-22T01:14:37.599Z",
    "updated_at": "2025-07-22T01:14:37.599Z",
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
    url = f"{config.GITLAB_URL}projects/{config.PROJECT_ID}/issues"
    headers = {"PRIVATE-TOKEN": config.GITLAB_TOKEN}
    response = requests.get(url, headers=headers, timeout=30)
```

---

### Create Issue

**Endpoint:** `POST /api/v4/projects/{id}/issues`

**Purpose:** Create a new issue in the GitLab project with automatic quick actions.

**URL Structure:**
```
{GITLAB_URL}projects/{PROJECT_ID}/issues
```

**Required Headers:**
```http
PRIVATE-TOKEN: your-gitlab-token-here
Content-Type: application/json
```

**JSON Body Format:**
```json
{
  "title": "Create a Script to fetch data",
  "description": "**Project:** Retailer\n**Specific Project:** Support Service\n**Main Task:** Main Task\n**Sub Task:** Create a Script to fetch data\n\n/assign @farhad.l@appigo.co\n/estimate 8h\n/milestone %milestone-name\n/label ~task"
}
```

**Example Request:**
```http
POST https://sourcecontrol.hsenidmobile.com/api/v4/projects/263/issues
Headers:
  PRIVATE-TOKEN: your-gitlab-token-here
  Content-Type: application/json

Body:
{
  "title": "Create a Script to fetch data",
  "description": "Project details with quick actions"
}
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
    url = f"{config.GITLAB_URL}projects/{config.PROJECT_ID}/issues"
    headers = {
        "PRIVATE-TOKEN": config.GITLAB_TOKEN,
        "Content-Type": "application/json"
    }
    
    data = {
        "title": title,
        "description": full_description  # Includes quick actions
    }
    
    response = requests.post(url, headers=headers, json=data, timeout=30)
```

---

### Update Issue

**Endpoint:** `PUT /api/v4/projects/{id}/issues/{issue_iid}`

**Purpose:** Update an existing issue, including closing or reopening issues.

**URL Structure:**
```
{GITLAB_URL}projects/{PROJECT_ID}/issues/{issue_iid}
```

**Required Headers:**
```http
PRIVATE-TOKEN: your-gitlab-token-here
Content-Type: application/json
```

**JSON Body Format:**
```json
{
  "title": "Updated Issue Title",
  "description": "Updated issue description", 
  "state_event": "close"
}
```

**State Events:**
- `"close"` - Close the issue
- `"reopen"` - Reopen a closed issue

**Example Request (Close Issue):**
```http
PUT https://sourcecontrol.hsenidmobile.com/api/v4/projects/263/issues/18
Headers:
  PRIVATE-TOKEN: your-gitlab-token-here
  Content-Type: application/json

Body:
{
  "state_event": "close"
}
```

**Example Request (Update Title and Description):**
```http
PUT https://sourcecontrol.hsenidmobile.com/api/v4/projects/263/issues/18
Headers:
  PRIVATE-TOKEN: your-gitlab-token-here
  Content-Type: application/json

Body:
{
  "title": "Updated Issue Title",
  "description": "Updated issue description"
}
```

**Example Response:**
```json
{
  "id": 456,
  "iid": 18,
  "title": "Updated Issue Title",
  "state": "closed",
  "closed_at": "2025-01-17T15:30:00.000Z"
}
```

**Usage in Code:**
```python
# From sheets_to_gitlab.py
def close_gitlab_issue(self, issue_id):
    url = f"{config.GITLAB_URL}projects/{config.PROJECT_ID}/issues/{issue_id}"
    headers = {
        "PRIVATE-TOKEN": config.GITLAB_TOKEN,
        "Content-Type": "application/json"
    }
    data = {"state_event": "close"}
    
    response = requests.put(url, headers=headers, json=data, timeout=30)

# Generic update method
def update_gitlab_issue(self, issue_id, title=None, description=None, state_event=None):
    url = f"{config.GITLAB_URL}projects/{config.PROJECT_ID}/issues/{issue_id}"
    headers = {
        "PRIVATE-TOKEN": config.GITLAB_TOKEN,
        "Content-Type": "application/json"
    }
    
    data = {}
    if title:
        data["title"] = title
    if description:
        data["description"] = description
    if state_event:
        data["state_event"] = state_event
    
    response = requests.put(url, headers=headers, json=data, timeout=30)
```

**Triggers:**
- When Google Sheets status column = "Completed" or "Cancelled"

---

### Add Time Tracking

**Endpoint:** `POST /api/v4/projects/{id}/issues/{issue_iid}/add_spent_time`

**Purpose:** Add time spent on an issue for time tracking purposes.

**URL Structure:**
```
{GITLAB_URL}projects/{PROJECT_ID}/issues/{issue_iid}/add_spent_time
```

**Parameters:**
- `duration` (string) - Time duration (e.g., "8h", "2d", "30m")
- `comment` (string) - Optional comment about the time entry

**Example Request:**
```http
POST https://sourcecontrol.hsenidmobile.com/api/v4/projects/263/issues/18/add_spent_time
Headers:
  PRIVATE-TOKEN: your-gitlab-token-here
  Content-Type: application/json

Body:
{
  "duration": "8h",
  "comment": "Time logged from Google Sheets: 8 hours"
}
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
    url = f"{config.GITLAB_URL}projects/{config.PROJECT_ID}/issues/{issue_id}/add_spent_time"
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
| `/assign @username` | Assigns issue to user | `DEFAULT_ASSIGNEE` |
| `/estimate Xh` | Sets time estimation | `DEFAULT_ESTIMATE` or from Planned Estimation column |
| `/milestone %name` | Sets milestone | `DEFAULT_MILESTONE` |
| `/due YYYY-MM-DD` | Sets due date | `DEFAULT_DUE_DATE` |
| `/label ~labelname` | Adds label | `DEFAULT_LABEL` |

**Configuration Example:**
```env
# In .env file
DEFAULT_ASSIGNEE=@farhad.l@appigo.co
DEFAULT_ESTIMATE=8h
DEFAULT_MILESTONE=%milestone-name
DEFAULT_DUE_DATE=
DEFAULT_LABEL=~task
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
    response = requests.post(url, headers=headers, json=data, timeout=30)
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
| "Completed", "Cancelled" | Close issue | `PUT /issues/{id}` with `state_event=close` |
| "Not Started", "In Progress", "Under Review", "Testing", "On Hold" | Keep open | No action (informational log only) |
| Empty GIT ID + Sub Task | Create new issue | `POST /issues` |

## Security Notes

1. **Token Security:**
   - Store tokens in `.env` files (never commit to version control)
   - Use environment variables in production
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
curl -H "PRIVATE-TOKEN: your-token" "https://sourcecontrol.hsenidmobile.com/api/v4/projects/263/issues"
```

**Test Issue Creation:**
```bash
curl -X POST -H "PRIVATE-TOKEN: your-token" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Issue","description":"Test description"}' \
  "https://sourcecontrol.hsenidmobile.com/api/v4/projects/263/issues"
```

**Test Issue Update:**
```bash
curl -X PUT -H "PRIVATE-TOKEN: your-token" \
  -H "Content-Type: application/json" \
  -d '{"state_event":"close"}' \
  "https://sourcecontrol.hsenidmobile.com/api/v4/projects/263/issues/18"
```

---

*This documentation covers all GitLab API endpoints used in the GitLab ↔ Google Sheets sync scripts. For the latest GitLab API documentation, visit: https://docs.gitlab.com/ee/api/* 