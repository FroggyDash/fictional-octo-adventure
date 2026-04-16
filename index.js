
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionsBitField
} = require('discord.js');

const express = require("express");
const fs = require("fs");
const path = require("path");

// ===== KEEP ALIVE SERVER (FIXES RENDER ERROR) =====
const app = express();
app.get("/", (req, res) => res.send("Bot is alive"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// ===== CONFIG =====
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = "1493989281956368538"; // your app ID

// ===== SIMPLE WARNING STORAGE (JSON) =====
const WARN_FILE = path.join(__dirname, "warnings.json");
function loadWarnings() {
  try {
    if (!fs.existsSync(WARN_FILE)) return {};
    return JSON.parse(fs.readFileSync(WARN_FILE, "utf8") || "{}");
  } catch {
    return {};
  }
}
function saveWarnings(data) {
  fs.writeFileSync(WARN_FILE, JSON.stringify(data, null, 2));
}
const warnings = loadWarnings();

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // needed for purge
    GatewayIntentBits.GuildMembers
  ]
});

// ===== SLASH COMMANDS =====
const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check if bot is alive'),

  // existing ban/unban
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to ban')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for ban')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user')
    .addStringOption(option =>
      option.setName('id')
        .setDescription('User ID to unban')
        .setRequired(true)
    ),

  // ===== NEW: warn =====
  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to warn')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for warning')
        .setRequired(false)
    ),

  // ===== NEW: kick =====
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user')
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

  // ===== NEW: purge =====
  new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete messages in this channel')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('How many messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
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

// ===== READY =====
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ===== HELPERS =====
function getMemberFromInteraction(interaction, user) {
  // interaction.options.getUser() returns a User, but we want GuildMember to kick/ban
  return interaction.guild.members.cache.get(user.id) || null;
}

async function enforceHierarchy({ interaction, targetMember }) {
  const author = interaction.member;
  const botMember = await interaction.guild.members.fetchMe();

  // If you can’t fetch members, this can throw; we handle it elsewhere.
  if (!author.roles?.highest || !targetMember.roles?.highest || !botMember.roles?.highest) {
    return { ok: false, msg: "Role hierarchy check failed." };
  }

  if (targetMember.id === interaction.client.user.id) {
    return { ok: false, msg: "I can’t moderate myself." };
  }

  if (targetMember.roles.highest.position >= author.roles.highest.position) {
    return { ok: false, msg: "You can’t moderate that member (role hierarchy)." };
  }

  if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
    return { ok: false, msg: "I can’t moderate that member (role hierarchy)." };
  }

  return { ok: true };
}

// ===== HANDLE COMMANDS =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { guild } = interaction;
  if (!guild) return interaction.reply({ content: "Use this command in a server.", ephemeral: true });

  // PING
  if (interaction.commandName === "ping") {
    return interaction.reply({ content: "🏓 Pong!", ephemeral: true });
  }

  // BAN
  if (interaction.commandName === "ban") {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.BanMembers)) {
      return interaction.reply({ content: "❌ No permission (BanMembers).", ephemeral: true });
    }

    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") || "No reason provided";

    try {
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (member) {
        const author = interaction.member;
        const botMember = await guild.members.fetchMe();
        if (member.roles.highest.position >= botMember.roles.highest.position) {
          return interaction.reply({ content: "❌ I can’t ban that user (role hierarchy).", ephemeral: true });
        }
        if (member.roles.highest.position >= author.roles.highest.position) {
          return interaction.reply({ content: "❌ You can’t ban that user (role hierarchy).", ephemeral: true });
        }
      }

      await guild.members.ban(user.id, { reason });
      return interaction.reply({ content: `✅ Banned **${user.tag}**.`, ephemeral: true });
    } catch {
      return interaction.reply({ content: "❌ Failed to ban user. Check permissions/role hierarchy.", ephemeral: true });
    }
  }

  // UNBAN
  if (interaction.commandName === "unban") {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.BanMembers)) {
      return interaction.reply({ content: "❌ No permission (BanMembers).", ephemeral: true });
    }

    const id = interaction.options.getString("id", true);

    try {
      await guild.members.unban(id);
      return interaction.reply({ content: `✅ Unbanned user with ID \`${id}\`.`, ephemeral: true });
    } catch {
      return interaction.reply({ content: "❌ Invalid ID or user not banned.", ephemeral: true });
    }
  }

  // WARN
  if (interaction.commandName === "warn") {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ModerateMembers)) {
      return interaction.reply({ content: "❌ No permission (ModerateMembers).", ephemeral: true });
    }

    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") || "No reason provided";

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: "❌ Could not find that member in this server.", ephemeral: true });

    // Hierarchy check (optional for warn, but good practice)
    const hierarchy = await enforceHierarchy({ interaction, targetMember: member });
    if (!hierarchy.ok) return interaction.reply({ content: `❌ ${hierarchy.msg}`, ephemeral: true });

    const current = warnings[user.id] || { count: 0, items: [] };
    const next = {
      count: (current.count || 0) + 1,
      items: [
        ...(current.items || []),
        {
          at: Date.now(),
          by: interaction.user.id,
          reason
        }
      ]
    };

    warnings[user.id] = next;
    saveWarnings(warnings);

    return interaction.reply({
      content: `⚠️ Warned **${user.tag}** (Total warns: ${next.count}).\nReason: ${reason}`,
      ephemeral: true
    });
  }

  // KICK
  if (interaction.commandName === "kick") {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.KickMembers)) {
      return interaction.reply({ content: "❌ No permission (KickMembers).", ephemeral: true });
    }

    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") || "No reason provided";

    const targetMember = await guild.members.fetch(user.id).catch(() => null);
    if (!targetMember) return interaction.reply({ content: "❌ Could not find that member.", ephemeral: true });

    const hierarchy = await enforceHierarchy({ interaction, targetMember });
    if (!hierarchy.ok) return interaction.reply({ content: `❌ ${hierarchy.msg}`, ephemeral: true });

    try {
      await targetMember.kick(reason);
      return interaction.reply({ content: `✅ Kicked **${user.tag}**.\nReason: ${reason}`, ephemeral: true });
    } catch {
      return interaction.reply({ content: "❌ Failed to kick. Check permissions/role hierarchy.", ephemeral: true });
    }
  }

  // PURGE
  if (interaction.commandName === "purge") {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({ content: "❌ No permission (ManageMessages).", ephemeral: true });
    }

    const amount = interaction.options.getInteger("amount", true);
    const channel = interaction.channel;

    // bot permission check
    const botMember = await guild.members.fetchMe();
    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({ content: "❌ I don’t have ManageMessages in this channel.", ephemeral: true });
    }

    try {
      // Fetch recent messages then bulk delete (filters out old messages with "true")
      const messages = await channel.messages.fetch({ limit: amount });
      const deleted = await channel.bulkDelete(messages, true);

      return interaction.reply({ content: `🧹 Deleted **${deleted.size}** message(s).`, ephemeral: true });
    } catch (err) {
      return interaction.reply({ content: "❌ Purge failed. Check bot permissions and message age limits.", ephemeral: true });
    }
  }
});

// ===== LOGIN =====
client.login(TOKEN);
```

---

## 3) Render / Discord settings you MUST do
1) In the **Discord Developer Portal**, enable the bot’s **Privileged Gateway Intent** only if needed (for intents used above):
   - You may need `Message Content Intent` enabled in Discord settings for purge to work reliably.

2) Invite URL permissions must include:
   - `Ban Members`
   - `Kick Members`
   - `Manage Messages`
   - `Moderate Members` (for warn)
   - `Use Application Commands` (always)

If your bot still fails, it’s almost always **permissions** or **role hierarchy**.

---

## Quick question (so I can add the “other mod commands” next)
Do you want these additional commands too?

- **/timeout** (mute for X minutes) ✅ very common
- **/ban** and **/unban** (you already started with ban/unban)
- **/lock** and **/unlock** (channel permissions)

Reply with: `timeout` / `lock` / `unlock` / `all`, and also tell me how you want timeout duration input (minutes vs seconds vs string like “10m”).
