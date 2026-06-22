import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure Pokemon Master settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) =>
      s.setName('economy').setDescription('Configure economy settings')
        .addIntegerOption((o) => o.setName('daily_reward').setDescription('Daily reward amount').setMinValue(1))
        .addIntegerOption((o) => o.setName('weekly_reward').setDescription('Weekly reward amount').setMinValue(1))
        .addIntegerOption((o) => o.setName('work_cooldown').setDescription('Work cooldown in seconds').setMinValue(60))
        .addIntegerOption((o) => o.setName('daily_cooldown').setDescription('Daily cooldown in seconds').setMinValue(60))
        .addIntegerOption((o) => o.setName('catch_cooldown').setDescription('Catch cooldown in seconds').setMinValue(1))
        .addIntegerOption((o) => o.setName('battle_cooldown').setDescription('Battle cooldown in seconds').setMinValue(1))
        .addIntegerOption((o) => o.setName('pack_cooldown').setDescription('Pack open cooldown in seconds').setMinValue(1))
    )
    .addSubcommand((s) =>
      s.setName('spawns').setDescription('Configure spawn settings')
        .addBooleanOption((o) => o.setName('enabled').setDescription('Enable spawns'))
        .addIntegerOption((o) => o.setName('cooldown').setDescription('Spawn cooldown in seconds').setMinValue(10))
        .addIntegerOption((o) => o.setName('rate').setDescription('Chance per message (1-100%)').setMinValue(1).setMaxValue(100))
        .addNumberOption((o) => o.setName('shiny_rate').setDescription('Shiny rate (0.001 = 0.1%)').setMinValue(0.0001).setMaxValue(0.1))
        .addNumberOption((o) => o.setName('legendary_rate').setDescription('Legendary rate (0-0.1)').setMinValue(0).setMaxValue(0.1))
        .addNumberOption((o) => o.setName('mythical_rate').setDescription('Mythical rate (0-0.1)').setMinValue(0).setMaxValue(0.1))
    )
    .addSubcommand((s) =>
      s.setName('moderation').setDescription('Configure moderation settings')
        .addBooleanOption((o) => o.setName('anti_spam').setDescription('Enable anti-spam'))
        .addBooleanOption((o) => o.setName('scam_detection').setDescription('Enable scam detection'))
        .addBooleanOption((o) => o.setName('anti_raid').setDescription('Enable anti-raid'))
    )
    .addSubcommand((s) =>
      s.setName('rob').setDescription('Configure rob settings')
        .addBooleanOption((o) => o.setName('enabled').setDescription('Enable robbery'))
        .addNumberOption((o) => o.setName('success_rate').setDescription('Success rate (0-1)').setMinValue(0).setMaxValue(1))
        .addIntegerOption((o) => o.setName('cooldown').setDescription('Cooldown in seconds').setMinValue(3600))
    )
    .addSubcommand((s) => s.setName('view').setDescription('View current configuration')),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    if (!interaction.guild) return;
    const sub = interaction.options.getSubcommand();

    if (sub === 'economy') {
      const data: Record<string, unknown> = {};
      const daily = interaction.options.getInteger('daily_reward');
      const weekly = interaction.options.getInteger('weekly_reward');
      const work = interaction.options.getInteger('work_cooldown');
      const dailyCd = interaction.options.getInteger('daily_cooldown');
      const catchCd = interaction.options.getInteger('catch_cooldown');
      const battleCd = interaction.options.getInteger('battle_cooldown');
      const packCd = interaction.options.getInteger('pack_cooldown');

      if (daily !== null) data.dailyReward = daily;
      if (weekly !== null) data.weeklyReward = weekly;
      if (work !== null) data.workCooldown = work;
      if (dailyCd !== null) data.dailyCooldown = dailyCd;
      if (catchCd !== null) data.catchCooldown = catchCd;
      if (battleCd !== null) data.battleCooldown = battleCd;
      if (packCd !== null) data.packCooldown = packCd;

      await client.prisma.guild.update({ where: { id: interaction.guild.id }, data });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00ff00).setTitle('✅ Economy Updated').setDescription(JSON.stringify(data, null, 2))], ephemeral: true });

    } else if (sub === 'spawns') {
      const data: Record<string, unknown> = {};
      const enabled = interaction.options.getBoolean('enabled');
      const cooldown = interaction.options.getInteger('cooldown');
      const rate = interaction.options.getInteger('rate');
      const shinyRate = interaction.options.getNumber('shiny_rate');
      const legendaryRate = interaction.options.getNumber('legendary_rate');
      const mythicalRate = interaction.options.getNumber('mythical_rate');
      if (enabled !== null) data.spawnEnabled = enabled;
      if (cooldown !== null) data.spawnCooldown = cooldown;
      if (rate !== null) data.spawnRate = rate;
      if (shinyRate !== null) data.shinyRate = shinyRate;
      if (legendaryRate !== null) data.legendaryRate = legendaryRate;
      if (mythicalRate !== null) data.mythicalRate = mythicalRate;

      await client.prisma.guild.update({ where: { id: interaction.guild.id }, data });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00ff00).setTitle('✅ Spawn Config Updated').setDescription(JSON.stringify(data, null, 2))], ephemeral: true });

    } else if (sub === 'moderation') {
      const data: Record<string, unknown> = {};
      const antiSpam = interaction.options.getBoolean('anti_spam');
      const scam = interaction.options.getBoolean('scam_detection');
      const raid = interaction.options.getBoolean('anti_raid');
      if (antiSpam !== null) data.antiSpamEnabled = antiSpam;
      if (scam !== null) data.scamDetectionEnabled = scam;
      if (raid !== null) data.antiRaidEnabled = raid;

      await client.prisma.guild.update({ where: { id: interaction.guild.id }, data });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00ff00).setTitle('✅ Moderation Config Updated').setDescription(JSON.stringify(data, null, 2))], ephemeral: true });

    } else if (sub === 'rob') {
      const data: Record<string, unknown> = {};
      const enabled = interaction.options.getBoolean('enabled');
      const rate = interaction.options.getNumber('success_rate');
      const cd = interaction.options.getInteger('cooldown');
      if (enabled !== null) data.robEnabled = enabled;
      if (rate !== null) data.robSuccessRate = rate;
      if (cd !== null) data.robCooldown = cd;

      await client.prisma.guild.update({ where: { id: interaction.guild.id }, data });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00ff00).setTitle('✅ Rob Config Updated').setDescription(JSON.stringify(data, null, 2))], ephemeral: true });

    } else if (sub === 'view') {
      const guild = await client.prisma.guild.findUnique({ where: { id: interaction.guild.id } });
      if (!guild) { await interaction.reply({ content: 'Config not found.', ephemeral: true }); return; }

      const embed = new EmbedBuilder()
        .setColor(0x3498db).setTitle('⚙️ Server Configuration')
        .addFields(
          { name: '💰 Economy', value: `Daily: ${formatNumber(guild.dailyReward)}\nWeekly: ${formatNumber(guild.weeklyReward)}\nWork CD: ${guild.workCooldown}s`, inline: true },
          { name: '🐾 Spawns', value: `Enabled: ${guild.spawnEnabled}\nRate: ${guild.spawnRate}% per message\nCooldown: ${guild.spawnCooldown}s\nChannels: ${guild.spawnChannelIds.length || (guild.pokeSpawnsChannelId ? 1 : 0)}\nMode: ${guild.spawnMode}\nShiny: ${(guild.shinyRate * 100).toFixed(2)}%`, inline: true },
          { name: '🔨 Moderation', value: `Anti-Spam: ${guild.antiSpamEnabled}\nScam: ${guild.scamDetectionEnabled}\nRaid: ${guild.antiRaidEnabled}`, inline: true },
          { name: '🦹 Rob', value: `Enabled: ${guild.robEnabled}\nSuccess: ${(guild.robSuccessRate * 100).toFixed(0)}%\nCooldown: ${guild.robCooldown}s`, inline: true },
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
export default command;
