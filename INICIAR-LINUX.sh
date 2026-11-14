#!/usr/bin/env bash
set -euo pipefail
umask 077

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v pwsh >/dev/null 2>&1; then
    printf '%s\n' 'PowerShell (pwsh) nao encontrado. Instale-o antes de iniciar o projeto.' >&2
    exit 1
fi

if [[ "${1:-}" == '--banco-vazio' ]]; then
    shift
    set -- -BancoVazio "$@"
fi

exec pwsh -NoLogo -NoProfile -File "$project_root/scripts/windows/Configurar-Windows.ps1" -SemAbrirNavegador "$@"
