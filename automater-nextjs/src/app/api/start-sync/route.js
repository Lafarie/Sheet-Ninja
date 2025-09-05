import { NextResponse } from 'next/server';
import syncStateManager from '@/lib/syncStateManager';

export async function POST(request) {
  try {
    const syncData = await request.json();
    
    // Validate required fields
    const requiredFields = ['gitlabUrl', 'gitlabToken', 'projectId', 'spreadsheetId', 'worksheetName'];
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
      return NextResponse.json(
        { error: 'Sync is already running' },
        { status: 409 }
      );
    }

    // Start the sync process
    syncStateManager.startSync();
    startSyncProcess(syncData);

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

// Simulate sync process (replace with actual sync logic)
async function startSyncProcess(syncData) {
  try {
    const steps = [
      { id: 'sync-start', title: 'Starting Sync', duration: 1000 },
      { id: 'reading-sheet', title: 'Reading Sheet', duration: 3000 },
      { id: 'creating-issues', title: 'Creating Issues', duration: 5000 },
      { id: 'updating-sheet', title: 'Updating Sheet', duration: 2000 },
      { id: 'completed', title: 'Completed', duration: 500 }
    ];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      // Check if sync was stopped
      const currentStatus = syncStateManager.getStatus();
      if (!currentStatus.running) {
        return;
      }
      
      // Update current step
      syncStateManager.setCurrentStep(step.id);
      syncStateManager.addOutput(`[${new Date().toISOString()}] ${step.title}...\n`);
      
      if (step.id === 'reading-sheet') {
        syncStateManager.addOutput(`  - Connecting to spreadsheet: ${syncData.spreadsheetId}\n`);
        syncStateManager.addOutput(`  - Reading worksheet: ${syncData.worksheetName}\n`);
      } else if (step.id === 'creating-issues') {
        syncStateManager.addOutput(`  - Connecting to GitLab project: ${syncData.projectId}\n`);
        syncStateManager.addOutput(`  - Creating issues with defaults:\n`);
        if (syncData.defaultAssignee) syncStateManager.addOutput(`    • Assignee: ${syncData.defaultAssignee}\n`);
        if (syncData.defaultMilestone) syncStateManager.addOutput(`    • Milestone: ${syncData.defaultMilestone}\n`);
        if (syncData.defaultLabel) syncStateManager.addOutput(`    • Label: ${syncData.defaultLabel}\n`);
        if (syncData.defaultEstimate) syncStateManager.addOutput(`    • Estimate: ${syncData.defaultEstimate}\n`);
      }
      
      // Wait for step duration
      await new Promise(resolve => setTimeout(resolve, step.duration));
    }

    // Mark as completed
    syncStateManager.completeSync();
    
  } catch (error) {
    console.error('Sync process error:', error);
    syncStateManager.errorSync(error.message);
  }
}
