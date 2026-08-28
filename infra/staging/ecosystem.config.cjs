/** PM2 process list for Staging — run from repo root: pm2 start infra/staging/ecosystem.config.cjs */
const fs = require('node:fs');
const path = require('node:path');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const repoRoot = path.resolve(__dirname, '../..');
const stagingEnv = {
  NODE_ENV: 'staging',
  ...loadEnvFile(path.join(repoRoot, '.env')),
};

module.exports = {
  apps: [
    {
      name: 'th-api',
      cwd: './apps/api',
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: stagingEnv,
    },
    {
      name: 'th-room',
      cwd: './apps/room',
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G',
      env: stagingEnv,
    },
    {
      name: 'th-admin',
      cwd: './apps/admin',
      script: 'pnpm',
      args: 'dev --host 0.0.0.0 --port 5173',
      interpreter: 'none',
      autorestart: true,
      max_memory_restart: '512M',
      env: stagingEnv,
    },
  ],
};
