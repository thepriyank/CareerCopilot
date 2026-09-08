# Jobmagnate – Backend

Express + TypeScript REST API powering Jobmagnate.

## Requirements

- Node.js 20+
- PostgreSQL 15+

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env
# Edit .env with your PostgreSQL connection string and API keys

# 3. Generate Prisma client
npm run db:generate

# 4. Run database migrations
npm run db:migrate

# 5. Start development server (hot reload)
npm run dev
# → http://localhost:3001
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with ts-node-dev (hot reload) |
| `npm run build` | Compile TypeScript → dist/ |
| `npm start` | Run compiled output |
| `npm test` | Run Jest unit tests |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Open Prisma Studio GUI |

## API

All endpoints are under `/api`. See `ARCHITECTURE.md` for the full endpoint list.

### Auth
```
POST /api/auth/register   { email, password, name? }
POST /api/auth/login      { email, password }
GET  /api/auth/me         (requires Bearer token)
```

### Resumes (F1)
```
POST /api/resumes/upload           multipart/form-data { file }
GET  /api/resumes
GET  /api/resumes/:fileId
PUT  /api/resumes/parsed/:id       { sections?, extractedEntities? }
```

### Profile / Onboarding (F2)
```
GET  /api/profile
POST /api/profile
POST /api/profile/onboarding       { message, state? }
```

## Environment Variables

See `.env.example` for all required variables.
