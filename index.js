  // index.js (Discord.js v15) - Moderation bot with clientReady fix

require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  ChannelType,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration, // timeouts etc.
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Channel],
});

// -------------------- Config --------------------
const PREFIX = "!"; // change if you want

// Simple in-memory warn store (resets when bot restarts).
// If you want persistence, tell me and I’ll add a JSON file or database.
const warns = new Map(); // key: `${guildId}_${userId}` => number
const warnLog = new Map(); // key: `${guildId}_${userId}` => array of warn entries

function warnKey(guildId, userId) {
  return `${guildId}_${userId}`;
}

function getWarnCount(guildId, userId) {
  return warns.get(warnKey(guildId, userId)) || 0;
}

function addWarn(guildId, userId) {
  const k = warnKey(guildId, userId);
  const next = getWarnCount(guildId, userId) + 1;
  warns.set(k, next);
  return next;
}

function parseDurationToMs(input) {
  // Accepts: 10s, 5m, 1h, 2d
  // Also accepts plain number as seconds: "30" => 30s
  const str = String(input).trim().toLowerCase();

  const m = str.match(/^(\d+)(s|m|h|d)?$/);
  if (!m) return null;

  const amount = Number(m[1]);
  const unit = m[2] || "s";

  const multipliers = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };

  return amount * multipliers[unit];
}

// -------------------- clientReady fix --------------------
client.once("clientReady", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// -------------------- Helpers --------------------
function hasModPerm(member) {
  return member.permissions.has(PermissionsBitField.Flags.ModerateMembers);
}

function replyEphemeralLike(message, text) {
  // In text chats we can't do ephemeral; just keep it short.
  return message.reply(text).catch(() => {});
}

async function canActOn(member, target) {
  // Basic role hierarchy check (bot must be able to moderate target)
  // Note: Discord enforces this server-side too.
  if (!target) return false;

  // Bot higher than target
  const botHighest = message.guild.members.me.roles.highest;
  const targetHighest = target.roles.highest;
  return botHighest.comparePositionTo(targetHighest) > 0;
}

// -------------------- Message Command Handler --------------------
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return; // ignore DMs
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();

  const modMember = message.member;

  // If command requires moderation permissions, check it:
  const requiresMod = [
    "kick",
    "ban",
    "timeout",
    "untimeout",
    "warn",
    "clearwarns",
    "purge",
    "delete",
    "lock",
    "unlock",
    "mute", // alias timeout
    "unmute", // alias untimeout
  ];

  if (requiresMod.includes(command) && !hasModPerm(modMember)) {
    return replyEphemeralLike(message, "❌ You need **Moderate Members** permission to use this.");
  }

  // -------------------- KICK --------------------
  if (command === "kick") {
    const member = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
    const reason = args.slice(1).join(" ") || "No reason provided";

    if (!member) return replyEphemeralLike(message, "Usage: `!kick @user [reason]`");
    if (!member.kickable) return replyEphemeralLike(message, "❌ I can’t kick that user (permissions/role).");

    // Try hierarchy quickly
    try {
      if (!message.guild.members.me.roles.highest || message.guild.members.me.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
        return replyEphemeralLike(message, "❌ My role must be higher than that user’s role.");
      }
    } catch {}

    try {
      await member.kick(reason);
      return message.reply(`✅ Kicked **${member.user.tag}**. Reason: ${reason}`);
    } catch (e) {
      return message.reply(`❌ Kick failed: ${e?.message || e}`);
    }
  }

  // -------------------- BAN --------------------
  if (command === "ban") {
    const member = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
    const reason = args.slice(1).join(" ") || "No reason provided";

    if (!member) return replyEphemeralLike(message, "Usage: `!ban @user [reason]`");
    if (!member.bannable) return replyEphemeralLike(message, "❌ I can’t ban that user (permissions/role).");

    try {
      if (!message.guild.members.me.roles.highest || message.guild.members.me.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
        return replyEphemeralLike(message, "❌ My role must be higher than that user’s role.");
      }
    } catch {}

    try {
      await member.ban({ reason });
      return message.reply(`✅ Banned **${member.user.tag}**. Reason: ${reason}`);
    } catch (e) {
      return message.reply(`❌ Ban failed: ${e?.message || e}`);
    }
  }

  // -------------------- TIMEOUT (mute) --------------------
  if (command === "timeout" || command === "mute") {
    const member = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
    const durationInput = args[1]; // e.g. 10m
    const reason = args.slice(2).join(" ") || "No reason provided";

    if (!member || !durationInput) {
      return replyEphemeralLike(message, "Usage: `!timeout @user <duration> [reason]` (e.g. `!timeout @Bob 10m spamming`)");
    }

    const ms = parseDurationToMs(durationInput);
    if (!ms || ms <= 0) return replyEphemeralLike(message, "❌ Invalid duration. Use like `10s`, `5m`, `1h`, `2d`.");

    // Discord timeout max is 28 days
    const maxMs = 28 * 24 * 60 * 60 * 1000;
    const finalMs = Math.min(ms, maxMs);

    try {
      if (!member.moderatable) {
        return replyEphemeralLike(message, "❌ I can’t timeout that user (permissions/role).");
      }

      await member.timeout(finalMs, reason);
      return message.reply(`✅ Timed out **${member.user.tag}** for **${durationInput}**. Reason: ${reason}`);
    } catch (e) {
      return message.reply(`❌ Timeout failed: ${e?.message || e}`);
    }
  }

  // -------------------- UNTIMEOUT (unmute) --------------------
  if (command === "untimeout" || command === "unmute") {
    const member = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
    const reason = args.slice(1).join(" ") || "No reason provided";

    if (!member) return replyEphemeralLike(message, "Usage: `!untimeout @user [reason]`");

    try {
      if (!member.moderatable) {
        return replyEphemeralLike(message, "❌ I can’t modify that user (permissions/role).");
      }

      await member.timeout(0, reason);
      return message.reply(`✅ Removed timeout from **${member.user.tag}**. Reason: ${reason}`);
    } catch (e) {
      return message.reply(`❌ Untimeout failed: ${e?.message || e}`);
    }
  }

  // -------------------- WARN --------------------
  if (command === "warn") {
    const member = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
    const reason = args.slice(1).join(" ") || "No reason provided";

    if (!member) return replyEphemeralLike(message, "Usage: `!warn @user [reason]`");

    const count = addWarn(message.guild.id, member.id);

    const k = warnKey(message.guild.id, member.id);
    if (!warnLog.has(k)) warnLog.set(k, []);
    warnLog.get(k).push({ by: message.author.id, reason, at: Date.now() });

    // (Optional) DM the user
    member
      .send(`You received a warning in **${message.guild.name}**.\nReason: ${reason}\nTotal warnings: ${count}`)
      .catch(() => {});

    return message.reply(`⚠️ Warned **${member.user.tag}**. Total warnings: **${count}**. Reason: ${reason}`);
  }

  // -------------------- CLEAR WARNS --------------------
  if (command === "clearwarns") {
    const member = message.mentions.members.first() || message.guild.members.cache.get(args[0]);

    if (!member) return replyEphemeralLike(message, "Usage: `!clearwarns @user`");

    warns.delete(warnKey(message.guild.id, member.id));
    warnLog.delete(warnKey(message.guild.id, member.id));

    return message.reply(`🧹 Cleared warnings for **${member.user.tag}**.`);
  }

  // -------------------- PURGE (delete multiple) --------------------
  if (command === "purge") {
    const amount = Number(args[0]);

    if (!amount || !Number.isFinite(amount) || amount < 1 || amount > 100) {
      return replyEphemeralLike(message, "Usage: `!purge <1-100>`");
    }

    try {
      const deleted = await message.channel.bulkDelete(amount, true);
      return message.reply(`🗑️ Purged **${deleted.size}** messages.`).then((m) => setTimeout(() => m.delete().catch(() => {}), 3000));
    } catch (e) {
      return message.reply(`❌ Purge failed: ${e?.message || e}`);
    }
  }

  // -------------------- DELETE (delete a single message by ID or mention) --------------------
  if (command === "delete") {
    // expects message mention or message id
    const targetMsg = message.mentions.messages?.first();

    const msgId = args[0];
    if (!targetMsg && !msgId) return replyEphemeralLike(message, "Usage: `!delete @message` or `!delete <messageId>`");

    try {
      const toDelete = targetMsg
        ? targetMsg
        : await message.channel.messages.fetch(msgId);

      if (!toDelete) return replyEphemeralLike(message, "Could not find that message.");
      await toDelete.delete();
      return message.reply("✅ Deleted.");
    } catch (e) {
      return message.reply(`❌ Delete failed: ${e?.message || e}`);
    }
  }

  // -------------------- LOCK / UNLOCK --------------------
  if (command === "lock" || command === "unlock") {
    // Only supports text channels
    const channel = message.channel;
    if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
      return replyEphemeralLike(message, "❌ This command only works in text/news channels.");
    }

    const everyone = message.guild.roles.everyone;

    const lock = command === "lock";
    try {
      await channel.permissionOverwrites.edit(everyone.id, {
        SendMessages: !lock,
        AddReactions: !lock,
      });

      return message.reply(lock ? "🔒 Channel locked." : "🔓 Channel unlocked.");
    } catch (e) {
      return message.reply(`❌ Failed: ${e?.message || e}`);
    }
  }

  // -------------------- MISC --------------------
  if (command === "help") {
    return message.reply(
      [
        "🛡️ Moderation commands:",
        "`!kick @user [reason]`",
        "`!ban @user [reason]`",
        "`!timeout @user <10s|5m|1h|2d> [reason]`  (alias: !mute)",
        "`!untimeout @user [reason]` (alias: !unmute)",
        "`!warn @user [reason]`",
        "`!clearwarns @user`",
        "`!purge <1-100>`",
        "`!delete @message` or `!delete <messageId>`",
        "`!lock` / `!unlock` (current channel)",
      ].join("\n")
    );
  }
});

// -------------------- Login --------------------
client.login(process.env.DISCORD_TOKEN);
