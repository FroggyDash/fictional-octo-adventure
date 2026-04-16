// Updated moderation commands

// Timeout command
async function timeout(interaction) {
    const duration = interaction.options.getString('duration');
    const member = interaction.options.getMember('target');

    // Implement mute functionality
    if (member && duration) {
        // Process duration and apply timeout
        const timeInMs = parseDuration(duration);
        if (timeInMs) {
            await member.timeout(timeInMs);
            await interaction.reply(`Muted ${member} for ${duration}.`);
        } else {
            await interaction.reply('Invalid duration format. Use like `10m` or `30s`.');
        }
    } else {
        await interaction.reply('Please specify a valid member and duration.');
    }
}

// Lock command
async function lock(interaction) {
    const channel = interaction.channel;
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SEND_MESSAGES: false });
    await interaction.reply(`Channel ${channel} is locked.`);
}

// Unlock command
async function unlock(interaction) {
    const channel = interaction.channel;
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SEND_MESSAGES: true });
    await interaction.reply(`Channel ${channel} is unlocked.`);
}

function parseDuration(duration) {
    // Parse the duration string and return milliseconds
    const timeFormat = /^(\d+)([smh])$/; // Matches duration like '10m', '30s', etc.
    const match = duration.match(timeFormat);
    if (!match) return null;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
        case 's': return value * 1000;
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        default: return null;
    }
}