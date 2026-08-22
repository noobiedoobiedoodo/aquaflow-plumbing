# ==============================================================================
# AQUAFLOW CONTINUOUS BULLMQ WORKER CONTAINER
# Production-ready, lightweight Docker container for persistent worker runtime
# Compatible with Railway, Render, Fly.io, AWS ECS / Fargate, Google Cloud Run
# ==============================================================================

FROM node:20-alpine AS base
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

# Step 1: Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Step 2: Generate Prisma Client & prepare runtime
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate

# Step 3: Production Runner
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /app ./

EXPOSE 8080

# Built-in HTTP health check probe for container orchestrators
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["npm", "run", "worker"]
