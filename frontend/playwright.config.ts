import { defineConfig } from '@playwright/test';

const db = new URL(process.env.DATABASE_URL ?? 'about:blank');
if (db.protocol !== 'postgresql:' || db.hostname !== '127.0.0.1' || db.port !== '5433' ||
    !/^\/controle_notas_pr1_test_[a-z0-9_]+$/.test(db.pathname) || db.search) {
  throw new Error('Testes exigem DATABASE_URL de um banco controle_notas_pr1_test_* em 127.0.0.1:5433.');
}

export default defineConfig({
  testDir: './tests',
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:5175',
    browserName: 'chromium',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined },
    trace: 'retain-on-failure',
  },
  webServer: [
    { command: 'npm --prefix ../backend start', url: 'http://127.0.0.1:3010/', env: { PORT: '3010' }, reuseExistingServer: false },
    { command: 'npm run dev -- --host 127.0.0.1 --port 5175 --strictPort', url: 'http://127.0.0.1:5175/', env: { VITE_API_URL: 'http://127.0.0.1:3010' }, reuseExistingServer: false },
  ],
});
