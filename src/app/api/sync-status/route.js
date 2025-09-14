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
    return NextResponse.json(formattedStatus);
  } catch (error) {
    console.error('Error getting sync status:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status: ' + error.message },
      { status: 500 }
    );
  }
}
