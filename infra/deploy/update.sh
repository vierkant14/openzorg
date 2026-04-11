#!/bin/bash
#
# OpenZorg Updater — draai dit na elke nieuwe release:
#
#   bash /mnt/user/appdata/openzorg/infra/deploy/update.sh
#
# Dit script:
# 1. Pulled de nieuwste code van GitHub
# 2. Herbouwt alleen de gewijzigde containers
# 3. Herstart de services
# 4. Data en gebruikers blijven behouden
#

set -euo pipefail

INSTALL_DIR="/mnt/user/appdata/openzorg"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         OpenZorg Updater                 ║"
echo "╚══════════════════════════════════════════╝"
echo ""

cd "$INSTALL_DIR"

# Show current version
echo "📌 Huidige versie:"
git log --oneline -1
echo ""

# Pull latest
echo "⬇️  Nieuwste code ophalen..."
git pull origin main
echo ""

echo "📌 Nieuwe versie:"
git log --oneline -1
echo ""

# Rebuild and restart
echo "🔨 Containers herbouwen (dit duurt 1-3 minuten)..."
docker compose -f infra/compose/docker-compose.yml up -d --build ecd web planning workflow-bridge

echo ""
echo "⏳ Wachten op healthy status..."
sleep 15

# Check health
echo ""
echo "📊 Service status:"
docker compose -f infra/compose/docker-compose.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || \
docker compose -f infra/compose/docker-compose.yml ps

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         ✅ Update compleet!              ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Web app: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost'):3000"
echo ""
