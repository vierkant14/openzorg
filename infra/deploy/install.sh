#!/bin/bash
#
# OpenZorg Installer — run dit ONE-LINER op je Unraid server:
#
#   curl -fsSL https://raw.githubusercontent.com/vierkant14/openzorg/main/infra/deploy/install.sh | bash
#
# Of als je de repo al hebt gecloned:
#
#   bash /mnt/user/appdata/openzorg/infra/deploy/install.sh
#
# Dit script doet ALLES automatisch:
# 1. Installeert Docker (als dat nog niet draait)
# 2. Cloned de repo (of doet git pull als die al bestaat)
# 3. Genereert veilige wachtwoorden
# 4. Start de hele stack
# 5. Maakt testgebruikers aan
# 6. Toont de login-gegevens
#

set -euo pipefail

INSTALL_DIR="/mnt/user/appdata/openzorg"
REPO_URL="https://github.com/vierkant14/openzorg.git"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         OpenZorg Installer v1.0          ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 1. Check Docker ──
if ! command -v docker &> /dev/null; then
  echo "❌ Docker is niet geinstalleerd."
  echo "   Op Unraid: ga naar Settings → Docker → Enable Docker"
  exit 1
fi
echo "✅ Docker gevonden"

if ! docker info &> /dev/null; then
  echo "❌ Docker draait niet. Start Docker eerst."
  exit 1
fi
echo "✅ Docker draait"

# ── 2. Clone of update repo ──
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "📦 Repository bestaat al, pulling latest..."
  cd "$INSTALL_DIR"
  git pull origin main
else
  echo "📦 Repository clonen..."
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi
echo "✅ Code is up-to-date"

# ── 3. Genereer .env (alleen als die nog niet bestaat) ──
ENV_FILE="$INSTALL_DIR/infra/compose/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "🔑 Wachtwoorden genereren..."

  PG_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
  MASTER_KEY=$(openssl rand -base64 32 | tr -d '/+=' | head -c 40)

  cat > "$ENV_FILE" << EOF
# OpenZorg Production Config
# Gegenereerd op $(date)
# BEWAAR DIT BESTAND VEILIG

POSTGRES_PASSWORD=${PG_PASS}
MASTER_ADMIN_KEY=${MASTER_KEY}
NODE_ENV=production
EOF

  chmod 600 "$ENV_FILE"
  echo "✅ .env aangemaakt met veilige wachtwoorden"
else
  echo "✅ .env bestaat al (wordt niet overschreven)"
fi

# ── 4. Start de stack ──
echo ""
echo "🚀 Docker stack starten (dit duurt 3-5 minuten)..."
echo ""
cd "$INSTALL_DIR"
docker compose -f infra/compose/docker-compose.yml up -d --build

echo ""
echo "⏳ Wachten tot alle services healthy zijn..."
sleep 10

# Wacht max 5 minuten op Medplum
for i in $(seq 1 60); do
  if curl -sf http://localhost:8103/healthcheck > /dev/null 2>&1; then
    echo "✅ Medplum is klaar"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "⚠️  Medplum is nog niet klaar na 5 min. Check: docker compose -f infra/compose/docker-compose.yml logs medplum"
  fi
  sleep 5
done

# ── 5. Seed users ──
echo ""
echo "👤 Testgebruikers aanmaken..."
docker compose -f infra/compose/docker-compose.yml up -d seed
sleep 15
docker compose -f infra/compose/docker-compose.yml logs seed 2>&1 | tail -20

# ── 6. Klaar! ──
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║              ✅ OpenZorg is geinstalleerd!           ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║                                                      ║"
echo "║  Web app:     http://$(hostname -I | awk '{print $1}'):3000        ║"
echo "║  Master admin: http://$(hostname -I | awk '{print $1}'):3000/master-admin  ║"
echo "║                                                      ║"
echo "║  Logins: zie seed output hierboven                   ║"
echo "║                                                      ║"
echo "║  Updates draaien:                                    ║"
echo "║    bash $INSTALL_DIR/infra/deploy/update.sh  ║"
echo "║                                                      ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
