const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedDemoUsers() {
  try {
    // Hash the demo password
    const hashedPassword = await bcrypt.hash('demo123', 12);

    // Demo users to create
    const demoUsers = [
      { email: 'demo1@example.com', name: 'Demo User 1' },
      { email: 'demo2@example.com', name: 'Demo User 2' },
      { email: 'admin@example.com', name: 'Admin User' }
    ];

    for (const userData of demoUsers) {
      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email }
      });

      if (!existingUser) {
        // Create user
        await prisma.user.create({
          data: {
            email: userData.email,
            name: userData.name,
            password: hashedPassword
          }
        });
        console.log(`Created demo user: ${userData.email}`);
      } else {
        // Update existing user with password if they don't have one
        if (!existingUser.password) {
          await prisma.user.update({
            where: { email: userData.email },
            data: { password: hashedPassword }
          });
          console.log(`Updated demo user with password: ${userData.email}`);
        } else {
          console.log(`Demo user already exists: ${userData.email}`);
        }
      }
    }

    console.log('Demo users seeded successfully!');
  } catch (error) {
    console.error('Error seeding demo users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedDemoUsers();
