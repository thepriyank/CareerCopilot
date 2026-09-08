# Jobmagnate – Frontend

Next.js 14 web application for Jobmagnate.

## Requirements

- Node.js 20+
- Backend running on http://localhost:3001

## Setup

```bash
# Install dependencies
npm install

# Copy env template
cp .env.local.example .env.local

# Start development server
npm run dev
# → http://localhost:3000
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server with HMR |
| `npm run build` | Production build |
| `npm start` | Serve production build |
| `npm run lint` | ESLint check |

## Key Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/login` | Login |
| `/register` | Register |
| `/dashboard` | Overview dashboard |
| `/resume/upload` | Upload resume (F1) |
| `/resume/:id` | Parsed resume viewer (F1) |
| `/onboarding` | Career preferences chat (F2) |
