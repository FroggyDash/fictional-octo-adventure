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

    // LOCK
    new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Lock the channel'),

    // UNLOCK
    new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Unlock the channel'),

    // TIMEOUT
    new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout a user')
        .addUserOption(o => o.setName('user').setRequired(true).setDescription('User'))
        .addStringOption(o => o.setName('duration').setRequired(true).setDescription('10s, 10m, 1h, 1d')),

    // KICK
    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a user')
        .addUserOption(o => o.setName('user').setRequired(true).setDescription('User'))
        .addStringOption(o => o.setName('reason').setDescription('Reason')),

    // BAN
    new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user')
        .addUserOption(o => o.setName('user').setRequired(true).setDescription('User'))
        .addStringOption(o => o.setName('reason').setDescription('Reason')),

    // UNBAN
    new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user')
        .addStringOption(o => o.setName('userid').setRequired(true).setDescription('User ID')),

    // CLEAR
    new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Delete messages')
        .addIntegerOption(o => o.setName('amount').setRequired(true).setDescription('1-100')),

];

// ===== REGISTER GLOBAL =====
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log("Registering global commands...");
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands.map(c => c.toJSON()) }
        );
        console.log("✅ Global commands ready (can take up to 1 hour)");
    } catch (err) {
        console.error(err);
    }
})();

// ===== READY =====
client.once("ready", () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

// ===== HANDLER =====
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, guild, channel, member } = interaction;
    const bot = guild.members.me;

    // LOCK
    if (commandName === "lock") {
        if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });

        await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });

        return interaction.reply({ content: "🔒 Channel locked" });
    }

    // UNLOCK
    if (commandName === "unlock") {
        if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });

        await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: true });

        return interaction.reply({ content: "🔓 Channel unlocked" });
    }

    // TIMEOUT
    if (commandName === "timeout") {
        const user = options.getUser("user");
        const duration = options.getString("duration");
        const target = await guild.members.fetch(user.id).catch(() => null);

        if (!target) return interaction.reply({ content: "❌ User not found", ephemeral: true });
        if (!bot.permissions.has(PermissionsBitField.Flags.ModerateMembers))
            return interaction.reply({ content: "❌ Missing permission", ephemeral: true });

        const ms = parseDuration(duration);
        if (!ms) return interaction.reply({ content: "❌ Invalid format", ephemeral: true });

        if (ms > 28 * 24 * 60 * 60 * 1000)
            return interaction.reply({ content: "❌ Max 28 days", ephemeral: true });

        if (target.roles.highest.position >= bot.roles.highest.position)
            return interaction.reply({ content: "❌ Role too high", ephemeral: true });

        await target.timeout(ms);
        return interaction.reply({ content: `⏱️ Timed out ${user.tag}` });
    }

    // KICK
    if (commandName === "kick") {
        const user = options.getUser("user");
        const reason = options.getString("reason") || "No reason";
        const target = await guild.members.fetch(user.id).catch(() => null);

        if (!target) return interaction.reply({ content: "❌ User not found", ephemeral: true });
        if (!bot.permissions.has(PermissionsBitField.Flags.KickMembers))
            return interaction.reply({ content: "❌ Missing permission", ephemeral: true });

        await target.kick(reason);
        return interaction.reply({ content: `👢 Kicked ${user.tag}` });
    }

    // BAN
    if (commandName === "ban") {
        const user = options.getUser("user");
        const reason = options.getString("reason") || "No reason";

        if (!bot.permissions.has(PermissionsBitField.Flags.BanMembers))
            return interaction.reply({ content: "❌ Missing permission", ephemeral: true });

        await guild.members.ban(user.id, { reason });
        return interaction.reply({ content: `🔨 Banned ${user.tag}` });
    }

    // UNBAN
    if (commandName === "unban") {
        const id = options.getString("userid");

        try {
            await guild.members.unban(id);
            return interaction.reply({ content: `🔓 Unbanned ${id}` });
        } catch {
            return interaction.reply({ content: "❌ Failed to unban", ephemeral: true });
        }
    }

    // CLEAR
    if (commandName === "clear") {
        const amount = options.getInteger("amount");

        if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });

        if (amount < 1 || amount > 100)
            return interaction.reply({ content: "❌ 1-100 only", ephemeral: true });

        await channel.bulkDelete(amount, true);
        return interaction.reply({ content: `🧹 Deleted ${amount} messages`, ephemeral: true });
    }
});

// ===== TIME PARSER =====
function parseDuration(input) {
    const match = input.match(/^(\d+)([smhd])$/);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2];

    return {
        s: value * 1000,
        m: value * 60000,
        h: value * 3600000,
        d: value * 86400000,
    }[unit];
}

// ===== LOGIN =====
client.login(TOKEN);
