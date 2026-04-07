import { NextResponse } from 'next/server';
import syncStateManager from '@/lib/syncStateManager';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import path from 'path';
import fs from 'fs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

// Column headers for the import sheet
const IMPORT_COLUMNS = [
  'Git ID',
  'Title',
  'Description',
  'Status',
  'Project',
  'Milestone',
  'Labels',
  'Assignee',
  'Start Date',
  'Due Date',
  'Created At',
  'Updated At',
  'Web URL',
];

export async function POST(request) {
  try {
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 1024 * 1024) {
      return NextResponse.json({ error: 'Request too large' }, { status: 413 });
    }

    const syncData = await request.json();

    const requiredFields = ['gitlabUrl', 'gitlabToken', 'spreadsheetId', 'worksheetName'];
    const missingFields = requiredFields.filter(field => !syncData[field]);
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Check if sync is already running
    const currentStatus = syncStateManager.getStatus();
    if (currentStatus.running) {
      return NextResponse.json({ error: 'Sync is already running' }, { status: 409 });
    }

    // Resolve credentials
    let resolvedServiceAccount = null;
    let useLocalServiceAccount = false;

    if (syncData.serviceAccount && syncData.serviceAccount.client_email && syncData.serviceAccount.private_key) {
      resolvedServiceAccount = syncData.serviceAccount;
    } else {
      try {
        const session = await getServerSession(authOptions);
        if (session?.user?.id) {
          const dbConfig = await prisma.savedConfig.findFirst({
            where: {
              userId: session.user.id,
              OR: [{ spreadsheetId: syncData.spreadsheetId }, { isDefault: true }],
            },
            orderBy: { updatedAt: 'desc' },
          });
          if (dbConfig?.serviceAccount) {
            const maybe = decrypt(dbConfig.serviceAccount);
            if (typeof maybe === 'string') {
              try { resolvedServiceAccount = JSON.parse(maybe); } catch { resolvedServiceAccount = maybe; }
            } else {
              resolvedServiceAccount = maybe;
            }
          }
        }
      } catch (e) {
        console.warn('import-from-gitlab: Could not read DB service account:', e);
      }
    }

    if (!resolvedServiceAccount) {
      const serviceAccountPath = path.join(process.cwd(), 'uploads', 'service_account.json');
      if (fs.existsSync(serviceAccountPath)) {
        useLocalServiceAccount = true;
      }
    }

    if (!resolvedServiceAccount && !useLocalServiceAccount) {
      return NextResponse.json({ error: 'No service account credentials available.' }, { status: 400 });
    }

    if (resolvedServiceAccount) syncData.serviceAccountResolved = resolvedServiceAccount;
    if (useLocalServiceAccount) syncData.useLocalServiceAccount = true;

    syncStateManager.startSync();
    performImport(syncData);

    return NextResponse.json({ message: 'Import started successfully', status: 'started' });
  } catch (error) {
    console.error('Error starting import:', error);
    syncStateManager.errorSync(error.message);
    return NextResponse.json({ error: 'Failed to start import: ' + error.message }, { status: 500 });
  }
}

async function performImport(syncData) {
  try {
    const dateFormat = syncData.dateFormat || 'MM/DD/YYYY';

    // Step 1: Initialize
    syncStateManager.setCurrentStep('sync-start');
    syncStateManager.addOutput(`[${new Date().toISOString()}] Starting GitLab -> Sheet Import...\n`);
    syncStateManager.addOutput(`  - Date format: ${dateFormat}\n`);

    // Step 2: Connect to Google Sheets
    syncStateManager.setCurrentStep('reading-sheet');
    syncStateManager.addOutput(`[${new Date().toISOString()}] Connecting to Google Sheet...\n`);

    let serviceAccountAuth = null;
    const resolved = syncData.serviceAccountResolved;

    if (resolved && resolved.client_email && resolved.private_key) {
      serviceAccountAuth = new JWT({
        email: resolved.client_email,
        key: resolved.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'],
      });
    } else if (syncData.useLocalServiceAccount) {
      const serviceAccountPath = path.join(process.cwd(), 'uploads', 'service_account.json');
      if (!fs.existsSync(serviceAccountPath)) {
        syncStateManager.errorSync('Local service account file missing');
        return;
      }
      serviceAccountAuth = new JWT({
        keyFile: serviceAccountPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'],
      });
    } else {
      syncStateManager.errorSync('No service account credentials available.');
      return;
    }

    let doc;
    try {
      doc = new GoogleSpreadsheet(syncData.spreadsheetId, serviceAccountAuth);
      await doc.loadInfo();
    } catch (err) {
      syncStateManager.errorSync('Failed to connect to Google Sheet: ' + err.message);
      return;
    }

    // Find or create the target worksheet
    let sheet = doc.sheetsByTitle[syncData.worksheetName];
    if (!sheet) {
      syncStateManager.addOutput(`  - Worksheet "${syncData.worksheetName}" not found, creating it...\n`);
      sheet = await doc.addSheet({ title: syncData.worksheetName, headerValues: IMPORT_COLUMNS });
      syncStateManager.addOutput(`  - Created worksheet "${syncData.worksheetName}" with ${IMPORT_COLUMNS.length} columns\n`);
    } else {
      // Ensure all columns exist
      await sheet.loadHeaderRow();
      const existingHeaders = sheet.headerValues || [];
      const missingHeaders = IMPORT_COLUMNS.filter(h => !existingHeaders.find(e => e.toLowerCase().trim() === h.toLowerCase().trim()));

      if (missingHeaders.length > 0) {
        const newHeaders = [...existingHeaders, ...missingHeaders];
        await sheet.setHeaderRow(newHeaders);
        syncStateManager.addOutput(`  - Added missing columns: ${missingHeaders.join(', ')}\n`);
      } else {
        syncStateManager.addOutput(`  - All required columns already exist\n`);
      }

      // Reload headers after potential update
      await sheet.loadHeaderRow();
    }

    syncStateManager.addOutput(`  - Connected to worksheet: ${syncData.worksheetName}\n`);

    // Load existing rows to check for duplicates using multiple identifiers
    const existingRows = await sheet.getRows();
    const existingKeys = new Set();
    const gitIdHeader = sheet.headerValues.find(h => h.toLowerCase().trim() === 'git id');
    const webUrlHeader = sheet.headerValues.find(h => h.toLowerCase().trim() === 'web url');
    const projectHeader = sheet.headerValues.find(h => h.toLowerCase().trim() === 'project');

    for (const row of existingRows) {
      // Track by web URL (most reliable - unique across projects)
      if (webUrlHeader) {
        const url = row.get(webUrlHeader);
        if (url) existingKeys.add(String(url).trim());
      }
      // Also track by project+iid combo
      if (gitIdHeader) {
        const gitId = row.get(gitIdHeader);
        const project = projectHeader ? row.get(projectHeader) : '';
        if (gitId) {
          const iidMatch = String(gitId).match(/#(\d+)/);
          const iid = iidMatch ? iidMatch[1] : String(gitId).trim();
          existingKeys.add(`${project}:${iid}`);
        }
      }
    }
    syncStateManager.addOutput(`  - Found ${existingKeys.size} existing entries in sheet (duplicate check active)\n`);

    // Step 3: Fetch GitLab issues
    syncStateManager.setCurrentStep('creating-issues');
    syncStateManager.addOutput(`[${new Date().toISOString()}] Fetching issues from GitLab...\n`);

    const gitlabUrl = syncData.gitlabUrl.endsWith('/') ? syncData.gitlabUrl : syncData.gitlabUrl + '/';
    const headers = {
      'Private-Token': syncData.gitlabToken,
      'Content-Type': 'application/json',
    };

    const projectMappings = syncData.projectMappings || [];
    if (projectMappings.length === 0) {
      syncStateManager.errorSync('No project mappings configured.');
      return;
    }

    // Build filter parameters
    const importState = syncData.importState || 'all';
    const importMilestone = syncData.importMilestone || '';
    const importLabels = syncData.importLabels || '';
    const importAssignee = syncData.importAssignee || '';

    syncStateManager.addOutput(`  - Filters: state=${importState}`);
    if (importMilestone) syncStateManager.addOutput(`, milestone=${importMilestone}`);
    if (importLabels) syncStateManager.addOutput(`, labels=${importLabels}`);
    if (importAssignee) syncStateManager.addOutput(`, assignee=${importAssignee}`);
    syncStateManager.addOutput(`\n`);

    let totalImported = 0;
    let totalSkipped = 0;

    for (const pm of projectMappings) {
      const projectId = pm.projectId;
      const projectName = pm.projectName;
      syncStateManager.addOutput(`\n  - Fetching issues from project: ${projectName} (ID: ${projectId})\n`);

      // Fetch all issues with pagination
      let page = 1;
      let hasMore = true;
      let projectIssueCount = 0;

      while (hasMore) {
        if (!syncStateManager.getStatus().running) return;

        // Build query parameters with filters
        const params = new URLSearchParams({
          per_page: '100',
          page: String(page),
        });

        // State filter
        if (importState !== 'all') {
          params.set('state', importState);
        } else {
          params.set('state', 'all');
        }

        // Milestone filter
        if (importMilestone === 'none') {
          params.set('milestone', 'None');
        } else if (importMilestone) {
          params.set('milestone', importMilestone);
        }

        // Labels filter
        if (importLabels) {
          params.set('labels', importLabels.trim());
        }

        // Assignee filter
        if (importAssignee === 'none') {
          params.set('assignee_id', '0');
        } else if (importAssignee) {
          params.set('assignee_username', importAssignee);
        }

        const issuesUrl = `${gitlabUrl}projects/${encodeURIComponent(projectId)}/issues?${params.toString()}`;
        const issuesResp = await fetch(issuesUrl, { headers });

        if (!issuesResp.ok) {
          syncStateManager.addOutput(`    - Error fetching issues page ${page}: ${issuesResp.status}\n`);
          break;
        }

        const issues = await issuesResp.json();
        if (issues.length === 0) {
          hasMore = false;
          break;
        }

        syncStateManager.addOutput(`    - Fetched page ${page}: ${issues.length} issues\n`);

        for (const issue of issues) {
          // Skip if already in sheet (check by web_url and project+iid)
          const isDuplicate = existingKeys.has(issue.web_url) ||
            existingKeys.has(`${projectName}:${issue.iid}`);
          if (isDuplicate) {
            totalSkipped++;
            continue;
          }

          // Format dates based on user's selected format
          const startDate = formatDateForSheet(issue.start_date, dateFormat);
          const dueDate = formatDateForSheet(issue.due_date, dateFormat);
          const createdAt = formatDateForSheet(issue.created_at?.split('T')[0], dateFormat);
          const updatedAt = formatDateForSheet(issue.updated_at?.split('T')[0], dateFormat);

          // Get milestone title
          const milestoneTitle = issue.milestone ? issue.milestone.title : '';

          // Get labels
          const labels = (issue.labels || []).join(', ');

          // Get assignee
          const assignees = (issue.assignees || []).map(a => a.username).join(', ');

          // Build row data matching headers
          const rowData = {};
          for (const h of sheet.headerValues) {
            const key = h.toLowerCase().trim();
            if (key === 'git id') rowData[h] = `#${issue.iid}`;
            else if (key === 'title') rowData[h] = issue.title || '';
            else if (key === 'description') rowData[h] = truncateDescription(issue.description || '');
            else if (key === 'status') rowData[h] = issue.state === 'opened' ? 'Open' : 'Closed';
            else if (key === 'project') rowData[h] = projectName;
            else if (key === 'milestone') rowData[h] = milestoneTitle;
            else if (key === 'labels') rowData[h] = labels;
            else if (key === 'assignee') rowData[h] = assignees;
            else if (key === 'start date') rowData[h] = startDate;
            else if (key === 'due date') rowData[h] = dueDate;
            else if (key === 'created at') rowData[h] = createdAt;
            else if (key === 'updated at') rowData[h] = updatedAt;
            else if (key === 'web url') rowData[h] = issue.web_url || '';
          }

          await sheet.addRow(rowData);
          // Track the new entry to avoid duplicates within the same run
          if (issue.web_url) existingKeys.add(issue.web_url);
          existingKeys.add(`${projectName}:${issue.iid}`);
          totalImported++;
          projectIssueCount++;
        }

        // Check next page header
        const totalPages = parseInt(issuesResp.headers.get('x-total-pages') || '1');
        if (page >= totalPages) {
          hasMore = false;
        } else {
          page++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      syncStateManager.addOutput(`    - Imported ${projectIssueCount} new issues from ${projectName}\n`);
    }

    // Step 4: Complete
    syncStateManager.setCurrentStep('updating-sheet');
    syncStateManager.addOutput(`\n[${new Date().toISOString()}] Import complete!\n`);
    syncStateManager.addOutput(`  - Total imported: ${totalImported} issues\n`);
    syncStateManager.addOutput(`  - Total skipped (already in sheet): ${totalSkipped}\n`);

    syncStateManager.completeSync();
  } catch (error) {
    console.error('Import error:', error);
    syncStateManager.errorSync(error.message);
  }
}

// Format a YYYY-MM-DD date string to the user's selected format
function formatDateForSheet(dateStr, format) {
  if (!dateStr) return '';
  const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return dateStr;

  const [, year, month, day] = match;
  if (format === 'DD/MM/YYYY') {
    return `${day}/${month}/${year}`;
  }
  // MM/DD/YYYY
  return `${month}/${day}/${year}`;
}

// Truncate long descriptions for sheet cells
function truncateDescription(desc) {
  if (!desc) return '';
  // Remove markdown links, images, etc. for cleaner sheet display
  const cleaned = desc
    .replace(/!\[.*?\]\(.*?\)/g, '') // remove images
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // simplify links
    .trim();
  if (cleaned.length > 500) return cleaned.substring(0, 497) + '...';
  return cleaned;
}
