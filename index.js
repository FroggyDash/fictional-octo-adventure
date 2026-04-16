'use strict';

const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
    ],
});

client.commands = new Collection();

// LOAD COMMAND FILES FROM SAME FOLDER
const commandFiles = fs.readdirSync(__dirname)
    .filter(file => file.endsWith('.js') && file !== 'index.js' && file !== 'deploy-commands.js');

for (const file of commandFiles) {
    const command = require(`./${file}`);
    if (command.data && command.execute) {
        client.commands.set(command.data.name, command);
    }
}

// READY (FIXED)
client.once("clientReady", (c) => {
    console.log(`🚀 ${c.user.tag} is online`);
});

// COMMAND HANDLER
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({
            content: "❌ Error executing command",
            ephemeral: true
        });
    }
});

client.login(TOKEN);
