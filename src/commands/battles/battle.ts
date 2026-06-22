import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
  StringSelectMenuBuilder, Message,
} from 'discord.js';
import type { BotClient, Command, BattleState } from '../../types/index.js';
import {
  loadBattleTeam,
  calcDamage,
  getMoveData,
  applyStatusDamage,
  checkFainted,
  saveBattleResult,
  checkAccuracy,
  checkStatusBlock,
  applyMoveEffect,
  statusLabel,
  getEffectiveSpeed,
  type BattleRewards,
  persistBattleState,
} from '../../services/battleService.js';
import { progressBar } from '../../utils/embeds.js';
import {
  activateBattleWithTeams,
  confirmRankedBattleRisk,
  createBattleWithParticipantLocks,
  releaseBattleParticipantLocks,
  RANKED_TEAM_MAX,
} from '../../services/rankedBattleService.js';

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

    const { REDIS_KEYS, REDIS_TTLS, deserializeBattle } = await import('../../utils/redisKeys.js');
    
    const myLockKey = REDIS_KEYS.battleLock(interaction.user.id);
    const opponentLockKey = REDIS_KEYS.battleLock(opponent.id);
    let battleRecord;
    try {
      battleRecord = await createBattleWithParticipantLocks(client.prisma, {
        challengerId: interaction.user.id,
        opponentId: opponent.id,
        guildId: interaction.guild.id,
        type,
      });
    } catch (error) {
      const message = error instanceof Error && error.message === 'BATTLE_PARTICIPANT_BUSY'
        ? 'One of these trainers already has a battle or challenge in progress.'
        : 'Could not reserve this battle. Please try again.';
      await interaction.reply({ content: `❌ ${message}`, ephemeral: true });
      return;
    }
    await Promise.all([
      client.redis.set(myLockKey, battleRecord.id, { EX: REDIS_TTLS.BATTLE }).catch(() => {}),
      client.redis.set(opponentLockKey, battleRecord.id, { EX: REDIS_TTLS.BATTLE }).catch(() => {}),
    ]);

    const challengerCandidates = await getEligibleBattlePokemon(
      client,
      interaction.user.id,
      type,
    );
    if (challengerCandidates.length === 0) {
      await cancelBattleSetup(client, battleRecord.id, [myLockKey, opponentLockKey]);
      await interaction.reply({ content: '❌ You have no eligible caught Pokémon for this battle.', ephemeral: true });
      return;
    }

    const msg = await interaction.reply({
      embeds: [buildTeamSelectionEmbed(
        interaction.user.username,
        type,
        'Challenger team selection',
      )],
      components: buildTeamSelectionComponents(
        challengerCandidates,
        type,
        `battle_team_challenger:${battleRecord.id}`,
        0,
      ),
      fetchReply: true,
    });
    const challengerSelection = await collectTeamSelection(
      msg,
      challengerCandidates,
      interaction.user.id,
      type,
      `battle_team_challenger:${battleRecord.id}`,
      buildTeamSelectionEmbed(interaction.user.username, type, 'Challenger team selection'),
    );
    if (!challengerSelection) {
      await cancelBattleSetup(client, battleRecord.id, [myLockKey, opponentLockKey]);
      await interaction.editReply({
        content: '⌛ Team selection expired. No battle was started.',
        embeds: [],
        components: [],
      }).catch(() => {});
      return;
    }

    const challengerTeam = await loadBattleTeam(
      client.prisma,
      interaction.user.id,
      challengerSelection,
    );
    if (challengerTeam.length !== challengerSelection.length) {
      await cancelBattleSetup(client, battleRecord.id, [myLockKey, opponentLockKey]);
      await interaction.editReply({ content: '❌ Your selected team changed. Start again.', embeds: [], components: [] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('⚔️ Battle Challenge!')
      .setDescription(
        `<@${interaction.user.id}> selected **${challengerTeam.length} caught Pokémon** and challenges <@${opponent.id}> to a **${type}** battle!\n\nDo you accept?`
      )
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

    await interaction.editReply({ embeds: [embed], components: [row] });
    let challengeResolved = false;

    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    collector.on('collect', async (btn) => {
      if (btn.user.id !== opponent.id) {
        await btn.reply({ content: "This isn't your battle invite!", ephemeral: true });
        return;
      }
      challengeResolved = true;
      collector.stop();

      if (btn.customId === 'decline') {
        await cancelBattleSetup(client, battleRecord.id, [myLockKey, opponentLockKey]);
        await btn.update({ embeds: [new EmbedBuilder().setColor(0x808080).setTitle('❌ Battle Declined')], components: [] });
        return;
      }

      const opponentCandidates = await getEligibleBattlePokemon(
        client,
        opponent.id,
        type,
      );
      if (opponentCandidates.length === 0) {
        await cancelBattleSetup(client, battleRecord.id, [myLockKey, opponentLockKey]);
        await btn.update({ content: `<@${opponent.id}> has no eligible caught Pokémon.`, embeds: [], components: [] });
        return;
      }
      await btn.update({
        embeds: [buildTeamSelectionEmbed(opponent.username, type, 'Opponent team selection')],
        components: buildTeamSelectionComponents(
          opponentCandidates,
          type,
          `battle_team_opponent:${battleRecord.id}`,
          0,
        ),
      });
      const opponentSelection = await collectTeamSelection(
        msg,
        opponentCandidates,
        opponent.id,
        type,
        `battle_team_opponent:${battleRecord.id}`,
        buildTeamSelectionEmbed(opponent.username, type, 'Opponent team selection'),
      );
      if (!opponentSelection) {
        await cancelBattleSetup(client, battleRecord.id, [myLockKey, opponentLockKey]);
        await interaction.editReply({
          content: '⌛ Opponent team selection expired. No battle was started.',
          embeds: [],
          components: [],
        }).catch(() => {});
        return;
      }
      const opponentTeam = await loadBattleTeam(client.prisma, opponent.id, opponentSelection);
      if (opponentTeam.length !== opponentSelection.length) {
        await cancelBattleSetup(client, battleRecord.id, [myLockKey, opponentLockKey]);
        await interaction.editReply({ content: '❌ The opponent team changed. Start again.', embeds: [], components: [] });
        return;
      }

      if (type === 'ranked') {
        await client.prisma.battle.update({
          where: { id: battleRecord.id },
          data: {
            status: 'confirming',
            challengerTeam: JSON.parse(JSON.stringify(challengerTeam)),
            opponentTeam: JSON.parse(JSON.stringify(opponentTeam)),
          },
        });
        const confirmed = await collectRankedConfirmations(
          client,
          msg,
          battleRecord.id,
          interaction.user.id,
          opponent.id,
          challengerTeam,
          opponentTeam,
        );
        if (!confirmed) {
          await cancelBattleSetup(client, battleRecord.id, [myLockKey, opponentLockKey]);
          await interaction.editReply({
            content: 'Ranked battle cancelled. No Pokémon changed ownership.',
            embeds: [],
            components: [],
          }).catch(() => {});
          return;
        }
      } else {
        await client.prisma.battle.update({
          where: { id: battleRecord.id },
          data: { challengerConfirmed: true, opponentConfirmed: true },
        });
      }

      try {
        await activateBattleWithTeams(client.prisma, battleRecord.id, challengerTeam, opponentTeam);
      } catch (error) {
        await cancelBattleSetup(client, battleRecord.id, [myLockKey, opponentLockKey]);
        client.logger.error('Battle activation failed', error);
        await interaction.editReply({
          content: '❌ A selected Pokémon became ineligible. No battle or transfer occurred.',
          embeds: [],
          components: [],
        }).catch(() => {});
        return;
      }

      // Persist canonical lastBattle timestamp for cooldowns
      try {
        await client.prisma.user.update({ where: { id: interaction.user.id }, data: { lastWork: new Date() } }).catch(() => {});
        await client.prisma.user.update({ where: { id: opponent.id }, data: { lastWork: new Date() } }).catch(() => {});
        const guild = await client.prisma.guild.findUnique({ where: { id: interaction.guild!.id } });
        const cd = guild?.battleCooldown ?? 300;
        // set Redis keys for both players
        await client.redis.set(`cooldown:${interaction.user.id}:battle`, (Date.now() + cd * 1000).toString(), { EX: cd }).catch(() => {});
        await client.redis.set(`cooldown:${opponent.id}:battle`, (Date.now() + cd * 1000).toString(), { EX: cd }).catch(() => {});
      } catch { /* non-fatal */ }

      // Speed-based first turn: faster active Pokémon's trainer goes first
      const chSpeed = challengerTeam[0] ? getEffectiveSpeed(challengerTeam[0]) : 0;
      const opSpeed = opponentTeam[0] ? getEffectiveSpeed(opponentTeam[0]) : 0;
      const firstTurnId = chSpeed >= opSpeed ? interaction.user.id : opponent.id;

      const state: BattleState = {
        id: battleRecord.id,
        challengerId: interaction.user.id,
        opponentId: opponent.id,
        guildId: interaction.guild!.id,
        type,
        status: 'active',
        turn: 1,
        currentTurnUserId: firstTurnId,
        roundLeaderId: firstTurnId,
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

      const battleKey = REDIS_KEYS.battle(state.id);
      await client.redis.set(myLockKey, 'active', { EX: REDIS_TTLS.BATTLE });
      await client.redis.set(opponentLockKey, 'active', { EX: REDIS_TTLS.BATTLE });
      await persistBattleState(client, state);

      const battleEmbed = buildBattleEmbed(state, interaction.user.username, opponent.username);
      const battleRow = buildBattleRow(state);

      await btn.update({ embeds: [battleEmbed], components: [battleRow] });

      // Battle timeout - warn at 4 min, expire at 5 min
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      setTimeout(async () => {
        const rawS = await client.redis.get(battleKey);
        if (rawS) {
          const s = deserializeBattle(rawS);
          if (s && s.status !== 'finished') {
            // Add timeout warning to battle log
            const currentTurnName = s.currentTurnUserId === s.challengerId ? interaction.user.username : opponent.username;
            s.battleLog.push(`⏰ **Timeout warning:** ${currentTurnName} has 60 seconds to act!`);
            await persistBattleState(client, s);
            
            // Try to update the embed with the warning
            try {
              await msg.edit({ embeds: [buildBattleEmbed(s, interaction.user.username, opponent.username)], components: [buildBattleRow(s)] });
            } catch { /* ignore */ }
          }
        }
      }, 240000); // 4 min warning

      // Actual timeout at 5 min
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      setTimeout(async () => {
        const rawS = await client.redis.get(battleKey);
        if (rawS) {
          const s = deserializeBattle(rawS);
          if (s && s.status !== 'finished') {
            s.status = 'finished';
            const winnerId = s.currentTurnUserId === s.challengerId ? s.opponentId : s.challengerId;
            const winnerName = winnerId === s.challengerId ? interaction.user.username : opponent.username;
            s.battleLog.push(`⏰ <@${s.currentTurnUserId}> ran out of time and forfeited the battle.`);
            const rewards = await saveBattleResult(client, s, winnerId);
            await client.redis.del([battleKey, myLockKey, opponentLockKey]);
            await msg.edit({
              embeds: [buildBattleEndEmbed(s, winnerName, rewards, 'timeout')],
              components: [],
            }).catch(() => {});
          }
        }
      }, 300000);

      // Move collector
      const moveCollector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300000 });
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      moveCollector.on('collect', async (moveBtn) => {
        const processingKey = `battle:processing:${state.id}`;
        const canProcess = await client.redis.set(processingKey, '1', { NX: true, EX: 5 });
        if (!canProcess) return; // Prevent overlapping clicks

        try {
          const rawState = await client.redis.get(battleKey);
          if (!rawState) {
            moveCollector.stop();
            await moveBtn.reply({ content: "Battle not found or has expired.", ephemeral: true });
            return;
          }

          const currentState = deserializeBattle(rawState);
          if (!currentState || currentState.status === 'finished') { moveCollector.stop(); return; }

          if (moveBtn.customId === 'battle_forfeit') {
            if (moveBtn.user.id !== currentState.challengerId &&
              moveBtn.user.id !== currentState.opponentId) {
              await moveBtn.reply({ content: 'This is not your battle.', ephemeral: true });
              return;
            }
            currentState.status = 'finished';
            const winnerId = moveBtn.user.id === currentState.challengerId
              ? currentState.opponentId
              : currentState.challengerId;
            const winnerName = winnerId === currentState.challengerId
              ? interaction.user.username
              : opponent.username;
            currentState.battleLog.push(`🏳️ <@${moveBtn.user.id}> forfeited the battle.`);
            const rewards = await saveBattleResult(client, currentState, winnerId);
            await client.redis.del([battleKey, myLockKey, opponentLockKey]);
            moveCollector.stop();
            await moveBtn.update({
              embeds: [buildBattleEndEmbed(currentState, winnerName, rewards, 'forfeit')],
              components: [],
            });
            return;
          }

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

          const challengerName = interaction.user.username;
          const opponentName = opponent.username;

          // 1. Status DoT (burn/poison) before move
          const dotResult = applyStatusDamage(attacker);
          if (dotResult.damage > 0) {
            attacker.currentHp = Math.max(0, attacker.currentHp - dotResult.damage);
            currentState.battleLog.push(dotResult.message);
            if (checkFainted(attacker)) {
              attackerTeam[attackerIdx].currentHp = 0;
              currentState.battleLog.push(`💀 ${attacker.name} fainted from status damage!`);
              const allFainted = attackerTeam.every((p) => p.currentHp <= 0);
              if (allFainted) {
                currentState.status = 'finished';
                await client.redis.del([battleKey, myLockKey, opponentLockKey]);
                moveCollector.stop();
                const winnerId = isChallenger ? currentState.opponentId : currentState.challengerId;
                const rewards = await saveBattleResult(client, currentState, winnerId);
                const winnerName = winnerId === currentState.challengerId ? challengerName : opponentName;
                await moveBtn.update({
                  embeds: [buildBattleEndEmbed(currentState, winnerName, rewards)],
                  components: [],
                });
                return;
              }
              currentState.turn++;
              currentState.currentTurnUserId = advanceTurn(currentState, isChallenger);
              await persistBattleState(client, currentState);
              await moveBtn.update({ embeds: [buildBattleEmbed(currentState, challengerName, opponentName)], components: [buildBattleRow(currentState)] });
              return;
            }
          }

          // 2. Status block check (sleep/freeze/paralysis)
          const blockResult = checkStatusBlock(attacker);
          if (blockResult.message) currentState.battleLog.push(blockResult.message);
          if (blockResult.blocked) {
            currentState.turn++;
            currentState.currentTurnUserId = advanceTurn(currentState, isChallenger);
            await persistBattleState(client, currentState);
            await moveBtn.update({ embeds: [buildBattleEmbed(currentState, challengerName, opponentName)], components: [buildBattleRow(currentState)] });
            return;
          }

          // 3. Use the selected move
          const moveIndex = parseInt(moveBtn.customId.replace('move_', ''));
          const moveName = attacker.moves[moveIndex] ?? 'tackle';
          const moveInfo = attacker.moveData?.[moveIndex] ?? getMoveData(moveName);

          // 4. Accuracy check
          const hits = checkAccuracy(moveInfo.accuracy);
          if (!hits) {
            currentState.battleLog.push(`${attacker.name} used **${moveName}**... but it missed!`);
            currentState.turn++;
            currentState.currentTurnUserId = advanceTurn(currentState, isChallenger);
            await persistBattleState(client, currentState);
            await moveBtn.update({ embeds: [buildBattleEmbed(currentState, challengerName, opponentName)], components: [buildBattleRow(currentState)] });
            return;
          }

          // 5. Damage
          const { damage, effectiveness, isCrit } = calcDamage(attacker, defender, moveInfo, currentState.weather);
          defender.currentHp = Math.max(0, defender.currentHp - damage);

          let logLine = `${attacker.name} used **${moveName}**!`;
          if (damage > 0) {
            logLine += ` (${damage} dmg`;
            // Effectiveness message
            if (effectiveness > 1) logLine += ` 💥 Super effective!`;
            else if (effectiveness < 1 && effectiveness > 0) logLine += ` 🔽 Not very effective...`;
            else if (effectiveness === 0) logLine += ` 💔 No effect!`;
            // Crit message
            if (isCrit) logLine += ` 💥 Critical hit!`;
            logLine += `)`;
          } else {
            logLine += ` (no damage)`;
          }
          currentState.battleLog.push(logLine);

          // 6. Apply status/stat effects declared by the move.
          const effectMessage = applyMoveEffect(moveInfo, defender);
          if (effectMessage) currentState.battleLog.push(effectMessage);

          currentState.turn++;
          currentState.currentTurnUserId = advanceTurn(currentState, isChallenger);

          // Check faint
          if (checkFainted(defender)) {
            defenderTeam[defenderIdx].currentHp = 0;
            currentState.battleLog.push(`💀 **${defender.name} fainted!**`);
            const allFainted = defenderTeam.every((p) => p.currentHp <= 0);
            if (allFainted) {
              currentState.status = 'finished';
              await client.redis.del([battleKey, myLockKey, opponentLockKey]);
              moveCollector.stop();
              const winnerId = moveBtn.user.id;
              const rewards = await saveBattleResult(client, currentState, winnerId);
              const winnerName = winnerId === currentState.challengerId ? challengerName : opponentName;
              await moveBtn.update({
                embeds: [buildBattleEndEmbed(currentState, winnerName, rewards)],
                components: [],
              });
              return;
            }
            // Find next alive Pokemon
            if (isChallenger) {
              const nextIdx = defenderTeam.findIndex((p, i) => i > defenderIdx && p.currentHp > 0);
              if (nextIdx !== -1) {
                currentState.opponentActivePokemonIndex = nextIdx;
                currentState.battleLog.push(`🔄 ${defenderTeam[nextIdx].name} switches in!`);
              }
            } else {
              const nextIdx = defenderTeam.findIndex((p, i) => i > defenderIdx && p.currentHp > 0);
              if (nextIdx !== -1) {
                currentState.challengerActivePokemonIndex = nextIdx;
                currentState.battleLog.push(`🔄 ${defenderTeam[nextIdx].name} switches in!`);
              }
            }
            recomputeRoundLeader(currentState);
          }

          // Trim battle log to last 8 entries to avoid embed overflow
          if (currentState.battleLog.length > 8) {
            currentState.battleLog = currentState.battleLog.slice(-8);
          }

          await persistBattleState(client, currentState);

          const updatedEmbed = buildBattleEmbed(currentState, challengerName, opponentName);
          const updatedRow = buildBattleRow(currentState);
          await moveBtn.update({ embeds: [updatedEmbed], components: [updatedRow] });
        } catch (err) {
          console.error(err);
        } finally {
          await client.redis.del(processingKey);
        }
      });
    });

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    collector.on('end', async (_, reason) => {
      if (!challengeResolved || reason === 'time') {
        await cancelBattleSetup(client, battleRecord.id, [myLockKey, opponentLockKey]);
        interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x808080).setTitle('⏰ Challenge Expired')], components: [] }).catch(() => {});
      }
    });
  },
};

/** Returns the next currentTurnUserId after the current player acted. Recomputes round leader at round boundaries. */
function advanceTurn(state: BattleState, wasChallenger: boolean): string {
  const actorId = wasChallenger ? state.challengerId : state.opponentId;
  const otherId = wasChallenger ? state.opponentId : state.challengerId;

  // If the actor was the round leader, the follower goes next
  if (actorId === state.roundLeaderId) return otherId;

  // Follower just acted → round complete, recompute leader for next round
  recomputeRoundLeader(state);
  return state.roundLeaderId ?? actorId;
}

function recomputeRoundLeader(state: BattleState): void {
  const chActive = state.challengerTeam[state.challengerActivePokemonIndex];
  const opActive = state.opponentTeam[state.opponentActivePokemonIndex];
  const challengerSpeed = chActive ? getEffectiveSpeed(chActive) : 0;
  const opponentSpeed = opActive ? getEffectiveSpeed(opActive) : 0;
  state.roundLeaderId = challengerSpeed >= opponentSpeed
    ? state.challengerId
    : state.opponentId;
}

function buildBattleEmbed(state: BattleState, challengerName: string, opponentName: string): EmbedBuilder {
  const ch = state.challengerTeam[state.challengerActivePokemonIndex];
  const op = state.opponentTeam[state.opponentActivePokemonIndex];
  const turnName = state.currentTurnUserId === state.challengerId ? challengerName : opponentName;

  const chStatus = statusLabel(ch?.statusEffect);
  const opStatus = statusLabel(op?.statusEffect);

  const logDisplay = state.battleLog.slice(-5).join('\n') || 'Battle started!';

  return new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle(`⚔️ Pokemon Battle! (Turn ${state.turn})`)
    .setDescription(logDisplay)
    .addFields(
      {
        name: `${challengerName}'s ${ch?.name ?? '???'}${chStatus ? ` ${chStatus}` : ''}`,
        value: `Lv.${ch?.level ?? '?'} • ${(ch?.types ?? []).join('/')}\nHP: \`${progressBar(ch?.currentHp ?? 0, ch?.maxHp ?? 1)}\` ${ch?.currentHp ?? 0}/${ch?.maxHp ?? 0}\nTeam: ${state.challengerTeam.filter((pokemon) => pokemon.currentHp > 0).length} remaining`,
        inline: true,
      },
      {
        name: `${opponentName}'s ${op?.name ?? '???'}${opStatus ? ` ${opStatus}` : ''}`,
        value: `Lv.${op?.level ?? '?'} • ${(op?.types ?? []).join('/')}\nHP: \`${progressBar(op?.currentHp ?? 0, op?.maxHp ?? 1)}\` ${op?.currentHp ?? 0}/${op?.maxHp ?? 0}\nTeam: ${state.opponentTeam.filter((pokemon) => pokemon.currentHp > 0).length} remaining`,
        inline: true,
      }
    )
    .setFooter({ text: `${turnName}'s turn • ${state.type} battle` });
}

function buildBattleEndEmbed(
  state: BattleState,
  winnerName: string,
  rewards: BattleRewards | null,
  reason: 'victory' | 'forfeit' | 'timeout' = 'victory',
): EmbedBuilder {
  const reasonText = reason === 'timeout'
    ? 'The opposing trainer ran out of time.'
    : reason === 'forfeit'
      ? 'The opposing trainer forfeited.'
      : 'The opposing team was defeated.';
  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle('🏆 Battle Ended!')
    .setDescription(`**${winnerName}** wins in **${state.turn}** turns!\n${reasonText}\n\n${state.battleLog.slice(-5).join('\n')}`)
    .addFields(
      { name: '📊 Total Turns', value: `${state.turn}`, inline: true },
      { name: '👑 Winner', value: winnerName, inline: true },
    );
  if (rewards) {
    embed.addFields(
      { name: '💰 Winner Reward', value: `${rewards.coinReward.toLocaleString()} PokéCoins`, inline: true },
      { name: '⭐ Trainer XP', value: `Winner +${rewards.winnerXp}\nOpponent +${rewards.loserXp}`, inline: true },
      ...(rewards.rankedGain > 0
        ? [{ name: '🏅 Ranked Points', value: `Winner +${rewards.rankedGain}\nOpponent -${rewards.rankedLoss}`, inline: true }]
        : []),
    );
    if (rewards.transferredPokemon > 0) {
      embed.addFields({
        name: '⚠️ Ranked Stakes Transferred',
        value: `The winner received **${rewards.transferredPokemon} caught Pokémon** used by the losing team.`,
        inline: false,
      });
    }
  }
  return embed;
}

function buildBattleRow(state: BattleState): ActionRowBuilder<ButtonBuilder> {
  const currentTeam = state.currentTurnUserId === state.challengerId
    ? state.challengerTeam : state.opponentTeam;
  const activeIdx = state.currentTurnUserId === state.challengerId
    ? state.challengerActivePokemonIndex : state.opponentActivePokemonIndex;
  const moves = currentTeam[activeIdx]?.moves ?? ['tackle', 'growl', 'scratch', 'ember'];

  const moveData = currentTeam[activeIdx]?.moveData ?? [];
  const typeEmoji: Record<string, string> = {
    fire: '🔥', water: '💧', grass: '🌿', electric: '⚡', ice: '🧊',
    fighting: '🥊', poison: '☠️', ground: '🌍', flying: '🪽',
    psychic: '🔮', bug: '🐛', rock: '🪨', ghost: '👻', dragon: '🐉',
    dark: '🌑', steel: '⚙️', fairy: '✨', normal: '⚪',
  };
  const buttons = moves.slice(0, 4).map((move, i) => {
    const data = moveData[i] ?? getMoveData(move);
    const power = data.category === 'Status' ? 'Status' : `${data.power} power`;
    return new ButtonBuilder()
      .setCustomId(`move_${i}`)
      .setLabel(`${move.charAt(0).toUpperCase() + move.slice(1)} • ${power}`.slice(0, 80))
      .setEmoji(typeEmoji[data.type.toLowerCase()] ?? '⚪')
      .setStyle(data.category === 'Status' ? ButtonStyle.Secondary : ButtonStyle.Primary);
  });
  buttons.push(
    new ButtonBuilder()
      .setCustomId('battle_forfeit')
      .setLabel('Forfeit')
      .setEmoji('🏳️')
      .setStyle(ButtonStyle.Danger)
  );

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    buttons
  );
}

interface BattleSelectionCandidate {
  id: string;
  nickname: string | null;
  level: number;
  isShiny: boolean;
  currentHp: number | null;
  pokemon: {
    nameDisplay: string;
    hp: number;
    type1: string;
    type2: string | null;
    rarity: string;
  };
}

async function getEligibleBattlePokemon(
  client: BotClient,
  userId: string,
  type: 'ranked' | 'unranked',
): Promise<BattleSelectionCandidate[]> {
  const candidates = await client.prisma.userPokemon.findMany({
    where: {
      userId,
      OR: [{ currentHp: null }, { currentHp: { gt: 0 } }],
      ...(type === 'ranked' ? { isLocked: false, isFavorite: false } : {}),
    },
    include: { pokemon: true },
    orderBy: [{ isInTeam: 'desc' }, { level: 'desc' }, { caughtAt: 'desc' }],
    take: 100,
  });
  if (candidates.length === 0) return [];

  const listed = await client.prisma.marketListing.findMany({
    where: { sellerId: userId, status: 'active' },
    select: { itemData: true },
  });
  const listedIds = new Set(listed.flatMap((listing) => {
    const data = listing.itemData as { userPokemonId?: string };
    return data.userPokemonId ? [data.userPokemonId] : [];
  }));
  const eligible = candidates.filter((pokemon) => !listedIds.has(pokemon.id));
  return eligible;
}

function buildTeamSelectionComponents(
  eligible: BattleSelectionCandidate[],
  type: 'ranked' | 'unranked',
  prefix: string,
  page: number,
) {
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(eligible.length / pageSize));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const pagePokemon = eligible.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const maxValues = Math.min(
    type === 'ranked' ? RANKED_TEAM_MAX : 6,
    pagePokemon.length,
  );
  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${prefix}:select`)
      .setPlaceholder(`Choose team • Page ${safePage + 1}/${totalPages}`)
      .setMinValues(1)
      .setMaxValues(maxValues)
      .addOptions(pagePokemon.map((owned) => {
        const displayName = owned.nickname ?? owned.pokemon.nameDisplay;
        const hp = owned.currentHp ?? owned.pokemon.hp;
        const types = [owned.pokemon.type1, owned.pokemon.type2].filter(Boolean).join('/');
        return {
          label: `${owned.isShiny ? '✨ ' : ''}${displayName} • Lv.${owned.level}`.slice(0, 100),
          description: `HP ${hp} • ${types} • ${owned.pokemon.rarity}`.slice(0, 100),
          value: owned.id,
        };
      })),
  );
  if (totalPages === 1) return [selectRow];
  const navigation = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${prefix}:prev`)
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage === 0),
    new ButtonBuilder()
      .setCustomId(`${prefix}:next`)
      .setLabel('Next')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId(`${prefix}:cancel`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger),
  );
  return [selectRow, navigation];
}

async function collectTeamSelection(
  message: Message,
  eligible: BattleSelectionCandidate[],
  userId: string,
  type: 'ranked' | 'unranked',
  prefix: string,
  embed: EmbedBuilder,
): Promise<string[] | null> {
  let page = 0;
  return new Promise((resolve) => {
    const collector = message.createMessageComponentCollector({
      filter: (component) => component.user.id === userId && component.customId.startsWith(prefix),
      time: 120_000,
    });
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    collector.on('collect', async (component) => {
      if (component.isStringSelectMenu() && component.customId === `${prefix}:select`) {
        await component.deferUpdate();
        collector.stop('selected');
        resolve(component.values);
        return;
      }
      if (!component.isButton()) return;
      if (component.customId === `${prefix}:cancel`) {
        await component.deferUpdate();
        collector.stop('cancelled');
        resolve(null);
        return;
      }
      page += component.customId === `${prefix}:next` ? 1 : -1;
      await component.update({
        embeds: [embed],
        components: buildTeamSelectionComponents(eligible, type, prefix, page),
      });
    });
    collector.on('end', (_collected, reason) => {
      if (!['selected', 'cancelled'].includes(reason)) resolve(null);
    });
  });
}

function buildTeamSelectionEmbed(
  trainerName: string,
  type: 'ranked' | 'unranked',
  stage: string,
): EmbedBuilder {
  const max = type === 'ranked' ? RANKED_TEAM_MAX : 6;
  return new EmbedBuilder()
    .setColor(type === 'ranked' ? 0xff8c00 : 0x3498db)
    .setTitle(`⚔️ ${stage}`)
    .setDescription(
      `**${trainerName}**, select **1–${max} caught Pokémon**.\n` +
      'Only Pokémon captured in this Discord bot are available. TCG collection cards cannot battle.'
    )
    .setFooter({ text: 'Names, levels, HP, and types are shown—no IDs required.' });
}

async function collectRankedConfirmations(
  client: BotClient,
  message: Message,
  battleId: string,
  challengerId: string,
  opponentId: string,
  challengerTeam: BattleState['challengerTeam'],
  opponentTeam: BattleState['opponentTeam'],
): Promise<boolean> {
  const confirmed = new Set<string>();
  const warning = () => new EmbedBuilder()
    .setColor(0xff3300)
    .setTitle('⚠️ Ranked Battle — Pokémon At Risk')
    .setDescription(
      '**Ranked battles are high-stakes. Pokémon used in this battle will transfer to the winner if you lose.**\n\n' +
      'This applies only to caught Pokédex Pokémon selected below. TCG collection cards are never included.'
    )
    .addFields(
      {
        name: 'Challenger team',
        value: challengerTeam.map((pokemon) => `${pokemon.isShiny ? '✨ ' : ''}${pokemon.name} • Lv.${pokemon.level}`).join('\n'),
        inline: true,
      },
      {
        name: 'Opponent team',
        value: opponentTeam.map((pokemon) => `${pokemon.isShiny ? '✨ ' : ''}${pokemon.name} • Lv.${pokemon.level}`).join('\n'),
        inline: true,
      },
      {
        name: 'Confirmation',
        value: `<@${challengerId}> ${confirmed.has(challengerId) ? '✅' : '⏳'}\n<@${opponentId}> ${confirmed.has(opponentId) ? '✅' : '⏳'}`,
      },
    )
    .setFooter({ text: 'Both trainers must explicitly accept the irreversible stakes.' });
  const controls = () => new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ranked_confirm:${battleId}`)
      .setLabel('Accept Ranked Risk')
      .setEmoji('⚔️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`ranked_cancel:${battleId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
  );

  await message.edit({ embeds: [warning()], components: [controls()] });
  return new Promise((resolve) => {
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
    });
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    collector.on('collect', async (button) => {
      if (![challengerId, opponentId].includes(button.user.id)) {
        await button.reply({ content: 'Only the two trainers can confirm this battle.', ephemeral: true });
        return;
      }
      if (button.customId === `ranked_cancel:${battleId}`) {
        await button.deferUpdate();
        collector.stop('cancelled');
        return;
      }
      if (button.customId !== `ranked_confirm:${battleId}`) return;
      await button.deferUpdate();
      if (!confirmed.has(button.user.id)) {
        await confirmRankedBattleRisk(client.prisma, battleId, button.user.id);
        confirmed.add(button.user.id);
      }
      if (confirmed.size === 2) {
        collector.stop('confirmed');
      } else {
        await message.edit({ embeds: [warning()], components: [controls()] });
      }
    });
    collector.on('end', (_collected, reason) => resolve(reason === 'confirmed'));
  });
}

async function cancelBattleSetup(
  client: BotClient,
  battleId: string,
  redisKeys: string[],
): Promise<void> {
  await Promise.all([
    client.prisma.battle.updateMany({
      where: { id: battleId, status: { in: ['selecting', 'confirming'] } },
      data: { status: 'cancelled', endedAt: new Date() },
    }),
    releaseBattleParticipantLocks(client.prisma, battleId),
    client.redis.del(redisKeys).catch(() => 0),
  ]);
}

export default command;
