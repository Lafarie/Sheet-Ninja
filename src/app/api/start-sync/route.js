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

// Helper: parse DD/MM/YYYY, DD-MM-YYYY, or YYYY-MM-DD date format
function parseDDMMYYYYDate(value) {
  if (!value) return null;
  // If already a Date
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  const s = String(value).trim();
  if (!s) return null;

  console.log('parseDDMMYYYYDate input:', { value, s });

  // Try YYYY-MM-DD format first (ISO format)
  const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  console.log('YYYY-MM-DD match:', ymd);
  if (ymd) {
    const year = parseInt(ymd[1], 10);
    const month = parseInt(ymd[2], 10);
    const day = parseInt(ymd[3], 10);
    
    console.log('YYYY-MM-DD parsed:', { year, month, day });
    
    // Validate date components
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
      console.log('YYYY-MM-DD validation failed');
      return null;
    }
    
    const maybe = new Date(year, month - 1, day);
    console.log('YYYY-MM-DD result:', maybe);
    if (!isNaN(maybe.getTime())) return maybe;
  }

  // Accept both DD/MM/YYYY and DD-MM-YYYY formats
  const dmY = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  console.log('Double separator match:', dmY);
  if (dmY) {
    const first = parseInt(dmY[1], 10);
    const second = parseInt(dmY[2], 10);
    const year = parseInt(dmY[3], 10);
    
    console.log('Double separator parsed:', { first, second, year });
    
    // Validate year
    if (year < 1900 || year > 2100) {
      console.log('Double separator validation failed - invalid year');
      return null;
    }
    
    // Try DD-MM-YYYY format first (European format)
    if (first >= 1 && first <= 31 && second >= 1 && second <= 12) {
      const day = first;
      const month = second;
      console.log('Interpreting as DD-MM-YYYY:', { day, month, year });
      
      const maybe = new Date(year, month - 1, day);
      console.log('DD-MM-YYYY result:', maybe);
      if (!isNaN(maybe.getTime())) return maybe;
    }
    
    // Try MM-DD-YYYY format (American format)
    if (first >= 1 && first <= 12 && second >= 1 && second <= 31) {
      const month = first;
      const day = second;
      console.log('Interpreting as MM-DD-YYYY:', { month, day, year });
      
      const maybe = new Date(year, month - 1, day);
      console.log('MM-DD-YYYY result:', maybe);
      if (!isNaN(maybe.getTime())) return maybe;
    }
    
    console.log('Double separator validation failed - no valid interpretation');
    return null;
  }

  // Also try DD-MM-YYYY format (single separator) - this is redundant now but kept for compatibility
  const dmY_single = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  console.log('Single separator match:', dmY_single);
  if (dmY_single) {
    const first = parseInt(dmY_single[1], 10);
    const second = parseInt(dmY_single[2], 10);
    const year = parseInt(dmY_single[3], 10);
    
    console.log('Single separator parsed:', { first, second, year });
    
    // Validate year
    if (year < 1900 || year > 2100) {
      console.log('Single separator validation failed - invalid year');
      return null;
    }
    
    // Try DD-MM-YYYY format first (European format)
    if (first >= 1 && first <= 31 && second >= 1 && second <= 12) {
      const day = first;
      const month = second;
      console.log('Single separator - DD-MM-YYYY:', { day, month, year });
      
      const maybe = new Date(year, month - 1, day);
      console.log('Single separator - DD-MM-YYYY result:', maybe);
      if (!isNaN(maybe.getTime())) return maybe;
    }
    
    // Try MM-DD-YYYY format (American format)
    if (first >= 1 && first <= 12 && second >= 1 && second <= 31) {
      const month = first;
      const day = second;
      console.log('Single separator - MM-DD-YYYY:', { month, day, year });
      
      const maybe = new Date(year, month - 1, day);
      console.log('Single separator - MM-DD-YYYY result:', maybe);
      if (!isNaN(maybe.getTime())) return maybe;
    }
    
    console.log('Single separator validation failed - no valid interpretation');
    return null;
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
    
    

    // Note: Using the global parseDDMMYYYYDate function defined at the top of the file

    // Debug: Log user filter information
    syncStateManager.addOutput(`  - User filter debug: ${JSON.stringify({
      userFilter: syncData.userFilter,
      userFilterType: typeof syncData.userFilter,
      userFilterLength: syncData.userFilter ? syncData.userFilter.length : 0,
      columnMappings: syncData.columnMappings,
      hasUserMapping: !!syncData.columnMappings?.USER
    })}\n`);


    console.log('Sync data:', syncData);

    // Apply user filtering if enabled
    if (syncData.userFilter && syncData.userFilter !== 'all') {
      syncStateManager.addOutput(`  - Applying user filter for: ${syncData.userFilter}\n`);
      
      const userColumn = syncData.columnMappings ? resolveColumnFromMapping(syncData.columnMappings.USER, sheet.headerValues) : null;
      
      if (userColumn) {
        const originalCount = rows.length;
        rows = rows.filter(row => {
          const userValue = row.get(userColumn);
          if (!userValue) {
            syncStateManager.addOutput(`  - Filtering out row with empty user value\n`);
            return false;
          }
          
          // Normalize both values for comparison (trim, lowercase, remove extra spaces)
          const normalizedUserValue = userValue.toString().trim().toLowerCase().replace(/\s+/g, ' ');
          const normalizedFilterValue = syncData.userFilter.trim().toLowerCase().replace(/\s+/g, ' ');
          
          const matches = normalizedUserValue === normalizedFilterValue;
          if (!matches) {
            syncStateManager.addOutput(`  - Filtering out row with user: "${userValue}" (normalized: "${normalizedUserValue}") (looking for: "${syncData.userFilter}" normalized: "${normalizedFilterValue}")\n`);
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

      // Debug: Log date filter parsing
      console.log('Date filter parsing:', {
        startDate: startDate,
        endDate: endDate,
        startDateParsed: startDate ? parseDDMMYYYYDate(startDate) : null,
        endDateParsed: endDate ? parseDDMMYYYYDate(endDate) : null
      });

      // Validate that date filter is properly configured
      if (!startDate && !endDate) {
        syncStateManager.addOutput(`  - ERROR: Date filter enabled but no start or end date provided!\n`);
        syncStateManager.errorSync('Date filter is enabled but no valid dates provided');
        return;
      }

      const dateColumn = syncData.columnMappings ? resolveColumnFromMapping(syncData.columnMappings.DATE, sheet.headerValues) : null;

      // Debug: Log column resolution details
      console.log('Date column resolution:', {
        columnMappings: syncData.columnMappings,
        dateMapping: syncData.columnMappings?.DATE,
        sheetHeaders: sheet.headerValues,
        resolvedDateColumn: dateColumn
      });

      if (dateColumn) {
        const originalCount = rows.length;
        
        // Parse filter dates once
        const parsedStartDate = startDate ? parseDDMMYYYYDate(startDate) : null;
        const parsedEndDate = endDate ? parseDDMMYYYYDate(endDate) : null;
        
        // Validate parsed dates
        if (startDate && !parsedStartDate) {
          syncStateManager.addOutput(`  - ERROR: Invalid start date format: ${startDate}. Expected DD/MM/YYYY or DD-MM-YYYY format.\n`);
          syncStateManager.errorSync('Invalid start date format');
          return;
        }
        
        if (endDate && !parsedEndDate) {
          syncStateManager.addOutput(`  - ERROR: Invalid end date format: ${endDate}. Expected DD/MM/YYYY or DD-MM-YYYY format.\n`);
          syncStateManager.errorSync('Invalid end date format');
          return;
        }
        
        // Set end date to end of day for inclusive filtering
        if (parsedEndDate) {
          parsedEndDate.setHours(23, 59, 59, 999);
        }
        
        // Debug: Log all date values from the sheet before filtering
        console.log('Date values from sheet before filtering:', {
          dateColumn: dateColumn,
          totalRows: originalCount,
          dateValues: rows.map((row, index) => ({
            rowIndex: index + 2, // +2 because sheet rows are 1-based and we skip header
            dateValue: row.get(dateColumn),
            rawValue: row.get(dateColumn)
          }))
        });
        
        rows = rows.filter(row => {
          const dateValue = row.get(dateColumn);
          if (!dateValue) {
            syncStateManager.addOutput(`  - Filtering out row with empty date value\n`);
            return false;
          }

          const rowDate = parseDDMMYYYYDate(dateValue);
          if (!rowDate) {
            console.log('Row date parsing failed:', {
              dateValue: dateValue,
              type: typeof dateValue,
              // Try alternative parsing
              alternativeParse: new Date(dateValue)
            });
            syncStateManager.addOutput(`  - Filtering out row with unparseable date: "${dateValue}"\n`);
            return false;
          }

          let inRange = true;
          
          // Check start date
          if (parsedStartDate) {
            inRange = inRange && rowDate >= parsedStartDate;
          }
          
          // Check end date
          if (parsedEndDate) {
            inRange = inRange && rowDate <= parsedEndDate;
          }

          // Debug: Log row date filtering
          console.log('Row date filtering:', {
            dateValue: dateValue,
            rowDate: rowDate,
            rowDateFormatted: rowDate ? rowDate.toISOString().split('T')[0] : null,
            inRange: inRange,
            startDate: startDate,
            endDate: endDate,
            parsedStartDate: parsedStartDate,
            parsedEndDate: parsedEndDate,
            comparison: {
              rowDate: rowDate ? rowDate.toISOString().split('T')[0] : 'null',
              startDate: parsedStartDate ? parsedStartDate.toISOString().split('T')[0] : 'null',
              endDate: parsedEndDate ? parsedEndDate.toISOString().split('T')[0] : 'null'
            }
          });

          if (!inRange) {
            syncStateManager.addOutput(`  - Filtering out row with date: "${dateValue}" (${rowDate.toISOString().split('T')[0]}) - outside range\n`);
          }

          return inRange;
        });
        
        // Check if date filtering removed all rows
        if (rows.length === 0 && originalCount > 0) {
          syncStateManager.addOutput(`  - WARNING: Date filter removed all rows! No issues will be created.\n`);
          syncStateManager.addOutput(`  - Filter range: ${startDate || 'no start'} to ${endDate || 'no end'}\n`);
          syncStateManager.addOutput(`  - No rows match the specified date range. Check your date filter settings.\n`);
        }
        
        syncStateManager.addOutput(`  - Date filter applied: ${originalCount} -> ${rows.length} rows (using column: ${dateColumn})\n`);
      } else {
        syncStateManager.addOutput(`  - Warning: Date filter enabled but no DATE column mapping found. Processing all rows.\n`);
      }
    }
    
    syncStateManager.addOutput(`  - Found ${rows.length} rows to process\n`);

    // Final validation: If date filter was enabled and no rows match, stop processing
    if (syncData.dateFilter && (syncData.dateFilter.startDate || syncData.dateFilter.endDate) && rows.length === 0) {
      syncStateManager.addOutput(`  - Date filter is enabled but no rows match the specified date range.\n`);
      syncStateManager.addOutput(`  - Sync completed with 0 issues created due to date filtering.\n`);
      syncStateManager.completeSync();
      return;
    }

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
    // console.log('Sync process completed, final status:', syncStateManager.getStatus());
    
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

  // Extract assignee from sheet if available - check both ASSIGNEE and USER columns
  const assigneeColumn = resolveColumnFromMapping(columnMappings.ASSIGNEE, headers) || 
                        resolveColumnFromMapping(columnMappings.USER, headers);
  taskData.assignee = assigneeColumn ? row.get(assigneeColumn) : '';

  // Debug: Log extracted data
  console.log('Extracted task data:', {
    timeEstimate: taskData.timeEstimate,
    dueDate: taskData.dueDate,
    assignee: taskData.assignee,
    timeEstimateColumn: timeEstimateColumn,
    dueDateColumn: dueDateColumn,
    assigneeColumn: assigneeColumn,
    columnMappings: {
      ASSIGNEE: columnMappings.ASSIGNEE,
      USER: columnMappings.USER,
      SELECTED_USER: columnMappings.SELECTED_USER
    }
  });
  
  return taskData;
}

// Find milestone by date range - returns the first matching milestone
function findMilestoneByDateRange(taskDate, milestones) {
  if (!taskDate || !milestones || milestones.length === 0) return null;
  
  // Sort milestones by start date (chronologically first)
  const sortedMilestones = milestones
    .filter(m => m.start_date || m.due_date)
    .sort((a, b) => {
      // Use start_date if available, otherwise use due_date
      const aDate = new Date(a.start_date || a.due_date);
      const bDate = new Date(b.start_date || b.due_date);
      return aDate - bDate;
    });
  
  // Find the first milestone that matches the task date
  for (const milestone of sortedMilestones) {
    const startDate = milestone.start_date ? new Date(milestone.start_date) : null;
    const dueDate = milestone.due_date ? new Date(milestone.due_date) : null;
    
    let isMatch = false;
    
    // If milestone has both start and due dates, check if task date is within range
    if (startDate && dueDate) {
      isMatch = taskDate >= startDate && taskDate <= dueDate;
    }
    // If milestone only has start date, check if task date is after start date
    else if (startDate && !dueDate) {
      isMatch = taskDate >= startDate;
    }
    // If milestone only has due date, check if task date is before due date
    else if (!startDate && dueDate) {
      isMatch = taskDate <= dueDate;
    }
    
    // Return the first matching milestone (chronologically first)
    if (isMatch) {
      console.log(`Milestone conflict resolved: Selected "${milestone.title}" (start: ${milestone.start_date}, due: ${milestone.due_date}) for task date: ${taskDate.toISOString().split('T')[0]}`);
      return milestone;
    }
  }
  
  return null;
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
  // Try to get assignee from task data, project config, or fallback to selected user filter
  const globalColumnMappings = globalThis._syncColumnMappings || {};
  const selectedUserFilter = globalColumnMappings.SELECTED_USER;
  
  const assigneeToUse = taskData.assignee || projectConfig.assignee || selectedUserFilter;
  
  // Normalize assignee name by removing spaces and converting to lowercase
  const normalizedAssignee = assigneeToUse ? 
    assigneeToUse.toString().trim().toLowerCase().replace(/\s+/g, '') : null;
  
  console.log('Assignee handling:', {
    taskDataAssignee: taskData.assignee,
    projectConfigAssignee: projectConfig.assignee,
    selectedUserFilter: selectedUserFilter,
    assigneeToUse: assigneeToUse,
    normalizedAssignee: normalizedAssignee,
    hasAssignee: !!normalizedAssignee && normalizedAssignee !== 'none' && normalizedAssignee !== ''
  });
  
  if (normalizedAssignee && normalizedAssignee !== 'none' && normalizedAssignee !== '') {
    description += `\n\n/assign @${normalizedAssignee}`;
  }
  
  if (taskData.timeEstimate) {
    description += `\n/estimate ${taskData.timeEstimate}`;
  }
  
  if (taskData.timeSpent) {
    description += `\n/spend ${taskData.timeSpent}`;
  }


  console.log("taskdata:", taskData);
  
  // Add due date slash command for GitLab due date field
  console.log('=== DUE DATE PROCESSING DEBUG ===');
  console.log('taskData.dueDate:', taskData.dueDate);
  console.log('taskData.dueDate type:', typeof taskData.dueDate);
  console.log('taskData.dueDate truthy:', !!taskData.dueDate);
  
  if (taskData.dueDate) {
    console.log('Processing due date:', taskData.dueDate);
    const dueDate = parseDDMMYYYYDate(taskData.dueDate);
    console.log('Parsed due date:', dueDate);
    
    if (dueDate) {
      // Format as YYYY-MM-DD for GitLab slash command
      const formattedDate = dueDate.toISOString().split('T')[0];
      console.log('Formatted date for /due command:', formattedDate);
      
      description += `\n/due ${formattedDate}`;
      console.log('Due date slash command added to description');
      console.log('Current description length:', description.length);
      
      console.log('Due date slash command added:', {
        originalDueDate: taskData.dueDate,
        parsedDate: dueDate,
        formattedDate: formattedDate,
        slashCommand: `/due ${formattedDate}`
      });
    } else {
      console.log('Due date parsing failed:', {
        originalDueDate: taskData.dueDate,
        type: typeof taskData.dueDate
      });
    }
  } else {
    console.log('No due date found in taskData.dueDate');
  }
  console.log('=== END DUE DATE PROCESSING DEBUG ===');
  
  // Auto-assign milestone based on task date and milestone date ranges
  let milestoneToUse = null;
  const taskDate = parseDDMMYYYYDate(taskData.date || taskData.startDate);
  if (taskDate && projectConfig.projectData?.milestones) {
    const matchingMilestone = findMilestoneByDateRange(taskDate, projectConfig.projectData.milestones);
    if (matchingMilestone) {
      milestoneToUse = matchingMilestone.id;
      console.log(`Auto-assigned milestone: ${matchingMilestone.title} for date: ${taskDate.toISOString().split('T')[0]}`);
    }
  }
  
  if (milestoneToUse && milestoneToUse !== 'none' && milestoneToUse !== '') {
    // Find the milestone title from the project data
    const milestoneTitle = projectConfig.projectData?.milestones?.find(m => m.id === milestoneToUse)?.title || milestoneToUse;
    description += `\n/milestone %"${milestoneTitle}"`;
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
    const startDate = parseDDMMYYYYDate(taskData.startDate);
    if (startDate) {
      issueData.created_at = startDate.toISOString();
    }
  }
  
  console.log('=== API FIELD PROCESSING DEBUG ===');
  console.log('Processing due date for API field...');
  
  if (taskData.dueDate) {
    console.log('API field - taskData.dueDate:', taskData.dueDate);
    const dueDate = parseDDMMYYYYDate(taskData.dueDate);
    console.log('API field - parsed due date:', dueDate);
    
    if (dueDate) {
      issueData.due_date = dueDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      console.log('Due date API field set:', {
        originalDueDate: taskData.dueDate,
        parsedDate: dueDate,
        apiField: issueData.due_date
      });
    } else {
      console.log('Due date API field parsing failed:', {
        originalDueDate: taskData.dueDate,
        type: typeof taskData.dueDate
      });
    }
  } else {
    console.log('No due date for API field processing');
  }
  console.log('=== END API FIELD PROCESSING DEBUG ===');

  console.log('=== FINAL DESCRIPTION DEBUG ===');
  console.log('Final description that will be sent to GitLab:');
  console.log('Description length:', description.length);
  console.log('Description content:');
  console.log('--- START DESCRIPTION ---');
  console.log(description);
  console.log('--- END DESCRIPTION ---');
  console.log('=== END FINAL DESCRIPTION DEBUG ===');

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
