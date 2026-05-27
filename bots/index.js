import 'dotenv/config'
import fs from "fs";
import { fork } from "child_process";
import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ActivityType } from "discord.js";
import { Client as SelfClient } from "discord.js-selfbot-v13";
import axios from "axios";
import Bot from "../mongo/bot.js";

const GUILD_ID = process.env.GUILD_ID;
const ADMIN_ID = process.env.ADMIN_ID;
const BOT_TOKEN = process.env.BOT_TOKEN;
const LOG_CHANNEL_ID = "1506963887700836473";
const MAX_BOTS_PER_WORKER = 3;

const workers = [];
const sessions = new Map();
const runningTokens = new Set();
const tokenWorkerMap = new Map();

// ─── Singleton log bot ────────────────────────────────────────────────────────
let logClient = null;

async function getLogClient() {
  if (logClient && logClient.isReady()) return logClient;

  logClient = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  });

  await logClient.login(BOT_TOKEN);

  await new Promise((resolve) => logClient.once("ready", resolve));

  // Set presence once on ready
  logClient.user.setPresence({
    activities: [
      {
        name: "nxtindia.me",
        type: ActivityType.Watching,
      },
    ],
    status: "online",
  });

  // Re-apply presence after any resume/reconnect
  logClient.on("shardResume", () => {
    logClient.user.setPresence({
      activities: [{ name: "nxtindia.me", type: ActivityType.Watching }],
      status: "online",
    });
  });

 //add command for log bot
  logClient.on("messageCreate", async (message) => {
    // Only admin
    if (message.author.id !== ADMIN_ID) return;

    if (message.content.startsWith("premium")) {

      const mention = message.mentions.users.first();
      if (!mention) {
        return message.reply("Please mention a user");
      }

      const User = (await import("../mongo/user.js")).default;

      const user = await User.findOne({ Id: mention.id });

      if (!user) {
        return message.reply("User not found");
      }

      // Current date
      const now = new Date();

      // Add 1 month
      const expiry = new Date();
      expiry.setMonth(expiry.getMonth() + 1);

      user.isPremium = true;
      user.premiumExpires = expiry;

      await user.save();

      await message.reply(
        `✅ Premium added to ${mention.username}\nExpires: <t:${Math.floor(expiry.getTime() / 1000)}:F>`
      );
    }
  });

  console.log(`[LogBot] Online as ${logClient.user.tag} — Watching nxtindia.me`);
  return logClient;
}

// Boot the log bot immediately on startup
getLogClient().catch((err) => console.error("[LogBot] Failed to start:", err));
// ─────────────────────────────────────────────────────────────────────────────

export async function sendUtr(id, utr) {
  const client = await getLogClient();
  const channel = await client.channels.fetch(LOG_CHANNEL_ID);

  const embed = new EmbedBuilder()
    .setTitle("💳 New UTR Submission")
    .setColor(0xf5a623)
    .addFields(
      { name: "User ID", value: `<@${id}>`, inline: true },
      { name: "UTR Number", value: `\`${utr}\``, inline: true },
      { name: "Status", value: "⏳ Pending", inline: true }
    )
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`utr_approve_${id}_${utr}`)
      .setLabel("✅ Approve")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`utr_reject_${id}_${utr}`)
      .setLabel("❌ Reject")
      .setStyle(ButtonStyle.Danger)
  );

  const message = await channel.send({ embeds: [embed], components: [row] });

  // Collector on the specific message — no timeout, runs until clicked
  const collector = message.createMessageComponentCollector({
    filter: (i) =>
      i.customId === `utr_approve_${id}_${utr}` ||
      i.customId === `utr_reject_${id}_${utr}`,
    max: 1,
  });

  collector.on("collect", async (interaction) => {
    // Only admin can click
    if (interaction.user.id !== ADMIN_ID) {
      return interaction.reply({
        content: "❌ Only the admin can approve or reject UTR submissions.",
        ephemeral: true,
      });
    }

    const isApproved = interaction.customId.startsWith("utr_approve");
    const newStatus = isApproved ? "approved" : "rejected";

    try {
      const Utr = (await import("../mongo/utr.js")).default;
      const User = (await import("../mongo/user.js")).default;

      await Utr.findOneAndUpdate({ utr, userId: id }, { status: newStatus });

      // If approved, mark the user as premium
      if (isApproved) {
        await User.findOneAndUpdate({ Id: id }, { isPremium: true });
        console.log(`[UTR] User ${id} upgraded to premium`);
      }

      const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(isApproved ? 0x2ecc71 : 0xe74c3c)
        .spliceFields(2, 1, {
          name: "Status",
          value: isApproved ? "✅ Approved" : "❌ Rejected",
          inline: true,
        })
        .addFields({
          name: "Reviewed By",
          value: `<@${interaction.user.id}>`,
          inline: true,
        });

      await interaction.update({ embeds: [updatedEmbed], components: [] });
      console.log(`[UTR] ${utr} for user ${id} → ${newStatus} by ${interaction.user.tag}`);
    } catch (err) {
      console.error("[UTR] Update error:", err);
      await interaction.reply({
        content: "❌ Failed to update UTR status.",
        ephemeral: true,
      });
    }
  });
}

// ─── Rest of your existing code (unchanged) ───────────────────────────────────

export async function verifyDiscordToken(token) {
  const self = new SelfClient({ intents: [] });
  try {
    await self.login(token);
    const username = self.user.username;
    const id = self.user.id;
    self.destroy();
    return { username, id };
  } catch (error) {
    return false;
  }
}

export async function startBot(token) {
  if (runningTokens.has(token)) return;

  let worker = getFreeWorker();
  if (!worker) worker = spawnWorker();

  worker.count++;
  runningTokens.add(token);
  tokenWorkerMap.set(token, worker);

  const botData = await Bot.findOne({ token });
  worker.send({
    type: "START",
    token: botData.token,
    presence: botData.presence || "NXT BOT INDIA",
    presencePic: botData.presencePic || null,
    prefix: botData.prefix || "*"
  });
}

export async function stopBot(token) {
  if (!runningTokens.has(token)) return;

  const worker = tokenWorkerMap.get(token);
  if (worker) {
    worker.send({ type: "STOP", token });
    worker.count = Math.max(0, worker.count - 1);
    tokenWorkerMap.delete(token);
  }

  runningTokens.delete(token);
}

const botStats = new Map();

function spawnWorker() {
  const w = fork("./bots/worker.cjs");

  w.count = 0;
  w.on("message", (msg) => {
    if (msg.type === "BANNED") handleBannedBot(msg.token);
    if (msg.type === "STATS") botStats.set(msg.token, msg.stats);
  });

  w.on("exit", (code) => {
    console.log("Worker exited:", code);
    const i = workers.indexOf(w);
    if (i !== -1) workers.splice(i, 1);
    for (const [token, worker] of tokenWorkerMap.entries()) {
      if (worker === w) {
        tokenWorkerMap.delete(token);
        runningTokens.delete(token);
      }
    }
  });

  workers.push(w);
  return w;
}

function getFreeWorker() {
  return workers.find((w) => w.count < MAX_BOTS_PER_WORKER);
}

async function handleBannedBot(token) {
  try {
    const Bot = (await import("../mongo/bot.js")).default;
    const bot = await Bot.findOne({ token });
    if (!bot) return;

    bot.isBanned = true;
    bot.isRunning = false;
    bot.lastActive = new Date();
    await bot.save();

    runningTokens.delete(token);
    tokenWorkerMap.delete(token);

    console.log(`Bot banned and stopped: ${bot.username}`);
  } catch (err) {
    console.error("handleBannedBot error:", err);
  }
}

export async function restoreRunningSessions() {
  try {
    const Bot = (await import("../mongo/bot.js")).default;
    const runningBots = await Bot.find({ isRunning: true, isBanned: false });

    if (runningBots.length === 0) {
      console.log("[AutoRestore] No bots to restore.");
      return;
    }

    console.log(`[AutoRestore] Restoring ${runningBots.length} bot(s)...`);

    for (const bot of runningBots) {
      if (runningTokens.has(bot.token)) {
        console.log(`[AutoRestore] ${bot.username} already running, skipping.`);
        continue;
      }
      console.log(`[AutoRestore] Starting ${bot.username}...`);
      await startBot(bot.token);
      bot.lastActive = new Date();
      await bot.save();
    }

    console.log("[AutoRestore] All sessions restored.");
  } catch (err) {
    console.error("[AutoRestore] Failed:", err);
  }
}

export function getBotStats(token) {
  return botStats.get(token) || { ramUsage: "—", cpuUsage: "—", latency: null };
}

export function changeAdver(token) {
  const worker = tokenWorkerMap.get(token);
  if (worker) {
    worker.send({ type: "CHANGE_ADVER", message: { name: "PREMIUM USER" }, token });
  } else {
    console.log("Worker not found..");
  }
}