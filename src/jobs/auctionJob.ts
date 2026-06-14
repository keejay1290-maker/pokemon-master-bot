import { EmbedBuilder } from 'discord.js';
import type { BotClient } from '../types/index.js';
import { transferBalance } from '../services/userService.js';

type Bid = { userId: string; username: string; amount: number; at: string };
type ItemData = { name: string; type: 'pokemon' | 'item' | 'pack'; userPokemonId?: string; itemId?: string };

async function transferAsset(client: BotClient, data: ItemData, sellerId: string, winnerId: string): Promise<void> {
  if (data.type === 'pokemon' && data.userPokemonId) {
    await client.prisma.userPokemon.update({
      where: { id: data.userPokemonId },
      data: { userId: winnerId },
    });
  } else if ((data.type === 'item' || data.type === 'pack') && data.itemId) {
    await client.prisma.userInventory.upsert({
      where: { userId_itemId: { userId: winnerId, itemId: data.itemId } },
      update: { quantity: { increment: 1 } },
      create: { userId: winnerId, itemId: data.itemId, itemName: data.name, quantity: 1 },
    });
  }
}

async function restoreEscrow(client: BotClient, data: ItemData, sellerId: string): Promise<void> {
  // Pokemon ownership was never changed — no restore needed
  if ((data.type === 'item' || data.type === 'pack') && data.itemId) {
    await client.prisma.userInventory.upsert({
      where: { userId_itemId: { userId: sellerId, itemId: data.itemId } },
      update: { quantity: { increment: 1 } },
      create: { userId: sellerId, itemId: data.itemId, itemName: data.name, quantity: 1 },
    });
  }
}

export async function settleExpiredAuctions(client: BotClient) {
  const expired = await client.prisma.marketListing.findMany({
    where: {
      isAuction: true,
      status: 'active',
      auctionEndsAt: { lte: new Date() },
    },
    include: { seller: { select: { id: true, username: true } } },
  });

  if (expired.length === 0) return;

  for (const listing of expired) {
    try {
      const bids = (listing.bids as Bid[] | null) ?? [];
      const data = listing.itemData as ItemData;
      const name = data.name ?? 'Item';

      if (bids.length === 0) {
        await client.prisma.marketListing.update({
          where: { id: listing.id },
          data: { status: 'expired' },
        });
        // Restore item/pack escrow to seller (pokemon was never moved)
        await restoreEscrow(client, data, listing.sellerId);
        client.logger.info(`Auction ${listing.id.slice(-6)} expired with no bids — escrow restored`);
        continue;
      }

      const winningBid = bids.reduce((best, b) => (b.amount > best.amount ? b : best), bids[0]);

      // Transfer coins: winner pays seller
      await transferBalance(client.prisma, winningBid.userId, listing.sellerId, winningBid.amount);

      // Transfer asset: winner receives the item/pokemon/pack
      await transferAsset(client, data, listing.sellerId, winningBid.userId);

      await client.prisma.marketListing.update({
        where: { id: listing.id },
        data: { status: 'sold' },
      });

      await client.prisma.marketPurchase.create({
        data: {
          listingId: listing.id,
          buyerId: winningBid.userId,
          price: winningBid.amount,
        },
      });

      client.logger.info(
        `Auction settled: ${name} → ${winningBid.username} for ${winningBid.amount} coins (${listing.id.slice(-6)})`
      );

      // DM winner
      try {
        const winner = await client.users.fetch(winningBid.userId);
        await winner.send({
          embeds: [new EmbedBuilder()
            .setColor(0xffd700)
            .setTitle('🏆 You Won an Auction!')
            .setDescription(`**${name}** has been transferred to your account.`)
            .addFields(
              { name: '💰 Winning Bid', value: `${winningBid.amount.toLocaleString()} PokéCoins`, inline: true },
              { name: '📦 Item', value: name, inline: true },
            )
            .setFooter({ text: 'Check /inventory or /box to see your new item' })
            .setTimestamp()],
        });
      } catch { /* DMs closed */ }

      // DM seller
      try {
        const seller = await client.users.fetch(listing.sellerId);
        await seller.send({
          embeds: [new EmbedBuilder()
            .setColor(0x00cc66)
            .setTitle('✅ Auction Sold!')
            .setDescription(`**${name}** sold to **${winningBid.username}**.`)
            .addFields(
              { name: '💰 Sale Price', value: `${winningBid.amount.toLocaleString()} PokéCoins`, inline: true },
            )
            .setTimestamp()],
        });
      } catch { /* DMs closed */ }

    } catch (err) {
      client.logger.error(`Failed to settle auction ${listing.id}:`, err);
    }
  }
}
