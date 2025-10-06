import { NextResponse } from 'next/server';
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
    const body = await request.json();
    const { spreadsheetId, worksheetName, serviceAccount } = body || {};

    if (!spreadsheetId || !worksheetName) {
      return NextResponse.json(
        { error: 'Spreadsheet ID and worksheet name are required' },
        { status: 400 }
      );
    }

    // Resolve service account: DB -> inline -> local file
    let serviceAccountAuth = null;
    let resolvedServiceAccount = null;

    try {
      const session = await getServerSession(authOptions);
      if (session?.user?.id) {
        const dbConfig = await prisma.savedConfig.findFirst({
          where: {
            userId: session.user.id,
            OR: [{ spreadsheetId }, { isDefault: true }],
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

    if (!resolvedServiceAccount && serviceAccount && serviceAccount.client_email && serviceAccount.private_key) {
      resolvedServiceAccount = serviceAccount;
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
      const serviceAccountPath = path.join(process.cwd(), 'uploads', 'service_account.json');
      if (!fs.existsSync(serviceAccountPath)) {
        return NextResponse.json({ error: 'No service account credentials available. Please upload one or save a config with a service account.' }, { status: 400 });
      }
      serviceAccountAuth = new JWT({
        keyFile: serviceAccountPath,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file',
        ],
      });
    }

    // Initialize the sheet
    const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
    await doc.loadInfo();

    // Get the specific worksheet
    const sheet = doc.sheetsByTitle[worksheetName];
    
    if (!sheet) {
      return NextResponse.json(
        { error: `Worksheet "${worksheetName}" not found` },
        { status: 404 }
      );
    }

    // Try to load headers with duplicate handling
    let rawHeaders = [];
    
    try {
      // Load the header row
      await sheet.loadHeaderRow();
      rawHeaders = sheet.headerValues || [];
    } catch (headerError) {
      console.warn('Failed to load header row, trying alternative method:', headerError.message);
      
      // Fallback: Get first row data directly
      try {
        const rows = await sheet.getRows({ limit: 1 });
        if (rows.length > 0) {
          rawHeaders = Object.keys(rows[0]._rawData || {});
        }
      } catch (fallbackError) {
        console.warn('Fallback method also failed:', fallbackError.message);
        // Last resort: generate generic headers
        rawHeaders = Array.from({ length: 10 }, (_, i) => `Column ${i + 1}`);
      }
    }
    
    // Process headers to handle duplicates
    const headers = [];
    const headerCounts = {};
    
    rawHeaders.forEach((header, index) => {
      if (!header || header.trim() === '') {
        headers.push(`Column ${index + 1}`);
        return;
      }
      
      const cleanHeader = header.trim();
      if (headerCounts[cleanHeader]) {
        headerCounts[cleanHeader]++;
        headers.push(`${cleanHeader} (${headerCounts[cleanHeader]})`);
      } else {
        headerCounts[cleanHeader] = 1;
        headers.push(cleanHeader);
      }
    });

    return NextResponse.json({ headers });
  } catch (error) {
    console.error('Error detecting headers:', error);
    
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

    if (error.message.includes('Duplicate header detected')) {
      return NextResponse.json(
        { error: 'Duplicate headers detected in the spreadsheet. Please ensure all column headers are unique, or the system will automatically rename duplicates.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to detect headers: ' + error.message },
      { status: 500 }
    );
  }
}
