'use strict';

const fs = require('fs');
const { REST, Routes } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = "1493989281956368538";

const commands = [];

// LOAD FROM SAME FOLDER
const commandFiles = fs.readdirSync(__dirname)
    .filter(file => file.endsWith('.js') && file !== 'index.js' && file !== 'deploy-commands.js');

for (const file of commandFiles) {
    const command = require(`./${file}`);
    if (command.data) {
        commands.push(command.data.toJSON());
    }
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log("🚀 Deploying commands...");
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        console.log("✅ Done!");
    } catch (err) {
        console.error(err);
    }
})();
