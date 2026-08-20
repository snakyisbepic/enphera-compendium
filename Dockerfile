# Multi-stage Dockerfile for the Enphera Compendium.
# Works on Fly.io, Railway, Render, Google Cloud Run, AWS App Runner,
# or any host that runs containers.
#
# Build:   docker build -t enphera-compendium .
# Run:     docker run -p 3000:3000 \
#            -e ADMIN_PIN=1234 \
#            -e SESSION_SECRET=$(openssl rand -hex 32) \
#            -e DATABASE_URL=file:/data/enphera.db \
#            -e CONTENT_DIR=/data/content \
#            -e NODE_ENV=production \
#            -v enphera_data:/data \
#            enphera-compendium

# ---- 1. Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (use npm; package-lock.json will be generated on first install).
COPY package.json ./
COPY prisma ./prisma
COPY postinstall.sh /usr/local/bin/postinstall 2>/dev/null || true
RUN npm install --no-audit --no-fund

# Copy the rest of the source.
COPY . .

# Build the Next.js standalone output.
RUN npm run build

# ---- 2. Runtime stage ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create the data directory for SQLite + markdown content.
RUN mkdir -p /data/content

# Copy the standalone server + static files.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/content ./content
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Default env values — override at runtime with -e flags or your host's env config.
ENV DATABASE_URL=file:/data/enphera.db
ENV CONTENT_DIR=/data/content

EXPOSE 3000

# Copy starter chapters into the persistent volume on first run,
# then start the server. Idempotent: skips files that already exist.
CMD sh -c "cp -rn content/* /data/content/ 2>/dev/null; node server.js"
