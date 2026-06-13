# Installation Guide

## Prerequisites

- **Node.js** 18+ (`node --version`)
- **npm** 9+ or **pnpm** 8+
- **PostgreSQL** 14+ running locally or hosted (e.g. Supabase, Railway)
- **Redis** 7+ running locally or hosted (e.g. Upstash, Railway)
- **Discord Application** with a bot token

## Step 1: Create a Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** → name it "Pokemon Master"
3. Go to **Bot** tab:
   - Click **Add Bot**
   - Enable **Server Members Intent**, **Message Content Intent**, **Presence Intent**
   - Copy the **Bot Token** → save as `DISCORD_TOKEN`
4. Go to **General Information**:
   - Copy **Application ID** → save as `DISCORD_CLIENT_ID`
   - Copy **Public Key** → save as `DISCORD_PUBLIC_KEY`
5. Go to **OAuth2 → General**:
   - Add redirect URL: `http://localhost:3001/auth/discord/callback`
   - Copy **Client Secret** → save as `DISCORD_CLIENT_SECRET`

## Step 2: Invite Bot to Server

Generate invite URL with required permissions:

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

Or use OAuth2 URL Generator with scopes: `bot`, `applications.commands` and permissions: **Administrator**

## Step 3: Clone & Install

```bash
git clone https://github.com/you/pokemon-master-bot
cd pokemon-master-bot
npm install
```

## Step 4: Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_PUBLIC_KEY=your_public_key_here
DISCORD_CLIENT_SECRET=your_client_secret_here

DATABASE_URL=postgresql://user:password@localhost:5432/pokemon_master

REDIS_URL=redis://localhost:6379

GROQ_API_KEY=your_groq_api_key_here
POKEMON_TCG_API_KEY=your_tcg_api_key_here
```

### Get API Keys

- **Groq API** (free): https://console.groq.com — sign up, create API key
- **Pokemon TCG API** (free): https://dev.pokemontcg.io — sign up, get key

## Step 5: Set Up Database

```bash
# Run all migrations
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate

# Seed database (downloads Gen 1 Pokemon from PokeAPI + achievements)
npm run db:seed
```

Note: Seeding fetches ~151 Pokemon from PokeAPI which takes ~3 minutes. Progress is shown.

## Step 6: Deploy Slash Commands

```bash
npm run deploy:commands
```

This registers all slash commands globally (takes up to 1 hour to propagate) or to a specific guild for instant testing:

```bash
# For instant testing in one server
DISCORD_GUILD_ID=your_server_id npm run deploy:commands
```

## Step 7: Run the Bot

```bash
# Development (hot-reload)
npm run dev

# Production
npm run build && npm start
```

## Step 8: Server Setup

In your Discord server, run:
```
/setup type:Full Setup (creates all channels & roles)
```

This creates all Pokemon-themed channels and roles automatically.

## Verify Installation

Check these work:
- `/ping` — bot responds with latency
- `/pokemon name:pikachu` — shows Pikachu stats
- `/daily` — claims daily reward
- `/professor ask question:What is Pikachu's type?` — AI responds

## Common Issues

**Bot not responding:**
- Check `DISCORD_TOKEN` is correct
- Verify bot has correct intents enabled in Developer Portal

**Database errors:**
- Verify `DATABASE_URL` format: `postgresql://user:password@host:port/database`
- Run `npx prisma migrate dev` if schema is out of sync

**Redis connection refused:**
- Start Redis: `redis-server` or `brew services start redis`
- Check `REDIS_URL` is correct

**Commands not showing:**
- Run `npm run deploy:commands` again
- Global commands take up to 1 hour to propagate; use guild commands for instant testing

**Seed fails:**
- PokeAPI may be rate-limited; the seed script has 100ms delays between requests
- Re-run `npm run db:seed` — it uses upsert and is safe to re-run
