import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';

export const authOptions = {
  // Ensure NextAuth has a secret available at runtime. Prefer environment var.
  // This prevents runtime errors where NextAuth internals try to read `options.secret`.
  secret: process.env.NEXTAUTH_SECRET || undefined,
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        name: { label: 'Name', type: 'text' }
      },
      async authorize(credentials) {
        console.log('🔐 Authorize called with:', { email: credentials?.email });
        
        if (!credentials?.email || !credentials?.password) {
          console.log('❌ Missing credentials');
          return null;
        }

        try {
          // Look for existing user

      // Warn early in server logs if NEXTAUTH_SECRET is not set.
      if (!process.env.NEXTAUTH_SECRET) {
        console.warn('⚠️ NEXTAUTH_SECRET is not set. NextAuth requires a secret for JWT/session signing. Set NEXTAUTH_SECRET in your environment (.env, docker-compose, etc).');
      }
          let user = await prisma.user.findUnique({
            where: { email: credentials.email }
          });

          console.log('👤 User found:', user ? { id: user.id, email: user.email, hasPassword: !!user.password } : 'No user found');

          if (user && user.password) {
            // User exists with password - validate it
            const isValidPassword = await bcrypt.compare(credentials.password, user.password);
            console.log('🔑 Password validation:', isValidPassword ? 'Valid' : 'Invalid');
            if (!isValidPassword) {
              return null;
            }
          } else if (user && !user.password) {
            // User exists but no password (legacy demo user) - allow any password for demo
            console.log('✅ Demo user login allowed:', user.email);
          } else {
            // User doesn't exist - this is handled in the registration flow
            console.log('❌ User not found');
            return null;
          }

          const returnUser = {
            id: user.id,
            email: user.email,
            name: user.name,
          };
          console.log('✅ Returning user:', returnUser);
          return returnUser;
        } catch (error) {
          console.error('❌ Auth error:', error);
          return null;
        }
      }
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (token) {
        session.user.id = token.id;
      }
      return session;
    },
    redirect: async ({ url, baseUrl }) => {
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url;
      return `${baseUrl}/v2`;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
};
