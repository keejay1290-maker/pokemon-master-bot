# Deployment Guide

## Docker (Recommended)

### Prerequisites
- Docker and Docker Compose installed
- `.env` file configured (see INSTALL.md)

### Quick Deploy

```bash
# Build and start all services
docker compose up -d

# View logs
docker compose logs -f pokemon-bot

# Stop
docker compose down
```

The `docker-compose.yml` includes:
- `pokemon-bot` — The bot
- `postgres` — PostgreSQL 16
- `redis` — Redis 7

### Production Docker

```bash
# Build production image
docker build -t pokemon-master-bot:latest .

# Run with external database (recommended for prod)
docker run -d \
  --name pokemon-bot \
  --restart unless-stopped \
  -e DISCORD_TOKEN=your_token \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  -e GROQ_API_KEY=... \
  -e POKEMON_TCG_API_KEY=... \
  pokemon-master-bot:latest
```

---

## Railway

Railway is the easiest cloud deployment option.

### Setup

1. Push your code to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
3. Add services: **PostgreSQL** and **Redis** from Railway marketplace
4. Set environment variables in Railway dashboard:
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `DISCORD_PUBLIC_KEY`
   - `DISCORD_CLIENT_SECRET`
   - `GROQ_API_KEY`
   - `POKEMON_TCG_API_KEY`
   - `DATABASE_URL` (auto-set from Railway PostgreSQL)
   - `REDIS_URL` (auto-set from Railway Redis)
5. Deploy!

Railway uses `railway.json` automatically. The deploy command runs migrations before starting.

### After Deploy

```bash
# Run seed (one-time, from Railway shell or CLI)
railway run npm run db:seed
railway run npm run deploy:commands
```

---

## Render

1. Push to GitHub
2. Go to [render.com](https://render.com) → New → Blueprint
3. Connect your repo — Render reads `render.yaml` automatically
4. Set secret environment variables:
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `DISCORD_PUBLIC_KEY`
   - `DISCORD_CLIENT_SECRET`
   - `GROQ_API_KEY`
   - `POKEMON_TCG_API_KEY`
5. Deploy

---

## Replit

1. Open this project in Replit
2. Add all secrets in the Secrets tab (left sidebar)
3. Click Run

The `.replit` file configures the run command automatically.

---

## VPS / Self-hosted (Ubuntu)

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib
sudo -u postgres createuser --superuser pokemon
sudo -u postgres createdb pokemon_master -O pokemon
sudo -u postgres psql -c "ALTER USER pokemon WITH PASSWORD 'your_password';"

# Install Redis
sudo apt-get install -y redis-server
sudo systemctl enable redis-server

# Clone and setup
git clone https://github.com/you/pokemon-master-bot
cd pokemon-master-bot
npm install
cp .env.example .env
# Edit .env
npx prisma migrate deploy
npm run db:seed
npm run deploy:commands
npm run build

# Use PM2 for process management
npm install -g pm2
pm2 start dist/index.js --name pokemon-bot
pm2 save
pm2 startup
```

---

## GitHub Actions CI/CD

The `.github/workflows/ci.yml` workflow:
1. Runs tests on every push/PR
2. Builds on merge to `main`
3. Pushes Docker image to DockerHub (set `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets)

### Setup GitHub Secrets

Go to your repo → Settings → Secrets and variables → Actions:
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

---

## Database Migrations in Production

```bash
# Apply pending migrations (safe, runs on deploy automatically)
npx prisma migrate deploy

# Never run `migrate dev` in production — it can drop data
```

---

## Monitoring

### Health Check

The dashboard API exposes `/api/stats` with uptime and latency info.

### Logs

```bash
# Docker
docker compose logs -f pokemon-bot

# PM2
pm2 logs pokemon-bot

# Winston log files (local)
tail -f logs/combined.log
tail -f logs/error.log
```
