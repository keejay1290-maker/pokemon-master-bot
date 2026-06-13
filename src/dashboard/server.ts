import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import type { BotClient } from '../types/index.js';
import { apiRouter } from './routes/api.js';

export async function startDashboard(client: BotClient) {
  const app = express();
  const PORT = parseInt(process.env.PORT ?? process.env.DASHBOARD_PORT ?? '3001', 10);

  app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: process.env.DASHBOARD_URL, credentials: true }));
  app.use(morgan('combined'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(session({
    secret: process.env.DASHBOARD_SECRET ?? 'pokemon-master-secret-change-in-prod',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 },
  }));

  passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID!,
    clientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
    callbackURL: process.env.DISCORD_CALLBACK_URL ?? 'http://localhost:3001/auth/discord/callback',
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
