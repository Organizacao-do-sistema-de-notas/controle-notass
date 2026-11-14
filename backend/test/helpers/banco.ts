import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import type { Pool } from 'pg';

export const backend = fileURLToPath(new URL('../../', import.meta.url));
export function urlDeTeste() {
  const url = new URL(process.env.DATABASE_URL ?? 'about:blank');
  if (url.protocol !== 'postgresql:' || url.hostname !== '127.0.0.1' || url.port !== '5433' || !/^\/controle_notas_pr1_test_[a-z0-9_]+$/.test(url.pathname) || url.search) {
    throw Error('Use exclusivamente DATABASE_URL de um banco controle_notas_pr1_test_* em 127.0.0.1:5433.');
  }
  return url;
}
export const totalMigracoes = () => readdirSync(join(backend, 'prisma/migrations')).filter(n => existsSync(join(backend, 'prisma/migrations', n, 'migration.sql'))).length;
export async function prepararBancoDeTeste(pool: Pool) {
  const url = urlDeTeste();
    function migrate(configFile: string) {
      const result = spawnSync(process.execPath, [join(backend, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy', '--config', configFile], { cwd: backend, env: process.env, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stdout + result.stderr);
    }
  const { rows } = await pool.query('SELECT host(inet_server_addr()) AS host, inet_server_port() AS port, current_database() AS db');
  assert.equal(rows[0].host, '127.0.0.1');
  assert.equal(rows[0].port, 5433);
  assert.equal(rows[0].db, url.pathname.slice(1));
  const tables = await pool.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'");
  if (tables.rows[0].n === 0) {
    // Exercise the real upgrade: first four migrations, synthetic legacy data,
    // then the new migration. Existing nonempty databases are never reset.
    const baseline = mkdtempSync(join(tmpdir(), 'controle-notas-pr1-test-'));
    mkdirSync(join(baseline, 'migrations'));
    cpSync(join(backend, 'prisma/schema.prisma'), join(baseline, 'schema.prisma'));
    for (const name of readdirSync(join(backend, 'prisma/migrations'))) {
      if (name === 'migration_lock.toml' || name < '20261112220000_ficha_cliente') {
        cpSync(join(backend, 'prisma/migrations', name), join(baseline, 'migrations', name), { recursive: true });
      }
    }
    const config = join(baseline, 'config.ts');
    writeFileSync(config, `export default {schema: ${JSON.stringify(join(baseline, 'schema.prisma'))}, migrations: {path: ${JSON.stringify(join(baseline, 'migrations'))}}, datasource: {url: process.env.DATABASE_URL}};`);
    migrate(config);
    const legacy = await pool.query('INSERT INTO "Cliente" (nome) VALUES ($1) RETURNING id', ['Codex legado fictício']);
    await pool.query('INSERT INTO "Pendencia" ("clienteId", competencia, "atualizadoEm", observacao) VALUES ($1, $2, NOW(), $3)', [legacy.rows[0].id, '2026-11', 'Preservar pendência fictícia anterior à migration']);

  }
  migrate(join(backend, 'prisma7.config.ts'));
}
