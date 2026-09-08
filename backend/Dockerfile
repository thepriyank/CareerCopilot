# Jobmagnate backend — Cloud Run image (2026-09-08, infra/terraform buildout).
#
# Base image note: `playwright` is a real runtime dependency here, not just a
# test tool — services/documents/renderPdf.ts launches Chromium via
# `playwright` to render résumé/cover-letter PDFs on every export request
# (F3/F5). That means this can't be a minimal Alpine/distroless image: we
# need Chromium plus its OS-level shared libraries actually present at
# runtime. Rather than apt-get'ing those ourselves (package.json's
# `postinstall` does `playwright install chromium --with-deps`, but running
# that INSIDE a Docker build is slow, fragile, and easy to drift out of sync
# with the installed npm package version), we start from Microsoft's own
# Playwright image, which ships Node + exactly one pinned Chromium build
# with all system deps preinstalled. The tag's version MUST match the
# `playwright` version resolved in package-lock.json (currently 1.62.1) —
# a mismatch here means "browser not found" at runtime, not a build failure.
ARG PLAYWRIGHT_VERSION=1.62.1

FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts: skips package.json's own `postinstall` (which would
# otherwise re-run `playwright install chromium --with-deps` — redundant
# and slow, since this base image already has that exact Chromium build).
RUN npm ci --ignore-scripts

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Runtime stage: reinstall from scratch with --omit=dev so devDependencies
# (typescript, ts-node, jest, @playwright/test, ...) never ship in the
# deployed image — only `dist/` and production deps do.
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /app/dist ./dist

# Cloud Run injects PORT itself (default 8080) and expects the process to
# bind to it — config/index.ts already reads `process.env.PORT`, so nothing
# else to wire here. Do not hardcode a PORT env var in the Cloud Run service
# config; Cloud Run sets it.
EXPOSE 8080

# Default entrypoint runs the web service. The same image (with a
# different Cloud Run Job command override) will later also run
# `npm run migration:run:prod` for the deploy-time migration step and the
# discovery-cron job's entrypoint — see docs/cicd_terraform_plan.md Phase E.
# Not wired up yet: index.ts still runs migrations + the in-process cron on
# boot, which is fine for a single-instance staging deploy today but is the
# exact thing Phase E replaces before production can safely run >1 instance.
CMD ["node", "dist/index.js"]
