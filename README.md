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
```bash
cd automater-nextjs

# Install dependencies
pnpm install

# Setup environment variables
cp .env.example .env.local
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

## 🔧 Usage

### 1. Initial Setup
1. **Sign up/Sign in** - Create your account or log in
2. **Configure GitLab** - Add your GitLab URL and access token
3. **Setup Google Sheets** - Upload service account JSON and configure sheet access
4. **Map Columns** - Define how your sheet columns map to GitLab fields
5. **Test Connection** - Verify everything works correctly

### 2. Running Syncs
- **Manual Sync** - Click sync button for immediate synchronization
- **Monitor Progress** - Watch real-time sync progress and logs
- **View History** - Check previous sync results and errors

### 3. Advanced Features
- **Multiple Configurations** - Save different setups for different projects
- **Custom Field Mapping** - Map custom GitLab fields to sheet columns
- **Filter Rules** - Sync only specific issues based on criteria
- **Batch Operations** - Handle large datasets efficiently

## ✨ Command Line Features

### 🎯 Dynamic Column Management
- **Flexible column mapping** that adapts to sheet changes
- **Auto-detection** of column positions and headers
- **Interactive configuration** tool for custom setups
- **Validation** to ensure everything works correctly

### 🎯 Quick Setup Tool
Run `python quick_setup.py` for guided setup and configuration management.

## �🚀 Quick Setup

### 1. One-Command Setup
```bash
# Install dependencies and run guided setup
pip install -r requirements.txt
python quick_setup.py
```

### 2. Manual Setup

#### Install Dependencies
```bash
pip install -r requirements.txt
```

#### Environment Variables Setup
```bash
# Copy the template
cp env.example .env

# Edit .env with your actual values
notepad .env  # Windows
nano .env     # Linux/Mac
```

Fill in your `.env` file with:
```env
# Required Values
GITLAB_TOKEN=your-gitlab-token-here
SPREADSHEET_ID=your-google-sheet-id-here

# Optional Values (have defaults)
GITLAB_URL=https://sourcecontrol.hsenidmobile.com/api/v4/
PROJECT_ID=263
WORKSHEET_NAME=Sheet1
SERVICE_ACCOUNT_FILE=service_account.json
DEFAULT_ASSIGNEE=@your.email@company.com
```

#### Column Configuration
```bash
# Configure your Google Sheet columns dynamically
python column_manager.py

# Choose option 1 for auto-detection
# Choose option 2 for interactive setup
```

### 3. Set up Google Service Account

**Step 3.1: Create Service Account**
- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Create a new project or select an existing one
- Enable the Google Sheets API:
  - Go to APIs & Services → Library
  - Search for "Google Sheets API" and enable it
- Create Service Account credentials:
  - Go to APIs & Services → Credentials
  - Click "Create Credentials" → "Service Account"
  - Fill in service account details and click "Create"
  - Skip optional steps and click "Done"

**Step 3.2: Download Credentials**
- Click on the created service account
- Go to "Keys" tab → "Add Key" → "Create new key"
- Choose "JSON" format and download the file
- Rename the file to `service_account.json`
- Place it in the same directory as your scripts

**Step 3.3: Share Google Sheet with Service Account**
- Open your Google Sheet
- Click "Share" button
- Add the service account email (found in the JSON file as `client_email`)
- Give it "Editor" permission
- Click "Send"

### 4. Get GitLab Personal Access Token
- Go to your GitLab instance → User Settings → Access Tokens
- Create a new personal access token with `api` scope
- Copy the token and add it to your `.env` file

### 5. Test the Setup
```bash
python gitlab_to_sheets.py
```

## 🔧 Usage

### Quick Start (Recommended)
```bash
# Guided setup and management
python quick_setup.py
```

### Column Management
```bash
# Auto-detect and configure columns
python column_manager.py

# Options available:
# 1. Auto-detect columns from your sheet
# 2. Interactive column setup
# 3. Validate current configuration
# 4. Export/import configurations
```

### Sync Operations
```bash
# Sync GitLab → Google Sheets
python gitlab_to_sheets.py

# Sync Google Sheets → GitLab
python sheets_to_gitlab.py

# Complete Bidirectional Sync
python complete_sync.py
```

### Sheet Setup
```bash
# Setup dropdowns and formatting
python setup/setup_sheet_dropdown.py
```

## 🔄 Dynamic Column System

### Key Features
- **Adaptive**: Automatically adapts to column position changes
- **Auto-detection**: Finds columns by header names
- **Validation**: Checks configuration against actual sheet
- **Interactive**: Step-by-step configuration wizard

### Column Configuration
The system stores column mappings in `custom_columns.json`:
```json
{
  "PROJECT_NAME": {
    "index": 3,
    "header": "Project Name",
    "required": true,
    "data_type": "dropdown"
  }
}
```

### When Columns Change
1. Run `python column_manager.py`
2. Choose "Auto-detect and map columns"
3. Review and apply suggested mappings
4. Validate the new configuration

### Migration from Fixed Columns
If upgrading from the old system:
1. Backup your sheet
2. Run `python column_manager.py`
3. Use auto-detection
4. Test with a small dataset first

📚 **Detailed Guide**: See [DYNAMIC_COLUMNS.md](DYNAMIC_COLUMNS.md) for complete documentation.

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

## 🎯 Development

### Local Development Setup
```bash
# Install dependencies
pnpm install

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

---

**🎉 Modern GitLab ↔ Google Sheets synchronization with a powerful web interface!**

Built with ❤️ using Next.js, Prisma, and modern web technologies.
