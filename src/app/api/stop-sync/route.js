import { NextResponse } from 'next/server';
import syncStateManager from '@/lib/syncStateManager';

export async function POST(request) {
  try {
    const currentStatus = syncStateManager.getStatus();
    
    if (!currentStatus.running) {
      return NextResponse.json(
        { message: 'No sync process is currently running' },
        { status: 200 }
      );
    }

    // Stop the sync process
    syncStateManager.stopSync();

    return NextResponse.json({ 
      message: 'Sync stopped successfully',
      status: 'stopped'
    });
  } catch (error) {
    console.error('Error stopping sync:', error);
    return NextResponse.json(
      { error: 'Failed to stop sync: ' + error.message },
      { status: 500 }
    );
  }
}
