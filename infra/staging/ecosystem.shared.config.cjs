/** PM2 — 共享服务器模式（端口从环境变量读取，先 source .env） */
const adminPort = process.env.ADMIN_PORT || '13180';

module.exports = {
  apps: [
    {
      name: 'th-api',
      cwd: './apps/api',
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'staging' },
    },
    {
      name: 'th-room',
      cwd: './apps/room',
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G',
      env: { NODE_ENV: 'staging' },
    },
    {
      name: 'th-admin',
      cwd: './apps/admin',
      script: 'pnpm',
      args: `dev --host 0.0.0.0 --port ${adminPort}`,
      interpreter: 'none',
      autorestart: true,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'staging' },
    },
  ],
};
