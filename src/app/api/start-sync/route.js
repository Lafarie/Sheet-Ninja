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
    const syncData = await request.json();

    console.log(syncData)
    
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

    // Apply date filtering if enabled
    if (syncData.startDate || syncData.endDate) {
      syncStateManager.addOutput(`  - Applying date filter (${syncData.startDate || 'no start'} to ${syncData.endDate || 'no end'})\n`);

      // Allow explicit mapping for DATE column in config
      const mappedDateColumn = syncData.columnMappings ? resolveColumnFromMapping(syncData.columnMappings.DATE || syncData.columnMappings.date, sheet.headerValues) : null;
      const dateColumn = mappedDateColumn || findColumnName(sheet.headerValues, ['date', 'created date', 'task date', 'created_date']);

      if (dateColumn) {
        const originalCount = rows.length;
        rows = rows.filter(row => {
          const dateValue = row.get(dateColumn);
          if (!dateValue) return false;

          const rowDate = parseFlexibleDate(dateValue);
          if (!rowDate) return false;

          let inRange = true;
          if (syncData.startDate) {
            const startDate = parseFlexibleDate(syncData.startDate) || new Date(syncData.startDate);
            if (!startDate) return false; // invalid startDate -> skip
            inRange = inRange && rowDate >= startDate;
          }
          if (syncData.endDate) {
            const endDate = parseFlexibleDate(syncData.endDate) || new Date(syncData.endDate);
            if (!endDate) return false;
            endDate.setHours(23, 59, 59, 999); // Include full end date
            inRange = inRange && rowDate <= endDate;
          }

          return inRange;
        });
        syncStateManager.addOutput(`  - Date filter applied: ${originalCount} -> ${rows.length} rows (using column: ${dateColumn})\n`);
      } else {
        syncStateManager.addOutput(`  - Warning: Date filter enabled but no date column found. Processing all rows.\n`);
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

      // Determine GitLab ID column and existing value early so we can act on rows
      // that already have an issue even if the main task cell is empty.
      // Prefer an explicit mapping (from saved config) if provided in syncData.columnMappings
      let gitIdColumn = null;
      if (syncData.columnMappings && (syncData.columnMappings.GIT_ID || syncData.columnMappings.git_id || syncData.columnMappings.gitId)) {
        const mapping = syncData.columnMappings.GIT_ID || syncData.columnMappings.git_id || syncData.columnMappings.gitId;
        // Use resolveColumnFromMapping helper which supports object, header string, and numeric (1-based) values
        gitIdColumn = resolveColumnFromMapping(mapping, sheet.headerValues) || gitIdColumn;
      }
      if (!gitIdColumn) {
        gitIdColumn = findColumnName(sheet.headerValues, ['git id', 'gitlab id', 'issue id', 'git_id','git']);
      }
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
          // If we have an existing issue link, optionally check status column before attempting to close
          const shouldCheckStatus = !!syncData.checkStatusBeforeClose;
          let shouldClose = true; // default behavior: close if present

          if (shouldCheckStatus) {
            // Look for a status column (prefer explicit mapping from columnMappings)
            const mappedStatusCol = resolveColumnFromMapping(syncData.columnMappings ? (syncData.columnMappings.STATUS || syncData.columnMappings.status) : null, sheet.headerValues);
            const statusCol = mappedStatusCol || findColumnName(sheet.headerValues, ['status', 'state', 'issue status']);
            const rawStatus = statusCol ? (row.get(statusCol) || '') : '';
            const statusVal = rawStatus.toString().trim();
            // Normalize: lowercase and remove non-alphanumeric to make matching tolerant to punctuation/casing/misspelling
            const normalized = statusVal.toLowerCase().replace(/[^a-z0-9]/g, '');
            // Expanded keywords to catch common variants/misspellings like 'compleated'
            const completionKeywords = ['completed', 'complete', 'compleat', 'complet', 'done', 'closed', 'finish', 'finished', 'resolved'];
            shouldClose = completionKeywords.some(k => normalized.includes(k));
            syncStateManager.addOutput(`  - Row ${i + 2} status check: "${statusVal}" -> shouldClose=${shouldClose}\n`);
          }

          if (shouldClose) {
            try {
              // Extract IID from the stored issue link or id (e.g. #123 or url)
              const iidMatch = String(existingGitIdValue).match(/#(\d+)|\/(\d+)(?:$|\D)/);
              let iid = null;
              if (iidMatch) {
                iid = iidMatch[1] || iidMatch[2];
              } else {
                // Fallback: try to parse digits
                const digits = String(existingGitIdValue).match(/(\d+)/);
                iid = digits ? digits[1] : null;
              }

              if (iid) {
                // Close the issue via GitLab API (uses resolved targetProjectId)
                const closeResp = await fetch(`${gitlabUrl}projects/${encodeURIComponent(targetProjectId)}/issues/${iid}`, {
                  method: 'PUT',
                  headers,
                  body: JSON.stringify({ state_event: 'close' }),
                });

                if (closeResp.ok) {
                  syncStateManager.addOutput(`  - Closed existing issue #${iid} for row ${i + 2}\n`);
                } else {
                  // Try to parse JSON error, fallback to raw text for debugging
                  let errMsg = '';
                  try {
                    const errData = await closeResp.json();
                    errMsg = errData.message || JSON.stringify(errData);
                  } catch (e) {
                    try {
                      errMsg = await closeResp.text();
                    } catch (e2) {
                      errMsg = closeResp.statusText || String(closeResp.status);
                    }
                  }
                  syncStateManager.addOutput(`  - Failed to close issue #${iid} for row ${i + 2}: ${closeResp.status} ${closeResp.statusText} - ${errMsg}\n`);
                  // For debugging, add a hint about possible reasons
                  syncStateManager.addOutput(`  - Hint: this may be due to using GitLab Work Items (GraphQL) instead of Issues (REST), insufficient permissions, or an incorrect project id.\n`);
                }
              } else {
                syncStateManager.addOutput(`  - Could not parse issue id from cell for row ${i + 2}, skipping close\n`);
              }
            } catch (err) {
              syncStateManager.addOutput(`  - Error closing existing issue for row ${i + 2}: ${err.message}\n`);
            }
          } else {
            syncStateManager.addOutput(`  - Not closing existing issue for row ${i + 2} due to status check\n`);
          }

          // Continue to next row (do not create a new issue)
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

// Helper function to find column name (case-insensitive)
function findColumnName(headers, possibleNames) {
  for (const possibleName of possibleNames) {
    const found = headers.find(header => 
      header.toLowerCase().trim().includes(possibleName.toLowerCase())
    );
    if (found) return found;
  }
  return null;
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

// Extract task data from a sheet row
function extractTaskData(row, headers) {
  const taskData = {};
  
  // Allow callers to pass in syncData.columnMappings by using a closure-resolved helper
  // If columnMappings isn't available here, fall back to header heuristics
  // Try to find main task column
  const mainTaskColumn = (typeof resolveColumnFromMapping === 'function' && globalThis && globalThis._syncColumnMappings)
    ? resolveColumnFromMapping(globalThis._syncColumnMappings.MAIN_TASK || globalThis._syncColumnMappings.MAIN_task || globalThis._syncColumnMappings.MAIN, headers)
    : null;
  const mainCol = mainTaskColumn || findColumnName(headers, ['main task', 'task', 'title', 'main_task']);
  taskData.mainTask = mainCol ? row.get(mainCol) : '';

  // Try to find sub task column
  const subTaskColumn = (typeof resolveColumnFromMapping === 'function' && globalThis && globalThis._syncColumnMappings)
    ? resolveColumnFromMapping(globalThis._syncColumnMappings.SUB_TASK || globalThis._syncColumnMappings.SUB_task || globalThis._syncColumnMappings.SUB, headers)
    : null;
  const subCol = subTaskColumn || findColumnName(headers, ['sub task', 'subtask', 'sub_task', 'description']);
  taskData.subTask = subCol ? row.get(subCol) : '';

  // Try to find project name
  const projectColumn = (typeof resolveColumnFromMapping === 'function' && globalThis && globalThis._syncColumnMappings)
    ? resolveColumnFromMapping(globalThis._syncColumnMappings.PROJECT_NAME || globalThis._syncColumnMappings.PROJECT || globalThis._syncColumnMappings.projectName, headers)
    : null;
  const projCol = projectColumn || findColumnName(headers, ['project name', 'project', 'project_name']);
  taskData.projectName = projCol ? row.get(projCol) : '';

  // Try to find specific project
  const specificProjectColumn = (typeof resolveColumnFromMapping === 'function' && globalThis && globalThis._syncColumnMappings)
    ? resolveColumnFromMapping(globalThis._syncColumnMappings.SPECIFIC_PROJECT || globalThis._syncColumnMappings.SPECIFIC_project, headers)
    : null;
  const specCol = specificProjectColumn || findColumnName(headers, ['specific project', 'specific_project']);
  taskData.specificProject = specCol ? row.get(specCol) : '';

  // Try to find date
  const dateColumn = (typeof resolveColumnFromMapping === 'function' && globalThis && globalThis._syncColumnMappings)
    ? resolveColumnFromMapping(globalThis._syncColumnMappings.DATE || globalThis._syncColumnMappings.date, headers)
    : null;
  const dCol = dateColumn || findColumnName(headers, ['date', 'created date', 'task date']);
  taskData.date = dCol ? row.get(dCol) : '';
  
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
  
  description += `\n*Created automatically from Google Sheets sync*`;
  
  const issueData = {
    title: title,
    description: description,
  };
  
    // Add optional fields if configured in project config
    if (projectConfig.assignee && projectConfig.assignee !== 'none' && projectConfig.assignee !== '') {
      // For assignee, we need to get the user ID by username
      const assigneeResponse = await fetch(`${gitlabUrl}projects/${projectId}/members/all`, {
        headers: headers,
      });
      
      if (assigneeResponse.ok) {
        const members = await assigneeResponse.json();
        const assignee = members.find(m => m.username === projectConfig.assignee);
        if (assignee) {
          issueData.assignee_ids = [assignee.id];
        }
      }
    }
    
    if (projectConfig.milestone && projectConfig.milestone !== 'none' && projectConfig.milestone !== '') {
      // Milestone ID should be numeric
      issueData.milestone_id = parseInt(projectConfig.milestone);
    }
    
    if (projectConfig.labels && Array.isArray(projectConfig.labels) && projectConfig.labels.length > 0) {
      // Filter out empty labels and 'none' values
      const validLabels = projectConfig.labels.filter(label => label && label !== 'none' && label !== '');
      if (validLabels.length > 0) {
        issueData.labels = validLabels;
      }
    }
  
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
