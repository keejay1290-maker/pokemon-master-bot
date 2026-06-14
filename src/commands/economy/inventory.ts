import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';

const ITEM_EMOJIS: Record<string, string> = {
  poke_ball: '🎾', great_ball: '🔵', ultra_ball: '⚫', master_ball: '🟣',
  repel: '🧴', lure: '🎣',
  exp_candy_s: '🍬', exp_candy_m: '🍭', exp_candy_xl: '🍫',
  shiny_charm: '✨', coin_case: '💰', amulet_coin: '🪙',
  old_rod: '🎣', good_rod: '🎣', super_rod: '🎣',
  research_kit: '🔬', field_scanner: '📡', incubator: '🥚',
  pickaxe: '⛏️', drill: '🔩',
};

const ITEM_EFFECTS: Record<string, string> = {
  shiny_charm: '3× shiny catch rate',
  amulet_coin: 'Double /work coins',
  coin_case: '+10% daily reward',
  old_rod: '+Fisher reward tier 1',
  good_rod: '+Fisher reward tier 2',
  super_rod: '+Fisher reward tier 3',
  research_kit: '+Researcher XP & rewards',
  field_scanner: '+Ranger rare encounters',
  incubator: '+Breeder egg rewards',
  pickaxe: 'Enables /miner',
  drill: '+Miner fossil rewards',
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('View your item inventory')
    .addUserOption((o) => o.setName('user').setDescription("View another trainer's inventory")),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    await interaction.deferReply();
    const target = interaction.options.getUser('user') ?? interaction.user;

    const items = await client.prisma.userInventory.findMany({
      where: { userId: target.id },
      orderBy: { itemName: 'asc' },
    });

    const embed = new EmbedBuilder()
      .setColor(0xf5c518)
      .setTitle(`🎒 ${target.username}'s Inventory`)
      .setThumbnail(target.displayAvatarURL());

    if (items.length === 0) {
      embed.setDescription('No items yet! Use `/shop` to browse and `/buy` to purchase items.');
    } else {
      const lines = items.map((inv) => {
        const emoji = ITEM_EMOJIS[inv.itemId] ?? '📦';
        const effect = ITEM_EFFECTS[inv.itemId];
        const effectStr = effect ? ` — *${effect}*` : '';
        return `${emoji} **${inv.itemName}** ×${inv.quantity}${effectStr}`;
      });
      embed.setDescription(lines.join('\n'));
      embed.setFooter({ text: `${items.length} item type${items.length !== 1 ? 's' : ''} • Use /shop to buy more` });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
