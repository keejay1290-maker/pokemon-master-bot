import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { CooldownService } from '../../services/CooldownService.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('rob')
    .setDescription('Attempt to rob another trainer')
    .addUserOption((opt) => opt.setName('target').setDescription('Who to rob').setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const target = interaction.options.getUser('target', true);
    if (target.id === interaction.user.id) {
      await interaction.reply({ content: "You can't rob yourself!", ephemeral: true });
      return;
    }
    if (target.bot) {
      await interaction.reply({ content: "You can't rob a bot!", ephemeral: true });
      return;
    }

    const guild = await client.prisma.guild.findUnique({ where: { id: interaction.guild?.id ?? '' } });
    if (guild && !guild.robEnabled) {
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setTitle('❌ Disabled').setDescription('Robbery is disabled in this server.')], ephemeral: true });
      return;
    }

    const cooldownService = new CooldownService(client);
    const { onCooldown, remaining } = await cooldownService.checkCareerForGuild(interaction.user.id, interaction.guild?.id);
    if (onCooldown) {
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setTitle('⏰ Career Cooldown').setDescription(`All careers are on cooldown. Come back in **${CooldownService.formatDuration(remaining!)}**.`)], ephemeral: true });
      return;
    }

    const robber = await client.prisma.user.findUnique({ where: { id: interaction.user.id } });
    const victim = await client.prisma.user.findUnique({ where: { id: target.id } });

    if (!robber || !victim) {
      await interaction.reply({ content: 'User not found!', ephemeral: true });
      return;
    }

    if (victim.balance < 100) {
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setTitle('💸 Broke!').setDescription(`${target.username} doesn't have enough coins to rob!`)], ephemeral: true });
      return;
    }

    // Protection period check
    if (victim.lastRobbed) {
      const protectionMs = (guild?.robProtectionHours ?? 24) * 3600000;
      if (Date.now() - victim.lastRobbed.getTime() < protectionMs) {
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff8c00).setTitle('🛡️ Protected').setDescription(`${target.username} is protected from robbery.`)], ephemeral: true });
        return;
      }
    }

    // Use configured rob cooldown (falls back to guild.workCooldown or 24h default) and persist canonical lastRob
    const robCooldown = guild?.robCooldown ?? guild?.workCooldown ?? 86400;
    await client.prisma.user.update({ where: { id: interaction.user.id }, data: { lastRob: new Date() } }).catch(() => {});
    await cooldownService.setCareer(interaction.user.id, robCooldown);

    const successRate = guild?.robSuccessRate ?? 0.4;
    const success = Math.random() < successRate;
    const maxLoss = guild?.robMaxLoss ?? 1000;

    let resultEmbed: EmbedBuilder;

    try {
      await client.prisma.$transaction(async (tx) => {
        const currentRobber = await tx.user.findUnique({ where: { id: interaction.user.id } });
        const currentVictim = await tx.user.findUnique({ where: { id: target.id } });

        if (!currentRobber || !currentVictim) throw new Error('USER_NOT_FOUND');
        if (currentVictim.balance < 100) throw new Error('VICTIM_BROKE');

        if (success) {
          const stolen = Math.min(Math.floor(currentVictim.balance * (Math.random() * 0.3 + 0.1)), maxLoss);
          if (stolen > 0) {
            await tx.user.update({ where: { id: interaction.user.id }, data: { balance: { increment: stolen }, totalEarned: { increment: stolen } } });
            await tx.user.update({ where: { id: target.id }, data: { balance: { decrement: stolen }, lastRobbed: new Date() } });
          }
          resultEmbed = new EmbedBuilder().setColor(0x00ff00).setTitle('🦹 Robbery Successful!')
            .setDescription(`You sneaked into ${target.username}'s bag and stole **${stolen.toLocaleString()} PokéCoins**!`).setTimestamp();
        } else {
          const fine = Math.min(Math.floor(currentRobber.balance * 0.15), 500);
          if (fine > 0) {
            await tx.user.update({ where: { id: interaction.user.id }, data: { balance: { decrement: fine }, totalSpent: { increment: fine } } });
            await tx.user.update({ where: { id: target.id }, data: { balance: { increment: fine } } });
          }
          resultEmbed = new EmbedBuilder().setColor(0xff4444).setTitle('🚨 Caught!')
            .setDescription(`You were caught trying to rob ${target.username}! You paid a **${fine.toLocaleString()} PokéCoins** fine.`).setTimestamp();
        }
      });
      await interaction.reply({ embeds: [resultEmbed!] });
    } catch (e: any) {
      if (e.message === 'VICTIM_BROKE') {
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setTitle('💸 Broke!').setDescription(`${target.username} doesn't have enough coins to rob!`)], ephemeral: true });
      } else {
        console.error(e);
        await interaction.reply({ content: 'An error occurred during the robbery.', ephemeral: true });
      }
    }
  },
};

export default command;
