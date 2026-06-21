import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { randomBytes } from 'crypto';
import type { BotClient } from '../types/index.js';
import { apiRouter } from './routes/api.js';

export async function startDashboard(client: BotClient) {
  const app = express();
  const PORT = parseInt(process.env.PORT ?? process.env.DASHBOARD_PORT ?? '3001', 10);
  const isProduction = process.env.NODE_ENV === 'production';
  const requiredProductionEnv = [
    'DASHBOARD_SECRET',
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
  ];
  const missingProductionEnv = requiredProductionEnv.filter((name) => !process.env[name]);

  if (isProduction && missingProductionEnv.length > 0) {
    throw new Error(`Missing required dashboard environment variables: ${missingProductionEnv.join(', ')}`);
  }

  const railwayPublicDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
  const dashboardUrl = process.env.DASHBOARD_URL ??
    (railwayPublicDomain ? `https://${railwayPublicDomain}` : `http://localhost:${PORT}`);
  const discordCallbackUrl = process.env.DISCORD_CALLBACK_URL ??
    `${dashboardUrl}/auth/discord/callback`;
  const sessionSecret = process.env.DASHBOARD_SECRET ?? randomBytes(32).toString('hex');

  if (!process.env.DASHBOARD_SECRET) {
    client.logger.warn('DASHBOARD_SECRET is not set; using an ephemeral development-only session secret');
  }

  if (isProduction) app.set('trust proxy', 1);

  app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

  app.use(helmet());
  app.use(cors({ origin: dashboardUrl, credentials: true, methods: ['GET', 'PATCH', 'POST'] }));
  app.use(morgan('combined'));
  app.use(express.json({ limit: '32kb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(session({
    name: 'pokemon_master_session',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }));

  passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID ?? '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
    callbackURL: discordCallbackUrl,
    scope: ['identify', 'guilds'],
  }, (_accessToken, _refreshToken, profile, done) => {
    return done(null, profile);
  }));

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user as Express.User));

  app.use(passport.initialize());
  app.use(passport.session());

  // Auth routes
  app.get('/auth/discord', passport.authenticate('discord'));
  app.get('/auth/discord/callback',
    passport.authenticate('discord', { failureRedirect: '/login?error=1' }),
    (_req, res) => res.redirect('/dashboard')
  );
  app.get('/auth/logout', (req, res) => {
    req.logout(() => res.redirect('/'));
  });
  app.get('/auth/me', (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
    res.json(req.user);
  });

  // API routes
  app.use('/api', (req, _res, next) => {
    (req as express.Request & { botClient: BotClient }).botClient = client;
    next();
  }, apiRouter);

  // Serve dashboard frontend
  const dashboardPublic = path.join(__dirname, '../../dashboard-ui/dist');
  app.use(express.static(dashboardPublic));
  app.get('*', (_req, res) => {
    const indexPath = path.join(dashboardPublic, 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) res.status(200).json({ message: 'Pokemon Master Dashboard API', version: '1.0.0' });
    });
  });

  app.listen(PORT, () => {
    client.logger.info(`Dashboard running on port ${PORT}`);
  });

  return app;
}
