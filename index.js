'use strict';

const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    REST,
    Routes,
    PermissionsBitField,
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN; // Add your bot token here
const CLIENT_ID = "1493989281956368538"; // Replace with your bot's client ID

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers],
});

// ===== SLASH COMMANDS =====
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
            option.setName('user')
                .setDescription('User to timeout')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Timeout duration (e.g., 10m, 1h)')
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
                .setDescription('Reason for kick')
                .setRequired(false)
        ),
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

// ===== READY EVENT =====
client.once("ready", () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

// ===== HANDLE COMMANDS =====
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, channel, guild } = interaction;

    // LOCK COMMAND
    if (commandName === "lock") {
        try {
            const everyoneRole = guild.roles.everyone; // @everyone role
            await channel.permissionOverwrites.edit(everyoneRole, {
                [PermissionsBitField.Flags.SendMessages]: false, // Disable sending messages
            });
            return interaction.reply({ content: "🔒 Channel locked successfully." });
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: `❌ Lock failed. ${error.message}`, ephemeral: true });
        }
    }

    // UNLOCK COMMAND
    if (commandName === "unlock") {
        try {
            const everyoneRole = guild.roles.everyone; // @everyone role
            await channel.permissionOverwrites.edit(everyoneRole, {
                [PermissionsBitField.Flags.SendMessages]: null, // Reset to default permission
            });
            return interaction.reply({ content: "🔓 Channel unlocked successfully." });
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: `❌ Unlock failed. ${error.message}`, ephemeral: true });
        }
    }

    // TIMEOUT COMMAND
    if (commandName === "timeout") {
        const user = options.getUser("user");
        const duration = options.getString("duration");

        const member = guild.members.cache.get(user.id) || await guild.members.fetch(user.id).catch(() => null);
        if (!member) return interaction.reply({ content: "❌ User not found!", ephemeral: true });

        const ms = parseDuration(duration);
        if (!ms) return interaction.reply({ content: "❌ Invalid duration format. Use '10m' or '1h'.", ephemeral: true });

        // Permission and hierarchy checks
        const author = interaction.member; // Command issuer
        const bot = guild.members.cache.get(client.user.id); // Bot member

        if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return interaction.reply({ content: "❌ I need the 'MODERATE_MEMBERS' permission to timeout users.", ephemeral: true });
        }

        if (member.roles.highest.position >= author.roles.highest.position) {
            return interaction.reply({ content: "❌ You can't timeout this user (role hierarchy).", ephemeral: true });
        }
        if (member.roles.highest.position >= bot.roles.highest.position) {
            return interaction.reply({ content: "❌ I can't timeout this user (role hierarchy).", ephemeral: true });
        }

        try {
            await member.timeout(ms, `Timed out by ${interaction.user.tag}`);
            return interaction.reply({ content: `✅ Timed out **${user.tag}** for ${duration}.` });
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: `❌ Timeout failed. Check role hierarchy or permissions.`, ephemeral: true });
        }
    }

    // KICK COMMAND
    if (commandName === "kick") {
        const user = options.getUser("user");
        const reason = options.getString("reason") || "No reason provided";

        const member = guild.members.cache.get(user.id) || await guild.members.fetch(user.id).catch(() => null);
        if (!member) return interaction.reply({ content: "❌ User not found.", ephemeral: true });

        // Permission and hierarchy checks
        const author = interaction.member; // Command issuer
        const bot = guild.members.cache.get(client.user.id); // Bot member

        if (!guild.members.me.permissions.has(PermissionsBitField.Flags.KickMembers)) {
            return interaction.reply({ content: "❌ I need the 'KICK_MEMBERS' permission to kick users.", ephemeral: true });
        }

        if (member.roles.highest.position >= author.roles.highest.position) {
            return interaction.reply({ content: "❌ You can't kick this user (role hierarchy).", ephemeral: true });
        }
        if (member.roles.highest.position >= bot.roles.highest.position) {
            return interaction.reply({ content: "❌ I can't kick this user (role hierarchy).", ephemeral: true });
        }

        try {
            await member.kick(reason);
            return interaction.reply({ content: `✅ Kicked **${user.tag}** successfully. Reason: ${reason}` });
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: `❌ Failed to kick user. ${error.message}`, ephemeral: true });
        }
    }
});

// ===== HELPER FUNCTION: Parse Duration =====
function parseDuration(duration) {
    const match = duration.match(/^(\d+)([smh])$/);
    if (!match) return null;

    const [, value, unit] = match;
    const number = parseInt(value, 10);

    switch (unit) {
        case 's': return number * 1000; // Seconds to milliseconds
        case 'm': return number * 60 * 1000; // Minutes to milliseconds
        case 'h': return number * 60 * 60 * 1000; // Hours to milliseconds
        default: return null;
    }
}

// ===== LOGIN =====
client.login(TOKEN);
