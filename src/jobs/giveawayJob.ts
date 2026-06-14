import type { BotClient } from '../types/index.js';
import { EmbedBuilder } from 'discord.js';
import { openPack } from '../services/pokemonTcgService.js';
import { ensureUser } from '../services/userService.js';

export async function checkGiveaways(client: BotClient) {
  const expiredGiveaways = await client.prisma.giveaway.findMany({
    where: { status: 'active', endsAt: { lte: new Date() } },
    include: { entries: true },
  });

  for (const giveaway of expiredGiveaways) {
    await endGiveaway(client, giveaway.id);
  }
}

export async function endGiveaway(client: BotClient, giveawayId: string) {
  const giveaway = await client.prisma.giveaway.findUnique({
    where: { id: giveawayId },
    include: { entries: true },
  });
  if (!giveaway || giveaway.status !== 'active') return;

  const entries = giveaway.entries;
  const winnerCount = Math.min(giveaway.winners, entries.length);
  const shuffled = [...entries].sort(() => Math.random() - 0.5);
  const winners = shuffled.slice(0, winnerCount).map((e) => e.userId);

  await client.prisma.giveaway.update({
    where: { id: giveawayId },
    data: { status: 'ended', winnerIds: winners, endedAt: new Date() },
  });

  const guild = client.guilds.cache.get(giveaway.guildId);
  if (!guild) return;
  const channel = guild.channels.cache.get(giveaway.channelId);
  if (!channel?.isTextBased()) return;

  // Distribute prizes to winners
  if (winners.length > 0) {
    const prizeData = giveaway.prizeData as Record<string, unknown>;

    if (giveaway.prizeType === 'coins') {
      const coins = (prizeData.coins as number) ?? 0;
      if (coins > 0) {
        for (const winnerId of winners) {
          await client.prisma.user.update({
            where: { id: winnerId },
            data: { balance: { increment: coins }, totalEarned: { increment: coins } },
          }).catch(() => {});
        }
      }
    } else if (giveaway.prizeType === 'packs') {
      const setId = prizeData.setId as string;
      const setName = prizeData.setName as string;
      const qty = (prizeData.quantity as number) ?? 1;

      for (const winnerId of winners) {
        // Ensure user exists
        const discordUser = await guild.members.fetch(winnerId).catch(() => null);
        if (!discordUser) continue;
        await ensureUser(client.prisma, discordUser.user);

        const allCards: Array<Record<string, unknown>> = [];
        for (let i = 0; i < qty; i++) {
          const cards = await openPack(client, setId);
          allCards.push(...cards);
        }

        for (const card of allCards) {
          const c = card as Record<string, unknown>;
          const tcgprices = (c.tcgplayer as Record<string, unknown> | null)?.prices as Record<string, Record<string, number>> | null;
          const marketValue =
            tcgprices?.holofoil?.market ??
            tcgprices?.normal?.market ??
            tcgprices?.reverseHolofoil?.market ??
            null;

          await client.prisma.card.upsert({
            where: { id: c.id as string },
            update: { marketValue: marketValue ?? undefined },
            create: {
              id: c.id as string,
              name: c.name as string,
              supertype: (c.supertype as string) ?? 'Pokémon',
              subtypes: (c.subtypes as string[]) ?? [],
              hp: (c.hp as string) ?? null,
              types: (c.types as string[]) ?? [],
              setId: ((c.set as Record<string, unknown>)?.id as string) ?? 'unknown',
              setName: ((c.set as Record<string, unknown>)?.name as string) ?? setName,
              number: (c.number as string) ?? '0',
              rarity: (c.rarity as string) ?? 'Common',
              artist: (c.artist as string) ?? null,
              imageSmall: ((c.images as Record<string, unknown>)?.small) as string ?? null,
              imageLarge: ((c.images as Record<string, unknown>)?.large) as string ?? null,
              marketValue,
            },
          }).catch(() => {});

          await client.prisma.userCard.upsert({
            where: { userId_cardId_isFoil: { userId: winnerId, cardId: c.id as string, isFoil: false } },
            update: { quantity: { increment: 1 } },
            create: { userId: winnerId, cardId: c.id as string, quantity: 1, isFoil: false },
          }).catch(() => {});
        }

        await client.prisma.user.update({
          where: { id: winnerId },
          data: { cardsCollected: { increment: allCards.length } },
        }).catch(() => {});

        // DM the winner
        await discordUser.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xffd700)
              .setTitle('🎉 You won a giveaway!')
              .setDescription(`You won **${qty} ${setName} Pack${qty > 1 ? 's' : ''}** from the **${giveaway.title}** giveaway!\nYour cards have been added to your collection. Use \`/collection\` to view them.`)
              .setTimestamp(),
          ],
        }).catch(() => {});
      }
    }
  }

  // Build prize label for the end embed
  const prizeData = giveaway.prizeData as Record<string, unknown>;
  let prizeLabel = 'the prize';
  if (giveaway.prizeType === 'coins') {
    prizeLabel = `${((prizeData.coins as number) ?? 0).toLocaleString()} PokéCoins`;
  } else if (giveaway.prizeType === 'packs') {
    const qty = (prizeData.quantity as number) ?? 1;
    prizeLabel = `${qty} ${prizeData.setName as string} Pack${qty > 1 ? 's' : ''}`;
  }

  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle('🎉 Giveaway Ended!')
    .setDescription(
      `**${giveaway.title}**\n\n` +
      (winners.length > 0
        ? `🏆 **Winner${winners.length > 1 ? 's' : ''}:** ${winners.map((w) => `<@${w}>`).join(', ')}`
        : 'No entries — no winner.')
    )
    .addFields(
      { name: 'Prize', value: prizeLabel, inline: true },
      { name: 'Entries', value: entries.length.toString(), inline: true },
    )
    .setTimestamp();

  if (giveaway.messageId) {
    await channel.messages.fetch(giveaway.messageId).then((msg) => msg.edit({ embeds: [embed], components: [] })).catch(() => {});
  }

  if (winners.length > 0) {
    await channel.send({
      content: `🎉 Congratulations ${winners.map((w) => `<@${w}>`).join(', ')}! You won **${giveaway.title}** — **${prizeLabel}**!`,
    }).catch(() => {});
  }
}
