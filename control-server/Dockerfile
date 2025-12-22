ARG NODE_VERSION=lts

# Stage 1: Builder
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

# Install dependencies with BuildKit cache (npm workspaces)
COPY package.json package-lock.json ./
COPY control-server/package.json control-server/package.json
COPY docs-site/package.json docs-site/package.json
RUN --mount=type=cache,target=/root/.npm npm ci -w control-server

# Copy source and build
COPY control-server/ control-server/
RUN npm run build -w control-server

# Stage 2: Runner
FROM node:${NODE_VERSION}-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PROJECT_ROOT=/app

# Install necessary system tools
RUN apk add --no-cache docker-cli docker-cli-compose openssh-client sshpass

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && adduser -u 1001 -S appuser -G appgroup

# Install production dependencies only with BuildKit cache (npm workspaces)
COPY package.json package-lock.json ./
COPY control-server/package.json control-server/package.json
COPY docs-site/package.json docs-site/package.json
RUN --mount=type=cache,target=/root/.npm npm ci -w control-server --omit=dev

# Copy built artifacts from builder
COPY --from=builder /app/control-server/dist ./control-server/dist

# Change ownership and switch to non-root user
# Note: We need root for docker socket access, so we keep root but add the user for future use
RUN chown -R appuser:appgroup /app

# Healthcheck for container orchestration
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

EXPOSE 3001

CMD ["node", "control-server/dist/index.js"]
