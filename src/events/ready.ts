import { ActivityType } from 'discord.js';
import type { BotClient } from '../types/index.js';

const activities = [
  { name: 'Pokemon battles', type: ActivityType.Watching },
  { name: '/catch', type: ActivityType.Listening },
  { name: 'Pokemon Master', type: ActivityType.Playing },
  { name: 'the Pokedex', type: ActivityType.Watching },
  { name: '/pokemon', type: ActivityType.Listening },
];

export async function handleReady(client: BotClient) {
  client.logger.info(`Logged in as ${client.user?.tag}`);
  client.logger.info(`Serving ${client.guilds.cache.size} guilds`);

  let i = 0;
  const rotateActivity = () => {
    const activity = activities[i % activities.length];
    client.user?.setActivity(activity.name, { type: activity.type });
    i++;
  };

  rotateActivity();
  setInterval(rotateActivity, 30000);
}
