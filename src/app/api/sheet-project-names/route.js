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
        { error: 'Missing required fields: spreadsheetId and worksheetName' },
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

    const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
    await doc.loadInfo();
    
    // Find the specified worksheet
    const sheet = doc.sheetsByTitle[worksheetName];
    if (!sheet) {
      return NextResponse.json(
        { error: `Worksheet "${worksheetName}" not found` },
        { status: 404 }
      );
    }

    // Load data from sheet
    await sheet.loadHeaderRow();
    const rows = await sheet.getRows();

    // Find project name columns
    const projectColumns = findProjectColumns(sheet.headerValues);
    
    if (!projectColumns.main && !projectColumns.specific) {
      return NextResponse.json(
        { error: 'No project name columns found in the sheet' },
        { status: 404 }
      );
    }

    // Extract unique project names
    const projectNames = new Set();
    
    for (const row of rows) {
      // Get main project name
      if (projectColumns.main) {
        const mainProject = row.get(projectColumns.main);
        if (mainProject && mainProject.trim()) {
          projectNames.add(mainProject.trim());
        }
      }
    }

    // Convert to array and remove empty values
    const uniqueProjectNames = Array.from(projectNames)
      .filter(name => name && name.length > 0)
      .sort();

    return NextResponse.json({
      projectNames: uniqueProjectNames,
      totalRows: rows.length,
      projectColumns: projectColumns
    });

  } catch (error) {
    console.error('Error fetching project names:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project names: ' + error.message },
      { status: 500 }
    );
  }
}

// Helper function to find project-related columns
function findProjectColumns(headers) {
  const result = { main: null, specific: null };
  
  // Look for main project column
  const mainProjectPatterns = ['project name', 'project', 'main project', 'project_name'];
  result.main = findColumnName(headers, mainProjectPatterns);
  
  // // Look for specific project column
  // const specificProjectPatterns = ['specific project', 'specific_project', 'sub project', 'subproject'];
  // result.specific = findColumnName(headers, specificProjectPatterns);
  
  return result;
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
