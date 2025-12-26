module.exports = {
  apps: [
    {
      name: "media-stack-control-server",
      script: "node",
      args: "dist/index.js",
      cwd: "./control-server",
      env: {
        NODE_ENV: "production",
        LOG_LEVEL: process.env.LOG_LEVEL || "info",
        DOCKER_STATUS_CACHE_MS: process.env.DOCKER_STATUS_CACHE_MS || "1500",
        DOCKER_STATUS_MAX_PARALLEL: process.env.DOCKER_STATUS_MAX_PARALLEL || "4"
      },
      watch: false,
      autorestart: true,
      max_restarts: 5,
      kill_timeout: 5000
    }
  ]
};
