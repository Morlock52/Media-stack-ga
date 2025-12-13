ARG NODE_VERSION=lts

# Stage 1: Builder
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

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

# Install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
# Copy template files (must be present in build context)
COPY docker-compose.yml ./

EXPOSE 3001

CMD ["node", "dist/index.js"]
