# Debian (glibc) base instead of Alpine (musl). The canvas/sharp native addons
# and the Prisma query engine are most reliable on glibc; this eliminates the
# whole class of musl shared-library incompatibilities that can abort Node with
# a fatal signal before any JS runs.
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates python3 make g++ pkg-config \
    libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-slim AS production

# Runtime shared libraries for the canvas/sharp native addons (glibc variants).
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 \
    libpixman-1-0 libfontconfig1 libfreetype6 libfribidi0 libharfbuzz0b \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN mkdir -p /app/logs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

EXPOSE 3001

# Single command so Node runs as the primary process and its stdout is captured
# by Railway (only the first command in a start chain is captured). Schema sync
# (prisma db push) should be run as a separate release/pre-deploy step.
CMD ["node", "dist/boot.js"]
