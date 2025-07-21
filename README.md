# GitLab ↔ Google Sheets Sync Scripts

Simple scripts to sync GitLab issues with Google Sheets using direct API key access.

## Setup

1. **Install required packages:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Get Google Sheets API Key:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Google Sheets API
   - Go to Credentials → Create Credentials → API Key
   - Copy the API key

3. **Make your Google Sheet public (for API access):**
   - Open your Google Sheet
   - Click "Share" → "Get link" → "Anyone with the link can view"
   - Or make it public: "Anyone on the internet with this link can view"

4. **Edit config.py:**
   - Update `GITLAB_TOKEN` with your GitLab token
   - Update `SPREADSHEET_ID` with your Google Sheet ID (from the URL)
   - Update `GOOGLE_SHEETS_API_KEY` with your API key
   - Configure GitLab issue template settings

## Usage

### Option 1: Sync GitLab → Google Sheets only
```bash
python gitlab_to_sheets.py
```

### Option 2: Sync Google Sheets → GitLab only  
```bash
python sheets_to_gitlab.py
```

### Option 3: Complete sync (both directions)
```bash
python complete_sync.py
```

## Google Sheet Format

Your Google Sheet should have these columns:
- **A**: Date
- **B**: GIT ID  
- **C**: Project Name
- **D**: Specific Project Name
- **E**: Main Task
- **F**: Sub Task
- **G**: Status
- **H**: Actual Start Date
- **I**: Planned Estimation (H)
- **J**: Actual Estimation (H)
- **K**: Actual End Date

## GitLab Issue Template

When creating GitLab issues, the script automatically adds these quick actions:

```
/assign @farhad.l@appigo.co
/estimate 8h
/milestone %milestone-name
/due 
/label ~task
```

You can customize these in `config.py`:
- `DEFAULT_ASSIGNEE` - Who gets assigned to new issues
- `DEFAULT_ESTIMATE` - Default time estimate
- `DEFAULT_MILESTONE` - Default milestone
- `DEFAULT_DUE_DATE` - Default due date
- `DEFAULT_LABEL` - Default label

## How It Works

### Sheets → GitLab:
- **Creates GitLab issues** for sub-tasks that don't have a GIT ID
- **Uses Sub Task as the issue title** (as requested)
- **Updates the GIT ID column** when new issues are created
- **Applies GitLab quick actions** automatically (assign, estimate, milestone, etc.)
- **Closes issues** when status is "Completed"
- **Adds time tracking** from "Actual Estimation (H)" column
- **Keeps issues open** when status is "In Progress"

### GitLab → Sheets:
- **Updates existing rows** with GitLab issue data
- **Adds new rows** for new GitLab issues (with basic info)
- **Preserves user data** (project names, estimations, etc.)

## Status Keywords

**To close issues in GitLab:**
- Completed

**To keep issues open:**
- In Progress

## Example Row

**Before running script:**
```
17-07-2025 | | Retailer | Support Service | Main Task | Create a Script to fetch data | In Progress | 17-07-2025 | 8 | | 
```

**After running script:**
```
17-07-2025 | 123 | Retailer | Support Service | Main Task | Create a Script to fetch data | In Progress | 17-07-2025 | 8 | | 
```

**GitLab issue will be created with:**
- **Title:** "Create a Script to fetch data" (Sub Task)
- **Description:** Project details + quick actions
- **Assigned to:** @farhad.l@appigo.co
- **Estimated:** 8h (from Planned Estimation column)
- **Milestone & Labels:** As configured

## Files

- `config.py` - All configuration settings (API keys, GitLab template)
- `gitlab_to_sheets.py` - Sync GitLab issues to Google Sheets
- `sheets_to_gitlab.py` - Sync Google Sheets changes to GitLab (creates issues with template)
- `complete_sync.py` - Run both syncs together
