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
const GUILD_ID = "1493176501099692073"; // put your server ID here

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
        .setDescription('Lock the channel'),

    new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Unlock the channel'),

    new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout a user')
        .addUserOption(option =>
            option.setName('user').setRequired(true).setDescription('User')
        )
        .addStringOption(option =>
            option.setName('duration').setRequired(true).setDescription('10s, 10m, 1h, 1d')
        ),

    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a user')
        .addUserOption(option =>
            option.setName('user').setRequired(true).setDescription('User')
        )
        .addStringOption(option =>
            option.setName('reason').setRequired(false).setDescription('Reason')
        ),
];

// ===== REGISTER =====
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log("Registering commands...");

        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands.map(c => c.toJSON()) }
        );

        console.log("✅ Commands registered");
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

    const { commandName, options, guild, channel, member } = interaction;
    const bot = guild.members.me;

    // ===== LOCK =====
    if (commandName === "lock") {

        if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return interaction.reply({ content: "❌ You need Manage Channels.", ephemeral: true });
        }

        try {
            await channel.permissionOverwrites.edit(guild.roles.everyone, {
                SendMessages: false, // ✅ FIXED
            });

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle("🔒 Locked")
                        .setDescription(`Locked by ${interaction.user.tag}`)
                ]
            });

        } catch (err) {
            console.error(err);
            return interaction.reply({ content: `❌ Lock failed: ${err.message}`, ephemeral: true });
        }
    }

    // ===== UNLOCK =====
    if (commandName === "unlock") {

        if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return interaction.reply({ content: "❌ You need Manage Channels.", ephemeral: true });
        }

        try {
            await channel.permissionOverwrites.edit(guild.roles.everyone, {
                SendMessages: true, // ✅ FIXED
            });

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x00ff00)
                        .setTitle("🔓 Unlocked")
                        .setDescription(`Unlocked by ${interaction.user.tag}`)
                ]
            });

        } catch (err) {
            console.error(err);
            return interaction.reply({ content: `❌ Unlock failed: ${err.message}`, ephemeral: true });
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

        // ✅ CHECK BOT PERMISSION
        if (!bot.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return interaction.reply({ content: "❌ I need Moderate Members permission.", ephemeral: true });
        }

        // ✅ ROLE HIERARCHY CHECK
        if (target.roles.highest.position >= member.roles.highest.position) {
            return interaction.reply({ content: "❌ You can't timeout this user.", ephemeral: true });
        }

        if (target.roles.highest.position >= bot.roles.highest.position) {
            return interaction.reply({ content: "❌ My role is too low.", ephemeral: true });
        }

        const ms = parseDuration(duration);
        if (!ms) {
            return interaction.reply({ content: "❌ Use format: 10s / 10m / 1h / 1d", ephemeral: true });
        }

        // ✅ MAX LIMIT
        if (ms > 28 * 24 * 60 * 60 * 1000) {
            return interaction.reply({ content: "❌ Max timeout is 28 days.", ephemeral: true });
        }

        try {
            await target.timeout(ms, `By ${interaction.user.tag}`);

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle("⏱️ Timeout")
                        .setDescription(`${user.tag} for ${duration}`)
                ]
            });

        } catch (err) {
            console.error(err);
            return interaction.reply({
                content: "❌ Timeout failed.\n👉 Make sure:\n- Bot role is above target\n- Bot has Moderate Members",
                ephemeral: true
            });
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
            return interaction.reply({ content: "❌ I need Kick Members.", ephemeral: true });
        }

        if (target.roles.highest.position >= member.roles.highest.position) {
            return interaction.reply({ content: "❌ You can't kick this user.", ephemeral: true });
        }

        if (target.roles.highest.position >= bot.roles.highest.position) {
            return interaction.reply({ content: "❌ My role is too low.", ephemeral: true });
        }

        try {
            await target.kick(reason);

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle("👢 Kicked")
                        .setDescription(`${user.tag} was kicked\nReason: ${reason}`)
                ]
            });

        } catch (err) {
            console.error(err);
            return interaction.reply({ content: "❌ Kick failed.", ephemeral: true });
        }
    }
});

// ===== PARSE TIME =====
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
