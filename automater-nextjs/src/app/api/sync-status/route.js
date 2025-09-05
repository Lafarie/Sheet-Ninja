import { NextResponse } from 'next/server';
import syncStateManager from '@/lib/syncStateManager';

export async function GET(request) {
  try {
    const status = syncStateManager.getStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('Error getting sync status:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status: ' + error.message },
      { status: 500 }
    );
  }
}
