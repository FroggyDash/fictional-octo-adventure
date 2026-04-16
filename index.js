// LOCK COMMAND
if (commandName === "lock") {
    try {
        const everyoneRole = guild.roles.everyone; // Get the @everyone role
        await channel.permissionOverwrites.edit(everyoneRole, {
            [PermissionsBitField.Flags.SendMessages]: false, // Correct flag
        });

        const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle("🔒 Channel Locked")
            .setDescription(`This channel has been locked by **${interaction.user.tag}**.`)
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.error(error);
        return interaction.reply({ content: `❌ Lock failed. ${error.message}`, ephemeral: true });
    }
}

// UNLOCK COMMAND
if (commandName === "unlock") {
    try {
        const everyoneRole = guild.roles.everyone; // Get the @everyone role
        await channel.permissionOverwrites.edit(everyoneRole, {
            [PermissionsBitField.Flags.SendMessages]: null, // Reset permission
        });

        const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle("🔓 Channel Unlocked")
            .setDescription(`This channel has been unlocked by **${interaction.user.tag}**.`)
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.error(error);
        return interaction.reply({ content: `❌ Unlock failed. ${error.message}`, ephemeral: true });
    }
}
