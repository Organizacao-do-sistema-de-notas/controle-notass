#!/usr/bin/env python3
"""Integration checks using only a new Docker project and synthetic records."""
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
DOCKER = shutil.which('docker')
PWSH = shutil.which('pwsh')


@unittest.skipUnless(DOCKER and PWSH and os.name == 'posix', 'Exige Linux, Docker e pwsh.')
class BackupServidor(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.workspace = Path(tempfile.mkdtemp(prefix='controle notas backup teste '))
        cls.root = cls.workspace / 'projeto'
        cls.root.mkdir()
        cls.project = 'controle-notas-backup-test-' + secrets.token_hex(6)
        cls.cli = [DOCKER, '--host', 'unix:///var/run/docker.sock']
        cls.container = cls.project + '-db-1'
        cls.password = secrets.token_hex(24)
        for name in ['compose.yaml', 'BACKUP-LINUX.sh', 'scripts/Backup-Banco.ps1']:
            target = cls.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, target)
        cls.legacy_launcher = cls.workspace / 'backup-legacy.ps1'
        cls.legacy_launcher.write_text("$PSNativeCommandArgumentPassing = 'Legacy'\n& (Join-Path $PSScriptRoot 'projeto/scripts/Backup-Banco.ps1') @args\nexit $LASTEXITCODE\n")
        cls.env_file = cls.root / '.env.docker'
        cls.env_file.write_text('POSTGRES_PASSWORD=' + cls.password + '\nCOMPOSE_PROJECT_NAME=' + cls.project + '\n')
        cls.env_file.chmod(0o600)
        cls.compose = cls.cli + ['compose', '--project-directory', str(cls.root), '--env-file', str(cls.env_file), '-f', str(cls.root / 'compose.yaml'), '-p', cls.project]
        if subprocess.check_output(cls.cli + ['ps', '-aq', '--filter', 'label=com.docker.compose.project=' + cls.project]).strip():
            raise AssertionError('O projeto descartavel precisa ser novo.')
        cls.addClassCleanup(cls.cleanup)
        subprocess.run(cls.compose + ['up', '-d', '--wait', '--wait-timeout', '60', 'db'], check=True, capture_output=True)
        count = cls.sql("SELECT count(*) FROM pg_tables WHERE schemaname='public';").strip()
        if count != '0':
            raise AssertionError('Nenhum banco preenchido pode ser preparado pelo teste.')
        migrations = sorted((ROOT / 'backend/prisma/migrations').glob('*/migration.sql'))
        cls.sql('\n'.join(p.read_text() for p in migrations) + '''
CREATE TABLE "_prisma_migrations" (id text PRIMARY KEY);
INSERT INTO "_prisma_migrations" VALUES ('fixture-backup');
INSERT INTO "Contabilidade"(nome) VALUES ('Contabilidade fictícia');
INSERT INTO "Cliente"(nome, "contabilidadeId") VALUES ('Empresa fictícia com acentuação', 1);
INSERT INTO "ClienteNomeAlternativo"("clienteId", nome) VALUES (1, 'Apelido fictício');
INSERT INTO "ProcedimentoCliente"("clienteId", titulo, descricao, "atualizadoEm") VALUES (1, 'Rotina fictícia', 'Texto permanente', NOW());
INSERT INTO "HistoricoContabilidadeCliente"("clienteId", "nomeAnterior", "nomeNova") VALUES (1, 'Anterior fictícia', 'Contabilidade fictícia');
INSERT INTO "Pendencia"("clienteId", competencia, observacao, "atualizadoEm") VALUES (1, '2026-11', 'Observação do mês', NOW());
INSERT INTO "HistoricoPendencia"("pendenciaId", tipo, "valorNovo") VALUES (1, 'OBSERVACAO', 'Histórico fictício preservado');
INSERT INTO "ClienteConfere"(codigo, "clienteId", "dadosOrigem", "hashOrigem") VALUES ('ficticio', 1, '{}', 'hash-ficticio');
INSERT INTO "ContabilidadeConfere"(codigo, grupo, "nomeOrigem", "contabilidadeId") VALUES ('ficticio', 'teste', 'Contabilidade fictícia', 1);
INSERT INTO "ExcelCompartilhado"(id, instancia, dados) VALUES ('principal', 'instancia-ficticia', '{"clientesExtras":["Empresa fictícia"],"nomesAlterados":{},"nomesBusca":{"Empresa fictícia":["Apelido"]},"informacoesClientes":{"Empresa fictícia":"Texto adicional"},"avisosExtras":[],"registros":{"2026-11":{"Empresa fictícia":{"status":"OK","observacao":"Texto mensal"}}}}');
''')
        cls.original = cls.snapshot()

    @classmethod
    def cleanup(cls):
        # Remove only containers/networks from this newly generated project.
        # Its volume and local diagnostics are retained, never pruned globally.
        subprocess.run(cls.compose + ['down'], check=True, capture_output=True)
        print('Diagnosticos ficticios: ' + str(cls.workspace))

    @classmethod
    def sql(cls, statement, database='controle_notas'):
        result = subprocess.run(cls.cli + ['exec', '-i', cls.container, 'psql', '-X', '-qAt', '-U', 'controle_notas', '-d', database, '-v', 'ON_ERROR_STOP=1'], input=statement, text=True, capture_output=True, check=True)
        return result.stdout

    @classmethod
    def snapshot(cls, database='controle_notas'):
        return json.loads(cls.sql((ROOT / 'scripts/windows/validar-dados.sql').read_text(), database))['tabelas']

    def backup(self, *args, env=None, legacy=False):
        variables = os.environ.copy()
        variables.update({'DOCKER_HOST': 'tcp://invalid.example:2375', 'COMPOSE_PROJECT_NAME': 'projeto-errado'})
        variables.update(env or {})
        command = [PWSH, '-NoLogo', '-NoProfile', '-File', str(self.legacy_launcher)] if legacy else ['bash', str(self.root / 'BACKUP-LINUX.sh')]
        result = subprocess.run([*command, *args], cwd=self.workspace, env=variables, text=True, capture_output=True)
        self.assertNotIn(self.password, result.stdout + result.stderr)
        return result

    def test_01_copia_binaria_restauracao_e_repeticao(self):
        before = self.env_file.read_bytes()
        result = self.backup()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        folders = list((self.root / 'backups').iterdir())
        self.assertEqual(len(folders), 1)
        first = folders[0]
        manifest = json.loads((first / 'backup.json').read_text())
        dump = first / manifest['arquivo']
        self.assertTrue(dump.read_bytes().startswith(b'PGDMP'))
        self.assertEqual(hashlib.sha256(dump.read_bytes()).hexdigest(), manifest['sha256'])
        self.assertTrue(manifest['indiceVerificado'])
        self.assertFalse(manifest['restauracaoTestada'])
        self.assertEqual(first.stat().st_mode & 0o777, 0o700)
        self.assertEqual(dump.stat().st_mode & 0o777, 0o600)
        self.assertEqual((first / 'backup.json').stat().st_mode & 0o777, 0o600)
        database = 'restauracao_teste_' + secrets.token_hex(6)
        subprocess.run(self.cli + ['exec', self.container, 'createdb', '-U', 'controle_notas', database], check=True, capture_output=True)
        with dump.open('rb') as stream:
            subprocess.run(self.cli + ['exec', '-i', self.container, 'pg_restore', '-U', 'controle_notas', '-d', database, '--exit-on-error', '--single-transaction', '--no-owner', '--no-privileges'], stdin=stream, check=True, capture_output=True)
        self.assertEqual(len(self.original), 11)
        self.assertEqual(self.snapshot(database), self.original)
        self.assertEqual(self.backup().returncode, 0)
        self.assertEqual(len(list((self.root / 'backups').iterdir())), 2)
        self.assertEqual(hashlib.sha256(dump.read_bytes()).hexdigest(), manifest['sha256'])
        self.assertEqual(self.env_file.read_bytes(), before)
        external = self.workspace / 'destino privado com espacos'
        self.assertEqual(self.backup('--destino', str(external)).returncode, 0)
        self.assertEqual(len(list(external.iterdir())), 1)
        self.assertEqual(self.backup('--destino', 'backups/subpasta').returncode, 0)
        self.assertEqual(len(list((self.root / 'backups/subpasta').iterdir())), 1)
        self.assertEqual(self.snapshot(), self.original)
        leftovers = subprocess.check_output(self.cli + ['exec', self.container, 'find', '/tmp', '-maxdepth', '1', '-name', 'controle-notas-*'])
        self.assertFalse(leftovers.strip())

    def test_01b_argumentos_nativos_legacy(self):
        # Legacy reproduces the native argument handling of Windows PowerShell 5.1.
        result = self.backup(legacy=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('Backup concluido:', result.stdout)
        self.assertEqual(self.snapshot(), self.original)

    def test_01c_tabela_base_ausente_recusada(self):
        # Only reversible DDL in this newly created, synthetic test database.
        for table in ['Cliente', 'Contabilidade', '_prisma_migrations']:
            with self.subTest(tabela=table):
                completed = sorted((self.root / 'backups').glob('*/backup.json'))
                temporary = 'tabela_teste_' + secrets.token_hex(6)
                self.sql(f'ALTER TABLE "{table}" RENAME TO {temporary};')
                try:
                    result = self.backup(legacy=True)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn('Banco nao reconhecido', result.stdout)
                    self.assertIn(table, result.stdout)
                    self.assertEqual(sorted((self.root / 'backups').glob('*/backup.json')), completed)
                finally:
                    self.sql(f'ALTER TABLE {temporary} RENAME TO "{table}";')
                self.assertEqual(self.snapshot(), self.original)

    def test_02_falha_na_copia_nao_conclui_nem_substitui_backup(self):
        tools = self.workspace / 'ferramentas'; tools.mkdir()
        wrapper = tools / 'docker'
        wrapper.write_text('#!/usr/bin/env python3\nimport os,sys\nif "cp" in sys.argv[1:]: sys.exit(41)\nos.execv(' + repr(DOCKER) + ', [' + repr(DOCKER) + '] + sys.argv[1:])\n')
        wrapper.chmod(0o700)
        completed = sorted((self.root / 'backups').glob('*/backup.json'))
        result = self.backup(env={'PATH': str(tools) + os.pathsep + os.environ['PATH']})
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(sorted((self.root / 'backups').glob('*/backup.json')), completed)
        self.assertTrue(list((self.root / 'backups').glob('*.incompleto')))
        self.assertEqual(self.snapshot(), self.original)

    def test_03_destino_no_codigo_recusado(self):
        for name in ['frontend', 'Backups']:
            with self.subTest(destino=name):
                result = self.backup('--destino', str(self.root / name))
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('use somente a pasta backups', result.stdout)
                self.assertFalse((self.root / name).exists())

    def test_04_url_externa_recusada(self):
        compose = self.root / 'compose.yaml'; original = compose.read_text()
        try:
            compose.write_text(original.replace('@db:5432/controle_notas', '@production.invalid:5432/controle_notas'))
            result = self.backup()
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('Destino recusado', result.stdout)
            self.assertEqual(self.snapshot(), self.original)
        finally:
            compose.write_text(original)

    def test_05_configuracao_ausente_nao_e_recriada(self):
        original = self.env_file.read_bytes(); self.env_file.unlink()
        try:
            result = self.backup()
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('Configuracao .env.docker ausente', result.stdout)
            self.assertFalse(self.env_file.exists())
        finally:
            self.env_file.write_bytes(original); self.env_file.chmod(0o600)

    def test_06_banco_parado_nao_e_iniciado(self):
        subprocess.run(self.compose + ['stop', 'db'], check=True, capture_output=True)
        result = self.backup()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('precisa estar em execucao', result.stdout)
        running = subprocess.check_output(self.cli + ['ps', '-q', '--filter', 'name=' + self.container])
        self.assertFalse(running.strip())

    def test_07_empacotador_recusa_backup_forcado_no_git(self):
        package = self.workspace / 'empacotador'; (package / 'scripts').mkdir(parents=True)
        shutil.copyfile(ROOT / 'scripts/preparar-pacote-windows.py', package / 'scripts/preparar-pacote-windows.py')
        subprocess.run(['git', 'init', '--quiet', str(package)], check=True, capture_output=True)
        private = package / 'Backups'; private.mkdir()
        (private / 'copia.dump').write_bytes(b'PGDMP-dado-ficticio')
        subprocess.run(['git', 'add', '-f', 'Backups/copia.dump'], cwd=package, check=True, capture_output=True)
        verification = self.workspace / 'verificacao.json'
        verification.write_text(json.dumps({'banco': 'controle_notas', 'tabelas': self.original}))
        result = subprocess.run(['python3', str(package / 'scripts/preparar-pacote-windows.py'), '--backup', str(private / 'copia.dump'), '--verificacao', str(verification), '--saida', str(self.workspace / 'nao-gerar.zip')], cwd=package, text=True, capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Arquivo privado ou gerado inesperado', result.stderr)
        self.assertFalse((self.workspace / 'nao-gerar.zip').exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
