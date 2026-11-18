#!/usr/bin/env bash
set -euo pipefail
umask 077

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v pwsh >/dev/null 2>&1; then
    printf '%s\n' 'PowerShell (pwsh) nao encontrado. Use o mesmo PowerShell da instalacao do projeto.' >&2
    exit 1
fi
if [[ "${1:-}" == '--destino' ]]; then
    shift
    set -- -Destino "$@"
fi
exec pwsh -NoLogo -NoProfile -File "$project_root/scripts/Backup-Banco.ps1" "$@"
