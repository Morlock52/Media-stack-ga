# Dockerized Media Stack Wizard

This document explains how to run the Media Stack Wizard (Control Server + Web UI) using Docker.

## Prerequisites
- Docker
- Docker Compose

## Important: absolute paths in .env

Because the wizard runs inside a container but orchestrates containers on your host machine (using the Docker socket), relative paths in your `.env` file will typically fail to resolve correctly on the host.

**Before running the wizard in Docker:**
1. Open `.env` in the root directory.
2. Change `DATA_ROOT=./data` to an absolute path, e.g., `DATA_ROOT=/Users/yourname/media-stack/data`.
3. Ensure any other paths are also absolute.

## Running the Wizard

Run the following command in the root directory:

```bash
docker compose -f docker-compose.wizard.yml up --build -d
```

## Accessing the Wizard

- **Web UI**: Open [http://localhost:3002](http://localhost:3002)
- **API**: Running internally on port 3001 (mapped to host port 3001 for compatibility).

## Troubleshooting

- **Port Conflicts**: Ensure ports 3002 and 3001 are free on your host.
- **Docker Socket permissions**: If you see "permission denied" errors regarding the Docker socket, you may need to adjust the user in `docker-compose.wizard.yml` or run with proper privileges.
