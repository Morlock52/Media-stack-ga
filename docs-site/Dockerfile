ARG NODE_VERSION=lts
 ARG VITE_OPENAI_MODEL

FROM node:${NODE_VERSION}-alpine as build

WORKDIR /app

 ENV VITE_OPENAI_MODEL=${VITE_OPENAI_MODEL}

# Copy package info first to leverage cache
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Add a healthcheck
HEALTHCHECK --interval=30s --timeout=3s \
    CMD test -f /usr/share/nginx/html/index.html || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
