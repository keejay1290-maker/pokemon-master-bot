import {
  createPackSession,
  handlePackReveal,
  resolveCardImage,
  type PackSession,
  type ResolvedCard,
} from '../src/handlers/packRevealHandler';

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

  test('awards every card atomically before the reveal session starts', async () => {
    const cards: ResolvedCard[] = [
      { id: 'card-1', name: 'Pikachu', rarity: 'Common', number: '1', isNew: true },
      { id: 'card-2', name: 'Raichu', rarity: 'Rare', number: '2', isNew: false },
    ];
    const tx = {
      card: { upsert: jest.fn().mockResolvedValue(undefined) },
      userCard: { upsert: jest.fn().mockResolvedValue(undefined) },
      user: { update: jest.fn().mockResolvedValue(undefined) },
      packSession: { create: jest.fn().mockResolvedValue(undefined) },
    };
    const client = {
      redis: { isReady: false },
      prisma: {
        guild: { findUnique: jest.fn().mockResolvedValue(null) },
        $transaction: jest.fn(async (callback: (transaction: typeof tx) => Promise<void>) => callback(tx)),
      },
    };

    await createPackSession(
      client as never,
      'trainer-1',
      'guild-1',
      'base1',
      'Base Set',
      undefined,
      cards,
    );

    expect(tx.card.upsert).toHaveBeenCalledTimes(2);
    expect(tx.userCard.upsert).toHaveBeenCalledTimes(2);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'trainer-1' },
      data: { cardsCollected: { increment: 2 } },
    });
    expect(tx.packSession.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'trainer-1', currentIndex: 0 }),
    }));
    const storedSession = tx.packSession.create.mock.calls[0][0].data.cards as PackSession;
    expect(storedSession.awardedUpfront).toBe(true);
  });

  test('resumes from PostgreSQL without granting the same card twice after restart', async () => {
    const session: PackSession = {
      userId: 'trainer-1',
      setName: 'Test Set',
      setId: 'test-set',
      cards: [
        { id: 'card-1', name: 'Pikachu', rarity: 'Common', number: '1', isNew: true },
        { id: 'card-2', name: 'Raichu', rarity: 'Rare', number: '2', isNew: true },
      ],
      currentIndex: 0,
      newCardIds: ['card-1', 'card-2'],
      dupCardIds: [],
      revealedCardIds: [],
      awardedUpfront: true,
    };
    const tx = {
      packSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      card: { upsert: jest.fn() },
      userCard: { upsert: jest.fn() },
      user: { update: jest.fn() },
    };
    const client = {
      redis: { isReady: false },
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

    expect(tx.packSession.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.userCard.upsert).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  test('normalizes image URLs and derives a stable high-resolution fallback', () => {
    expect(resolveCardImage({
      id: 'card-1',
      name: 'Pikachu',
      rarity: 'Common',
      number: '58',
      isNew: true,
      imageLarge: 'http://images.pokemontcg.io/base1/58_hires.png',
    }, 'base1')).toBe('https://images.pokemontcg.io/base1/58_hires.png');
    expect(resolveCardImage({
      id: 'card-2',
      name: 'Raichu',
      rarity: 'Rare',
      number: '14',
      isNew: true,
    }, 'base1')).toBe('https://images.pokemontcg.io/base1/14_hires.png');
  });
});
