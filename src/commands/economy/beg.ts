import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { CooldownService } from '../../services/CooldownService.js';
import { addXp } from '../../services/userService.js';

const COOLDOWN = 3600;

const RESPONSES = [
  { msg: 'A kind trainer tossed you some change!',             min: 50,  max: 150 },
  { msg: 'You found some cash on the ground!',                 min: 10,  max: 50  },
  { msg: 'Nurse Joy felt sorry for you.',                      min: 100, max: 300 },
  { msg: 'The Gym Leader ignored you...',                      min: 0,   max: 0   },
  { msg: 'A wealthy Collector donated some cash!',             min: 200, max: 500 },
  { msg: 'Professor Grim tossed you some research grant money.',        min: 150, max: 400 },
  { msg: 'A passing trainer gave you their spare change.',     min: 75,  max: 200 },
  { msg: 'You found some money hidden in a bush!',             min: 300, max: 700 },
];

// Small chance of a common Pokemon being gifted by a passerby
const GIFTED_POKEMON: Array<{ name: string; id: number; weight: number }> = [
  { name: 'Rattata',  id: 19,  weight: 30 },
  { name: 'Pidgey',   id: 16,  weight: 30 },
  { name: 'Caterpie', id: 10,  weight: 20 },
  { name: 'Weedle',   id: 13,  weight: 20 },
];

const NATURES = ['Hardy','Lonely','Brave','Adamant','Naughty','Bold','Docile','Relaxed','Impish','Lax','Timid','Hasty','Serious','Jolly','Naive','Modest','Mild','Quiet','Bashful','Rash','Calm','Gentle','Sassy','Careful','Quirky'];

const command: Command = {
  data: new SlashCommandBuilder().setName('beg').setDescription('Beg for PokéCoins — or maybe a Pokémon!'),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const cooldownService = new CooldownService(client);
    const { onCooldown, remaining } = await cooldownService.checkCareer(interaction.user.id);
    if (onCooldown) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xff4444).setTitle('⏰ Career Cooldown').setDescription(`All careers are on cooldown. Come back in **${CooldownService.formatDuration(remaining!)}**.`)],
        ephemeral: true,
      });
      return;
    }

    await cooldownService.setCareer(interaction.user.id, COOLDOWN);

    const res = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
        const amount = res.min > 0 ? Math.floor(Math.random() * (res.max - res.min) + res.min) : 0;
        const gbpAmount = (amount / 100);

    // 3% chance a trainer gifts you a common Pokemon
    const giftPokemon = Math.random() < 0.03;
    let giftedPokemonName: string | null = null;

    if (giftPokemon) {
      const totalW = GIFTED_POKEMON.reduce((s, p) => s + p.weight, 0);
      let roll = Math.random() * totalW;
      let picked = GIFTED_POKEMON[0];
      for (const p of GIFTED_POKEMON) { roll -= p.weight; if (roll <= 0) { picked = p; break; } }

      const pokemon = await client.prisma.pokemon.findUnique({ where: { id: picked.id } });
      if (pokemon) {
        const nature = NATURES[Math.floor(Math.random() * 25)];
        await client.prisma.userPokemon.create({
          data: {
            userId: interaction.user.id,
            pokemonId: pokemon.id,
            isShiny: false,
            level: Math.floor(Math.random() * 5) + 1,
            nature,
            ivHp: Math.floor(Math.random() * 32),
            ivAttack: Math.floor(Math.random() * 32),
            ivDefense: Math.floor(Math.random() * 32),
            ivSpAttack: Math.floor(Math.random() * 32),
            ivSpDefense: Math.floor(Math.random() * 32),
            ivSpeed: Math.floor(Math.random() * 32),
            moves: ['tackle', 'growl'],
            caughtIn: 'Poke Ball',
          },
        });
        await client.prisma.user.update({
          where: { id: interaction.user.id },
          data: { pokemonCaught: { increment: 1 } },
        });
        giftedPokemonName = pokemon.name;
      }
    }

    if (amount > 0) {
      await client.prisma.user.update({
        where: { id: interaction.user.id },
        data: { balance: { increment: amount }, totalEarned: { increment: amount } },
      });
    }
    if (amount > 0 || giftedPokemonName) {
      await addXp(client.prisma, interaction.user.id, giftedPokemonName ? 15 : 5);
    }

    const embed = new EmbedBuilder()
      .setColor(giftedPokemonName ? 0xffd700 : amount > 0 ? 0x00ff00 : 0x808080)
      .setTitle(giftedPokemonName ? '🎁 A Trainer Gave You a Pokémon!' : amount > 0 ? '🙏 Someone was generous!' : '🙏 No luck...')
      .setDescription(
        [
          res.msg,
          amount > 0 ? `\n+**£${gbpAmount.toFixed(2)}**` : '',
          giftedPokemonName ? `\n🎁 A passing trainer gave you a **${giftedPokemonName}**!` : '',
        ].join('')
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
export default command;
