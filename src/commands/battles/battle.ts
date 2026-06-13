import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
} from 'discord.js';
import type { BotClient, Command, BattleState } from '../../types/index.js';
import { loadBattleTeam, calcDamage, applyStatusDamage, checkFainted, saveBattleResult } from '../../services/battleService.js';
import { progressBar } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('battle')
    .setDescription('Challenge another trainer to a Pokemon battle')
    .addUserOption((o) => o.setName('opponent').setDescription('Trainer to challenge').setRequired(true))
    .addStringOption((o) => o.setName('type').setDescription('Battle type').addChoices(
      { name: 'Unranked', value: 'unranked' },
      { name: 'Ranked', value: 'ranked' },
    )),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    if (!interaction.guild) return;
    const opponent = interaction.options.getUser('opponent', true);
    const type = (interaction.options.getString('type') ?? 'unranked') as 'ranked' | 'unranked';

    if (opponent.id === interaction.user.id) {
      await interaction.reply({ content: "You can't battle yourself!", ephemeral: true });
      return;
    }
    if (opponent.bot) {
      await interaction.reply({ content: "You can't battle a bot!", ephemeral: true });
      return;
    }

    // Check if either user is already in a battle
    const existingBattle = [...client.activeBattles.values()].find(
      (b) => b.challengerId === interaction.user.id || b.opponentId === interaction.user.id ||
             b.challengerId === opponent.id || b.opponentId === opponent.id
    );
    if (existingBattle) {
      await interaction.reply({ content: 'One of you is already in a battle!', ephemeral: true });
      return;
    }

    const challengerTeam = await loadBattleTeam(client.prisma, interaction.user.id);
    if (challengerTeam.length === 0) {
      await interaction.reply({ content: "You don't have any Pokemon! Use `/catch` first.", ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('⚔️ Battle Challenge!')
      .setDescription(`<@${interaction.user.id}> challenges <@${opponent.id}> to a **${type}** Pokemon battle!\n\nDo you accept?`)
      .addFields(
        { name: 'Challenger', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Opponent', value: `<@${opponent.id}>`, inline: true },
        { name: 'Type', value: type.charAt(0).toUpperCase() + type.slice(1), inline: true },
      )
      .setFooter({ text: 'Expires in 60 seconds' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('accept').setLabel('Accept').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('decline').setLabel('Decline').setStyle(ButtonStyle.Danger),
    );

    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

    collector.on('collect', async (btn) => {
      if (btn.user.id !== opponent.id) {
        await btn.reply({ content: "This isn't your battle invite!", ephemeral: true });
        return;
      }
      collector.stop();

      if (btn.customId === 'decline') {
        await btn.update({ embeds: [new EmbedBuilder().setColor(0x808080).setTitle('❌ Battle Declined')], components: [] });
        return;
      }

      // Start the battle
      const opponentTeam = await loadBattleTeam(client.prisma, opponent.id);
      if (opponentTeam.length === 0) {
        await btn.update({ content: `<@${opponent.id}> has no Pokemon!`, embeds: [], components: [] });
        return;
      }

      const battleRecord = await client.prisma.battle.create({
        data: {
          challengerId: interaction.user.id,
          opponentId: opponent.id,
          guildId: interaction.guild!.id,
          type,
          status: 'active',
          startedAt: new Date(),
        },
      });

      const state: BattleState = {
        id: battleRecord.id,
        challengerId: interaction.user.id,
        opponentId: opponent.id,
        guildId: interaction.guild!.id,
        type,
        status: 'active',
        turn: 1,
        currentTurnUserId: Math.random() < 0.5 ? interaction.user.id : opponent.id,
        challengerTeam,
        opponentTeam,
        challengerActivePokemonIndex: 0,
        opponentActivePokemonIndex: 0,
        weather: 'clear',
        weatherTurns: 0,
        battleLog: [],
        channelId: interaction.channelId,
        messageId: msg.id,
      };

      client.activeBattles.set(state.id, state);

      const battleEmbed = buildBattleEmbed(state, interaction.user.username, opponent.username);
      const battleRow = buildBattleRow(state);

      await btn.update({ embeds: [battleEmbed], components: [battleRow] });

      // Battle timeout
      state.timeout = setTimeout(async () => {
        const s = client.activeBattles.get(state.id);
        if (!s || s.status === 'finished') return;
        client.activeBattles.delete(state.id);
        await msg.edit({ embeds: [new EmbedBuilder().setColor(0x808080).setTitle('⏰ Battle Timed Out')], components: [] }).catch(() => {});
      }, 300000);

      // Move collector
      const moveCollector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300000 });
      moveCollector.on('collect', async (moveBtn) => {
        const currentState = client.activeBattles.get(state.id);
        if (!currentState || currentState.status === 'finished') { moveCollector.stop(); return; }

        if (moveBtn.user.id !== currentState.currentTurnUserId) {
          await moveBtn.reply({ content: "It's not your turn!", ephemeral: true });
          return;
        }

        const isChallenger = moveBtn.user.id === currentState.challengerId;
        const attackerTeam = isChallenger ? currentState.challengerTeam : currentState.opponentTeam;
        const defenderTeam = isChallenger ? currentState.opponentTeam : currentState.challengerTeam;
        const attackerIdx = isChallenger ? currentState.challengerActivePokemonIndex : currentState.opponentActivePokemonIndex;
        const defenderIdx = isChallenger ? currentState.opponentActivePokemonIndex : currentState.challengerActivePokemonIndex;

        const attacker = attackerTeam[attackerIdx];
        const defender = defenderTeam[defenderIdx];

        if (!attacker || !defender) return;

        const moveIndex = parseInt(moveBtn.customId.replace('move_', ''));
        const moveName = attacker.moves[moveIndex] ?? 'tackle';

        // Simple damage calculation
        const basePower = 40 + Math.floor(Math.random() * 60);
        const damage = Math.max(1, Math.floor(attacker.attack * basePower / (50 * (defender.defense || 1))));
        defender.currentHp = Math.max(0, defender.currentHp - damage);

        currentState.battleLog.push(`${attacker.name} used ${moveName}! Dealt ${damage} damage.`);
        currentState.turn++;
        currentState.currentTurnUserId = isChallenger ? currentState.opponentId : currentState.challengerId;

        const challengerName = isChallenger ? moveBtn.user.username : opponent.username;
        const opponentName = isChallenger ? opponent.username : moveBtn.user.username;

        // Check faint
        if (checkFainted(defender)) {
          defenderTeam[defenderIdx].currentHp = 0;
          const allFainted = defenderTeam.every((p) => p.currentHp <= 0);
          if (allFainted) {
            currentState.status = 'finished';
            if (currentState.timeout) clearTimeout(currentState.timeout);
            moveCollector.stop();
            const winnerId = moveBtn.user.id;
            await saveBattleResult(client, currentState, winnerId);
            const winnerName = winnerId === currentState.challengerId ? challengerName : opponentName;
            await moveBtn.update({
              embeds: [new EmbedBuilder().setColor(0xffd700).setTitle('🏆 Battle Ended!')
                .setDescription(`**${winnerName}** wins!\n\n${currentState.battleLog.slice(-5).join('\n')}`)],
              components: [],
            });
            return;
          }
          // Find next alive Pokemon
          if (isChallenger) {
            const nextIdx = defenderTeam.findIndex((p, i) => i > defenderIdx && p.currentHp > 0);
            if (nextIdx !== -1) currentState.opponentActivePokemonIndex = nextIdx;
          } else {
            const nextIdx = defenderTeam.findIndex((p, i) => i > defenderIdx && p.currentHp > 0);
            if (nextIdx !== -1) currentState.challengerActivePokemonIndex = nextIdx;
          }
        }

        const updatedEmbed = buildBattleEmbed(currentState, challengerName, opponentName);
        const updatedRow = buildBattleRow(currentState);
        await moveBtn.update({ embeds: [updatedEmbed], components: [updatedRow] });
      });
    });

    collector.on('end', (_, reason) => {
      if (reason === 'time') {
        interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x808080).setTitle('⏰ Challenge Expired')], components: [] }).catch(() => {});
      }
    });
  },
};

function buildBattleEmbed(state: BattleState, challengerName: string, opponentName: string): EmbedBuilder {
  const ch = state.challengerTeam[state.challengerActivePokemonIndex];
  const op = state.opponentTeam[state.opponentActivePokemonIndex];
  const turnName = state.currentTurnUserId === state.challengerId ? challengerName : opponentName;

  return new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('⚔️ Pokemon Battle!')
    .setDescription(`**Turn ${state.turn}** — ${turnName}'s move\n\n${state.battleLog.slice(-3).join('\n') || 'Battle started!'}`)
    .addFields(
      {
        name: `${challengerName}'s ${ch?.name ?? '???'}`,
        value: `HP: \`${progressBar(ch?.currentHp ?? 0, ch?.maxHp ?? 1)}\` ${ch?.currentHp ?? 0}/${ch?.maxHp ?? 0}`,
        inline: true,
      },
      {
        name: `${opponentName}'s ${op?.name ?? '???'}`,
        value: `HP: \`${progressBar(op?.currentHp ?? 0, op?.maxHp ?? 1)}\` ${op?.currentHp ?? 0}/${op?.maxHp ?? 0}`,
        inline: true,
      }
    )
    .setFooter({ text: `${state.type} battle` });
}

function buildBattleRow(state: BattleState): ActionRowBuilder<ButtonBuilder> {
  const currentTeam = state.currentTurnUserId === state.challengerId
    ? state.challengerTeam : state.opponentTeam;
  const activeIdx = state.currentTurnUserId === state.challengerId
    ? state.challengerActivePokemonIndex : state.opponentActivePokemonIndex;
  const moves = currentTeam[activeIdx]?.moves ?? ['tackle', 'growl', 'scratch', 'ember'];

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    moves.slice(0, 4).map((move, i) =>
      new ButtonBuilder()
        .setCustomId(`move_${i}`)
        .setLabel(move.charAt(0).toUpperCase() + move.slice(1))
        .setStyle(ButtonStyle.Primary)
    )
  );
}

export default command;
