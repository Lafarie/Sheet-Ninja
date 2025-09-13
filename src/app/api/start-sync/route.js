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

export async function POST(request) {
  try {
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

    // Start the sync process
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
    // Step 1: Initialize
    syncStateManager.setCurrentStep('sync-start');
    syncStateManager.addOutput(`[${new Date().toISOString()}] Starting Sync...\n`);
    
    // Step 2: Connect to Google Sheets
    syncStateManager.setCurrentStep('reading-sheet');
    syncStateManager.addOutput(`[${new Date().toISOString()}] Reading Sheet...\n`);
    syncStateManager.addOutput(`  - Connecting to spreadsheet: ${syncData.spreadsheetId}\n`);
    syncStateManager.addOutput(`  - Reading worksheet: ${syncData.worksheetName}\n`);
    
    // Resolve service account: prefer DB-saved, then inline body, then local uploaded file
    let serviceAccountAuth = null;
    let resolvedServiceAccount = null;

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
      console.warn('Could not read DB service account:', e);
    }

    // Inline body takes precedence after DB
    if (!resolvedServiceAccount && syncData.serviceAccount && syncData.serviceAccount.client_email && syncData.serviceAccount.private_key) {
      resolvedServiceAccount = syncData.serviceAccount;
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
    } else {
      // Fallback to server-side uploaded file
      const serviceAccountPath = path.join(process.cwd(), 'uploads', 'service_account.json');
      if (!fs.existsSync(serviceAccountPath)) {
        // Cannot proceed without credentials; mark sync as errored and stop
        syncStateManager.errorSync('No service account credentials available. Please upload one or save a config with a service account.');
        return;
      }
      serviceAccountAuth = new JWT({
        keyFile: serviceAccountPath,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file',
        ],
      });
    }

    const doc = new GoogleSpreadsheet(syncData.spreadsheetId, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[syncData.worksheetName];
    
    if (!sheet) {
      throw new Error(`Worksheet "${syncData.worksheetName}" not found`);
    }

    // Load rows from the sheet
    await sheet.loadHeaderRow();
    const rows = await sheet.getRows();
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

      // Skip rows that already have a GitLab ID
      const gitIdColumn = findColumnName(sheet.headerValues, ['git id', 'gitlab id', 'issue id', 'git_id']);
      if (gitIdColumn && row.get(gitIdColumn)) {
        syncStateManager.addOutput(`  - Skipping row ${i + 2}: Already has GitLab ID\n`);
        continue;
      }

      // Get task data from the row
      const taskData = extractTaskData(row, sheet.headerValues);
      
      if (!taskData.mainTask) {
        syncStateManager.addOutput(`  - Skipping row ${i + 2}: No main task found\n`);
        continue;
      }

      try {
        // Determine which project configuration to use
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
  
  // Try to find main task column
  const mainTaskColumn = findColumnName(headers, ['main task', 'task', 'title', 'main_task']);
  taskData.mainTask = mainTaskColumn ? row.get(mainTaskColumn) : '';
  
  // Try to find sub task column
  const subTaskColumn = findColumnName(headers, ['sub task', 'subtask', 'sub_task', 'description']);
  taskData.subTask = subTaskColumn ? row.get(subTaskColumn) : '';
  
  // Try to find project name
  const projectColumn = findColumnName(headers, ['project name', 'project', 'project_name']);
  taskData.projectName = projectColumn ? row.get(projectColumn) : '';
  
  // Try to find specific project
  const specificProjectColumn = findColumnName(headers, ['specific project', 'specific_project']);
  taskData.specificProject = specificProjectColumn ? row.get(specificProjectColumn) : '';
  
  // Try to find date
  const dateColumn = findColumnName(headers, ['date', 'created date', 'task date']);
  taskData.date = dateColumn ? row.get(dateColumn) : '';
  
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
