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

    // Get user to check view count
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        animationViews: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get animation settings
    let settings = await prisma.animationSettings.findFirst();
    
    // Create default settings if none exist
    if (!settings) {
      settings = await prisma.animationSettings.create({
        data: {},
      });
    }

    // Check if user should see animation
    const animationView = user.animationViews[0];
    const shouldShowAnimation = !animationView || 
      animationView.viewCount < settings.maxViewsPerUser;

    return NextResponse.json({
      settings,
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