import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ComponentType, Message, ButtonInteraction,
} from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber, formatDuration } from '../../utils/embeds.js';
import { checkCooldown, setCooldown } from '../../utils/cooldown.js';
import { CooldownService } from '../../services/CooldownService.js';
import { addXp } from '../../services/userService.js';
import {
  CAREERS, getCareerChoices, getButtonStyle, resolveOutcome, getEquipmentTier,
  type CareerConfig, type CareerScenario,
} from '../../services/career/scenarios.js';

// ── Slash command definition ───────────────────────────────────────────────────

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription('Start a career shift — pick a job and face interactive scenarios!')
    .addStringOption((o) =>
      o.setName('career')
        .setDescription('Which career to work')
        .setRequired(true)
        .addChoices(...getCareerChoices()),
    ),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const careerName = interaction.options.getString('career', true);
    const career = CAREERS[careerName];
    if (!career) {
      await interaction.reply({ content: '❌ Unknown career.', ephemeral: true });
      return;
    }

    try {
      // ── Cooldown check ──────────────────────────────────────────────
      // Use guild-aware cooldown check so admin changes apply immediately
      const cooldownService = new CooldownService(client);
      const { onCooldown, remaining } = await cooldownService.checkCareerForGuild(interaction.user.id, interaction.guild?.id);
      if (onCooldown) {
        const { safeReply } = await import('../../utils/interactionReply.js');
        await safeReply(interaction, {
          embeds: [new EmbedBuilder()
            .setColor(0xff4444)
            .setTitle('⏰ Career Cooldown')
            .setDescription(
              `You already worked a shift! All careers share a cooldown.\nCome back in **${formatDuration(remaining!)}**.`,
            )],
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply();

      // ── Equipment check ─────────────────────────────────────────────
      const equipTier = await getEquipmentTier(client.prisma, interaction.user.id, career);
      if (equipTier === 0) {
        const embed = new EmbedBuilder()
          .setColor(0xff4444)
          .setTitle(`${career.emoji} No Equipment!`)
          .setDescription(
            `You need a **${career.baseEquipmentName}** to work as a ${career.name}!\n\n` +
            `Purchase one at \`/shop\` → Career Tools, or use \`/career shop ${careerName.toLowerCase()}\`.`,
          )
          .setTimestamp();
        const { safeEditReply } = await import('../../utils/interactionReply.js');
        await safeEditReply(interaction, { embeds: [embed] });
        return;
      }

      // ── Career level ────────────────────────────────────────────────
      const jobRecord = await client.prisma.userJob.findUnique({
        where: { userId_jobName: { userId: interaction.user.id, jobName: careerName } },
      });
      const jobLevel = jobRecord?.level ?? 1;

      // ── Pick random scenario ────────────────────────────────────────
      const scenario = career.scenarios[Math.floor(Math.random() * career.scenarios.length)];

      // ── Build scenario embed ────────────────────────────────────────
      const scenarioEmbed = buildScenarioEmbed(career, scenario, equipTier, jobLevel);
      const buttons = buildChoiceButtons(interaction.user.id, careerName, scenario);

        const { safeEditReply } = await import('../../utils/interactionReply.js');
        const msgAny = await safeEditReply(interaction, {
         embeds: [scenarioEmbed],
         components: buttons.map((r) => r.toJSON()),
       }) as any;
        if (!msgAny || typeof msgAny.createMessageComponentCollector !== 'function') {
          await safeEditReply(interaction, { content: '❌ Could not start interactive scenario. Please try again.' });
          return;
        }
        const msg = msgAny as Message;

      // ── Button collector ────────────────────────────────────────────
      const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30_000,
        filter: (btn: ButtonInteraction) => btn.user.id === interaction.user.id,
      });

      collector.on('collect', (btn: ButtonInteraction) => {
        void (async () => {
          // Parse custom ID: work:{userId}:{careerName}:{scenarioId}:{choiceIndex}
          const parts = btn.customId.split(':');
          const choiceIndex = parseInt(parts[4], 10);
          const choice = scenario.choices[choiceIndex];
          if (!choice) {
            await btn.reply({ content: '❌ Invalid choice.', ephemeral: true });
            return;
          }

          // ── Resolve outcome ──────────────────────────────────────────
          const outcome = resolveOutcome(choice, equipTier, jobLevel);
          const finalReward = Math.max(0, outcome.reward);
          const penalty = outcome.reward < 0 ? Math.abs(outcome.reward) : 0;

          // ── Apply rewards ────────────────────────────────────────────
          if (finalReward > 0) {
            await client.prisma.user.update({
              where: { id: interaction.user.id },
              data: { balance: { increment: finalReward }, totalEarned: { increment: finalReward } },
            });
          }
          if (penalty > 0) {
            const freshUser = await client.prisma.user.findUnique({ where: { id: interaction.user.id } });
            if (freshUser && freshUser.balance >= penalty) {
              await client.prisma.user.update({
                where: { id: interaction.user.id },
                data: { balance: { decrement: penalty }, totalSpent: { increment: penalty } },
              });
            }
          }

          // ── Update job record ────────────────────────────────────────
          const newRecord = await client.prisma.userJob.upsert({
            where: { userId_jobName: { userId: interaction.user.id, jobName: careerName } },
            update: {
              lastWorked: new Date(),
              totalEarned: { increment: finalReward },
              timesWorked: { increment: 1 },
            },
            create: {
              userId: interaction.user.id,
              jobName: careerName,
              lastWorked: new Date(),
              totalEarned: finalReward,
              timesWorked: 1,
            },
          });

          let leveledUp = false;
          if (newRecord.timesWorked % 10 === 0) {
            await client.prisma.userJob.update({
              where: { userId_jobName: { userId: interaction.user.id, jobName: careerName } },
              data: { level: { increment: 1 } },
            });
            leveledUp = true;
          }

          // ── Set cooldown ─────────────────────────────────────────────
          // Persist canonical last-work timestamp and set Redis cooldown using configured value
          const guild = await client.prisma.guild.findUnique({ where: { id: interaction.guild?.id ?? '' } });
          const configured = guild?.workCooldown ?? 3600;
          await client.prisma.user.update({ where: { id: interaction.user.id }, data: { lastWork: new Date() } }).catch(() => {});
          await cooldownService.setCareer(interaction.user.id, configured);

          // ── XP ───────────────────────────────────────────────────────
          const { leveledUp: trainerLeveledUp, newLevel } = await addXp(
            client.prisma, interaction.user.id, outcome.xp,
          );

          // ── Item drop ────────────────────────────────────────────────
          let dropMessage: string | null = null;
          if (outcome.itemDrop) {
            await client.prisma.userInventory.upsert({
              where: {
                userId_itemId: {
                  userId: interaction.user.id,
                  itemId: outcome.itemDrop.itemId,
                },
              },
              update: { quantity: { increment: 1 } },
              create: {
                userId: interaction.user.id,
                itemId: outcome.itemDrop.itemId,
                itemName: outcome.itemDrop.itemName,
                quantity: 1,
              },
            });
            dropMessage = `🎒 **Item Drop!** ${outcome.itemDrop.itemName}`;
          }

          // ── Build result embed ───────────────────────────────────────
          const resultEmbed = buildResultEmbed(
            career, scenario, choice, outcome,
            finalReward, penalty, equipTier, jobLevel,
            leveledUp, trainerLeveledUp, newLevel, dropMessage,
          );

          // Disable all buttons
          const disabledButtons = buttons.map((row) => {
            const disabledRow = ActionRowBuilder.from(row);
            disabledRow.components.forEach((comp) => {
              if (comp instanceof ButtonBuilder) comp.setDisabled(true);
            });
            return disabledRow.toJSON();
          });

          collector.stop();
          await btn.update({ embeds: [resultEmbed], components: disabledButtons });
        })();
      });

      collector.on('end', (_collected: any, reason: string) => {
        if (reason === 'time') {
          const disabledButtons = buttons.map((row) => {
            const disabledRow = ActionRowBuilder.from(row);
            disabledRow.components.forEach((comp) => {
              if (comp instanceof ButtonBuilder) comp.setDisabled(true);
            });
            return disabledRow.toJSON();
          });
          interaction.editReply({ components: disabledButtons }).catch(() => {});
        }
      });
    } catch (err) {
      console.error(`[work ${careerName}]`, err);
      if (interaction.deferred) {
        await interaction.editReply({ content: '❌ An error occurred. Please try again.' }).catch(() => {});
      } else if (!interaction.replied) {
        await interaction.reply({ content: '❌ An error occurred. Please try again.', ephemeral: true }).catch(() => {});
      }
    }
  },
};

// ── Embed builders ────────────────────────────────────────────────────────────

function buildScenarioEmbed(
  career: CareerConfig,
  scenario: CareerScenario,
  equipTier: number,
  careerLevel: number,
): EmbedBuilder {
  const equipName = getEquipDisplayName(career, equipTier);

  return new EmbedBuilder()
    .setColor(career.color)
    .setTitle(`${career.emoji} ${scenario.title}`)
    .setDescription(scenario.description)
    .addFields(
      {
        name: '📊 Your Status',
        value: [
          `**Equipment:** ${equipName} (Tier ${equipTier})`,
          `**Career Level:** ${careerLevel}`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '⚠️ Choose Your Path',
        value: 'Pick a button below. Each choice has a different risk and reward.',
        inline: true,
      },
    )
    .setFooter({ text: `${career.name} Career • Choose wisely — 30s to decide` })
    .setTimestamp();
}

function buildChoiceButtons(
  userId: string,
  careerName: string,
  scenario: CareerScenario,
): ActionRowBuilder<ButtonBuilder>[] {
  const row = new ActionRowBuilder<ButtonBuilder>();

  for (let i = 0; i < scenario.choices.length; i++) {
    const choice = scenario.choices[i];
    const style = getButtonStyle(choice.riskLevel);

    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`work:${userId}:${careerName}:${scenario.id}:${i}`)
        .setLabel(`${choice.emoji} ${choice.label}`)
        .setStyle(style),
    );
  }

  return [row];
}

function buildResultEmbed(
  career: CareerConfig,
  scenario: CareerScenario,
  choice: { label: string; emoji: string; riskLevel: string },
  outcome: { success: boolean; reward: number; xp: number; message: string },
  finalReward: number,
  penalty: number,
  equipTier: number,
  careerLevel: number,
  jobLeveledUp: boolean,
  trainerLeveledUp: boolean,
  newTrainerLevel: number,
  dropMessage: string | null,
): EmbedBuilder {
  const statusTitle = outcome.success ? 'Success!' : 'Failed!';
  const equipName = getEquipDisplayName(career, equipTier);

  const embed = new EmbedBuilder()
    .setColor(outcome.success ? 0x00cc44 : 0xff4444)
    .setTitle(`${career.emoji} ${scenario.title} — ${statusTitle}`)
    .setDescription(`**${choice.emoji} ${choice.label}**\n\n${outcome.message}`);

  const rewardLines: string[] = [];
  if (finalReward > 0) {
    rewardLines.push(`💰 **+${formatNumber(finalReward)} PokéCoins**`);
  }
  if (penalty > 0) {
    rewardLines.push(`💸 **-${formatNumber(penalty)} PokéCoins** (penalty)`);
  }
  if (finalReward === 0 && penalty === 0) {
    rewardLines.push('💰 No coins gained or lost');
  }

  embed.addFields(
    { name: '💰 Reward', value: rewardLines.join('\n'), inline: true },
    { name: '⭐ XP Gained', value: `+${outcome.xp} XP`, inline: true },
    { name: '🎒 Equipment', value: equipName, inline: true },
  );

  if (jobLeveledUp) {
    embed.addFields({
      name: '📈 Career Level Up!',
      value: `You reached **${career.name} Level ${careerLevel + 1}**! 🎉`,
      inline: false,
    });
  }
  if (trainerLeveledUp) {
    embed.addFields({
      name: '🎉 Trainer Level Up!',
      value: `You reached **Trainer Level ${newTrainerLevel}**!`,
      inline: false,
    });
  }
  if (dropMessage) {
    embed.addFields({ name: 'Item Drop!', value: dropMessage, inline: false });
  }

  embed
    .setFooter({ text: '⏰ Next shift in 1 hour • /career view to check progress' })
    .setTimestamp();

  return embed;
}

function getEquipDisplayName(career: CareerConfig, tier: number): string {
  if (tier === 0) return 'None';
  if (tier === 1) return career.baseEquipmentName;
  const tierItem = career.tierItems[tier - 2];
  return tierItem
    ? tierItem.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : career.baseEquipmentName;
}

export default command;