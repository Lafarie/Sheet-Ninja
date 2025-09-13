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
    const decryptedConfigs = configs.map(config => {
      // gitlabToken stored encrypted; decrypt may return original value if not encrypted
      let gitlabToken = config.gitlabToken;
      try {
        const maybe = decrypt(config.gitlabToken);
        if (typeof maybe === 'string') gitlabToken = maybe;
      } catch (e) {
        // leave original
      }

      // serviceAccount stored as encrypted JSON string; decrypt may return plaintext JSON or the original
      let serviceAccount = null;
      if (config.serviceAccount) {
        try {
          const decrypted = decrypt(config.serviceAccount);
          if (typeof decrypted === 'string') {
            // If it's a JSON string, try parse
            try {
              serviceAccount = JSON.parse(decrypted);
            } catch (e) {
              // not JSON - return string as-is
              serviceAccount = decrypted;
            }
          } else {
            serviceAccount = decrypted;
          }
        } catch (e) {
          // fallback: use original stored value
          serviceAccount = config.serviceAccount;
        }
      }

      // columnMappings may be stored as JSON (object) or as a JSON string (legacy); handle both
      let columnMappings = null;
      if (config.columnMappings) {
        try {
          columnMappings = typeof config.columnMappings === 'string'
            ? JSON.parse(config.columnMappings)
            : config.columnMappings;
        } catch (e) {
          columnMappings = config.columnMappings;
        }
      }

      const projectMappings = (config.projectMappings || []).map(pm => {
        let labels = [];
        if (pm.labels) {
          try {
            labels = typeof pm.labels === 'string' ? JSON.parse(pm.labels) : pm.labels;
          } catch (e) {
            labels = pm.labels;
          }
        }

        return {
          ...pm,
          labels,
        };
      });

      return {
        ...config,
        gitlabToken,
        serviceAccount,
        columnMappings,
        projectMappings,
      };
    });

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
  // store JSON fields directly (Prisma Json type) and encrypt serviceAccount as string
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
            projectId: pm.projectId,
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
    console.error('Error creating config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
