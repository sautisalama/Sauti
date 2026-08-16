# Contributing to Sauti Salama

Thank you for your interest in contributing to the Sauti Salama platform. This document outlines the engineering standards and workflow requirements for all contributors.

## Code of Conduct

This project serves survivors of gender-based violence. All contributions must uphold trauma-informed design principles, prioritize user safety and privacy, and maintain the dignity of the communities we serve.

## Fork-and-Pull Workflow

This repository follows the **Fork-and-Pull** collaboration model.

1. **Fork** the repository to your GitHub account.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/sauti-salama.git
   cd sauti-salama
   ```
3. **Add the upstream** remote:
   ```bash
   git remote add upstream https://github.com/Sauti-Salama/sauti-salama.git
   ```
4. **Sync regularly** with upstream:
   ```bash
   git fetch upstream
   git checkout main
   git rebase upstream/main
   ```

## Branching Strategy

Never push directly to `main`. Use conventional branch prefixes:

| Prefix      | Purpose                                          | Example                          |
|-------------|--------------------------------------------------|----------------------------------|
| `feat/`     | New features                                     | `feat/emergency-exit-button`     |
| `fix/`      | Bug fixes                                        | `fix/seo-redirect-loop`          |
| `docs/`     | Documentation updates                            | `docs/api-endpoints`             |
| `refactor/` | Code improvement without functional changes      | `refactor/auth-middleware`        |
| `test/`     | Adding or updating tests                         | `test/report-abuse-validation`   |
| `chore/`    | Build process, tooling, dependencies             | `chore/update-dependencies`      |

Create a branch:
```bash
git checkout -b feat/your-feature-name
```

## Commit Standards

Use [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (formatting, etc.)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to build process or auxiliary tools

### Examples

```
fix(seo): resolve robots.txt 307 redirect to signin
feat(security): implement rate limiting on report-abuse form
style(ui): add high-contrast theme for WCAG compliance
docs(contributing): add PR validation requirements
```

## Pull Request Requirements

Every PR must follow the **Single Responsibility Principle**. Do not mix concerns (e.g., do not combine SEO fixes with UI changes).

### PR Checklist

Each PR must include:

- [ ] **Linked Issue:** Reference the issue with "Closes #X" or "Fixes #X" in the description.
- [ ] **Implementation Detail:** A concise summary of the approach taken.
- [ ] **Validation Evidence:**
  - Lighthouse audit scores (Target: 90+ for Accessibility and SEO).
  - `curl -I` output verifying correct HTTP status codes for affected endpoints.
  - Security scan results for any new form endpoints or API routes.
- [ ] **No secrets or credentials** in the diff.
- [ ] **Lint and type-check** pass:
  ```bash
  npm run lint
  npm run type-check
  ```

### PR Template

```markdown
## Description
[What does this PR do and why?]

Closes #X

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Validation
- [ ] Lighthouse scores: Accessibility: __, SEO: __
- [ ] `curl -I` output for affected routes:
  ```
  [paste output]
  ```
- [ ] No new security vulnerabilities introduced.

## Checklist
- [ ] Code follows project conventions
- [ ] Self-reviewed the diff
- [ ] No console.log statements in production code
- [ ] Verified on mobile viewport
```

## Development Setup

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
npm install
cp .env.example .env.local
# Fill in required environment variables
npm run dev
```

### Scripts

| Command               | Purpose                               |
|-----------------------|---------------------------------------|
| `npm run dev`         | Start development server              |
| `npm run build`       | Production build                      |
| `npm run start`       | Start production server               |
| `npm run lint`        | Run ESLint                            |
| `npm run type-check`  | Run TypeScript type checking          |

## Architecture Overview

```
app/                    # Next.js App Router pages and layouts
  _actions/             # Server actions
  _components/          # Page-specific components
  api/                  # API route handlers
components/             # Shared UI components
hooks/                  # Custom React hooks
lib/                    # Business logic and utilities
utils/                  # Utility functions and Supabase clients
types/                  # TypeScript type definitions
public/                 # Static assets
```

## Security Considerations

- **Never commit** `.env`, `.env.local`, credentials, or API keys.
- **Sanitize all user inputs** on the server side to prevent XSS and SQL injection.
- **Data minimization:** Only collect information strictly necessary for survivor safety.
- **Progressive enhancement:** Ensure critical flows work without JavaScript where possible.
- **Performance:** Optimize for 3G networks (LCP < 2.5s) to serve users in Kenya.

## Trauma-Informed Design Principles

1. **Emergency Exit:** Every page must have a visible, one-click escape route.
2. **No mandatory PII:** Onboarding must not require personally identifiable information.
3. **Clear language:** Use simple, non-triggering language in all user-facing text.
4. **Data minimization:** Collect only what is essential for safety and support.
