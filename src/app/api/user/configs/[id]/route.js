import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';

// PUT - Update an existing configuration
export async function PUT(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
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

    // Verify ownership
    const existingConfig = await prisma.savedConfig.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existingConfig) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
    }

    // If this is being set as default, unset other defaults
    if (isDefault) {
      await prisma.savedConfig.updateMany({
        where: {
          userId: session.user.id,
          isDefault: true,
          id: { not: id },
        },
        data: {
          isDefault: false,
        },
      });
    }

    // Delete existing project mappings
    await prisma.projectMapping.deleteMany({
      where: {
        configId: id,
      },
    });

    // Update the configuration with encrypted sensitive data
    const config = await prisma.savedConfig.update({
      where: { id },
      data: {
        name,
        gitlabUrl,
        gitlabToken: encrypt(gitlabToken),
        spreadsheetId,
        worksheetName,
  serviceAccount: serviceAccount ? encrypt(JSON.stringify(serviceAccount)) : null,
  columnMappings: columnMappings ? columnMappings : null,
        defaultAssignee,
        defaultMilestone,
        defaultLabel,
        defaultEstimate,
        isDefault: isDefault || false,
        projectMappings: {
          create: projectMappings?.map((pm) => ({
            projectName: pm.projectName,
            projectId: pm.projectId ? String(pm.projectId) : null,
            assignee: pm.assignee,
            milestone: pm.milestone,
            labels: pm.labels ? pm.labels : null,
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
    console.error('Error updating config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a configuration
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Verify ownership
    const existingConfig = await prisma.savedConfig.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existingConfig) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
    }

    // Delete the configuration (project mappings will be deleted via cascade)
    await prisma.savedConfig.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
