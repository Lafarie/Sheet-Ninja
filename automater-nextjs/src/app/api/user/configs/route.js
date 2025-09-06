import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';

// GET - Fetch user's saved configurations
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const configs = await prisma.savedConfig.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        projectMappings: true,
      },
      orderBy: [
        { isDefault: 'desc' },
        { updatedAt: 'desc' },
      ],
    });

    // Decrypt sensitive data before sending to client
    const decryptedConfigs = configs.map(config => ({
      ...config,
      gitlabToken: decrypt(config.gitlabToken),
      serviceAccount: config.serviceAccount ? decrypt(config.serviceAccount) : null,
      columnMappings: config.columnMappings ? JSON.parse(config.columnMappings) : null,
      projectMappings: config.projectMappings.map(pm => ({
        ...pm,
        labels: pm.labels ? JSON.parse(pm.labels) : []
      }))
    }));

    return NextResponse.json({ configs: decryptedConfigs });
  } catch (error) {
    console.error('Error fetching configs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new configuration
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      gitlabUrl,
      gitlabToken,
      spreadsheetId,
      worksheetName,
      serviceAccount,
      columnMappings,
      projectMappings,
      defaultAssignee,
      defaultMilestone,
      defaultLabel,
      defaultEstimate,
      isDefault,
    } = body;

    // If this is being set as default, unset other defaults
    if (isDefault) {
      await prisma.savedConfig.updateMany({
        where: {
          userId: session.user.id,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    // Create the configuration with encrypted sensitive data
    const config = await prisma.savedConfig.create({
      data: {
        userId: session.user.id,
        name,
        gitlabUrl,
        gitlabToken: encrypt(gitlabToken),
        spreadsheetId,
        worksheetName,
        serviceAccount: serviceAccount ? encrypt(JSON.stringify(serviceAccount)) : null,
        columnMappings: columnMappings ? JSON.stringify(columnMappings) : null,
        defaultAssignee,
        defaultMilestone,
        defaultLabel,
        defaultEstimate,
        isDefault: isDefault || false,
        projectMappings: {
          create: projectMappings?.map((pm) => ({
            projectName: pm.projectName,
            projectId: pm.projectId,
            assignee: pm.assignee,
            milestone: pm.milestone,
            labels: pm.labels ? JSON.stringify(pm.labels) : null,
            estimate: pm.estimate,
          })) || [],
        },
      },
      include: {
        projectMappings: true,
      },
    });

    return NextResponse.json({ config });
  } catch (error) {
    console.error('Error creating config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
