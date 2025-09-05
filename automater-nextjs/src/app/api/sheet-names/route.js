import { NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import path from 'path';

export async function POST(request) {
  try {
    const { spreadsheetId } = await request.json();

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Spreadsheet ID is required' },
        { status: 400 }
      );
    }

    // Path to the service account file
    const serviceAccountPath = path.join(process.cwd(), 'uploads', 'service_account.json');
    
    // Create JWT auth
    const serviceAccountAuth = new JWT({
      keyFile: serviceAccountPath,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
      ],
    });

    // Initialize the sheet
    const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
    await doc.loadInfo();

    // Get all sheet names
    const sheetNames = doc.sheetsByIndex.map(sheet => sheet.title);

    return NextResponse.json({ sheetNames });
  } catch (error) {
    console.error('Error fetching sheet names:', error);
    
    if (error.message.includes('The caller does not have permission')) {
      return NextResponse.json(
        { error: 'Permission denied. Please make sure the service account email has been added to the spreadsheet with editor permissions.' },
        { status: 403 }
      );
    }
    
    if (error.message.includes('Requested entity was not found')) {
      return NextResponse.json(
        { error: 'Spreadsheet not found. Please check the spreadsheet ID.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch sheet names: ' + error.message },
      { status: 500 }
    );
  }
}
