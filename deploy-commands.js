'use strict';

const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = "1493989281956368538";

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log("🚀 Deploying commands...");
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        console.log("✅ Commands deployed!");
    } catch (err) {
        console.error(err);
    }
})();
