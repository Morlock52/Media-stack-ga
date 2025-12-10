ARG NODE_VERSION=lts

FROM node:${NODE_VERSION}-alpine

WORKDIR /app

# Install dependencies including Docker CLI
# We add them in the same layer as other system deps if any were needed
RUN apk add --no-cache docker-cli docker-cli-compose

# Copy package files first for better caching
COPY package*.json ./

# Install only production dependencies if we were building for prod, 
# but since this acts as a dev/control server we usually need full deps or at least tsx.
# 'npm ci' respects package-lock.json strictly.
RUN npm ci

# Copy source
COPY . .

# Build (compile TS to JS)
RUN npm run build

# Expose port
EXPOSE 3001

# Start using the built JS files for better performance than ts-node/tsx in prod
# Assuming command in package.json for start is "node dist/index.js" or similar
# If "start" is "tsx src/index.ts", we should change CMD to run the compiled code.
CMD ["node", "dist/index.js"]
