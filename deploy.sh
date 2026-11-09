#!/usr/bin/env bash
set -Eeuo pipefail
umask 027

# Apache reste sur l'hote. Seule l'application tourne dans Docker.
DOMAIN="${DOMAIN:-ustock.upowa.org}"
SERVER_IP="${SERVER_IP:-82.165.222.49}"
UKIT_HTTP_PORT="${UKIT_HTTP_PORT:-3011}"
UKIT_CACHE_TTL_SECONDS="${UKIT_CACHE_TTL_SECONDS:-60}"
LE_EMAIL="${LE_EMAIL:-}"
ENABLE_HTTPS="${ENABLE_HTTPS:-1}"
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
export UKIT_HTTP_PORT UKIT_CACHE_TTL_SECONDS
SITE="ukit-${DOMAIN}.conf"
SITE_PATH="/etc/apache2/sites-available/${SITE}"
BACKUP_DIR=""
CONFIG_CHANGED=0
SITE_WAS_ENABLED=0
COMPOSE=(docker compose --project-name ukit --project-directory "$PROJECT_DIR" -f "$PROJECT_DIR/compose.yaml")

log() { printf '\n[ukit] %s\n' "$*"; }
die() { printf '\n[ukit] ERREUR : %s\n' "$*" >&2; exit 1; }
rollback_apache() {
  local status=$?
  trap - ERR
  if (( CONFIG_CHANGED )); then
    for saved in "$BACKUP_DIR"/*.conf; do
      [[ ! -f "$saved" ]] || cp -p -- "$saved" "/etc/apache2/sites-available/$(basename "$saved")"
    done
    for marker in "$BACKUP_DIR"/*.absent; do
      [[ -f "$marker" ]] || continue
      name="$(basename "${marker%.absent}")"
      a2dissite "$name" >/dev/null 2>&1 || true
      rm -f -- "/etc/apache2/sites-available/$name"
    done
    if apache2ctl configtest; then systemctl reload apache2 || true; fi
  fi
  printf '\n[ukit] Echec ligne %s. Les volumes Docker et les autres sites sont conserves.\n' "${BASH_LINENO[0]}" >&2
  exit "$status"
}
trap rollback_apache ERR

[[ $EUID -eq 0 ]] || die 'Lancer : sudo bash deploy.sh'
[[ "$DOMAIN" =~ ^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$ ]] || die 'Nom de domaine invalide.'
[[ "$UKIT_HTTP_PORT" =~ ^[0-9]{1,5}$ ]] && (( 10#$UKIT_HTTP_PORT >= 1024 && 10#$UKIT_HTTP_PORT <= 65535 )) || die 'Le port local doit etre compris entre 1024 et 65535.'
[[ "$ENABLE_HTTPS" == 0 || "$ENABLE_HTTPS" == 1 ]] || die 'ENABLE_HTTPS doit valoir 0 ou 1.'
[[ -f /etc/debian_version ]] || die 'Ce script cible Debian/Ubuntu avec Apache2 gere par systemd.'
command -v apache2ctl >/dev/null || die 'Apache2 doit deja etre installe sur le serveur hote.'
systemctl is-active --quiet apache2 || die 'Le service Apache2 doit deja etre actif.'
apache2ctl configtest
[[ -f "$PROJECT_DIR/backend/.env" ]] || die 'Copier les acces distants dans backend/.env avant de lancer ce script.'
[[ -f "$PROJECT_DIR/frontend/server/Agents_Terrain_Uniformises.xlsx" ]] || die 'Le referentiel Excel des agents est absent.'
if [[ "$ENABLE_HTTPS" == 1 ]]; then
  addresses="$(getent ahostsv4 "$DOMAIN" | awk '{print $1}' | sort -u)" || die "DNS absent : $DOMAIN -> $SERVER_IP."
  grep -Fxq "$SERVER_IP" <<< "$addresses" || die "Le DNS $DOMAIN ne pointe pas vers $SERVER_IP."
fi

log 'Installation des prerequis manquants.'
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl gnupg python3
if ! command -v docker >/dev/null; then
  # Depot Docker officiel, sans execution d'un script telecharge.
  . /etc/os-release
  [[ "$ID" == ubuntu || "$ID" == debian ]] || die 'Distribution Docker non supportee automatiquement.'
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/ukit-docker.asc
  chmod a+r /etc/apt/keyrings/ukit-docker.asc
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/ukit-docker.asc] https://download.docker.com/linux/%s %s stable\n' "$(dpkg --print-architecture)" "$ID" "${UBUNTU_CODENAME:-$VERSION_CODENAME}" > /etc/apt/sources.list.d/ukit-docker.list
  chmod 0644 /etc/apt/sources.list.d/ukit-docker.list
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
elif ! docker compose version >/dev/null 2>&1; then
  if apt-cache show docker-compose-plugin >/dev/null 2>&1; then
    DEBIAN_FRONTEND=noninteractive apt-get install -y docker-compose-plugin
  elif apt-cache show docker-compose-v2 >/dev/null 2>&1; then
    DEBIAN_FRONTEND=noninteractive apt-get install -y docker-compose-v2
  else
    die 'Installer Docker Compose v2 pour le moteur Docker existant, puis relancer.'
  fi
fi
systemctl enable --now docker
docker info >/dev/null
"${COMPOSE[@]}" config --quiet

log 'Construction de l application.'
"${COMPOSE[@]}" build dashboard
# Le fichier .env monte en lecture seule doit etre lisible par l'utilisateur node.
chgrp 1000 "$PROJECT_DIR/backend/.env"
chmod 0640 "$PROJECT_DIR/backend/.env"
if ! "${COMPOSE[@]}" run --rm --no-deps --entrypoint node dashboard -e 'require("node:fs").accessSync("/app/backend/.env",require("node:fs").constants.R_OK)'; then
  die 'backend/.env est illisible par uid 1000. Donner la lecture au groupe 1000 (chgrp 1000 backend/.env ; chmod 640 backend/.env), puis relancer.'
fi

log 'Demarrage du conteneur sur 127.0.0.1 uniquement.'
"${COMPOSE[@]}" up -d --no-build dashboard
healthy=0
for ((attempt=0; attempt<60; attempt++)); do
  if curl -fsS --max-time 3 "http://127.0.0.1:$UKIT_HTTP_PORT/healthz" >/dev/null; then healthy=1; break; fi
  sleep 2
done
(( healthy )) || { "${COMPOSE[@]}" logs --tail=60 dashboard; die 'Le conteneur ne repond pas.'; }
if ! curl -fsS --max-time 15 "http://127.0.0.1:$UKIT_HTTP_PORT/readyz"; then
  "${COMPOSE[@]}" exec -T dashboard node server/diagnose.mjs || true
  "${COMPOSE[@]}" logs --tail=40 dashboard
  die 'Connexion PostgreSQL distante indisponible ; consulter le diagnostic ci-dessus. Apache reste inchange.'
fi

log 'Configuration du VirtualHost Apache dedie.'
BACKUP_DIR="$PROJECT_DIR/backend/backups/apache/$(date -u +%Y%m%dT%H%M%SZ)-$$"
mkdir -p -- "$BACKUP_DIR"
a2enmod proxy proxy_http headers ssl rewrite
CONFIG_CHANGED=1
python3 "$PROJECT_DIR/apache/configure_proxy.py" --domain "$DOMAIN" --port "$UKIT_HTTP_PORT" --backup "$BACKUP_DIR" > "$BACKUP_DIR/sites.txt"
while IFS= read -r site; do a2ensite "$site"; done < "$BACKUP_DIR/sites.txt"
apache2ctl configtest
systemctl reload apache2
CONFIG_CHANGED=0
curl -fsS --max-time 15 -H "Host: $DOMAIN" "http://127.0.0.1/healthz" >/dev/null

if [[ "$ENABLE_HTTPS" == 1 ]]; then
  log 'Activation HTTPS et renouvellement automatique.'
  DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-apache
  if [[ -s "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" && -s "/etc/letsencrypt/live/$DOMAIN/privkey.pem" ]]; then
    log 'Certificat existant conserve ; aucune adresse email demandee.'
  else
    EMAIL_ARGS=(--register-unsafely-without-email)
    [[ -z "$LE_EMAIL" ]] || EMAIL_ARGS=(--email "$LE_EMAIL")
    certbot --apache --non-interactive --agree-tos "${EMAIL_ARGS[@]}" --redirect --keep-until-expiring --cert-name "$DOMAIN" -d "$DOMAIN"
  fi
  apache2ctl configtest
  systemctl reload apache2
  systemctl enable --now certbot.timer
  curl -fsS --max-time 20 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/healthz" >/dev/null
  log "Deploiement termine : https://$DOMAIN"
else
  log "Deploiement HTTP termine : http://$DOMAIN (HTTPS desactive explicitement)."
fi
"${COMPOSE[@]}" ps
