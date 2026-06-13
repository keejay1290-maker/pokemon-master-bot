# ⚡ Pokemon Master Discord Bot

A production-ready Pokemon Discord bot with full economy, battles, TCG card system, AI Professor Oak, and a web admin dashboard.

## Features

- 🎮 **Pokemon Spawns** — Random Pokemon spawn in your server. Click to catch them!
- ⚔️ **Turn-based Battles** — Challenge trainers to ranked or unranked Pokemon battles
- 💰 **Full Economy** — Earn, spend, trade PokeCoins with daily/weekly rewards, jobs, fishing, hunting
- 🃏 **Pokemon TCG Cards** — Open card packs, build collections using the official TCG API
- 🤖 **AI Professor Oak** — Ask Pokemon questions powered by Groq AI (Llama 3.1)
- 🏆 **Achievements & Quests** — Complete 27+ achievements and daily/weekly quests
- 🎉 **Giveaways** — Run Pokemon and coin giveaways with button entry
- 🔨 **Full Moderation** — Auto-mod, anti-spam, scam detection, ban/kick/warn/timeout/purge
- 🌐 **Web Dashboard** — Discord OAuth2 admin panel at `/dashboard`
- 📊 **Leaderboards** — Balance, Pokemon caught, battles, ranked points, level
- 🔧 **Fully Configurable** — Per-server settings for economy, spawns, moderation, and more

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Discord Bot Token

### Installation

```bash
git clone https://github.com/you/pokemon-master-bot
cd pokemon-master-bot
npm install
cp .env.example .env
# Fill in .env
npx prisma migrate dev
npm run db:seed     # Seeds Gen 1 Pokemon + achievements
npm run deploy:commands   # Deploy slash commands to Discord
npm run dev
```

See [INSTALL.md](INSTALL.md) for full installation guide.

## Commands

| Category | Commands |
|----------|----------|
| Pokemon | `/pokemon` `/pokedex` `/catch` `/box` `/team` `/trade` `/favorite` |
| Economy | `/balance` `/daily` `/weekly` `/work` `/fish` `/hunt` `/beg` `/rob` `/deposit` `/withdraw` `/shop` |
| Cards | `/pack` `/card` `/collection` |
| Battles | `/battle` |
| Social | `/profile` `/leaderboard` `/achievements` `/quests` |
| Moderation | `/ban` `/kick` `/warn` `/timeout` `/warnings` `/purge` `/lock` `/unlock` `/slowmode` |
| Utility | `/ping` `/help` `/setup` `/welcome` `/professor ask` `/giveaway` `/config` |

See [COMMANDS.md](COMMANDS.md) for full documentation.

## Deployment

- **Railway**: See [railway.json](railway.json) — `railway up`
- **Render**: See [render.yaml](render.yaml) — connect repo to Render
- **Docker**: `docker compose up -d`
- **Replit**: `.replit` configured, just add env vars and run

See [DEPLOY.md](DEPLOY.md) for full deployment guide.

## Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20, TypeScript 5 |
| Discord | Discord.js v14 |
| Database | PostgreSQL + Prisma ORM |
| Cache | Redis |
| AI | Groq SDK (Llama 3.1 70B) |
| Cards | Pokemon TCG API |
| Pokemon | PokeAPI |
| Dashboard | Express + Passport Discord OAuth2 |
| Jobs | node-cron |
| Container | Docker + Docker Compose |
| CI/CD | GitHub Actions |

## Environment Variables

See [.env.example](.env.example) for all required and optional variables.

**Required:**
- `DISCORD_TOKEN` — Bot token
- `DISCORD_CLIENT_ID` — App client ID
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis URL
- `GROQ_API_KEY` — For Professor Oak AI
- `POKEMON_TCG_API_KEY` — For card packs

## License

MIT
