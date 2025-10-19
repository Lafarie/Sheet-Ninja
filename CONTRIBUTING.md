# Contributing to Sheet Ninja v2

First off, thank you for considering contributing to Sheet Ninja! 🎉

It's people like you that make Sheet Ninja such a great tool. We welcome contributions from everyone, whether you're fixing a typo, adding a feature, or improving documentation.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Guidelines](#coding-guidelines)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Questions](#questions)

---

## 📜 Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to [your-email@example.com].

### Our Pledge

We are committed to making participation in this project a harassment-free experience for everyone, regardless of:
- Age, body size, disability, ethnicity, gender identity and expression
- Level of experience, education, socio-economic status
- Nationality, personal appearance, race, religion
- Sexual identity and orientation

### Our Standards

**Positive behavior includes:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behavior includes:**
- Trolling, insulting/derogatory comments, and personal attacks
- Public or private harassment
- Publishing others' private information without permission
- Other conduct which could reasonably be considered inappropriate

---

## 🤝 How Can I Contribute?

### Types of Contributions We're Looking For

- **Bug fixes** - Found something broken? Fix it!
- **New features** - Have an idea? Implement it!
- **Documentation** - Improve README, add examples, write guides
- **Tests** - Increase test coverage
- **Performance improvements** - Make it faster!
- **UI/UX enhancements** - Make it prettier and more intuitive
- **Translations** - Help us reach more people (future)
- **Examples** - Share how you use Sheet Ninja

### Not Sure Where to Start?

- Look for issues labeled `good first issue`
- Check issues labeled `help wanted`
- Improve documentation
- Add tests for existing features
- Fix typos or improve code comments

---

## 🛠️ Development Setup

### Prerequisites

- Node.js 18+ and pnpm
- PostgreSQL 14+
- Git
- A code editor (VS Code recommended)

### Initial Setup

```bash
# 1. Fork the repository on GitHub
# 2. Clone your fork
git clone https://github.com/YOUR-USERNAME/sheet-ninja.git
cd sheet-ninja

# 3. Add upstream remote
git remote add upstream https://github.com/Lafarie/scripts.git

# 4. Install dependencies
pnpm install

# 5. Copy environment variables
cp example.env .env

# 6. Configure your .env file
# Add your database URL and other required variables

# 7. Setup database
pnpm db:migrate
pnpm db:generate

# 8. Start development server
pnpm dev
```

### Development with Docker

```bash
# Start all services
pnpm docker:dev

# View logs
pnpm docker:logs

# Stop services
pnpm docker:dev:down
```

### Verify Setup

1. Open [http://localhost:3000/v2](http://localhost:3000/v2)
2. You should see the Sheet Ninja v2 interface
3. Sign in functionality should work
4. Check browser console for any errors

---

## 📁 Project Structure

```
sheet-ninja/
├── src/
│   ├── app/
│   │   ├── api/              # API routes
│   │   │   ├── auth/         # Authentication
│   │   │   ├── gitlab-*/     # GitLab integrations
│   │   │   ├── sheet-*/      # Google Sheets integrations
│   │   │   └── user/         # User management
│   │   └── v2/               # V2 application (MAIN)
│   ├── components/
│   │   ├── v2/               # V2 components
│   │   └── ui/               # Reusable UI components (shadcn/ui)
│   ├── stores/               # Zustand state management
│   │   ├── useSetupStore.ts  # Setup wizard state
│   │   └── useUIStore.ts     # UI state (notifications, modals)
│   ├── lib/                  # Utilities and helpers
│   └── types/                # TypeScript type definitions
├── prisma/                   # Database schema and migrations
├── public/                   # Static assets
└── uploads/                  # Service account uploads (gitignored)
```

### Key Directories

- **`/src/app/v2`** - Main V2 application entry point
- **`/src/components/v2`** - V2-specific components (focus here for UI changes)
- **`/src/stores`** - Zustand stores (state management)
- **`/src/app/api`** - Backend API routes
- **`/prisma`** - Database schema (modify with care)

---

## 💻 Coding Guidelines

### General Principles

1. **Write clean, readable code** - Code is read more than written
2. **Follow existing patterns** - Consistency is key
3. **Comment complex logic** - Help future contributors (and yourself)
4. **Keep functions small** - Single responsibility principle
5. **Use TypeScript** - Type safety prevents bugs

### TypeScript Guidelines

```typescript
// ✅ Good - Type everything
interface User {
  id: string;
  name: string;
  email: string;
}

const getUser = async (id: string): Promise<User> => {
  // Implementation
};

// ❌ Bad - Using 'any'
const getUser = async (id: any): Promise<any> => {
  // Implementation
};
```

### React/Next.js Guidelines

```typescript
// ✅ Good - Use TypeScript, proper naming
export function GitLabConfig({ onComplete }: GitLabConfigProps) {
  const { gitlab, updateGitLab } = useSetupStore();
  
  // Clear, descriptive function names
  const handleTokenValidation = async () => {
    // Implementation
  };
  
  return (
    <Card>
      {/* Component content */}
    </Card>
  );
}

// ❌ Bad - No types, unclear naming
export default function Component({ func }) {
  const do_thing = () => {
    // Implementation
  };
  
  return <div>Content</div>;
}
```

### State Management (Zustand)

```typescript
// ✅ Good - Clear actions, typed state
interface SetupState {
  gitlab: GitLabConfig;
  updateGitLab: (config: Partial<GitLabConfig>) => void;
}

export const useSetupStore = create<SetupState>((set) => ({
  gitlab: { url: '', token: '' },
  updateGitLab: (config) =>
    set((state) => ({
      gitlab: { ...state.gitlab, ...config }
    })),
}));

// ❌ Bad - Mutating state directly
set((state) => {
  state.gitlab.url = newUrl; // Don't mutate!
  return state;
});
```

### Component Structure

```typescript
// Recommended component structure
'use client'; // If needed

// 1. Imports
import React from 'react';
import { useSetupStore } from '@/stores/useSetupStore';

// 2. Types/Interfaces
interface ComponentProps {
  onComplete: () => void;
}

// 3. Component
export function Component({ onComplete }: ComponentProps) {
  // 3.1. Hooks
  const { state, updateState } = useSetupStore();
  const [localState, setLocalState] = useState('');
  
  // 3.2. Event handlers
  const handleSubmit = async () => {
    // Implementation
  };
  
  // 3.3. Effects
  useEffect(() => {
    // Side effects
  }, []);
  
  // 3.4. Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

### API Routes

```typescript
// ✅ Good - Proper error handling, typed responses
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const requestSchema = z.object({
  gitlabUrl: z.string().url(),
  gitlabToken: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = requestSchema.parse(body);
    
    // Business logic
    const result = await processRequest(validated);
    
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
```

### Styling Guidelines

- Use **Tailwind CSS** classes for styling
- Follow existing color scheme (blues, purples)
- Ensure dark mode compatibility
- Use **shadcn/ui** components when possible
- Keep responsive design in mind (mobile-first)

```tsx
// ✅ Good - Tailwind classes, dark mode support
<div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
    Title
  </h2>
</div>

// ❌ Bad - Inline styles, no dark mode
<div style={{ padding: '16px', background: 'white' }}>
  <h2 style={{ fontSize: '20px' }}>Title</h2>
</div>
```

---

## 📝 Commit Guidelines

### Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, semicolons, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Maintenance tasks
- **ci**: CI/CD changes

### Examples

```bash
# Good commit messages
feat(v2): add user filter functionality
fix(api): resolve GitLab token validation issue
docs(readme): update installation instructions
refactor(stores): simplify setup store logic
perf(sync): optimize batch processing

# With body
feat(v2): add user filter functionality

- Add UserFilter component
- Implement user extraction API
- Update setup wizard to include filter step

Closes #123
```

### Best Practices

- Use present tense ("add feature" not "added feature")
- Use imperative mood ("move cursor to..." not "moves cursor to...")
- Keep subject line under 72 characters
- Reference issues and PRs when applicable
- Explain **what** and **why**, not **how**

---

## 🔄 Pull Request Process

### Before Submitting

1. **Update your fork**
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Write clean, documented code
   - Follow coding guidelines
   - Add tests if applicable

4. **Test your changes**
   ```bash
   # Run the development server
   pnpm dev
   
   # Test the functionality
   # Verify no console errors
   # Check both light and dark mode
   ```

5. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

6. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

### Submitting the PR

1. Go to the [Sheet Ninja repository](https://github.com/Lafarie/scripts)
2. Click "New Pull Request"
3. Select your fork and branch
4. Fill out the PR template:

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring
- [ ] Performance improvement

## Changes Made
- List key changes
- One per line
- Be specific

## Testing
- [ ] Tested locally
- [ ] Verified in both light and dark mode
- [ ] Checked responsive design
- [ ] No console errors

## Screenshots (if applicable)
Add screenshots for UI changes

## Related Issues
Closes #123
Related to #456

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-reviewed my code
- [ ] Commented complex code
- [ ] Updated documentation
- [ ] No new warnings introduced
```

### PR Review Process

1. **Automated checks** run (if configured)
2. **Maintainer reviews** your code
3. **Feedback addressed** - make requested changes
4. **Approval** - PR is approved
5. **Merge** - Maintainer merges your PR

### After Your PR is Merged

1. **Delete your branch**
   ```bash
   git branch -d feature/your-feature-name
   git push origin --delete feature/your-feature-name
   ```

2. **Update your fork**
   ```bash
   git checkout main
   git pull upstream main
   git push origin main
   ```

3. **Celebrate! 🎉** You're now a contributor!

---

## 🐛 Reporting Bugs

### Before Submitting a Bug Report

- **Check existing issues** - someone may have already reported it
- **Try the latest version** - bug might be fixed
- **Verify it's a bug** - not a configuration issue

### How to Submit a Bug Report

Use the bug report template:

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
 - OS: [e.g. macOS, Windows, Linux]
 - Browser: [e.g. Chrome 120, Safari 17]
 - Node version: [e.g. 18.17.0]
 - Version: [e.g. v2.0.0]

**Additional context**
Any other context about the problem.

**Logs**
```
Paste relevant error logs here
```
```

---

## 💡 Suggesting Features

### Before Suggesting a Feature

- **Check existing feature requests** - might already exist
- **Consider if it fits the project scope**
- **Think about implementation complexity**

### How to Suggest a Feature

Use the feature request template:

```markdown
**Is your feature request related to a problem?**
A clear description of the problem. Ex. I'm frustrated when [...]

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Alternative solutions or features you've considered.

**Use Case**
How would this feature be used? Who benefits?

**Additional context**
Add any other context, screenshots, or mockups.

**Implementation Ideas** (optional)
If you have technical ideas on how to implement this.
```

---

## ❓ Questions

### Where to Ask

- **General questions**: [GitHub Discussions](https://github.com/Lafarie/scripts/discussions)
- **Bug reports**: [GitHub Issues](https://github.com/Lafarie/scripts/issues)
- **Security issues**: Email [your-email@example.com]
- **Chat**: Join our community (if applicable)

### Getting Help

When asking for help:
1. **Be specific** - what exactly are you trying to do?
2. **Share context** - environment, versions, configurations
3. **Show your work** - what have you tried?
4. **Include errors** - full error messages and logs
5. **Be patient** - maintainers are volunteers

---

## 🎯 Development Tips

### Useful Commands

```bash
# Development
pnpm dev                 # Start dev server
pnpm build              # Build for production
pnpm start              # Start production server

# Database
pnpm db:migrate         # Run migrations
pnpm db:generate        # Generate Prisma client
pnpm db:studio          # Open Prisma Studio
pnpm db:push            # Push schema changes

# Docker
pnpm docker:dev         # Start dev environment
pnpm docker:logs        # View container logs
pnpm docker:dev:down    # Stop dev environment

# Linting
pnpm lint               # Run ESLint
```

### Debugging

```typescript
// Enable debug logging
console.log('[DEBUG]', { variable, state, data });

// Use browser DevTools
debugger; // Breakpoint

// Check Zustand store state
import { useSetupStore } from '@/stores/useSetupStore';
console.log('Store state:', useSetupStore.getState());
```

### Common Issues

**Database connection fails:**
```bash
# Reset database
pnpm db:migrate
pnpm db:generate
```

**Dependencies out of sync:**
```bash
# Clean install
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

**Docker issues:**
```bash
# Rebuild containers
pnpm docker:dev:down
docker system prune -a
pnpm docker:dev
```

---

## 🏆 Recognition

Contributors will be:
- Listed in the README
- Mentioned in release notes
- Given credit in commits
- Appreciated by the community! 💙

---

## 📄 License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT License).

---

## 🙏 Thank You!

Your contributions, whether big or small, make a difference. Thank you for taking the time to contribute to Sheet Ninja!

**Happy coding! 🥷✨**

---

*Questions about contributing? Open an issue or discussion, and we'll help you get started!*
