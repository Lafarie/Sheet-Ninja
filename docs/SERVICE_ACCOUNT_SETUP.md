# Service Account Setup Guide

This guide will help you set up Google Service Account authentication for the GitLab ↔ Google Sheets sync scripts.

## 🚀 Quick Setup (5 minutes)

### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name (e.g., "GitLab Sheets Sync")
4. Click "Create"

### Step 2: Enable Google Sheets API
1. In the Cloud Console, go to **APIs & Services** → **Library**
2. Search for "Google Sheets API"
3. Click on it and press **"Enable"**

### Step 3: Create Service Account
1. Go to **APIs & Services** → **Credentials**
2. Click **"Create Credentials"** → **"Service Account"**
3. Fill in details:
   - **Service account name:** `gitlab-sheets-sync`
   - **Service account ID:** (auto-generated)
   - **Description:** `Service account for GitLab to Sheets synchronization`
4. Click **"Create and Continue"**
5. Skip the optional role assignment (click **"Continue"**)
6. Skip granting users access (click **"Done"**)

### Step 4: Download Service Account Key
1. Find your created service account in the list
2. Click on the service account name
3. Go to the **"Keys"** tab
4. Click **"Add Key"** → **"Create new key"**
5. Select **"JSON"** format
6. Click **"Create"**
7. The JSON file will download automatically

### Step 5: Setup the JSON File
1. **Rename** the downloaded file to `service_account.json`
2. **Move** it to your scripts directory (same folder as `config.py`)
3. **IMPORTANT:** Never commit this file to Git!

### Step 6: Share Google Sheet with Service Account
1. Open the JSON file and find the `client_email` field
2. Copy the entire email address (e.g., `gitlab-sheets-sync@your-project.iam.gserviceaccount.com`)
3. Open your Google Sheet
4. Click **"Share"** button
5. Paste the service account email
6. Set permission to **"Editor"**
7. **Uncheck** "Notify people" (it's a robot, not a person!)
8. Click **"Send"**

## ✅ Verify Setup

Run this test to verify everything works:

```bash
python gitlab_to_sheets.py
```

**Expected output:**
```
✅ Connected to Google Sheets API with Service Account
✅ Sheet read access: OK
✅ Sheet write access: OK
🔄 Starting GitLab to Google Sheets sync...
✅ Found X issues in GitLab
```

## 🚨 Troubleshooting

### "Service account file not found"
- Ensure `service_account.json` is in the same folder as your scripts
- Check the filename is exactly `service_account.json`

### "Failed to authenticate"
- Re-download the JSON file from Google Cloud Console
- Ensure the file is valid JSON (open it in a text editor)

### "The caller does not have permission"
- Make sure you shared the sheet with the correct service account email
- Give the service account "Editor" permission (not just "Viewer")
- Wait a few minutes for permissions to propagate

### "API has not been used"
- Go back to Google Cloud Console → APIs & Services → Library
- Search for "Google Sheets API" and make sure it's enabled

## 🔒 Security Best Practices

1. **Never commit `service_account.json` to version control**
2. **Add `service_account.json` to your `.gitignore` file**
3. **Only share sheets with the specific service account (not all Google users)**
4. **Regularly review which sheets have been shared with the service account**
5. **Delete unused service accounts from Google Cloud Console**

## 📂 File Structure

After setup, your directory should look like:
```
scripts/
├── config.py
├── gitlab_to_sheets.py
├── sheets_to_gitlab.py
├── complete_sync.py
├── service_account.json     ← This file
└── requirements.txt
```

---

**🎉 That's it! Your Service Account is ready to use.**

The scripts will now have full read/write access to your Google Sheets without requiring them to be public. 