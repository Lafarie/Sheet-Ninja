import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get animation settings
    let settings = await prisma.animationSettings.findFirst();
    
    if (!settings) {
      settings = await prisma.animationSettings.create({
        data: {},
      });
    }

    // Get animation view statistics
    const totalViews = await prisma.animationView.aggregate({
      _sum: {
        viewCount: true,
      },
    });

    const uniqueViewers = await prisma.animationView.count();

    const recentViews = await prisma.animationView.findMany({
      take: 10,
      orderBy: {
        lastViewAt: 'desc',
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      settings,
      stats: {
        totalViews: totalViews._sum.viewCount || 0,
        uniqueViewers,
        recentViews,
      },
    });
  } catch (error) {
    console.error('Admin animation settings fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch animation settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { isEnabled, items, itemCount, duration, maxViewsPerUser } = body;

    // Validate input
    if (typeof isEnabled !== 'boolean') {
      return NextResponse.json({ error: 'isEnabled must be a boolean' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items must be a non-empty array' }, { status: 400 });
    }

    if (typeof itemCount !== 'number' || itemCount < 1 || itemCount > 200) {
      return NextResponse.json({ error: 'itemCount must be between 1 and 200' }, { status: 400 });
    }

    if (typeof duration !== 'number' || duration < 1000 || duration > 10000) {
      return NextResponse.json({ error: 'duration must be between 1000 and 10000ms' }, { status: 400 });
    }

    if (typeof maxViewsPerUser !== 'number' || maxViewsPerUser < 0 || maxViewsPerUser > 100) {
      return NextResponse.json({ error: 'maxViewsPerUser must be between 0 and 100' }, { status: 400 });
    }

    // Update or create settings
    const settings = await prisma.animationSettings.upsert({
      where: {
        id: 'default',
      },
      update: {
        isEnabled,
        items,
        itemCount,
        duration,
        maxViewsPerUser,
      },
      create: {
        id: 'default',
        isEnabled,
        items,
        itemCount,
        duration,
        maxViewsPerUser,
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Admin animation settings update error:', error);
    return NextResponse.json(
      { error: 'Failed to update animation settings' },
      { status: 500 }
    );
  }
}

// Reset user view counts
export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action === 'reset-views') {
      await prisma.animationView.deleteMany({});
      return NextResponse.json({ success: true, message: 'All view counts reset' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Admin animation reset error:', error);
    return NextResponse.json(
      { error: 'Failed to reset animation data' },
      { status: 500 }
    );
  }
}