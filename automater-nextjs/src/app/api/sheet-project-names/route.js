import { NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import path from 'path';

export async function POST(request) {
  try {
    const { spreadsheetId, worksheetName } = await request.json();
    
    if (!spreadsheetId || !worksheetName) {
      return NextResponse.json(
        { error: 'Missing required fields: spreadsheetId and worksheetName' },
        { status: 400 }
      );
    }

    // Initialize Google Sheets connection
    const serviceAccountPath = path.join(process.cwd(), 'uploads', 'service_account.json');
    const serviceAccountAuth = new JWT({
      keyFile: serviceAccountPath,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
      ],
    });

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
      
      // // Get specific project name
      // if (projectColumns.specific) {
      //   const specificProject = row.get(projectColumns.specific);
      //   if (specificProject && specificProject.trim()) {
      //     projectNames.add(specificProject.trim());
      //   }
      // }
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
