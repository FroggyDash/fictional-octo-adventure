'use strict';

const { Client } = require('discord.js');
const client = new Client();

client.on('clientReady', () => {
    console.log('Client is ready!');
});

client.login('YOUR_BOT_TOKEN');
