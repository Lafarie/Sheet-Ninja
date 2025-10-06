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

// Helper: resolve column header from a mapping value provided in config
// mapping may be:
// - an object { index: <number>, header: <string> }
// - a string header name
// - a numeric string or number indicating 1-based column index
function resolveColumnFromMapping(mapping, headers) {
  if (!mapping) return null;
  // object form
  if (typeof mapping === 'object') {
    if (mapping.header) {
      return headers.find(h => h.toLowerCase().trim() === String(mapping.header).toLowerCase().trim()) || null;
    }
    if (typeof mapping.index === 'number') {
      const idx = mapping.index - 1; // config may be 1-based
      if (idx >= 0 && idx < headers.length) return headers[idx];
    }
  }

  // numeric string or number -> treat as 1-based index
  if (typeof mapping === 'string' && /^[0-9]+$/.test(mapping)) {
    const idx = parseInt(mapping, 10) - 1;
    if (idx >= 0 && idx < headers.length) return headers[idx];
  }
  if (typeof mapping === 'number') {
    const idx = mapping - 1;
    if (idx >= 0 && idx < headers.length) return headers[idx];
  }

  // otherwise treat as header name and match case-insensitively
  if (typeof mapping === 'string') {
    return headers.find(h => h.toLowerCase().trim() === mapping.toLowerCase().trim()) || null;
  }

  return null;
}

// Helper: parse flexible date formats (accepts DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, MM/DD/YYYY, and native ISO)
function parseFlexibleDate(value) {
  if (!value) return null;
  // If already a Date
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  const s = String(value).trim();
  if (!s) return null;

  // Try native parse first (ISO etc.)
  const d1 = new Date(s);
  if (!isNaN(d1.getTime())) return d1;

  // Try DD-MM-YYYY or D-M-YYYY or DD/MM/YYYY
  const dmY = s.match(/^(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{4})$/);
  if (dmY) {
    const day = parseInt(dmY[1], 10);
    const month = parseInt(dmY[2], 10);
    const year = parseInt(dmY[3], 10);
    const maybe = new Date(year, month - 1, day);
    if (!isNaN(maybe.getTime())) return maybe;
  }

  // Try YYYY/MM/DD or YYYY.MM.DD
  const ymd = s.match(/^(\d{4})[\-\/\.](\d{1,2})[\-\/\.](\d{1,2})$/);
  if (ymd) {
    const year = parseInt(ymd[1], 10);
    const month = parseInt(ymd[2], 10);
    const day = parseInt(ymd[3], 10);
    const maybe = new Date(year, month - 1, day);
    if (!isNaN(maybe.getTime())) return maybe;
  }

  return null;
}

export async function POST(request) {
  try {
    // Input validation
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 1024 * 1024) { // 1MB limit
      return NextResponse.json({ error: 'Request too large' }, { status: 413 });
    }

    const syncData = await request.json();
    
    // Validate required fields
    const requiredFields = ['gitlabUrl', 'gitlabToken', 'spreadsheetId', 'worksheetName'];
    const missingFields = requiredFields.filter(field => !syncData[field]);
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate project mappings if provided
    if (syncData.projectMappings && Array.isArray(syncData.projectMappings)) {
      if (syncData.projectMappings.length === 0) {
        return NextResponse.json(
          { error: 'No project mappings configured. Please set up at least one project mapping.' },
          { status: 400 }
        );
      }
    } else if (!syncData.projectId) {
      return NextResponse.json(
        { error: 'Either projectId or projectMappings must be provided' },
        { status: 400 }
      );
    }

    // Check if sync is already running
    const currentStatus = syncStateManager.getStatus();
    if (currentStatus.running) {
      return NextResponse.json(
        { error: 'Sync is already running' },
        { status: 409 }
      );
    }

    // Resolve credentials now (during request) so background task has them
    let resolvedServiceAccount = null;
    let useLocalServiceAccount = false;

    // Prefer inline service account in request body
    if (syncData.serviceAccount && syncData.serviceAccount.client_email && syncData.serviceAccount.private_key) {
      resolvedServiceAccount = syncData.serviceAccount;
      console.info('start-sync POST: using inline serviceAccount from body');
    } else {
      // Try DB-saved config using current session
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
            console.info('start-sync POST: using serviceAccount from DB-saved config');
          }
        }
      } catch (e) {
        console.warn('start-sync POST: Could not read DB service account:', e);
      }
    }

    // If still no resolved service account, check for local file
    if (!resolvedServiceAccount) {
      const serviceAccountPath = path.join(process.cwd(), 'uploads', 'service_account.json');
      if (fs.existsSync(serviceAccountPath)) {
        useLocalServiceAccount = true;
        console.info('start-sync POST: will use local uploads/service_account.json fallback');
      }
    }

    // If no credentials exist at all, return an error and don't start the sync
    if (!resolvedServiceAccount && !useLocalServiceAccount) {
      return NextResponse.json({ error: 'No service account credentials available. Please upload one or save a config with a service account.' }, { status: 400 });
    }

    // Attach resolved info to syncData so background worker can use it without session
    if (resolvedServiceAccount) syncData.serviceAccountResolved = resolvedServiceAccount;
    if (useLocalServiceAccount) syncData.useLocalServiceAccount = true;

    // Start the sync process and run the background task
    syncStateManager.startSync();
    performActualSync(syncData);

    return NextResponse.json({ 
      message: 'Sync started successfully',
      status: 'started'
    });
  } catch (error) {
    console.error('Error starting sync:', error);
    syncStateManager.errorSync(error.message);
    return NextResponse.json(
      { error: 'Failed to start sync: ' + error.message },
      { status: 500 }
    );
  }
}

// Perform actual sync between Google Sheets and GitLab
async function performActualSync(syncData) {
  try {
    // Expose columnMappings to helper functions used later (extractTaskData uses this)
    try {
      if (syncData && syncData.columnMappings) {
        // store on globalThis so helper functions inside this module can read it
        globalThis._syncColumnMappings = syncData.columnMappings;
      } else {
        globalThis._syncColumnMappings = {};
      }
    } catch (e) {
      // ignore if we cannot set global
      globalThis._syncColumnMappings = globalThis._syncColumnMappings || {};
    }

    // Step 1: Initialize
    syncStateManager.setCurrentStep('sync-start');
    syncStateManager.addOutput(`[${new Date().toISOString()}] Starting Sync...\n`);
    
    // Step 2: Connect to Google Sheets
    syncStateManager.setCurrentStep('reading-sheet');
    syncStateManager.addOutput(`[${new Date().toISOString()}] Reading Sheet...\n`);
    syncStateManager.addOutput(`  - Connecting to spreadsheet: ${syncData.spreadsheetId}\n`);
    syncStateManager.addOutput(`  - Reading worksheet: ${syncData.worksheetName}\n`);
    
    // Use resolved credentials from request handler when available to avoid session calls in background
    let serviceAccountAuth = null;
    let resolvedServiceAccount = null;

    console.info('start-sync (background): syncData has serviceAccountResolved?', !!syncData.serviceAccountResolved, 'useLocalServiceAccount?', !!syncData.useLocalServiceAccount);

    if (syncData.serviceAccountResolved && syncData.serviceAccountResolved.client_email && syncData.serviceAccountResolved.private_key) {
      resolvedServiceAccount = syncData.serviceAccountResolved;
      console.info('start-sync (background): using pre-resolved serviceAccount from POST handler', { client_email: resolvedServiceAccount.client_email });
      syncStateManager.addOutput(`  - Using service account from saved configuration: ${resolvedServiceAccount.client_email}\n`);
    } else if (syncData.serviceAccount && syncData.serviceAccount.client_email && syncData.serviceAccount.private_key) {
      // If client sent inline credentials directly, use them
      resolvedServiceAccount = syncData.serviceAccount;
      console.info('start-sync (background): using inline serviceAccount from syncData.serviceAccount', { client_email: resolvedServiceAccount.client_email });
      syncStateManager.addOutput(`  - Using inline uploaded service account: ${resolvedServiceAccount.client_email}\n`);
    }

    if (resolvedServiceAccount && resolvedServiceAccount.client_email && resolvedServiceAccount.private_key) {
      serviceAccountAuth = new JWT({
        email: resolvedServiceAccount.client_email,
        key: resolvedServiceAccount.private_key,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file',
        ],
      });
    } else if (syncData.useLocalServiceAccount) {
      const serviceAccountPath = path.join(process.cwd(), 'uploads', 'service_account.json');
      if (!fs.existsSync(serviceAccountPath)) {
        console.warn('start-sync (background): useLocalServiceAccount requested but file missing');
        syncStateManager.addOutput(`  - Requested to use local service account file but it was not found\n`);
        syncStateManager.errorSync('No service account credentials available. Please upload one or save a config with a service account.');
        return;
      }
      console.info('start-sync (background): using local uploads/service_account.json fallback');
      syncStateManager.addOutput(`  - Using local uploaded service account file: uploads/service_account.json\n`);
      serviceAccountAuth = new JWT({
        keyFile: serviceAccountPath,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file',
        ],
      });
    } else {
      console.warn('start-sync (background): no resolved credentials available');
      syncStateManager.errorSync('No service account credentials available. Please upload one or save a config with a service account.');
      return;
    }

    let doc;
    try {
      doc = new GoogleSpreadsheet(syncData.spreadsheetId, serviceAccountAuth);
      await doc.loadInfo();
    } catch (err) {
      console.error('Error initializing GoogleSpreadsheet:', err);
      // Detect missing local service account file ENOENT and give a clearer sync output
      if (err && err.code === 'ENOENT' && String(err.message).includes(path.join(process.cwd(), 'uploads', 'service_account.json'))) {
        syncStateManager.addOutput(`  - ERROR: Local service account file not found: uploads/service_account.json\n`);
        syncStateManager.addOutput(`  - Please upload a service account file or provide inline credentials in the UI.\n`);
        syncStateManager.errorSync('Local service account file missing');
        return;
      }
      // Fallback: report error and stop sync
      syncStateManager.errorSync(err.message || 'Failed to initialize Google Sheets client');
      return;
    }
    const sheet = doc.sheetsByTitle[syncData.worksheetName];
    
    if (!sheet) {
      throw new Error(`Worksheet "${syncData.worksheetName}" not found`);
    }

    // Load rows from the sheet
    await sheet.loadHeaderRow();
    let rows = await sheet.getRows();
    
    

    // Helper: parse flexible date formats (accepts DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, MM/DD/YYYY, and native ISO)
    function parseFlexibleDate(value) {
      if (!value) return null;
      // If already a Date
      if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

      const s = String(value).trim();
      if (!s) return null;

      // Try native parse first (ISO etc.)
      const d1 = new Date(s);
      if (!isNaN(d1.getTime())) return d1;

      // Try DD-MM-YYYY or D-M-YYYY or DD/MM/YYYY
      const dmY = s.match(/^(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{4})$/);
      if (dmY) {
        const day = parseInt(dmY[1], 10);
        const month = parseInt(dmY[2], 10);
        const year = parseInt(dmY[3], 10);
        // If looks like YYYY-MM-DD (e.g., 2025-09-16) this will have month > 31; but we've already tried native parse
        const maybe = new Date(year, month - 1, day);
        if (!isNaN(maybe.getTime())) return maybe;
      }

      // Try YYYY/MM/DD or YYYY.MM.DD
      const ymd = s.match(/^(\d{4})[\-\/\.](\d{1,2})[\-\/\.](\d{1,2})$/);
      if (ymd) {
        const year = parseInt(ymd[1], 10);
        const month = parseInt(ymd[2], 10);
        const day = parseInt(ymd[3], 10);
        const maybe = new Date(year, month - 1, day);
        if (!isNaN(maybe.getTime())) return maybe;
      }

      return null;
    }

    // Debug: Log user filter information
    syncStateManager.addOutput(`  - User filter debug: ${JSON.stringify({
      userFilter: syncData.userFilter,
      columnMappings: syncData.columnMappings,
      hasUserMapping: !!syncData.columnMappings?.USER
    })}\n`);

    // Apply user filtering if enabled
    if (syncData.userFilter && syncData.userFilter !== 'all') {
      syncStateManager.addOutput(`  - Applying user filter for: ${syncData.userFilter}\n`);
      
      const userColumn = syncData.columnMappings ? resolveColumnFromMapping(syncData.columnMappings.USER, sheet.headerValues) : null;
      
      if (userColumn) {
        const originalCount = rows.length;
        rows = rows.filter(row => {
          const userValue = row.get(userColumn);
          const matches = userValue && userValue.toString().trim() === syncData.userFilter;
          if (!matches) {
            syncStateManager.addOutput(`  - Filtering out row with user: "${userValue}" (looking for: "${syncData.userFilter}")\n`);
          }
          return matches;
        });
        syncStateManager.addOutput(`  - User filter applied: ${originalCount} -> ${rows.length} rows (using column: ${userColumn})\n`);
      } else {
        syncStateManager.addOutput(`  - Warning: User filter enabled but no USER column mapping found. Processing all rows.\n`);
      }
    } else {
      syncStateManager.addOutput(`  - No user filter applied (userFilter: ${syncData.userFilter})\n`);
    }

    // Apply date filtering if enabled
    if (syncData.dateFilter && (syncData.dateFilter.startDate || syncData.dateFilter.endDate)) {
      const startDate = syncData.dateFilter.startDate;
      const endDate = syncData.dateFilter.endDate;
      syncStateManager.addOutput(`  - Applying date filter (${startDate || 'no start'} to ${endDate || 'no end'})\n`);

      const dateColumn = syncData.columnMappings ? resolveColumnFromMapping(syncData.columnMappings.DATE, sheet.headerValues) : null;

      if (dateColumn) {
        const originalCount = rows.length;
        rows = rows.filter(row => {
          const dateValue = row.get(dateColumn);
          if (!dateValue) return false;

          const rowDate = parseFlexibleDate(dateValue);
          if (!rowDate) return false;

          let inRange = true;
          if (startDate) {
            const start = parseFlexibleDate(startDate) || new Date(startDate);
            if (!start) return false;
            inRange = inRange && rowDate >= start;
          }
          if (endDate) {
            const end = parseFlexibleDate(endDate) || new Date(endDate);
            if (!end) return false;
            end.setHours(23, 59, 59, 999);
            inRange = inRange && rowDate <= end;
          }

          return inRange;
        });
        syncStateManager.addOutput(`  - Date filter applied: ${originalCount} -> ${rows.length} rows (using column: ${dateColumn})\n`);
      } else {
        syncStateManager.addOutput(`  - Warning: Date filter enabled but no DATE column mapping found. Processing all rows.\n`);
      }
    }
    
    syncStateManager.addOutput(`  - Found ${rows.length} rows to process\n`);

    // Check if sync was stopped
    if (!syncStateManager.getStatus().running) return;

    // Step 3: Create GitLab Issues
    syncStateManager.setCurrentStep('creating-issues');
    syncStateManager.addOutput(`[${new Date().toISOString()}] Creating Issues...\n`);
    
    // Log project mapping mode vs single project mode
    if (syncData.projectMappings && Array.isArray(syncData.projectMappings)) {
      syncStateManager.addOutput(`  - Using project mappings (${syncData.projectMappings.length} projects configured)\n`);
    } else {
      syncStateManager.addOutput(`  - Using single project mode: ${syncData.projectId}\n`);
    }
    
    const gitlabUrl = syncData.gitlabUrl.endsWith('/') ? syncData.gitlabUrl : syncData.gitlabUrl + '/';
    const headers = {
      'Private-Token': syncData.gitlabToken,
      'Content-Type': 'application/json',
    };

    let createdIssues = 0;
    let updatedRows = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Check if sync was stopped
      if (!syncStateManager.getStatus().running) return;

      // Get task data from the row
      const taskData = extractTaskData(row, sheet.headerValues);

      // Determine GitLab ID column using column mappings
      const gitIdColumn = syncData.columnMappings ? resolveColumnFromMapping(syncData.columnMappings.GIT_ID, sheet.headerValues) : null;
      let existingGitIdValue = gitIdColumn ? row.get(gitIdColumn) : null;

      // If there's no main task and no existing GitLab id, skip the row.
      if (!taskData.mainTask && !existingGitIdValue) {
        syncStateManager.addOutput(`  - Skipping row ${i + 2}: git id found\n`);
        continue;
      }

      try {
        // Determine which project configuration to use early so we can reuse for closing existing issues
        let projectConfig;
        let targetProjectId;

        if (syncData.projectMappings && Array.isArray(syncData.projectMappings)) {
          // Find matching project mapping
          projectConfig = findProjectMapping(syncData.projectMappings, taskData);
          if (!projectConfig) {
            syncStateManager.addOutput(`  - Skipping row ${i + 2}: No matching project mapping found\n`);
            continue;
          }
          targetProjectId = projectConfig.projectId;
          syncStateManager.addOutput(`  - Using project mapping: ${projectConfig.projectName} (${targetProjectId})\n`);
        } else {
          // Use default single project configuration
          targetProjectId = syncData.projectId;
          projectConfig = {
            projectId: targetProjectId,
            projectName: 'Default Project',
            assignee: syncData.defaultAssignee || '',
            milestone: syncData.defaultMilestone || '',
            labels: syncData.defaultLabels || []
          };
        }

  // gitIdColumn and existingGitIdValue were computed earlier (reused here)
        if (existingGitIdValue) {
          // Do NOT close or modify pre-existing GitLab issue references. Skip rows that already have a Git ID.
          syncStateManager.addOutput(`  - Skipping row ${i + 2}: existing GitLab ID present (not modifying old issues)\n`);
          continue;
        }

        // Create GitLab issue with project-specific configuration
        const issue = await createGitLabIssue(gitlabUrl, headers, targetProjectId, projectConfig, taskData);
        createdIssues++;

        syncStateManager.addOutput(`  - Created issue #${issue.iid}: ${issue.title}\n`);

        // Update the Google Sheet with the issue ID and link
        if (gitIdColumn) {
          // Create a link to the GitLab issue
          const issueLink = `=HYPERLINK("${issue.web_url}","#${issue.iid}")`;
          row.set(gitIdColumn, issueLink);
          await row.save();
          updatedRows++;

          syncStateManager.addOutput(`  - Updated sheet with issue link: #${issue.iid}\n`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

        // After creating a new issue, if the config requests status-check-before-close, close newly created issue
        try {
          const shouldCheckStatus = !!syncData.checkStatusBeforeClose;
          if (shouldCheckStatus) {
            const statusCol = syncData.columnMappings ? resolveColumnFromMapping(syncData.columnMappings.STATUS, sheet.headerValues) : null;
            const rawStatus = statusCol ? (row.get(statusCol) || '') : '';
            const statusVal = rawStatus.toString().trim();
            const normalized = statusVal.toLowerCase().replace(/[^a-z0-9]/g, '');
            const completionKeywords = ['completed', 'complete', 'compleat', 'complet', 'done', 'closed', 'finish', 'finished', 'resolved'];
            const shouldClose = completionKeywords.some(k => normalized.includes(k));
            syncStateManager.addOutput(`  - Row ${i + 2} post-create status check: "${statusVal}" -> shouldClose=${shouldClose}\n`);

            if (shouldClose) {
              try {
                const iid = issue && issue.iid ? issue.iid : null;
                if (iid) {
                  const closeResp = await fetch(`${gitlabUrl}projects/${encodeURIComponent(targetProjectId)}/issues/${iid}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ state_event: 'close' }),
                  });

                  if (closeResp.ok) {
                    syncStateManager.addOutput(`  - Closed newly created issue #${iid} for row ${i + 2}\n`);
                  } else {
                    let errMsg = '';
                    try { const errData = await closeResp.json(); errMsg = errData.message || JSON.stringify(errData); } catch (e) { try { errMsg = await closeResp.text(); } catch (e2) { errMsg = closeResp.statusText || String(closeResp.status); } }
                    syncStateManager.addOutput(`  - Failed to close newly created issue #${iid} for row ${i + 2}: ${closeResp.status} ${closeResp.statusText} - ${errMsg}\n`);
                  }
                }
              } catch (err) {
                syncStateManager.addOutput(`  - Error closing newly created issue for row ${i + 2}: ${err.message}\n`);
              }
            }
          }
        } catch (err) {
          syncStateManager.addOutput(`  - Error during post-create status check for row ${i + 2}: ${err.message}\n`);
        }

      } catch (error) {
        syncStateManager.addOutput(`  - Error creating issue for row ${i + 2}: ${error.message}\n`);
      }
    }

    // Check if sync was stopped
    if (!syncStateManager.getStatus().running) return;

    // Step 4: Final update
    syncStateManager.setCurrentStep('updating-sheet');
    syncStateManager.addOutput(`[${new Date().toISOString()}] Finalizing updates...\n`);
    syncStateManager.addOutput(`  - Created ${createdIssues} GitLab issues\n`);
    syncStateManager.addOutput(`  - Updated ${updatedRows} sheet rows with issue links\n`);

    // Mark as completed
    syncStateManager.completeSync();
    
  } catch (error) {
    console.error('Sync process error:', error);
    syncStateManager.errorSync(error.message);
  }
}


// Find matching project mapping for task data
function findProjectMapping(projectMappings, taskData) {
  // Try to match by project name first, then specific project
  const projectName = taskData.projectName || '';
  const specificProject = taskData.specificProject || '';
  
  // Look for exact matches first
  let match = projectMappings.find(mapping => 
    mapping.projectName.toLowerCase() === projectName.toLowerCase()
  );
  
  if (!match && specificProject) {
    // Try to find by specific project name
    match = projectMappings.find(mapping => 
      mapping.projectName.toLowerCase() === specificProject.toLowerCase()
    );
  }
  
  if (!match && projectName) {
    // Try partial matching
    match = projectMappings.find(mapping => 
      projectName.toLowerCase().includes(mapping.projectName.toLowerCase()) ||
      mapping.projectName.toLowerCase().includes(projectName.toLowerCase())
    );
  }
  
  return match;
}

// Extract task data from a sheet row using column mappings
function extractTaskData(row, headers) {
  const taskData = {};
  
  // Use column mappings from global sync data
  const columnMappings = globalThis._syncColumnMappings || {};
  
  // Debug: Log column mappings
  console.log('Column mappings available:', columnMappings);
  
  // Extract main task
  const mainTaskColumn = resolveColumnFromMapping(columnMappings.MAIN_TASK, headers);
  taskData.mainTask = mainTaskColumn ? row.get(mainTaskColumn) : '';

  // Extract sub task
  const subTaskColumn = resolveColumnFromMapping(columnMappings.SUB_TASK, headers);
  taskData.subTask = subTaskColumn ? row.get(subTaskColumn) : '';

  // Extract project name
  const projectColumn = resolveColumnFromMapping(columnMappings.PROJECT_NAME, headers);
  taskData.projectName = projectColumn ? row.get(projectColumn) : '';

  // Extract specific project
  const specificProjectColumn = resolveColumnFromMapping(columnMappings.SPECIFIC_PROJECT, headers);
  taskData.specificProject = specificProjectColumn ? row.get(specificProjectColumn) : '';

  // Extract date
  const dateColumn = resolveColumnFromMapping(columnMappings.DATE, headers);
  taskData.date = dateColumn ? row.get(dateColumn) : '';

  // Extract start date
  const startDateColumn = resolveColumnFromMapping(columnMappings.START_DATE, headers);
  taskData.startDate = startDateColumn ? row.get(startDateColumn) : '';

  // Extract due date - use END_DATE
  const dueDateColumn = resolveColumnFromMapping(columnMappings.END_DATE, headers);
  taskData.dueDate = dueDateColumn ? row.get(dueDateColumn) : '';

  // Extract time tracking fields - use PLANNED_ESTIMATION and ACTUAL_ESTIMATION
  const timeEstimateColumn = resolveColumnFromMapping(columnMappings.PLANNED_ESTIMATION, headers);
  taskData.timeEstimate = timeEstimateColumn ? row.get(timeEstimateColumn) : '';

  const timeSpentColumn = resolveColumnFromMapping(columnMappings.ACTUAL_ESTIMATION, headers);
  taskData.timeSpent = timeSpentColumn ? row.get(timeSpentColumn) : '';

  // Extract assignee from sheet if available
  const assigneeColumn = resolveColumnFromMapping(columnMappings.ASSIGNEE, headers);
  taskData.assignee = assigneeColumn ? row.get(assigneeColumn) : '';

  // Debug: Log extracted data
  console.log('Extracted task data:', {
    timeEstimate: taskData.timeEstimate,
    dueDate: taskData.dueDate,
    assignee: taskData.assignee,
    timeEstimateColumn: timeEstimateColumn,
    dueDateColumn: dueDateColumn,
    assigneeColumn: assigneeColumn
  });
  
  return taskData;
}

// Create a GitLab issue
async function createGitLabIssue(gitlabUrl, headers, projectId, projectConfig, taskData) {
  const title = taskData.mainTask;
  let description = '';
  
  if (taskData.subTask) {
    description += `**Sub Task:** ${taskData.subTask}\n\n`;
  }
  
  if (taskData.projectName) {
    description += `**Project:** ${taskData.projectName}\n`;
  }
  
  if (taskData.specificProject) {
    description += `**Specific Project:** ${taskData.specificProject}\n`;
  }
  
  if (taskData.date) {
    description += `**Date:** ${taskData.date}\n`;
  }
  
  if (taskData.startDate) {
    description += `**Start Date:** ${taskData.startDate}\n`;
  }
  
  if (taskData.dueDate) {
    description += `**Due Date:** ${taskData.dueDate}\n`;
  }
  
  if (taskData.timeEstimate) {
    description += `**Time Estimate:** ${taskData.timeEstimate}\n`;
  }
  
  if (taskData.timeSpent) {
    description += `**Time Spent:** ${taskData.timeSpent}\n`;
  }
  
  if (taskData.assignee) {
    description += `**Assignee:** ${taskData.assignee}\n`;
  }
  
  description += `\n*Created automatically from Google Sheets sync*`;
  
  // Debug: Log task data to see what's available
  console.log('Task data for slash commands:', {
    timeEstimate: taskData.timeEstimate,
    dueDate: taskData.dueDate,
    assignee: taskData.assignee,
    projectConfig: {
      assignee: projectConfig.assignee,
      milestone: projectConfig.milestone,
      labels: projectConfig.labels
    }
  });

  // Add GitLab slash commands for better integration
  const assigneeToUse = taskData.assignee || projectConfig.assignee;
  if (assigneeToUse && assigneeToUse !== 'none' && assigneeToUse !== '') {
    description += `\n\n/assign @${assigneeToUse}`;
  }
  
  if (taskData.timeEstimate) {
    description += `\n/estimate ${taskData.timeEstimate}`;
  }
  
  if (taskData.timeSpent) {
    description += `\n/spend ${taskData.timeSpent}`;
  }
  
  if (projectConfig.milestone && projectConfig.milestone !== 'none' && projectConfig.milestone !== '') {
    description += `\n/milestone %${projectConfig.milestone}`;
  }
  
  // Note: Start and due dates are handled via API fields, not slash commands
  
  if (projectConfig.labels && Array.isArray(projectConfig.labels) && projectConfig.labels.length > 0) {
    const validLabels = projectConfig.labels.filter(label => label && label !== 'none' && label !== '');
    if (validLabels.length > 0) {
      description += `\n/label ~${validLabels.join(' ~')}`;
    }
  }
  
  const issueData = {
    title: title,
    description: description,
  };

  // Add date fields using GitLab API (slash commands don't work for dates)
  if (taskData.startDate) {
    // Parse and format the start date for GitLab API
    const startDate = parseFlexibleDate(taskData.startDate);
    if (startDate) {
      issueData.created_at = startDate.toISOString();
    }
  }
  
  if (taskData.dueDate) {
    // Parse and format the due date for GitLab API
    const dueDate = parseFlexibleDate(taskData.dueDate);
    if (dueDate) {
      issueData.due_date = dueDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    }
  }

  console.log('Issue data:', issueData);
  
    // Note: Using slash commands in description instead of API fields for better GitLab integration
  
  // Log the complete request body before sending to GitLab
  console.log('GitLab Issue Creation Request:', {
    url: `${gitlabUrl}projects/${projectId}/issues`,
        headers: headers,
    body: issueData
  });
  
  const response = await fetch(`${gitlabUrl}projects/${projectId}/issues`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(issueData),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`GitLab API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
  }
  
  return await response.json();
}
