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
    const { spreadsheetId, worksheetName, userColumn, serviceAccount } = body || {};

    if (!spreadsheetId || !worksheetName || !userColumn) {
      return NextResponse.json(
        { error: 'Spreadsheet ID, worksheet name, and user column are required' },
        { status: 400 }
      );
    }

    // Resolve service account: prefer DB-saved, then inline body, then local uploaded file
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

    // Inline body takes precedence after DB
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
      // Fallback to server-side uploaded file
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

    // Initialize the sheet with timeout
    const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
    
    // Add timeout to prevent hanging requests
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout: Google Sheets API took too long to respond')), 15000);
    });
    
    const loadInfoPromise = doc.loadInfo();
    
    await Promise.race([loadInfoPromise, timeoutPromise]);

    // Get the specific worksheet
    const sheet = doc.sheetsByTitle[worksheetName];
    if (!sheet) {
      return NextResponse.json(
        { error: `Worksheet "${worksheetName}" not found` },
        { status: 404 }
      );
    }

    // Load all rows
    await sheet.loadCells();
    
    // Get all rows with data
    const rows = await sheet.getRows();
    
    // Extract unique users from the specified column
    const userColumnIndex = parseInt(userColumn) - 1; // Convert to 0-based index
    const users = new Set();
    
    rows.forEach(row => {
      const userValue = row.values[userColumnIndex];
      if (userValue && typeof userValue === 'string' && userValue.trim()) {
        users.add(userValue.trim());
      }
    });

    const uniqueUsers = Array.from(users).sort();

    return NextResponse.json({ 
      users: uniqueUsers,
      total: uniqueUsers.length 
    });
  } catch (error) {
    console.error('Error fetching user names:', error);
    
    if (error.message.includes('Request timeout')) {
      return NextResponse.json(
        { error: 'Request timeout. The Google Sheets API took too long to respond. Please try again.' },
        { status: 408 }
      );
    }
    
    if (error.message.includes('The caller does not have permission') || error.message.includes('PERMISSION_DENIED')) {
      return NextResponse.json(
        { error: 'Permission denied. Please make sure the service account email has been added to the spreadsheet with editor permissions.' },
        { status: 403 }
      );
    }
    
    if (error.message.includes('Requested entity was not found') || error.message.includes('NOT_FOUND')) {
      return NextResponse.json(
        { error: 'Spreadsheet or worksheet not found. Please check the IDs and ensure they exist.' },
        { status: 404 }
      );
    }

    if (error.message.includes('INVALID_ARGUMENT') || error.message.includes('Invalid spreadsheet ID')) {
      return NextResponse.json(
        { error: 'Invalid spreadsheet ID format. Please check the ID and try again.' },
        { status: 400 }
      );
    }

    if (error.message.includes('UNAUTHENTICATED') || error.message.includes('Invalid credentials')) {
      return NextResponse.json(
        { error: 'Authentication failed. Please check your service account credentials.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch user names: ' + error.message },
      { status: 500 }
    );
  }
}
