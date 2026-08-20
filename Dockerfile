# ---- 1. Build stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install exact locked dependencies
COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci --no-audit --no-fund

# Copy application source
COPY . .

# Create a clean SQLite database containing the Prisma schema.
# This database is used only to initialize the persistent Railway volume.
RUN DATABASE_URL=file:/app/seed.db npx prisma db push --accept-data-loss

# Build Next.js standalone output
RUN npm run build


# ---- 2. Runtime stage ----
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Persistent Railway volume will be mounted at /data.
RUN mkdir -p /data/content

# Next.js standalone application
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma runtime files
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Initial application content
COPY --from=builder /app/content ./content

# Clean Prisma/SQLite database created during the build
COPY --from=builder /app/seed.db ./seed.db

# Production database/content locations.
# Railway variables override these when supplied.
ENV DATABASE_URL=file:/data/enphera.db
ENV CONTENT_DIR=/data/content

EXPOSE 3000

# Initialize the persistent volume only when no database exists.
# Copy starter Markdown files without overwriting user-managed files.
# Then start the Next.js standalone server.
CMD ["sh", "-c", "if [ ! -f /data/enphera.db ]; then echo 'Initializing production database...'; cp /app/seed.db /data/enphera.db; fi; mkdir -p /data/content; cp -rn /app/content/* /data/content/ 2>/dev/null || true; echo 'Starting Enphera...'; exec node /app/server.js"]