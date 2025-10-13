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
      include: {
        animationSettings: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If user doesn't have custom settings, create default ones from global settings
    let userSettings = user.animationSettings;
    
    if (!userSettings) {
      // Get global default settings
      const globalSettings = await prisma.animationSettings.findFirst();
      
      // Create user settings with global defaults
      userSettings = await prisma.userAnimationSettings.create({
        data: {
          userId: user.id,
          isEnabled: globalSettings?.isEnabled ?? true,
          items: globalSettings?.items ?? ["❤️", "💖", "💕", "💗", "💝"],
          itemCount: globalSettings?.itemCount ?? 50,
          duration: globalSettings?.duration ?? 3000,
          maxViewsPerUser: globalSettings?.maxViewsPerUser ?? 5,
        },
      });
    }

    return NextResponse.json({
      settings: userSettings,
    });
  } catch (error) {
    console.error('User animation settings fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user animation settings' },
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

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
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

    if (!Number.isInteger(itemCount) || itemCount < 1 || itemCount > 200) {
      return NextResponse.json({ error: 'itemCount must be between 1 and 200' }, { status: 400 });
    }

    if (!Number.isInteger(duration) || duration < 1000 || duration > 10000) {
      return NextResponse.json({ error: 'duration must be between 1000 and 10000ms' }, { status: 400 });
    }

    if (!Number.isInteger(maxViewsPerUser) || maxViewsPerUser < 0 || maxViewsPerUser > 100) {
      return NextResponse.json({ error: 'maxViewsPerUser must be between 0 and 100' }, { status: 400 });
    }

    // Update or create user settings
    const userSettings = await prisma.userAnimationSettings.upsert({
      where: { userId: user.id },
      update: {
        isEnabled,
        items,
        itemCount,
        duration,
        maxViewsPerUser,
      },
      create: {
        userId: user.id,
        isEnabled,
        items,
        itemCount,
        duration,
        maxViewsPerUser,
      },
    });

    return NextResponse.json({
      settings: userSettings,
    });
  } catch (error) {
    console.error('User animation settings update error:', error);
    return NextResponse.json(
      { error: 'Failed to update user animation settings' },
      { status: 500 }
    );
  }
}