import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { CooldownService } from '../../services/CooldownService.js';

const SUPPORTED = ['work', 'rob', 'daily', 'battle', 'catch', 'all'] as const;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('admin-cooldown')
    .setDescription('Admin: view or reset cooldowns')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) => s.setName('view').setDescription('View a user\'s cooldown')
      .addUserOption((o) => o.setName('user').setDescription('User to view').setRequired(true))
      .addStringOption((o) => o.setName('type').setDescription('Cooldown to view').addChoices(...SUPPORTED.map((c) => ({ name: c, value: c }))).setRequired(true))
    )
    .addSubcommand((s) => s.setName('reset').setDescription('Reset a user or all cooldowns')
      .addStringOption((o) => o.setName('type').setDescription('Cooldown to reset').addChoices(...SUPPORTED.map((c) => ({ name: c, value: c }))).setRequired(true))
      .addUserOption((o) => o.setName('user').setDescription('Target user (omit to reset all)'))
    ),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const sub = interaction.options.getSubcommand();
    const type = interaction.options.getString('type', true) as typeof SUPPORTED[number];
    const cooldownService = new CooldownService(client);

    if (sub === 'view') {
      const target = interaction.options.getUser('user', true);
      // Only career-type uses unified key; others map to specific keys
      if (type === 'work' || type === 'rob') {
        const cd = await cooldownService.checkCareerForGuild(target.id, interaction.guild?.id);
        if (cd.onCooldown) await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xffd700).setTitle('Cooldown').setDescription(`<@${target.id}> — ${type}: ${CooldownService.formatDuration(cd.remaining!)} remaining`)] , ephemeral: true });
        else await interaction.reply({ content: `✅ <@${target.id}> — ${type}: Ready`, ephemeral: true });
        return;
      }

      const key = `cooldown:${target.id}:${type}`;
      const raw = await client.redis.get(key).catch(() => null);
      if (!raw) { await interaction.reply({ content: `✅ <@${target.id}> — ${type}: Ready`, ephemeral: true }); return; }
      const expiresAt = parseInt(raw, 10);
      const remaining = Math.ceil((expiresAt - Date.now()) / 1000);
      if (remaining > 0) await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xffd700).setTitle('Cooldown').setDescription(`<@${target.id}> — ${type}: ${CooldownService.formatDuration(remaining)} remaining`)], ephemeral: true });
      else await interaction.reply({ content: `✅ <@${target.id}> — ${type}: Ready`, ephemeral: true });
      return;
    }

    if (sub === 'reset') {
      const target = interaction.options.getUser('user');
      // reset all
      if (type === 'all' && !target) {
        // Warning: Expensive operation — only delete keys with cooldown: prefix
        const keys = await client.redis.keys('cooldown:*');
        if (keys.length === 0) { await interaction.reply({ content: 'No cooldowns found.', ephemeral: true }); return; }
        await client.redis.del(keys);
        await client.prisma.auditLog.create({ data: { guildId: interaction.guild?.id ?? '', action: 'COOLDOWN_RESET_ALL', moderatorId: interaction.user.id } }).catch(() => {});
        await interaction.reply({ content: `✅ Cleared ${keys.length} cooldown keys.`, ephemeral: true });
        return;
      }

      // reset specific user
      if (target) {
        if (type === 'all') {
          const keys = await client.redis.keys(`cooldown:${target.id}:*`);
          if (keys.length > 0) await client.redis.del(keys);
          await client.prisma.auditLog.create({ data: { guildId: interaction.guild?.id ?? '', action: 'COOLDOWN_RESET_USER', targetId: target.id, moderatorId: interaction.user.id } }).catch(() => {});
          await interaction.reply({ content: `✅ Cleared ${keys.length} cooldown keys for <@${target.id}>.`, ephemeral: true });
          return;
        }

        if (type === 'work' || type === 'rob') {
          // Clear DB canonical timestamps and Redis key
          await client.prisma.user.update({ where: { id: target.id }, data: { lastWork: null, lastBeg: null, lastRob: null } }).catch(() => {});
          await client.redis.del(`cooldown:${target.id}:career:work`);
          await client.prisma.auditLog.create({ data: { guildId: interaction.guild?.id ?? '', action: 'COOLDOWN_RESET_USER', targetId: target.id, moderatorId: interaction.user.id, metadata: { type } } }).catch(() => {});
          await interaction.reply({ content: `✅ Cleared career cooldowns for <@${target.id}>.`, ephemeral: true });
          return;
        }

        await client.redis.del(`cooldown:${target.id}:${type}`);
        await client.prisma.auditLog.create({ data: { guildId: interaction.guild?.id ?? '', action: 'COOLDOWN_RESET_USER', targetId: target.id, moderatorId: interaction.user.id, metadata: { type } } }).catch(() => {});
        await interaction.reply({ content: `✅ Cleared ${type} cooldown for <@${target.id}>.`, ephemeral: true });
        return;
      }

      await interaction.reply({ content: 'Specify a user to reset their cooldown, or use type=all to reset all cooldowns.', ephemeral: true });
    }
  },
};

export default command;
