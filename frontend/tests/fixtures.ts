import { test as base, expect } from '@playwright/test';
import { createRequire } from 'node:module';

// Only this disposable database may be cleaned by browser fixtures. There is
// no production reset endpoint or test bypass in the application.
export const test = base.extend<{ excelIsolado: void }>({
  excelIsolado: [async ({}, use) => {
    const url = new URL(process.env.DATABASE_URL ?? 'about:blank');
    if (url.protocol !== 'postgresql:' || url.hostname !== '127.0.0.1' || url.port !== '5433' || !/^\/controle_notas_pr1_test_[a-z0-9_]+$/.test(url.pathname) || url.search) throw Error('Fixture exige banco local descartável de testes.');
    const require = createRequire(new URL('../../backend/package.json', import.meta.url));
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: url.toString() });
    try { await pool.query('DELETE FROM "ExcelCompartilhado" WHERE id=$1', ['principal']); }
    finally { await pool.end(); }
    await use();
  }, { auto: true }],
});
export { expect };
