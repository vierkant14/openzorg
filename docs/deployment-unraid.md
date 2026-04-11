# OpenZorg op Unraid deployen

## Overzicht

OpenZorg draait als Docker Compose stack. Op Unraid gebruik je de **Docker Compose Manager** plugin om de hele stack in één keer te deployen.

**Wat je nodig hebt:**
- Unraid 6.12+ met Docker Compose Manager plugin
- Cloudflare subdomain (bijv. `zorg.jouwdomein.nl`)
- Home Assistant als reverse proxy met Cloudflare plugin

## Stap 1: Docker Compose Manager installeren

1. Ga naar **Apps** in Unraid
2. Zoek **Docker Compose Manager** (door dcm)
3. Installeer de plugin
4. Na installatie verschijnt een **Compose** tab in de Docker sectie

## Stap 2: Repository clonen op Unraid

SSH naar je Unraid server:

```bash
ssh root@<unraid-ip>

# Maak een share aan voor OpenZorg
mkdir -p /mnt/user/appdata/openzorg

# Clone de repo
cd /mnt/user/appdata/openzorg
git clone https://github.com/<jouw-org>/openzorg.git .
```

## Stap 3: Productie environment aanmaken

Maak een `.env` bestand aan in `/mnt/user/appdata/openzorg/infra/compose/`:

```bash
cat > /mnt/user/appdata/openzorg/infra/compose/.env << 'EOF'
# === PostgreSQL ===
POSTGRES_PASSWORD=<genereer-sterk-wachtwoord>

# === Medplum ===
MEDPLUM_SUPER_ADMIN_EMAIL=admin@jouwdomein.nl
MEDPLUM_SUPER_ADMIN_PASSWORD=<genereer-sterk-wachtwoord>

# === Master Admin ===
MASTER_ADMIN_KEY=<genereer-lange-random-key>

# === URLs (pas aan naar je domein) ===
NEXT_PUBLIC_MEDPLUM_BASE_URL=https://fhir.zorg.jouwdomein.nl
NEXT_PUBLIC_ECD_URL=https://api.zorg.jouwdomein.nl

# === Node ===
NODE_ENV=production
EOF
```

**Wachtwoorden genereren:**
```bash
openssl rand -base64 32  # Gebruik dit voor elk wachtwoord
```

## Stap 4: Docker Compose stack starten

Via de Unraid UI:
1. Ga naar **Docker → Compose**
2. Klik **Add New Stack**
3. Stel het pad in naar: `/mnt/user/appdata/openzorg/infra/compose/docker-compose.yml`
4. Klik **Compose Up**

Of via SSH:
```bash
cd /mnt/user/appdata/openzorg
docker compose -f infra/compose/docker-compose.yml up -d --build
```

Wacht 2-3 minuten tot alle services healthy zijn:
```bash
docker compose -f infra/compose/docker-compose.yml ps
```

## Stap 5: Seed uitvoeren (eerste keer)

De seed container maakt automatisch testgebruikers aan. Check de logs:
```bash
docker compose -f infra/compose/docker-compose.yml logs seed
```

## Stap 6: Cloudflare + Home Assistant proxy

### Cloudflare DNS
Maak de volgende DNS records aan (type A of CNAME naar je thuisnetwerk):

| Subdomain | Doel |
|-----------|------|
| `zorg.jouwdomein.nl` | Web app (port 3000) |
| `api.zorg.jouwdomein.nl` | ECD API (port 4001) |
| `fhir.zorg.jouwdomein.nl` | Medplum (port 8103) |

Zet **Proxy** aan (oranje wolk) voor HTTPS.

### Home Assistant Nginx Proxy Manager

Als je Nginx Proxy Manager draait op Home Assistant:

1. Ga naar je Nginx Proxy Manager (bijv. `http://<ha-ip>:81`)
2. Voeg per subdomain een **Proxy Host** toe:

**zorg.jouwdomein.nl:**
- Scheme: `http`
- Forward Hostname/IP: `<unraid-ip>`
- Forward Port: `3000`
- SSL: Request a new SSL certificate → Force SSL

**api.zorg.jouwdomein.nl:**
- Scheme: `http`
- Forward Hostname/IP: `<unraid-ip>`
- Forward Port: `4001`
- Custom locations: voeg CORS headers toe

**fhir.zorg.jouwdomein.nl:**
- Scheme: `http`
- Forward Hostname/IP: `<unraid-ip>`
- Forward Port: `8103`

### Cloudflare Tunnel (alternatief, geen port forwarding nodig)

Als je de Cloudflare Tunnel plugin in HA gebruikt:

1. Ga naar Cloudflare Zero Trust → Access → Tunnels
2. Maak een tunnel (of gebruik je bestaande)
3. Voeg public hostnames toe:

```
zorg.jouwdomein.nl    → http://<unraid-ip>:3000
api.zorg.jouwdomein.nl → http://<unraid-ip>:4001
fhir.zorg.jouwdomein.nl → http://<unraid-ip>:8103
```

## Stap 7: Twee omgevingen aanmaken

Ga naar `https://zorg.jouwdomein.nl/master-admin/onboarding` en maak 2 omgevingen:

**Omgeving 1 — voor jezelf:**
- Naam: bijv. "OpenZorg Dev"
- Slug: `openzorg-dev`
- Sector: VVT

**Omgeving 2 — voor je collega:**
- Naam: bijv. "OpenZorg Test"
- Slug: `openzorg-test`
- Sector: VVT

Maak daarna in Medplum (via API) voor elk een gebruikersaccount.

## Stap 8: Inloggen testen

Ga naar `https://zorg.jouwdomein.nl/login`:
- Gebruik de credentials uit de seed logs
- Kies rol **Beheerder**

Deel met je collega:
- URL: `https://zorg.jouwdomein.nl/login`
- Credentials van omgeving 2

## Updates deployen

Bij nieuwe code:
```bash
cd /mnt/user/appdata/openzorg
git pull
docker compose -f infra/compose/docker-compose.yml up -d --build ecd web
```

Alleen ECD + Web herbouwen is meestal genoeg (30 seconden).

## Troubleshooting

**Services starten niet:**
```bash
docker compose -f infra/compose/docker-compose.yml logs <service-name>
```

**Database resetten:**
```bash
docker compose -f infra/compose/docker-compose.yml down -v
docker compose -f infra/compose/docker-compose.yml up -d
```

**Port conflict:**
```bash
docker compose -f infra/compose/docker-compose.yml ps
netstat -tlnp | grep <port>
```
