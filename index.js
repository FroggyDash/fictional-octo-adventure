'use strict';

const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    REST,
    Routes,
    PermissionsBitField,
    EmbedBuilder,
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = "1493989281956368538";
const GUILD_ID = "YOUR_GUILD_ID"; // optional (for instant command updates)

// ===== CLIENT =====
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
    ],
});

// ===== COMMANDS =====
const commands = [
    new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Lock the current channel'),

    new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Unlock the current channel'),

    new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout a user')
        .addUserOption(option =>
            option.setName('user').setDescription('User to timeout').setRequired(true)
        )
        .addStringOption(option =>
            option.setName('duration').setDescription('10s, 10m, 1h, 1d').setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a user')
        .addUserOption(option =>
            option.setName('user').setDescription('User to kick').setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason').setDescription('Reason').setRequired(false)
        ),
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

// ===== REGISTER =====
(async () => {
    try {
        console.log("Registering commands...");

        // ⚡ FAST (guild only)
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands.map(cmd => cmd.toJSON()) }
        );

        // 🌍 GLOBAL (slow)
        // await rest.put(
        //     Routes.applicationCommands(CLIENT_ID),
        //     { body: commands.map(cmd => cmd.toJSON()) }
        // );

        console.log("✅ Commands registered!");
    } catch (err) {
        console.error(err);
    }
})();

// ===== READY =====
client.once("ready", () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

// ===== COMMAND HANDLER =====
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, channel, guild, member } = interaction;
    const bot = guild.members.me;

    // ===== LOCK =====
    if (commandName === "lock") {

        if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return interaction.reply({ content: "❌ You need Manage Channels permission.", ephemeral: true });
        }

        try {
            await channel.permissionOverwrites.edit(guild.roles.everyone, {
                SendMessages: false,
            });

            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle("🔒 Channel Locked")
                .setDescription(`Locked by **${interaction.user.tag}**`)
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });

        } catch (err) {
            return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
        }
    }

    // ===== UNLOCK =====
    if (commandName === "unlock") {

        if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return interaction.reply({ content: "❌ You need Manage Channels permission.", ephemeral: true });
        }

        try {
            await channel.permissionOverwrites.edit(guild.roles.everyone, {
                SendMessages: true,
            });

            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle("🔓 Channel Unlocked")
                .setDescription(`Unlocked by **${interaction.user.tag}**`)
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });

        } catch (err) {
            return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
        }
    }

    // ===== TIMEOUT =====
    if (commandName === "timeout") {
        const user = options.getUser("user");
        const duration = options.getString("duration");

        const target = await guild.members.fetch(user.id).catch(() => null);
        if (!target) {
            return interaction.reply({ content: "❌ User not found.", ephemeral: true });
        }

        if (!bot.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return interaction.reply({ content: "❌ I need Moderate Members permission.", ephemeral: true });
        }

        const ms = parseDuration(duration);
        if (!ms) {
            return interaction.reply({ content: "❌ Invalid format. Use 10s / 10m / 1h / 1d", ephemeral: true });
        }

        if (ms > 28 * 24 * 60 * 60 * 1000) {
            return interaction.reply({ content: "❌ Max timeout is 28 days.", ephemeral: true });
        }

        if (target.roles.highest.position >= member.roles.highest.position) {
            return interaction.reply({ content: "❌ You can't timeout this user.", ephemeral: true });
        }

        if (target.roles.highest.position >= bot.roles.highest.position) {
            return interaction.reply({ content: "❌ I can't timeout this user.", ephemeral: true });
        }

        try {
            await target.timeout(ms, `By ${interaction.user.tag}`);

            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle("⏱️ Timed Out")
                .setDescription(`**${user.tag}** for **${duration}**`)
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });

        } catch (err) {
            return interaction.reply({ content: "❌ Failed to timeout user.", ephemeral: true });
        }
    }

    // ===== KICK =====
    if (commandName === "kick") {
        const user = options.getUser("user");
        const reason = options.getString("reason") || "No reason";

        const target = await guild.members.fetch(user.id).catch(() => null);
        if (!target) {
            return interaction.reply({ content: "❌ User not found.", ephemeral: true });
        }

        if (!bot.permissions.has(PermissionsBitField.Flags.KickMembers)) {
            return interaction.reply({ content: "❌ I need Kick Members permission.", ephemeral: true });
        }

        if (target.roles.highest.position >= member.roles.highest.position) {
            return interaction.reply({ content: "❌ You can't kick this user.", ephemeral: true });
        }

        if (target.roles.highest.position >= bot.roles.highest.position) {
            return interaction.reply({ content: "❌ I can't kick this user.", ephemeral: true });
        }

        try {
            await target.kick(reason);

            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle("👢 Member Kicked")
                .setDescription(`**${user.tag}** was kicked`)
                .addFields({ name: "Reason", value: reason })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });

        } catch (err) {
            return interaction.reply({ content: "❌ Failed to kick user.", ephemeral: true });
        }
    }
});

// ===== DURATION PARSER =====
function parseDuration(input) {
    const match = input.match(/^(\d+)([smhd])$/);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
        case 's': return value * 1000;
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        default: return null;
    }
}

// ===== LOGIN =====
client.login(TOKEN);
