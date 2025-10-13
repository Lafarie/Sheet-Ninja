const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedAnimationSettings() {
  try {
    // Create default animation settings if they don't exist
    const existingSettings = await prisma.animationSettings.findFirst();
    
    if (!existingSettings) {
      await prisma.animationSettings.create({
        data: {
          isEnabled: true,
          items: ['❤️', '💖', '💕', '💗', '💝', '💓', '💞', '💘'],
          itemCount: 50,
          duration: 3000,
          maxViewsPerUser: 5,
        },
      });
      
      console.log('✅ Default animation settings created');
    } else {
      console.log('ℹ️ Animation settings already exist');
    }

    // Create admin user if it doesn't exist
    const adminEmail = 'dev@example.com'; // This should match your development email
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (!existingAdmin) {
      await prisma.user.create({
        data: {
          email: adminEmail,
          name: 'Dev Admin User',
          isAdmin: true,
        },
      });
      
      console.log('✅ Admin user created with email:', adminEmail);
    } else {
      // Update existing user to be admin
      await prisma.user.update({
        where: { email: adminEmail },
        data: { isAdmin: true },
      });
      
      console.log('ℹ️ Admin user updated with email:', adminEmail);
    }

  } catch (error) {
    console.error('❌ Error seeding animation settings:', error);
  }
}

async function main() {
  await seedAnimationSettings();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });