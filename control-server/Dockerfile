ARG NODE_VERSION=lts

# Stage 1: Builder
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

# Install dependencies with BuildKit cache
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Runner
FROM node:${NODE_VERSION}-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PROJECT_ROOT=/app

# Install necessary system tools
RUN apk add --no-cache docker-cli docker-cli-compose openssh-client sshpass

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && adduser -u 1001 -S appuser -G appgroup

# Install production dependencies only with BuildKit cache
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# Change ownership and switch to non-root user
# Note: We need root for docker socket access, so we keep root but add the user for future use
RUN chown -R appuser:appgroup /app

# Healthcheck for container orchestration
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:3001/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

EXPOSE 3001

CMD ["node", "dist/index.js"]
