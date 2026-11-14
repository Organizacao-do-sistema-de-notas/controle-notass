#!/usr/bin/env python3
"""Create a private portable bundle from the working tree and an explicit backup."""
import argparse
import hashlib
import json
import subprocess
import zipfile
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backup', required=True, type=Path)
    parser.add_argument('--verificacao', required=True, type=Path)
    parser.add_argument('--saida', required=True, type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    output = args.saida.resolve()
    if output.is_relative_to(root) or output.exists():
        raise SystemExit('Use um arquivo ZIP novo fora do checkout; arquivos existentes nao sao sobrescritos.')
    backup = args.backup.read_bytes()
    if backup[:5] != b'PGDMP':
        raise SystemExit('O backup deve ser um arquivo PostgreSQL custom validado.')
    verification = json.loads(args.verificacao.read_text(encoding='utf-8-sig'))
    if verification.get('banco') != 'controle_notas' or len(verification.get('tabelas', {})) != 10:
        raise SystemExit('Verificacao deve descrever as dez tabelas do banco controle_notas.')
    for item in verification['tabelas'].values():
        if not isinstance(item['quantidade'], int) or item['quantidade'] < 0 or len(item['sha256']) != 64:
            raise SystemExit('Verificacao invalida.')
    names = set(subprocess.check_output(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], cwd=root).decode().strip('\0').split('\0'))
    files = {}
    for name in sorted(names):
        path = root / name
        if not name or not path.exists():
            continue
        if path.is_symlink() or not path.resolve().is_relative_to(root):
            raise SystemExit('Link de arquivo inesperado: ' + name)
        parts = Path(name).parts
        if any(part in {'.git', 'node_modules', 'generated', 'dist', 'test-results', 'playwright-report', 'importacoes', 'dados'} for part in parts):
            raise SystemExit('Arquivo privado ou gerado inesperado na lista Git: ' + name)
        if path.name.startswith('.env') and not path.name.endswith('.example'):
            raise SystemExit('Configuracao local nao pode entrar no pacote: ' + name)
        files[name] = path.read_bytes()
    required = {'compose.yaml', 'INICIAR-WINDOWS.bat', 'scripts/windows/Configurar-Windows.ps1', 'scripts/windows/validar-dados.sql', 'LEIA-ME-WINDOWS.md'}
    if not required.issubset(files):
        raise SystemExit('Arquivos de instalacao ausentes.')
    originals = {}
    for name in ['clientes_confere.csv', 'regras_confere.json']:
        path = root / 'backend/importacoes' / name
        if path.exists():
            originals[name] = path.read_bytes()
    manifest = {
        'versao': 1, 'banco': 'controle_notas', 'postgresMajor': 17,
        'backupSha256': sha(backup), 'verificacao': verification,
        'arquivosOrigem': {name: sha(data) for name, data in originals.items()},
    }
    info = {
        'geradoEm': datetime.now(ZoneInfo('America/Sao_Paulo')).isoformat(),
        'repositorio': 'Organizacao-do-sistema-de-notas/controle-notass',
        'branch': subprocess.check_output(['git', 'branch', '--show-current'], cwd=root, text=True).strip(),
        'commitBase': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
        'incluiAlteracoesLocaisNaoPublicadas': True,
        'arquivosCodigo': {name: sha(data) for name, data in files.items()},
        'backupSha256': sha(backup),
    }
    files['dados/controle_notas.dump'] = backup
    files['dados/manifesto_backup.json'] = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode()
    for name, data in originals.items():
        files['dados/origem/' + name] = data
    files['ORIGEM_DO_PACOTE.json'] = (json.dumps(info, ensure_ascii=False, indent=2) + '\n').encode()
    output.parent.mkdir(parents=True, exist_ok=True)
    prefix = output.stem
    with zipfile.ZipFile(output, 'x', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, data in files.items():
            archive.writestr(prefix + '/' + name, data)
    output.chmod(0o600)
    with zipfile.ZipFile(output) as archive:
        if archive.testzip() is not None:
            raise SystemExit('Falha na verificacao interna do ZIP.')
    print(json.dumps({'arquivo': str(output), 'bytes': output.stat().st_size, 'sha256': sha(output.read_bytes()), 'arquivosCodigo': len(info['arquivosCodigo']), 'tabelas': len(verification['tabelas'])}, ensure_ascii=False))


if __name__ == '__main__':
    main()
