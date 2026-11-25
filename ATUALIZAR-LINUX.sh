#!/usr/bin/env bash
# Run from the existing checkout. All application writes start after backup.
(
  set -euo pipefail
  cd "$(git rev-parse --show-toplevel)"
  case "$(git remote get-url origin)" in
    https://github.com/Organizacao-do-sistema-de-notas/controle-notass|https://github.com/Organizacao-do-sistema-de-notas/controle-notass.git|git@github.com:Organizacao-do-sistema-de-notas/controle-notass.git) ;;
    *) echo 'Esta pasta nao aponta para o repositorio esperado.'; exit 1 ;;
  esac
  test -f .env.docker || { echo '.env.docker ausente. Pare e informe o erro.'; exit 1; }
  command -v pwsh >/dev/null || { echo 'PowerShell pwsh nao encontrado.'; exit 1; }
  if test -n "$(git status --porcelain)"; then
    git status --short
    echo 'Ha alteracoes locais; preserve os arquivos e envie a saida antes de continuar.'
    exit 1
  fi
  projeto="$(sed -nE 's/^[[:space:]]*COMPOSE_PROJECT_NAME[[:space:]]*=[[:space:]]*([a-z0-9][a-z0-9_-]*)[[:space:]]*$/\1/p' .env.docker)"
  [[ "$projeto" =~ ^[a-z0-9][a-z0-9_-]{0,62}$ ]] || { echo 'Nome original do projeto ausente ou invalido.'; exit 1; }
  docker_local() { env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host unix:///var/run/docker.sock "$@"; }
  dc() { docker_local compose --env-file .env.docker -f compose.yaml -p "$projeto" "$@"; }
  ramo='teste/controle-basico-linux'
  referencia="refs/remotes/origin/$ramo"
  git fetch origin "refs/heads/$ramo:$referencia"
  if git show-ref --verify --quiet "refs/heads/$ramo"; then
    git merge-base --is-ancestor "$ramo" "$referencia" || { echo 'A branch local divergiu. Pare e informe o erro.'; exit 1; }
  fi
  dc config --quiet
  dc up -d --no-recreate --wait db
  dc stop backend frontend
  if git show-ref --verify --quiet "refs/heads/$ramo"; then
    git switch "$ramo"
  else
    git switch --no-track -c "$ramo" "$referencia"
  fi
  git merge --ff-only "$referencia"
  bash ./BACKUP-LINUX.sh
  dc build backend frontend
  dc up -d --no-deps --wait backend
  dc up -d --no-deps --wait frontend
  dc exec -T backend ./node_modules/.bin/prisma migrate status --config prisma7.config.ts
  dc ps
  git log -1 --oneline
)
