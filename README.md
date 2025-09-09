# GitLab ↔ Google Sheets Sync (Next.js Branch)

**Sheet Ninja** - A modern Next.js web application for synchronizing GitLab issues with Google Sheets using a secure, user-friendly interface.

> **Note**: This is the `nextjs` branch containing a full-stack web application. For Python scripts, see the main branch.

## 🚀 Features

### 🎯 Modern Web Interface
- **Interactive Setup Wizard** - Step-by-step configuration with validation
- **Real-time Sync Monitoring** - Watch your data sync with live progress tracking
- **Visual Column Mapping** - Drag-and-drop interface for mapping sheet columns
- **Connection Testing** - Validate GitLab and Google Sheets connections before syncing
- **User Management** - Secure authentication with NextAuth.js

### 🔧 Powerful Sync Engine
- **Bidirectional Sync** - GitLab ↔ Google Sheets synchronization
- **Dynamic Column Detection** - Automatically adapts to sheet structure changes
- **Conflict Resolution** - Smart handling of data conflicts
- **Batch Processing** - Efficient handling of large datasets

### 🔒 Security & Reliability  
- **Service Account Authentication** - Secure Google Sheets API integration
- **Encrypted Configuration** - Sensitive data encrypted at rest
- **Session Management** - Secure user sessions with JWT
- **Database Persistence** - PostgreSQL with Prisma ORM

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and **pnpm**
- **PostgreSQL** database
- **GitLab** Personal Access Token
- **Google Service Account** credentials

### 1. Clone and Setup

## 🎯 Development

### Local Development Setup
```bash
# Install dependencies
pnpm install

# Setup environment variables
cp .env.example .env.local

# Setup database
pnpm db:migrate
pnpm db:generate

# Start development server with Turbopack
pnpm dev
```

### Database Management
```bash
# Create new migration
pnpm db:migrate

# Reset database (development only)
npx prisma migrate reset

# View data in Prisma Studio
pnpm db:studio
```
### Docker Development
```bash
# Full stack with hot reload
pnpm docker:dev

# View all service logs
pnpm docker:logs

# Rebuild after dependency changes
pnpm docker:dev:down
pnpm docker:dev
```

### 2. Configure Environment
Edit `.env.local`:
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/sheet_ninja"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# Application
ENCRYPTION_KEY="your-32-character-encryption-key"

NEXT_PUBLIC_API_BASE_URL=""

#db setup
POSTGRES_DB=""
POSTGRES_USER=""
POSTGRES_PASSWORD=""

```

### 3. Database Setup
```bash
# Run database migrations
pnpm db:migrate

# Generate Prisma client
pnpm db:generate

# (Optional) Open database studio
pnpm db:studio
```

### 4. Development
```bash
# Start development server
pnpm dev

# Or use Docker for full stack
pnpm docker:dev
```

Visit [http://localhost:3000](http://localhost:3000) to access the application.

## 🐳 Docker Deployment

### Development with Docker
```bash
# Start all services (app + PostgreSQL)
pnpm docker:dev

# View logs
pnpm docker:logs

# Stop services
pnpm docker:dev:down
```

### Production with Docker
```bash
# Build and start production containers
pnpm docker:build
pnpm docker:up

# Stop production containers
pnpm docker:down
```

## � Google Sheets Format

Your Google Sheet should include these columns:
- **Date** - Issue creation/update date
- **GIT ID** - GitLab issue ID (auto-populated)
- **Project Name** - GitLab project identifier
- **Specific Project Name** - Sub-project or component
- **Main Task** - High-level task description
- **Sub Task** - Detailed task/issue title
- **Status** - Current status (dropdown)
- **Actual Start Date** - When work began
- **Planned Estimation (H)** - Estimated hours
- **Actual Estimation (H)** - Actual time spent
- **Actual End Date** - Completion date

## 🔄 How Sync Works

### Sheets → GitLab
- Creates new GitLab issues for rows without GIT ID
- Updates existing GitLab issues when data changes
- Applies GitLab quick actions (assign, estimate, labels, etc.)
- Closes issues when status is "Completed" or "Cancelled"

### GitLab → Sheets  
- Updates sheet rows with latest GitLab issue data
- Adds new rows for new GitLab issues
- Preserves user-entered data in the sheet
- Maintains data integrity during bidirectional sync

## 🛠️ Technology Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
- **React Hook Form** - Form handling and validation
- **Sonner** - Toast notifications

### Backend  
- **Next.js API Routes** - Serverless API endpoints
- **NextAuth.js** - Authentication and session management
- **Prisma ORM** - Database toolkit and query builder
- **PostgreSQL** - Primary database

### External APIs
- **GitLab REST API** - Issue management and project data
- **Google Sheets API** - Spreadsheet read/write operations
- **Google Service Account** - Secure API authentication

## 🔒 Security Features

### Data Protection
- **Encryption at Rest** - All sensitive configuration data encrypted
- **Secure Headers** - CSRF protection and security headers
- **Input Validation** - Comprehensive data validation and sanitization
- **SQL Injection Protection** - Prisma ORM prevents SQL injection

### Authentication & Authorization  
- **Session-based Auth** - Secure user sessions with NextAuth.js
- **JWT Tokens** - Stateless authentication for API routes
- **Role-based Access** - User-specific configuration isolation
- **Service Account Security** - Google credentials encrypted and isolated

### API Security
- **Rate Limiting** - Protection against API abuse
- **CORS Configuration** - Controlled cross-origin requests
- **Environment Variables** - Sensitive data in environment variables only
- **No Hardcoded Secrets** - All credentials externally configured

## 📁 Project Structure

```
automater-nextjs/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   ├── auth/              # Authentication pages
│   │   └── setup/             # Setup wizard pages
│   ├── components/            # React components
│   │   ├── setup/             # Setup wizard components
│   │   └── ui/                # Reusable UI components
│   ├── lib/                   # Utility libraries
│   │   ├── auth.js           # NextAuth configuration
│   │   ├── prisma.ts         # Prisma client setup
│   │   └── encryption.ts      # Data encryption utilities
│   └── types/                 # TypeScript type definitions
├── prisma/                    # Database schema and migrations
├── public/                    # Static assets
├── docker-compose.yml         # Production Docker setup
├── docker-compose.dev.yml     # Development Docker setup
└── package.json              # Dependencies and scripts
```

## 🚨 Troubleshooting

### Common Issues

**Database Connection Issues**
- Verify PostgreSQL is running and accessible
- Check `DATABASE_URL` format and credentials
- Run `pnpm db:migrate` to ensure schema is up to date

**Authentication Problems**
- Verify `NEXTAUTH_SECRET` is set and random
- Check `NEXTAUTH_URL` matches your domain
- Clear browser cookies and try again

**Google Sheets API Errors**
- Ensure service account JSON is valid
- Share spreadsheet with service account email
- Verify Google Sheets API is enabled in Google Cloud Console

**GitLab Connection Issues**
- Check GitLab token has `api` scope
- Verify GitLab URL includes `/api/v4/`
- Ensure project ID exists and is accessible

### Getting Help
1. Check browser developer console for errors
2. Review application logs in Docker containers
3. Verify all environment variables are properly set
4. Test API connections independently using the built-in test features


**🎉 Modern GitLab ↔ Google Sheets synchronization with a powerful web interface!**

Built with ❤️ using Next.js, Prisma, and modern web technologies.
