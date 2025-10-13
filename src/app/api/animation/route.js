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

    // Get user with their animation settings and views
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        animationViews: true,
        animationSettings: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has custom settings set by admin, otherwise use global settings
    let effectiveSettings = user.animationSettings;
    
    if (!effectiveSettings) {
      // No custom settings, use global default settings
      const globalSettings = await prisma.animationSettings.findFirst();
      
      if (!globalSettings) {
        // Create default global settings if none exist
        effectiveSettings = await prisma.animationSettings.create({
          data: {
            isEnabled: true,
            items: ["❤️", "💖", "💕", "💗", "💝"],
            itemCount: 50,
            duration: 3000,
            maxViewsPerUser: 5,
          },
        });
      } else {
        effectiveSettings = globalSettings;
      }
    }

    // Check if user should see animation based on effective settings
    const animationView = user.animationViews[0];
    const shouldShowAnimation = effectiveSettings.isEnabled && (!animationView || 
      animationView.viewCount < effectiveSettings.maxViewsPerUser);

    return NextResponse.json({
      settings: effectiveSettings,
      shouldShowAnimation,
      userViewCount: animationView?.viewCount || 0,
    });
  } catch (error) {
    console.error('Animation settings fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch animation settings' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
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

    // Record animation view
    const existingView = await prisma.animationView.findUnique({
      where: { userId: user.id },
    });

    if (existingView) {
      await prisma.animationView.update({
        where: { userId: user.id },
        data: {
          viewCount: { increment: 1 },
          lastViewAt: new Date(),
        },
      });
    } else {
      await prisma.animationView.create({
        data: {
          userId: user.id,
          viewCount: 1,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Animation view record error:', error);
    return NextResponse.json(
      { error: 'Failed to record animation view' },
      { status: 500 }
    );
  }
}