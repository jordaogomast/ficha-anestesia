#!/usr/bin/env bash
# Cria um link HTTPS público e TEMPORÁRIO para testar o app no celular (Cloudflare Quick Tunnel).
# ATENÇÃO: qualquer pessoa com o link acessa os arquivos enquanto o túnel estiver aberto. Use só dados fictícios.
set -euo pipefail
cd "$(dirname "$0")/.."
PORTA="${PORTA:-8080}"
if ! command -v cloudflared >/dev/null; then
  echo "Baixando cloudflared..."; curl -fsSL -o /tmp/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64; chmod +x /tmp/cloudflared; CF=/tmp/cloudflared
else CF=cloudflared; fi
curl -s -o /dev/null "http://127.0.0.1:$PORTA/index.html" || { python3 -m http.server "$PORTA" --bind 127.0.0.1 >/tmp/ficha-http.log 2>&1 & sleep 1; }
echo "Abrindo túnel (Ctrl+C para encerrar)…"
"$CF" tunnel --no-autoupdate --url "http://127.0.0.1:$PORTA"
