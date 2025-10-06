import { NextResponse } from 'next/server';
import syncStateManager from '@/lib/syncStateManager';

export async function GET(request) {
  try {
    const status = syncStateManager.getStatus();
    // Convert output array to formatted string for easier consumption
    const formattedStatus = {
      ...status,
      output: syncStateManager.getFormattedOutput()
    };
    
    // Debug logging for completion detection
    if (status.currentStep === 'completed' || (!status.running && status.endTime)) {
      console.log('Sync status API: Sync appears completed', {
        currentStep: status.currentStep,
        running: status.running,
        endTime: status.endTime,
        hasOutput: !!formattedStatus.output
      });
    }
    
    return NextResponse.json(formattedStatus);
  } catch (error) {
    console.error('Error getting sync status:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status: ' + error.message },
      { status: 500 }
    );
  }
}
