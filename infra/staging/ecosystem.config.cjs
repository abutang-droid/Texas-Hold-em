/** PM2 process list for Staging — run from repo root: pm2 start infra/staging/ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: 'th-api',
      cwd: './apps/api',
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'staging',
      },
    },
    {
      name: 'th-room',
      cwd: './apps/room',
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'staging',
      },
    },
    {
      name: 'th-admin',
      cwd: './apps/admin',
      script: 'pnpm',
      args: 'dev --host 0.0.0.0 --port 5173',
      interpreter: 'none',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'staging',
      },
    },
  ],
};
