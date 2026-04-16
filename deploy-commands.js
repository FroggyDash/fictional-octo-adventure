'use strict';

const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = "1493989281956368538";

// ===== COMMANDS =====
const commands = [

    new SlashCommandBuilder().setName('lock').setDescription('Lock channel'),

    new SlashCommandBuilder().setName('unlock').setDescription('Unlock channel'),

    new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout a user')
        .addUserOption(o => o.setName('user').setRequired(true))
        .addStringOption(o => o.setName('duration').setRequired(true)),

    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a user')
        .addUserOption(o => o.setName('user').setRequired(true))
        .addStringOption(o => o.setName('reason')),

    new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user')
        .addUserOption(o => o.setName('user').setRequired(true))
        .addStringOption(o => o.setName('reason')),

    new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user')
        .addStringOption(o => o.setName('userid').setRequired(true)),

    new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Delete messages')
        .addIntegerOption(o => o.setName('amount').setRequired(true)),

];

const rest = new REST({ version: '10' }).setToken(TOKEN);

// ===== DEPLOY =====
(async () => {
    try {
        console.log("🚀 Deploying commands...");

        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands.map(c => c.toJSON()) }
        );

        console.log("✅ Commands deployed (wait up to 1 hour globally)");
    } catch (err) {
        console.error(err);
    }
})();
