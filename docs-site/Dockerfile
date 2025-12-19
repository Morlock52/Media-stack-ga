ARG NODE_VERSION=lts
ARG VITE_OPENAI_MODEL
ARG VITE_CONTROL_SERVER_URL
ARG VITE_CONTROL_SERVER_TOKEN

FROM node:${NODE_VERSION}-alpine AS build

WORKDIR /app

ENV VITE_OPENAI_MODEL=${VITE_OPENAI_MODEL}
ENV VITE_CONTROL_SERVER_URL=${VITE_CONTROL_SERVER_URL}
ENV VITE_CONTROL_SERVER_TOKEN=${VITE_CONTROL_SERVER_TOKEN}

# Copy package info first to leverage cache
COPY docs-site/package*.json ./
RUN npm install

COPY docs-site/ .
COPY docker-compose.yml ./docker-compose.yml
# The UI imports this file via `../../../docker-compose.yml?raw` from under `src/components/`,
# which resolves to `/docker-compose.yml` inside this build container.
COPY docker-compose.yml /docker-compose.yml
RUN npm run build

FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

COPY --from=build /app/dist /usr/share/nginx/html
COPY docs-site/nginx.conf /etc/nginx/conf.d/default.conf

# Add a healthcheck
HEALTHCHECK --interval=30s --timeout=3s \
    CMD test -f /usr/share/nginx/html/index.html || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
