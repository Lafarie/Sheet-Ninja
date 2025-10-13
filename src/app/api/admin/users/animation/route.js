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

    // Get all users with their animation settings
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        isAdmin: true,
        createdAt: true,
        animationSettings: true,
        animationViews: {
          select: {
            viewCount: true,
            lastViewAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get global default settings
    const globalSettings = await prisma.animationSettings.findFirst();

    return NextResponse.json({
      users,
      globalSettings,
    });
  } catch (error) {
    console.error('Admin user management fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
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
    const { userId, isEnabled, items, itemCount, duration, maxViewsPerUser } = body;

    // Validate input
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    if (typeof isEnabled !== 'boolean') {
      return NextResponse.json({ error: 'isEnabled must be a boolean' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items must be a non-empty array' }, { status: 400 });
    }

    if (!Number.isInteger(itemCount) || itemCount < 1 || itemCount > 200) {
      return NextResponse.json({ error: 'itemCount must be between 1 and 200' }, { status: 400 });
    }

    if (!Number.isInteger(duration) || duration < 1000 || duration > 10000) {
      return NextResponse.json({ error: 'duration must be between 1000 and 10000ms' }, { status: 400 });
    }

    if (!Number.isInteger(maxViewsPerUser) || maxViewsPerUser < 0 || maxViewsPerUser > 100) {
      return NextResponse.json({ error: 'maxViewsPerUser must be between 0 and 100' }, { status: 400 });
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    // Get existing settings to check if maxViewsPerUser changed
    const existingSettings = await prisma.userAnimationSettings.findUnique({
      where: { userId },
    });

    // Update or create user-specific animation settings
    const userSettings = await prisma.userAnimationSettings.upsert({
      where: { userId },
      update: {
        isEnabled,
        items,
        itemCount,
        duration,
        maxViewsPerUser,
      },
      create: {
        userId,
        isEnabled,
        items,
        itemCount,
        duration,
        maxViewsPerUser,
      },
    });

    // Reset animation view count if maxViewsPerUser was changed
    // This allows users to see animations again up to the new limit
    if (!existingSettings || existingSettings.maxViewsPerUser !== maxViewsPerUser) {
      await prisma.animationView.upsert({
        where: { userId },
        update: {
          viewCount: 0,
          lastViewAt: new Date(),
        },
        create: {
          userId,
          viewCount: 0,
        },
      });
    }

    return NextResponse.json({
      success: true,
      settings: userSettings,
    });
  } catch (error) {
    console.error('Admin user animation update error:', error);
    return NextResponse.json(
      { error: 'Failed to update user animation settings' },
      { status: 500 }
    );
  }
}

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

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Delete user-specific animation settings (user will fall back to global settings)
    await prisma.userAnimationSettings.deleteMany({
      where: { userId },
    });

    return NextResponse.json({
      success: true,
      message: 'User animation settings removed, user will use global settings',
    });
  } catch (error) {
    console.error('Admin user animation delete error:', error);
    return NextResponse.json(
      { error: 'Failed to remove user animation settings' },
      { status: 500 }
    );
  }
}