# ---- 1. Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

COPY . .

# Create a clean SQLite database containing the Prisma schema.
RUN DATABASE_URL=file:/app/seed.db npx prisma db push --accept-data-loss

# Build the Next.js standalone output.
RUN npm run build

# ---- 2. Runtime stage ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN mkdir -p /data/content

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/content ./content
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Clean database containing the Prisma schema.
COPY --from=builder /app/seed.db ./seed.db

ENV DATABASE_URL=file:/data/enphera.db
ENV CONTENT_DIR=/data/content

EXPOSE 3000

# Seed the persistent volume once, then start the app.
CMD sh -c "if [ ! -f /data/enphera.db ]; then cp seed.db /data/enphera.db; fi; cp -rn content/* /data/content/ 2>/dev/null || true; node server.js"