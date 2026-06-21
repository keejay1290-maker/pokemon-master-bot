import { handlePackReveal, type PackSession } from '../src/handlers/packRevealHandler';

describe('Pack reveal durability', () => {
  test('acknowledges immediately and relies on PostgreSQL instead of a Redis reveal lock', async () => {
    const session: PackSession = {
      userId: 'trainer-1',
      setName: 'Test Set',
      setId: 'test-set',
      cards: [{
        id: 'card-1',
        name: 'Pikachu',
        rarity: 'Common',
        number: '1',
        isNew: true,
      }],
      currentIndex: 0,
      newCardIds: ['card-1'],
      dupCardIds: [],
      revealedCardIds: [],
    };

    const tx = {
      packSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        delete: jest.fn().mockResolvedValue(undefined),
      },
      card: { upsert: jest.fn().mockResolvedValue(undefined) },
      userCard: { upsert: jest.fn().mockResolvedValue(undefined) },
      user: { update: jest.fn().mockResolvedValue(undefined) },
    };
    const redis = {
      isReady: true,
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };
    const client = {
      redis,
      prisma: {
        packSession: {
          findUnique: jest.fn().mockResolvedValue({
            sessionId: 'session-1',
            cards: session,
            currentIndex: 0,
            expiresAt: new Date(Date.now() + 60_000),
          }),
        },
        $transaction: jest.fn(async (callback: (transaction: typeof tx) => Promise<void>) => callback(tx)),
        userInventory: { findFirst: jest.fn().mockResolvedValue(null) },
      },
      logger: { error: jest.fn() },
    };
    const interaction = {
      user: { id: 'trainer-1' },
      deferUpdate: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined),
      followUp: jest.fn().mockResolvedValue(undefined),
    };

    await handlePackReveal(interaction as never, client as never, 'session-1');

    expect(interaction.deferUpdate).toHaveBeenCalledTimes(1);
    expect(tx.packSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { sessionId: 'session-1', currentIndex: 0 },
    }));
    expect(redis.set).not.toHaveBeenCalledWith(
      'pack:lock:session-1',
      expect.anything(),
      expect.anything(),
    );
    expect(interaction.editReply).toHaveBeenCalled();
  });
});
