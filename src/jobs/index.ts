import cron from 'node-cron';
import type { BotClient } from '../types/index.js';
import { checkEventSchedule } from './eventJob.js';
import { checkGiveaways } from './giveawayJob.js';
import { resetDailyQuests } from './questJob.js';

export function startJobService(client: BotClient) {
  // Check active giveaways every minute
  cron.schedule('* * * * *', () => checkGiveaways(client).catch(() => {}));

  // Check events every hour
  cron.schedule('0 * * * *', () => checkEventSchedule(client).catch(() => {}));

  // Reset daily quests at midnight
  cron.schedule('0 0 * * *', () => resetDailyQuests(client).catch(() => {}));

  client.logger.info('Job service started');
}
