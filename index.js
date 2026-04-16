'use strict';

const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    REST,
    Routes,
    PermissionsBitField,
} = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');

// ===== KEEP ALIVE SERVER =====
const app = express();
app.get("/", (req, res) => res.send("Bot is alive"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// ===== CONFIG =====
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = "1493989281956368538"; // your app ID

// ===== SIMPLE WARNING STORAGE (JSON) =====
const WARN_FILE = path.join(__dirname, "warnings.json");
function loadWarnings() {
    try {
        if (!fs.existsSync(WARN_FILE)) return {};
        return JSON.parse(fs.readFileSync(WARN_FILE, "utf8") || "{}");
    } catch {
        return {};
    }
}
function saveWarnings(data) {
    fs.writeFileSync(WARN_FILE, JSON.stringify(data, null, 2));
}
const warnings = loadWarnings();

// ===== CLIENT =====
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

// ===== SLASH COMMANDS =====
const commands = [
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check if bot is alive'),

    new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to timeout')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Duration (e.g., 10m, 1h)')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a user from the server')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to kick')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the kick')
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Delete messages in this channel')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of messages to delete (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        ),

    new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Lock the current channel'),

    new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Unlock the current channel'),
];

const commandsJson = commands.map(cmd => cmd.toJSON());

// ===== REGISTER COMMANDS =====
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log("Registering slash commands...");
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commandsJson }
        );
        console.log("Slash commands registered!");
    } catch (error) {
        console.error(error);
    }
})();

// ===== READY =====
client.once("clientReady", () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

// ===== HELPERS =====
function parseDuration(duration) {
    const match = duration.match(/^(\d+)([smh])$/); // Matches seconds, minutes, hours
    if (!match) return null;

    const [, value, unit] = match;
    const number = parseInt(value, 10);

    switch (unit) {
        case 's': return number * 1000; // Seconds to ms
        case 'm': return number * 60 * 1000; // Minutes to ms
        case 'h': return number * 60 * 60 * 1000; // Hours to ms
        default: return null;
    }
}

// ===== HANDLE COMMANDS =====
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, channel, guild } = interaction;

    // PING COMMAND
    if (commandName === "ping") {
        return interaction.reply({ content: "🏓 Pong!", ephemeral: true });
    }

    // TIMEOUT COMMAND
    if (commandName === "timeout") {
        const user = options.getUser("user");
        const duration = options.getString("duration");

        const member = guild.members.cache.get(user.id) || await guild.members.fetch(user.id).catch(() => null);
        if (!member) return interaction.reply({ content: "❌ User not found.", ephemeral: true });

        const ms = parseDuration(duration);
        if (!ms) return interaction.reply({ content: "❌ Invalid duration format. Use like `10m` or `1h`.", ephemeral: true });

        try {
            await member.timeout(ms, "Timeout via moderation bot");
            return interaction.reply({ content: `✅ Timed out **${user.tag}** for ${duration}.` });
        } catch (error) {
            return interaction.reply({ content: `❌ Timeout failed. ${error.message}`, ephemeral: true });
        }
    }

    // KICK COMMAND
    if (commandName === "kick") {
        const user = options.getUser("user");
        const reason = options.getString("reason") || "No reason provided";

        const member = guild.members.cache.get(user.id) || await guild.members.fetch(user.id).catch(() => null);
        if (!member) return interaction.reply({ content: "❌ User not found.", ephemeral: true });

        try {
            await member.kick(reason);
            return interaction.reply({ content: `✅ Kicked **${user.tag}**. Reason: ${reason}` });
        } catch (error) {
            return interaction.reply({ content: `❌ Failed to kick user. ${error.message}`, ephemeral: true });
        }
    }

    // PURGE COMMAND
    if (commandName === "purge") {
        const amount = options.getInteger("amount");

        try {
            const messages = await channel.messages.fetch({ limit: amount });
            await channel.bulkDelete(messages, true);
            return interaction.reply({ content: `✅ Deleted **${messages.size}** messages.`, ephemeral: true });
        } catch (error) {
            return interaction.reply({ content: `❌ Purge failed. ${error.message}`, ephemeral: true });
        }
    }

    // LOCK AND UNLOCK COMMANDS
    if (commandName === "lock") {
        try {
            await channel.permissionOverwrites.edit(guild.roles.everyone, { SEND_MESSAGES: false });
            return interaction.reply({ content: "🔒 Channel locked." });
        } catch (error) {
            return interaction.reply({ content: `❌ Lock failed. ${error.message}`, ephemeral: true });
        }
    }

    if (commandName === "unlock") {
        try {
            await channel.permissionOverwrites.edit(guild.roles.everyone, { SEND_MESSAGES: true });
            return interaction.reply({ content: "🔓 Channel unlocked." });
        } catch (error) {
            return interaction.reply({ content: `❌ Unlock failed. ${error.message}`, ephemeral: true });
        }
    }
});

// ===== LOGIN =====
client.login(TOKEN);
