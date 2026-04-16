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

// ===== KEEP ALIVE SERVER (FIXES RENDER ERROR) =====
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
        GatewayIntentBits.MessageContent, // needed for purge
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
    const match = duration.match(/^(\d+)([smh])$/); // Supports seconds, minutes, hours
    if (!match) return null;

    const [, value, unit] = match;
    const time = parseInt(value, 10);

    if (unit === 's') return time * 1000; // Seconds to ms
    if (unit === 'm') return time * 60 * 1000; // Minutes to ms
    if (unit === 'h') return time * 60 * 60 * 1000; // Hours to ms
    return null;
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
        if (!member) return interaction.reply({ content: "❌ User not found in the server.", ephemeral: true });

        const ms = parseDuration(duration);
        if (!ms) return interaction.reply({ content: "❌ Invalid duration (use 10s, 10m, 1h).", ephemeral: true });

        try {
            await member.timeout(ms, "Timeout via moderation bot");
            return interaction.reply({ content: `✅ Timed out **${user.tag}** for ${duration}.` });
        } catch (error) {
            return interaction.reply({ content: `❌ Timeout failed. ${error.message}`, ephemeral: true });
        }
    }

    // LOCK COMMAND
    if (commandName === "lock") {
        try {
            await channel.permissionOverwrites.edit(guild.roles.everyone, { SEND_MESSAGES: false });
            return interaction.reply({ content: "🔒 Channel locked." });
        } catch (error) {
            return interaction.reply({ content: `❌ Lock failed. ${error.message}` });
        }
    }

    // UNLOCK COMMAND
    if (commandName === "unlock") {
        try {
            await channel.permissionOverwrites.edit(guild.roles.everyone, { SEND_MESSAGES: true });
            return interaction.reply({ content: "🔓 Channel unlocked." });
        } catch (error) {
            return interaction.reply({ content: `❌ Unlock failed. ${error.message}` });
        }
    }
});

// ===== LOGIN =====
client.login(TOKEN);
