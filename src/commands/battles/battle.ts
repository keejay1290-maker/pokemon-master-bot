import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
} from 'discord.js';
import type { BotClient, Command, BattleState } from '../../types/index.js';
import { loadBattleTeam, calcDamage, getMoveData, applyStatusDamage, checkFainted, saveBattleResult, checkAccuracy, checkStatusBlock, tryInflictStatus, statusLabel } from '../../services/battleService.js';
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

    const { REDIS_KEYS, REDIS_TTLS, serializeBattle, deserializeBattle } = await import('../../utils/redisKeys.js');
    
    const myLockKey = REDIS_KEYS.battleLock(interaction.user.id);
    const opponentLockKey = REDIS_KEYS.battleLock(opponent.id);

    // Try to acquire locks
    const acquiredMe = await client.redis.set(myLockKey, 'pending', { NX: true, EX: 60 });
    if (!acquiredMe) {
      await interaction.reply({ content: 'You are already in a battle or have a pending challenge!', ephemeral: true });
      return;
    }

    const acquiredThem = await client.redis.set(opponentLockKey, 'pending', { NX: true, EX: 60 });
    if (!acquiredThem) {
      await client.redis.del(myLockKey);
      await interaction.reply({ content: `<@${opponent.id}> is already in a battle or has a pending challenge!`, ephemeral: true });
      return;
    }

    const challengerTeam = await loadBattleTeam(client.prisma, interaction.user.id);
    if (challengerTeam.length === 0) {
      await client.redis.del([myLockKey, opponentLockKey]);
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
    let challengeResolved = false;

    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

    collector.on('collect', async (btn) => {
      if (btn.user.id !== opponent.id) {
        await btn.reply({ content: "This isn't your battle invite!", ephemeral: true });
        return;
      }
      challengeResolved = true;
      collector.stop();

      if (btn.customId === 'decline') {
        await client.redis.del([myLockKey, opponentLockKey]);
        await btn.update({ embeds: [new EmbedBuilder().setColor(0x808080).setTitle('❌ Battle Declined')], components: [] });
        return;
      }

      // Start the battle
      const opponentTeam = await loadBattleTeam(client.prisma, opponent.id);
      if (opponentTeam.length === 0) {
        await client.redis.del([myLockKey, opponentLockKey]);
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
      const chSpeed = challengerTeam[0]?.speed ?? 0;
      const opSpeed = opponentTeam[0]?.speed ?? 0;
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
      await client.redis.set(battleKey, serializeBattle(state), { EX: REDIS_TTLS.BATTLE });

      const battleEmbed = buildBattleEmbed(state, interaction.user.username, opponent.username);
      const battleRow = buildBattleRow(state);

      await btn.update({ embeds: [battleEmbed], components: [battleRow] });

      // Battle timeout - warn at 4 min, expire at 5 min
      setTimeout(async () => {
        const rawS = await client.redis.get(battleKey);
        if (rawS) {
          const s = deserializeBattle(rawS);
          if (s && s.status !== 'finished') {
            // Add timeout warning to battle log
            const currentTurnName = s.currentTurnUserId === s.challengerId ? interaction.user.username : opponent.username;
            s.battleLog.push(`⏰ **Timeout warning:** ${currentTurnName} has 60 seconds to act!`);
            await client.redis.set(battleKey, serializeBattle(s), { EX: REDIS_TTLS.BATTLE });
            
            // Try to update the embed with the warning
            try {
              await msg.edit({ embeds: [buildBattleEmbed(s, interaction.user.username, opponent.username)], components: [buildBattleRow(s)] });
            } catch { /* ignore */ }
          }
        }
      }, 240000); // 4 min warning

      // Actual timeout at 5 min
      setTimeout(async () => {
        const rawS = await client.redis.get(battleKey);
        if (rawS) {
          const s = deserializeBattle(rawS);
          if (s && s.status !== 'finished') {
            await client.redis.del([battleKey, myLockKey, opponentLockKey]);
            await msg.edit({ embeds: [new EmbedBuilder().setColor(0x808080).setTitle('⏰ Battle Timed Out').setDescription('Battle expired due to inactivity.')], components: [] }).catch(() => {});
          }
        }
      }, 300000);

      // Move collector
      const moveCollector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300000 });
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

          const challengerName = isChallenger ? moveBtn.user.username : opponent.username;
          const opponentName = isChallenger ? opponent.username : moveBtn.user.username;

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
                await saveBattleResult(client, currentState, winnerId);
                const winnerName = winnerId === currentState.challengerId ? challengerName : opponentName;
                await moveBtn.update({
                  embeds: [buildBattleEndEmbed(currentState, winnerName)],
                  components: [],
                });
                return;
              }
              currentState.turn++;
              currentState.currentTurnUserId = advanceTurn(currentState, isChallenger);
              await client.redis.set(battleKey, serializeBattle(currentState), { EX: REDIS_TTLS.BATTLE });
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
            await client.redis.set(battleKey, serializeBattle(currentState), { EX: REDIS_TTLS.BATTLE });
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
            await client.redis.set(battleKey, serializeBattle(currentState), { EX: REDIS_TTLS.BATTLE });
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

          // 6. Status infliction from move type
          if (moveInfo.power > 0) {
            const inflicted = tryInflictStatus(moveInfo.type, moveInfo.category, defender);
            if (inflicted) {
              defender.statusEffect = inflicted;
              const statusNames: Record<string, string> = {
                burn: 'burned 🔥',
                poison: 'poisoned ☠️',
                paralysis: 'paralyzed ⚡',
                sleep: 'put to sleep 😴',
                freeze: 'frozen 🧊',
              };
              currentState.battleLog.push(`⚡ ${defender.name} was ${statusNames[inflicted] ?? inflicted}!`);
            }
          }

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
              await saveBattleResult(client, currentState, winnerId);
              const winnerName = winnerId === currentState.challengerId ? challengerName : opponentName;
              await moveBtn.update({
                embeds: [buildBattleEndEmbed(currentState, winnerName)],
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

          await client.redis.set(battleKey, serializeBattle(currentState), { EX: REDIS_TTLS.BATTLE });

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

    collector.on('end', async (_, reason) => {
      if (!challengeResolved || reason === 'time') {
        await client.redis.del([myLockKey, opponentLockKey]);
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
  state.roundLeaderId = (chActive?.speed ?? 0) >= (opActive?.speed ?? 0)
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
        value: `HP: \`${progressBar(ch?.currentHp ?? 0, ch?.maxHp ?? 1)}\` ${ch?.currentHp ?? 0}/${ch?.maxHp ?? 0}`,
        inline: true,
      },
      {
        name: `${opponentName}'s ${op?.name ?? '???'}${opStatus ? ` ${opStatus}` : ''}`,
        value: `HP: \`${progressBar(op?.currentHp ?? 0, op?.maxHp ?? 1)}\` ${op?.currentHp ?? 0}/${op?.maxHp ?? 0}`,
        inline: true,
      }
    )
    .setFooter({ text: `${turnName}'s turn • ${state.type} battle` });
}

function buildBattleEndEmbed(state: BattleState, winnerName: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle('🏆 Battle Ended!')
    .setDescription(`**${winnerName}** wins in **${state.turn}** turns!\n\n${state.battleLog.slice(-5).join('\n')}`)
    .addFields(
      { name: '📊 Total Turns', value: `${state.turn}`, inline: true },
      { name: '👑 Winner', value: winnerName, inline: true },
    );
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