# 🥷 Sheet Ninja v2

**Modern GitLab ↔ Google Sheets Synchronization Platform**

A powerful, enterprise-ready Next.js application that seamlessly synchronizes GitLab issues with Google Sheets. Built with modern technologies, featuring an intuitive setup wizard, real-time synchronization, and advanced user filtering capabilities.

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

> **Note**: This repository uses the **v2 version** (`/v2` route) which features a completely rewritten, modern architecture with Zustand state management, TypeScript, and enhanced features including user filtering.

---

## ✨ Features

### 🎯 **V2 Enhanced Setup System**
- **6-Step Setup Wizard** - Intuitive step-by-step configuration process
- **Zustand State Management** - Lightweight, efficient state handling
- **User Filter System** - NEW! Filter synchronization by specific users
- **Smart Column Mapping** - Intelligent auto-detection with manual override
- **Real-time Notifications** - Toast-based feedback system
- **Configuration Management** - Save, load, and manage multiple configurations

### 🔄 **Bidirectional Synchronization**
- **Sheets → GitLab** - Create and update GitLab issues from spreadsheet data
- **GitLab → Sheets** - Sync issue updates back to Google Sheets
- **Smart Conflict Resolution** - Intelligent handling of data conflicts
- **Batch Processing** - Efficiently handle large datasets
- **Real-time Progress Tracking** - Visual feedback during synchronization

### 🔒 **Enterprise Security**
- **NextAuth.js Authentication** - Secure user authentication and session management
- **Encrypted Credentials** - Service account and API tokens encrypted at rest
- **PostgreSQL Database** - Reliable data persistence with Prisma ORM
- **User Isolation** - Each user's configurations are completely isolated
- **HTTPS Support** - Secure data transmission

### 🎨 **Modern User Experience**
- **Dark Mode Support** - Beautiful light and dark themes
- **Responsive Design** - Works seamlessly on desktop, tablet, and mobile
- **Real-time Validation** - Instant feedback on configuration errors
- **Progress Indicators** - Clear visual status of setup completion
- **Accessibility** - WCAG compliant UI components

---

## 🚀 Quick Start

### Prerequisites

Before you begin, ensure you have:
- **Node.js** 18+ and **pnpm** package manager
- **PostgreSQL** database (local or hosted)
- **GitLab** account with Personal Access Token
- **Google Cloud** project with service account credentials

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/sheet-ninja.git
cd sheet-ninja

# Install dependencies
pnpm install

# Copy environment variables
cp example.env .env

# Setup database
pnpm db:migrate
pnpm db:generate

# Start development server
pnpm dev
```

Visit [http://localhost:3000/v2](http://localhost:3000/v2) to access the application.

---

## ⚙️ Configuration

### Environment Variables

Edit `.env` with your configuration:

```env
# Database Connection
DATABASE_URL="postgresql://postgres:password@localhost:5432/automater"

# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secure-random-secret-key-min-32-characters"

# Application Settings
ENCRYPTION_KEY="your-32-character-encryption-key-here"
NEXT_PUBLIC_API_BASE_URL="http://localhost:3000"

# PostgreSQL Settings (for Docker)
POSTGRES_DB="automater"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="password"
```

> **Security Note**: Always use strong, randomly generated values for `NEXTAUTH_SECRET` and `ENCRYPTION_KEY` in production.

---

## 🔐 Google Service Account Setup

To use Google Sheets API, you need a service account:

### Step 1: Create a Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your project ID

### Step 2: Enable Google Sheets API
1. In your Google Cloud project, navigate to **APIs & Services** > **Library**
2. Search for "Google Sheets API"
3. Click **Enable**

### Step 3: Create Service Account
1. Go to **IAM & Admin** > **Service Accounts**
2. Click **Create Service Account**
3. Enter a name (e.g., "sheet-ninja-service")
4. Click **Create and Continue**
5. Skip optional steps and click **Done**

### Step 4: Generate Service Account Key
1. Click on your newly created service account
2. Go to the **Keys** tab
3. Click **Add Key** > **Create new key**
4. Select **JSON** format
5. Click **Create** - this downloads your service account JSON file

### Step 5: Share Your Google Sheet
1. Open your Google Sheet
2. Click **Share**
3. Add the service account email (looks like `service-account@project-id.iam.gserviceaccount.com`)
4. Give it **Editor** permissions
5. Click **Done**

### Step 6: Upload Service Account in Sheet Ninja
1. Navigate to `/v2` in the application
2. Go to **Step 2: Sheets Configuration**
3. Click **Upload Service Account JSON**
4. Select the JSON file you downloaded in Step 4
5. The service account email will be automatically detected

> **Important**: Keep your service account JSON file secure. Never commit it to version control. The file should be stored in a secure location or uploaded directly through the application interface.

**File Location**: You can optionally place service account files in the `/uploads` directory (already in `.gitignore`), but uploading through the UI is recommended for better security.

---

## 🎯 GitLab Configuration

### Creating a GitLab Personal Access Token

1. Log in to your GitLab instance
2. Click your avatar > **Preferences**
3. Select **Access Tokens** from the left sidebar
4. Enter a token name (e.g., "Sheet Ninja Sync")
5. Set an expiration date (optional but recommended)
6. Select the following scopes:
   - `api` - Full API access (required)
7. Click **Create personal access token**
8. **Important**: Copy the token immediately - you won't see it again!

### GitLab URL Format

Your GitLab API URL should follow this format:
```
https://your-gitlab-instance.com/api/v4/
```

For GitLab.com, use:
```
https://gitlab.com/api/v4/
```

For self-hosted GitLab:
```
https://your-gitlab-domain.com/api/v4/
```

**Note**: Always include `/api/v4/` at the end of the URL.

---

## 📊 Google Sheets Format

Your Google Sheet should include these columns (can be customized during setup):

| Column Name | Description | Required | Auto-populated |
|-------------|-------------|----------|----------------|
| **Date** | Issue creation/update date | No | Yes |
| **GIT ID** | GitLab issue IID | Yes | Yes |
| **Project Name** | GitLab project identifier | Yes | No |
| **Specific Project Name** | Sub-project or component | No | No |
| **Main Task** | High-level task description | No | No |
| **Sub Task** | Detailed task/issue title | Yes | No |
| **Status** | Current status | Yes | No |
| **Actual Start Date** | When work began | No | No |
| **Planned Estimation (H)** | Estimated hours | No | No |
| **Actual Estimation (H)** | Actual time spent | No | Yes |
| **Actual End Date** | Completion date | No | No |
| **User** | Assignee/Owner (NEW in v2) | No | No |

### Example Sheet Structure

```
| Date       | GIT ID | Project Name | Sub Task           | Status      | User        |
|------------|--------|--------------|-------------------|-------------|-------------|
| 2025-01-15 | 123    | Frontend     | Fix login bug     | In Progress | john.doe    |
| 2025-01-16 | 124    | Backend      | API optimization  | Completed   | jane.smith  |
```

> **V2 Feature**: The User column enables the new **User Filter** functionality, allowing you to sync data for specific team members.

---

## 🔄 How It Works

### Setup Flow (6 Steps)

```mermaid
graph LR
    A[1. GitLab Config] --> B[2. Sheets Config]
    B --> C[3. Column Mapping]
    C --> D[4. Project Mapping]
    D --> E[5. User Filter]
    E --> F[6. Sync Runner]
```

#### **Step 1: GitLab Configuration**
- Enter your GitLab instance URL
- Provide your Personal Access Token
- System validates connection and fetches available projects

#### **Step 2: Google Sheets Configuration**
- Upload service account JSON file
- Enter your spreadsheet ID
- Select worksheet name
- System detects available sheets

#### **Step 3: Column Mapping**
- Auto-detection of column headers
- Map sheet columns to data fields
- Configure which columns sync to GitLab

#### **Step 4: Project Mapping**
- Configure individual projects
- Set assignees, milestones, and labels
- Apply defaults or customize per project

#### **Step 5: User Filter** (NEW in V2)
- Extract users from your User column
- Select specific user to filter by
- Optional: Skip to sync all users

#### **Step 6: Synchronization**
- Review configuration
- Start bidirectional sync
- Monitor real-time progress

### Synchronization Logic

#### **Sheets → GitLab**
1. Reads rows from Google Sheets
2. For rows without GIT ID: Creates new GitLab issues
3. For rows with GIT ID: Updates existing GitLab issues
4. Applies quick actions (assignees, estimates, labels, milestones)
5. Closes issues with "Completed" or "Cancelled" status

#### **GitLab → Sheets**
1. Fetches latest issue data from GitLab
2. Updates corresponding rows in Google Sheets
3. Adds new rows for new GitLab issues
4. Preserves user-entered data

#### **User Filter** (V2)
1. Extracts unique users from the User column
2. Filters synchronization to only selected user's data
3. Reduces API calls and improves performance

---

## 🛠️ Technology Stack

### Frontend
- **Next.js 15** - React framework with App Router and Turbopack
- **TypeScript** - Type-safe development
- **Zustand** - Lightweight state management
- **Tailwind CSS 4** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
- **Sonner** - Beautiful toast notifications
- **Lucide Icons** - Modern icon library

### Backend
- **Next.js API Routes** - Serverless API endpoints
- **NextAuth.js** - Authentication and session management
- **Prisma ORM** - Type-safe database client
- **PostgreSQL** - Reliable relational database
- **bcryptjs** - Password hashing

### External APIs
- **GitLab REST API v4** - Issue and project management
- **Google Sheets API v4** - Spreadsheet operations
- **Google Auth Library** - Service account authentication

---

## 🐳 Docker Deployment

### Development Environment

```bash
# Start all services (app + PostgreSQL)
pnpm docker:dev

# View logs
pnpm docker:logs

# Stop services
pnpm docker:dev:down
```

The application will be available at `http://localhost:3000/v2`

### Production Deployment

```bash
# Build production images
pnpm docker:build

# Start production containers
pnpm docker:up

# View production logs
pnpm docker:logs

# Stop production containers
pnpm docker:down
```

### Docker Compose Configuration

**Development** (`docker-compose.dev.yml`):
- Hot reload enabled
- Volume mounting for live code updates
- Debug mode enabled

**Production** (`docker-compose.yml`):
- Optimized build
- Environment-based configuration
- Health checks enabled

---

## 📁 Project Structure

```
sheet-ninja/
├── src/
│   ├── app/
│   │   ├── api/                  # API routes
│   │   │   ├── auth/            # Authentication endpoints
│   │   │   ├── gitlab-*/        # GitLab integration
│   │   │   ├── sheet-*/         # Google Sheets integration
│   │   │   ├── start-sync/      # Sync execution
│   │   │   └── user/            # User management
│   │   ├── auth/                # Auth pages
│   │   ├── v2/                  # V2 application (MAIN)
│   │   │   ├── page.tsx         # Main setup page
│   │   │   └── README.md        # V2 documentation
│   │   └── layout.js            # Root layout
│   ├── components/
│   │   ├── v2/                  # V2 components
│   │   │   ├── GitLabConfig.tsx
│   │   │   ├── SheetsConfig.tsx
│   │   │   ├── ColumnMapping.tsx
│   │   │   ├── ProjectMapping.tsx
│   │   │   ├── UserFilter.tsx   # NEW in V2
│   │   │   └── SyncRunner.tsx
│   │   └── ui/                  # Reusable UI components
│   ├── stores/                  # Zustand stores
│   │   ├── useSetupStore.ts     # Setup state
│   │   └── useUIStore.ts        # UI state
│   ├── lib/                     # Utilities
│   │   ├── auth.ts              # NextAuth config
│   │   ├── prisma.ts            # Database client
│   │   ├── encryption.ts        # Data encryption
│   │   └── utils.ts             # Helpers
│   └── types/                   # TypeScript types
├── prisma/
│   ├── schema.prisma            # Database schema
│   └── migrations/              # Database migrations
├── public/                      # Static assets
├── uploads/                     # Service account uploads
├── docker-compose.yml           # Production Docker
├── docker-compose.dev.yml       # Development Docker
├── Dockerfile                   # Container definition
└── package.json                 # Dependencies
```

---

## 💾 Database Schema

```prisma
User {
  id, email, name, password
  savedConfigs []
}

SavedConfig {
  id, name, gitlabUrl, gitlabToken
  spreadsheetId, worksheetName
  serviceAccount, columnMappings
  isDefault
  projectMappings []
}

ProjectMapping {
  id, projectName, projectId
  assignee, milestone, labels, estimate
}
```

---

## 🚨 Troubleshooting

### Common Issues

#### **Database Connection Errors**
```bash
# Check PostgreSQL is running
docker ps

# Reset database (development only)
pnpm db:migrate
```

#### **Google Sheets Access Denied**
- Verify service account email is added to the sheet with Editor permissions
- Ensure Google Sheets API is enabled in your project
- Check service account JSON file is valid

#### **GitLab Authentication Failed**
- Verify Personal Access Token has `api` scope
- Check token hasn't expired
- Ensure GitLab URL ends with `/api/v4/`

#### **Column Mapping Issues**
- Column headers should be in the first row
- Avoid special characters in column names
- Use manual mapping if auto-detection fails

#### **User Filter Not Working**
- Ensure User column is mapped in Step 3
- Extract users in Step 5 before filtering
- User names should match exactly (case-sensitive)

### Debug Mode

Enable verbose logging:
```bash
# Development
DEBUG=* pnpm dev

# Production
NODE_ENV=production DEBUG=* pnpm start
```

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Run tests and linting**
   ```bash
   pnpm lint
   ```
5. **Commit your changes**
   ```bash
   git commit -m 'Add amazing feature'
   ```
6. **Push to your branch**
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open a Pull Request**

### Development Guidelines

- Use TypeScript for new code
- Follow existing code style
- Add comments for complex logic
- Update documentation for new features
- Test thoroughly before submitting

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Next.js Team** - Amazing React framework
- **Vercel** - Hosting and deployment platform
- **Prisma** - Excellent ORM
- **shadcn/ui** - Beautiful UI components
- **GitLab** - Version control and CI/CD
- **Google** - Sheets API and service accounts

---

## 📧 Support

- **Documentation**: [GitHub Wiki](https://github.com/yourusername/sheet-ninja/wiki)
- **Issues**: [GitHub Issues](https://github.com/yourusername/sheet-ninja/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/sheet-ninja/discussions)

---

## 🗺️ Roadmap

### V2 Current Features ✅
- [x] Zustand state management
- [x] User filtering system
- [x] TypeScript migration
- [x] Configuration management
- [x] Dark mode support

### Upcoming Features 🚀
- [ ] Bulk user operations
- [ ] Advanced date range filtering
- [ ] Configuration templates
- [ ] Automated scheduling
- [ ] Email notifications
- [ ] Sync analytics dashboard
- [ ] Export/import configurations
- [ ] Multi-tenant support
- [ ] Webhook integrations

---

<div align="center">

**Built with ❤️ using Next.js, TypeScript, and modern web technologies**

⭐ **Star this repo if you find it useful!** ⭐

[Report Bug](https://github.com/yourusername/sheet-ninja/issues) · [Request Feature](https://github.com/yourusername/sheet-ninja/issues) · [Documentation](https://github.com/yourusername/sheet-ninja/wiki)

</div>
