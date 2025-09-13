import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request) {
  try {
    // Expect JSON body with either { serviceAccount: { ... } } or raw JSON content
    const body = await request.json();
    const serviceAccount = body && (body.serviceAccount || body);

    if (!serviceAccount || !serviceAccount.client_email || !serviceAccount.private_key) {
      return NextResponse.json(
        { error: 'Invalid service account JSON provided' },
        { status: 400 }
      );
    }

    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, 'service_account.json');
    fs.writeFileSync(filePath, JSON.stringify(serviceAccount, null, 2), { encoding: 'utf8' });

    return NextResponse.json({ success: true, path: '/uploads/service_account.json' });
  } catch (error) {
    console.error('Error saving service account:', error);
    return NextResponse.json({ error: 'Failed to save service account: ' + error.message }, { status: 500 });
  }
}

export const runtime = 'edge';
