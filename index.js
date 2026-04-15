const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionsBitField
} = require('discord.js');

const express = require("express");

// ===== KEEP ALIVE SERVER (FIXES RENDER ERROR) =====
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is alive");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// ===== CONFIG =====
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = "1493989281956368538"; // your app ID

// ===== CLIENT =====
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ===== SLASH COMMANDS =====
const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check if bot is alive'),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to ban')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user')
    .addStringOption(option =>
      option.setName('id')
        .setDescription('User ID to unban')
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

// ===== REGISTER COMMANDS =====
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log("Registering slash commands...");

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );

    console.log("Slash commands registered!");
  } catch (error) {
    console.error(error);
  }
})();

// ===== READY =====
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ===== HANDLE COMMANDS =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // ===== PING =====
  if (interaction.commandName === "ping") {
    return interaction.reply("🏓 Pong!");
  }

  // ===== BAN =====
  if (interaction.commandName === "ban") {
    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.BanMembers)) {
      return interaction.reply({ content: "❌ No permission", ephemeral: true });
    }

    const user = interaction.options.getMember("user");
    if (!user) {
      return interaction.reply("❌ User not found");
    }

    try {
      await user.ban();
      interaction.reply(`✅ Banned ${user.user.tag}`);
    } catch {
      interaction.reply("❌ Failed to ban user");
    }
  }

  // ===== UNBAN =====
  if (interaction.commandName === "unban") {
    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.BanMembers)) {
      return interaction.reply({ content: "❌ No permission", ephemeral: true });
    }

    const id = interaction.options.getString("id");

    try {
      await interaction.guild.members.unban(id);
      interaction.reply(`✅ Unbanned user with ID ${id}`);
    } catch {
      interaction.reply("❌ Invalid ID or not banned");
    }
  }
});

// ===== LOGIN =====
client.login(TOKEN);
