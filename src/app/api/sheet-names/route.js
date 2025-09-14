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
    const { spreadsheetId, serviceAccount } = body || {};

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Spreadsheet ID is required' },
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
