#!/bin/bash
# OpenZorg Server Setup — Run once on a fresh Ubuntu 22.04+ VPS
# Usage: ssh root@<server-ip> 'bash -s' < infra/deploy/server-setup.sh
#
# Tested on: Hetzner Cloud CX22 (€5/mnd, 2 vCPU, 4GB RAM, 40GB SSD)
# Also works on: DigitalOcean, Vultr, OVH, any Ubuntu VPS with Docker

set -euo pipefail

echo "=== OpenZorg Server Setup ==="

# ── 1. System updates ──
apt-get update -y && apt-get upgrade -y
apt-get install -y curl git ufw fail2ban

# ── 2. Docker ──
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

# ── 3. Firewall ──
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable

# ── 4. Create deploy user ──
if ! id "deploy" &>/dev/null; then
  useradd -m -s /bin/bash -G docker deploy
  mkdir -p /home/deploy/.ssh
  cp /root/.ssh/authorized_keys /home/deploy/.ssh/ 2>/dev/null || true
  chown -R deploy:deploy /home/deploy/.ssh
  chmod 700 /home/deploy/.ssh
  chmod 600 /home/deploy/.ssh/authorized_keys 2>/dev/null || true
fi

# ── 5. Clone repo ──
mkdir -p /opt/openzorg
if [ ! -d "/opt/openzorg/.git" ]; then
  git clone https://github.com/vierkant14/openzorg.git /opt/openzorg
fi
chown -R deploy:deploy /opt/openzorg

# ── 6. Create production .env ──
if [ ! -f "/opt/openzorg/infra/compose/.env" ]; then
  POSTGRES_PW=$(openssl rand -base64 24)
  MASTER_KEY=$(openssl rand -base64 32)

  cat > /opt/openzorg/infra/compose/.env << EOF
# Auto-generated production config — $(date)
POSTGRES_PASSWORD=${POSTGRES_PW}
MASTER_ADMIN_KEY=${MASTER_KEY}
NODE_ENV=production
EOF

  chmod 600 /opt/openzorg/infra/compose/.env
  chown deploy:deploy /opt/openzorg/infra/compose/.env

  echo ""
  echo "Generated credentials:"
  echo "  POSTGRES_PASSWORD: ${POSTGRES_PW}"
  echo "  MASTER_ADMIN_KEY:  ${MASTER_KEY}"
  echo ""
  echo "SAVE THESE — they won't be shown again!"
fi

# ── 7. Install Caddy (reverse proxy + auto HTTPS) ──
if ! command -v caddy &> /dev/null; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "  1. Set your domain in /etc/caddy/Caddyfile"
echo "  2. Run: cd /opt/openzorg && docker compose -f infra/compose/docker-compose.yml up -d --build"
echo "  3. Wait 2-3 min for services to start"
echo "  4. Run: docker compose -f infra/compose/docker-compose.yml up -d seed"
echo "  5. Point your DNS A record to this server's IP"
echo ""
