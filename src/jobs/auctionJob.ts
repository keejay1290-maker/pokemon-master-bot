import type { BotClient } from '../types/index.js';
import { transferBalance } from '../services/userService.js';

type Bid = { userId: string; username: string; amount: number; at: string };

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

      if (bids.length === 0) {
        // No bids — mark expired
        await client.prisma.marketListing.update({
          where: { id: listing.id },
          data: { status: 'expired' },
        });
        client.logger.info(`Auction ${listing.id.slice(-6)} expired with no bids`);
        continue;
      }

      // Winner = highest bid (last entry since bids are appended in order)
      const winningBid = bids.reduce((best, b) => (b.amount > best.amount ? b : best), bids[0]);

      // Transfer coins: winner → seller
      await transferBalance(client.prisma, winningBid.userId, listing.sellerId, winningBid.amount);

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

      const data = listing.itemData as Record<string, unknown>;
      const name = (data.name as string) ?? 'Item';
      client.logger.info(
        `Auction settled: ${name} → ${winningBid.username} for ${winningBid.amount} coins (listing ${listing.id.slice(-6)})`
      );

      // Attempt to DM winner and seller
      try {
        const winner = await client.users.fetch(winningBid.userId);
        await winner.send(
          `🏆 You won the auction for **${name}** with a bid of **${winningBid.amount.toLocaleString()} PokéCoins**!`
        );
      } catch {
        // DMs may be closed — not fatal
      }

      try {
        const seller = await client.users.fetch(listing.sellerId);
        await seller.send(
          `✅ Your auction for **${name}** sold to **${winningBid.username}** for **${winningBid.amount.toLocaleString()} PokéCoins**!`
        );
      } catch {
        // DMs may be closed — not fatal
      }
    } catch (err) {
      client.logger.error(`Failed to settle auction ${listing.id}:`, err);
    }
  }
}
