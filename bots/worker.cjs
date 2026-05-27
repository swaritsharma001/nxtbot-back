function startWorker() {
  const { Client: SelfClient } = require("discord.js-selfbot-v13");
  const fs = require("fs");
  const path = require("path");
  const os = require("os");

  const clients = new Map();

  process.on("message", async (msg) => {
    try {
      const token = msg.token;

      if (msg.type === "START") {
        if (clients.has(token)) {
          console.log("Already running:", token);
          return;
        }

        let self = new SelfClient({ intents: [] });

        self.on("error", (err) => {
          const errMsg = err?.message?.toLowerCase() || "";
          if (
            errMsg.includes("disallowed intents") ||
            errMsg.includes("authentication failed") ||
            errMsg.includes("invalid token") ||
            errMsg.includes("banned")
          ) {
            console.warn(`[BANNED/INVALID] Token:`, token);
            process.send({ type: "BANNED", token });
            self.destroy();
            clients.delete(token);
          }
        });

        try {
          await self.login(token);
        } catch (loginErr) {
          console.error(`[LOGIN FAILED] ${loginErr.message}`);
          process.send({ type: "BANNED", token });
          clients.delete(token);
          return;
        }

        clients.set(token, self);

        const baseDir = "./data";
        if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir);

        const configPath = path.join(baseDir, `config_${self.user.id}.json`);

        const loadConfig = () => {
          try {
            if (!fs.existsSync(configPath)) {
              const defaultConfig = {
                exile_users: [],
                auto_reaction: null,
                auto_italic: false,
                auto_bold: false,
                auto_strong: false,
                mimic_user: null,
                last_word_enabled: true,
                confirm_style: "words",
                auto_lines: false,
                auto_dark: false,
                auto_spoil: false,
                roast_list: [],
                last_word_replies: [],
                hindi_insults: [],
                links: {},
                owners: [self.user.id]
              };
              fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
              return defaultConfig;
            }
            return JSON.parse(fs.readFileSync(configPath, "utf8"));
          } catch (error) {
            console.error("Error loading config:", error);
            return {
              exile_users: [],
              auto_reaction: null,
              auto_italic: false,
              auto_bold: false,
              auto_strong: false,
              mimic_user: null,
              last_word_enabled: true,
              confirm_style: "words",
              auto_lines: false,
              auto_dark: false,
              auto_spoil: false,
              roast_list: [],
              last_word_replies: [],
              hindi_insults: [],
              links: {},
              owners: [self.user.id]
            };
          }
        };

        const saveConfig = (config) => {
          try {
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
          } catch (error) {
            console.error("Error saving config:", error);
          }
        };

        let config = loadConfig();
        const MAIN_OWNER_ID = self.user.id;
        let owners = config.owners || [MAIN_OWNER_ID];

        let pressureTasks = new Map();
        let gcPressureTasks = new Map();
        let gc1Tasks = new Map();
        let gc2Tasks = new Map();
        let exileUsers = new Set(config.exile_users || []);
        let autoReactions = new Map();
        let autoItalic = config.auto_italic || false;
        let autoBold = config.auto_bold || false;
        let autoStrong = config.auto_strong || false;
        let mimicUser = config.mimic_user;
        let lastWordEnabled = config.last_word_enabled !== false;
        let confirmStyle = config.confirm_style || "words";
        let autoLines = config.auto_lines || false;
        let autoDark = config.auto_dark || false;
        let autoSpoil = config.auto_spoil || false;
        let roastList = config.roast_list || [];
        let lastWordReplies = config.last_word_replies || [];
        let hindiInsults = config.hindi_insults || [];
        let links = config.links || {};

        let spamTask = null, outlastTask = null;
        let spamActive = false, outlastActive = false;
        let m16Task = null, uziTask = null, ak47Task = null, nameChangeTask = null, alTask = null;
        let m16Active = false, uziActive = false, ak47Active = false, gcnActive = false, alActive = false;
        let pressureActive = new Map(), gcPressureActive = new Map(), gc1Active = new Map(), gc2Active = new Map();
        let statuses = [];
        let isStatusRotating = false;
        let currentStatusIndex = 0;
        let currentState = 'online';
        let autoresponders = new Map();
        let clonedOriginalAvatar = null;
        let clonedOriginalUsername = null;

        const prefix = msg.prefix || "*";
        const startTime = Date.now();

        function getRandomElement(arr) {
          return arr[Math.floor(Math.random() * arr.length)];
        }

        function parseUser(message, args) {
          const mention = message.mentions.users.first();
          return mention || (args[0] && self.users.cache.get(args[0]?.replace(/[<@!>]/g, ''))) || null;
        }

        function formatUptime(ms) {
          const seconds = Math.floor(ms / 1000);
          const days = Math.floor(seconds / 86400);
          const hours = Math.floor((seconds % 86400) / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          const secs = seconds % 60;
          return `${days}d ${hours}h ${minutes}m ${secs}s`;
        }

        async function confirmAction(message) {
          if (confirmStyle === "words") {
            await message.channel.send("Action confirmed.").catch(() => {});
          } else if (confirmStyle === "reactions") {
            await message.react('👍').catch(() => {});
          } else if (confirmStyle === "delete") {
            await message.delete().catch(() => {});
          }
        }

        self.on("ready", () => {
          console.log(`✅ ${self.user.tag} ready!`);
          self.setPresence({
            activities: [{ name: msg.presence || "mintgram.live", type: 3 }],
            status: "online",
          });
        });

        const statsInterval = setInterval(() => {
          const memUsage = process.memoryUsage();
          const latency = self.ws.ping;
          process.send({
            type: "STATS",
            token,
            stats: {
              ramUsage: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
              cpuUsage: `${(process.cpuUsage().user / 1000000).toFixed(1)}%`,
              latency: latency,
            }
          });
        }, 5000);

        self.on("messageCreate", async (message) => {
          try {
            if (!message || message.author.bot) return;

            const authorId = message.author.id;
            const content = message.content.trim();
            const isCommand = content.startsWith(prefix);
            const isOwner = owners.includes(authorId);

            if (exileUsers.has(message.author.id) && message.author.id !== self.user.id) {
              const fixedWords = [
                "TERI MAA KI BHOSDA CHUD GAYI 🔥💦",
                "MADARCHOD 😡🍆",
                "TERI MAA KA BHOSDA KA ANDAR MERA LUND 🍆💦",
                "TERI MAA GB ROAD KI RANDI 🛣️😈",
                "MADARCHOD TERI MAA KI BUR MA HATHI KA LUND 🐘🍆",
                "RANDI KA PILLA MADARCHOD 🐶💦",
                "TERI MAA KI CHOOT FAAD DUNGA 🍆🔥",
                "BEHENCHOD TERI BEHEN KI BUR ME LUND 🤬💦",
                "TERI MAA RANDI HAI PUBLIC USE 🛑😈",
                "MADARCHOD TERI MAA KO RAILWAY STATION PE CHODA 🚂🍆",
                "TERI MAA KA BHOSDA LOOSE HO GAYA 💦😂",
                "GANDU MADARCHOD TERI GAND MARUNGA 🍑🔥",
                "TERI MAA KO DOGGY STYLE ME CHODUNGA 🐕💦",
                "RANDI KI AULAD TERI MAA KI CHUT 💦😡",
                "TERI MAA KA BHOSDA BLACK HO GAYA 🍆🌑",
                "MADARCHOD TERI MAA KO 100 LOGO NE CHODA 👥🍆",
                "TERI BEHEN KI CHUT ME SARSO KA TEL 🔥🌶️",
                "BHOSDIKE TERI MAA KI BUR ME JCB 🏗️💦",
                "TERI MAA KO HIGHWAY PE THOKUNGA 🛣️😈",
                "MADARCHOD TERI MAA RANDI CERTIFIED 🏆💦",
              ];
              setTimeout(async () => {
                await message.reply(`# <@${message.author.id}> ${getRandomElement(fixedWords)}`).catch(() => {});
              }, Math.random() * 1500);
            }

            if (message.author.id === self.user.id && !isCommand) {
              let modifiedContent = message.content;
              let modified = false;

              if (autoBold) { modifiedContent = `**${modifiedContent}**`; modified = true; }
              if (autoStrong) { modifiedContent = `> # ${modifiedContent}`; modified = true; }
              if (autoItalic) { modifiedContent = `*${modifiedContent}*`; modified = true; }
              if (autoLines) { modifiedContent = `${modifiedContent}\n${'_'.repeat(modifiedContent.length)}`; modified = true; }
              if (autoDark) { modifiedContent = `\`\`\`${modifiedContent}\`\`\``; modified = true; }
              if (autoSpoil) { modifiedContent = `||${modifiedContent}||`; modified = true; }

              if (modified) {
                await message.edit(modifiedContent).catch(() => {});
              }
            }

            if (autoReactions.has(message.author.id)) {
              const emoji = autoReactions.get(message.author.id);
              await message.react(emoji).catch(() => {});
            }

            if (exileUsers.has(message.author.id) && roastList.length > 0) {
              await message.reply(getRandomElement(roastList)).catch(() => {});
            }

            if (mimicUser && message.author.id === mimicUser) {
              await message.channel.send(message.content).catch(() => {});
            }

            if (lastWordEnabled && message.author.id !== self.user.id && lastWordReplies.length > 0) {
              const contentLower = message.content.toLowerCase();
              if (["last word", "last", "bye", "lasty"].some(t => contentLower.includes(t))) {
                await message.channel.send(getRandomElement(lastWordReplies)).catch(() => {});
              }
            }

            for (const [trigger, response] of autoresponders) {
              if (message.content.toLowerCase().includes(trigger)) {
                await message.channel.send(response).catch(() => {});
                break;
              }
            }

            if (!isCommand) return;

            const author = message.author.id;
            const secondOwner = "1034768829764616202";
            if (!isOwner && author !== secondOwner) return;

            const args = content.slice(prefix.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();

            // Link commands
            if (command === 'linkstore') {
              const linkName = args[0];
              const linkUrl = args[1];
              if (!linkName || !linkUrl) {
                await message.channel.send("Usage: *linkstore <name> <url>");
                return;
              }
              if (!linkUrl.startsWith('http')) {
                await message.channel.send("❌ URL must start with http or https");
                return;
              }
              if (links[linkName]) {
                await message.channel.send(`❌ Link '${linkName}' already exists!`);
                return;
              }
              links[linkName] = linkUrl;
              config.links = links;
              saveConfig(config);
              await message.channel.send(`✅ Link '${linkName}' saved! Use *${linkName} to send it`);
              return;
            } else if (command === 'linkdelete') {
              const linkName = args[0];
              if (!linkName) {
                await message.channel.send("Usage: *linkdelete <name>");
                return;
              }
              if (!links[linkName]) {
                await message.channel.send(`❌ Link '${linkName}' not found`);
                return;
              }
              delete links[linkName];
              config.links = links;
              saveConfig(config);
              await message.channel.send(`✅ Link '${linkName}' deleted!`);
              return;
            } else if (command === 'linkshow') {
              const allLinks = Object.entries(links).map(([name, url]) => `*${name} -> ${url}`).join('\n');
              if (allLinks) {
                await message.channel.send(`\`\`\`\n${allLinks}\n\`\`\``);
              } else {
                await message.channel.send("No stored links yet");
              }
              return;
            } else if (links[command]) {
              await message.channel.send(links[command]);
              return;
            }

            switch (command) {

              // ── CORE ─────────────────────────────────────────
              case 'ping': {
                const latency = Date.now() - message.createdTimestamp;
                const uptime = formatUptime(Date.now() - startTime);
                await message.channel.send(`\`\`\`
~ NXTINDIA BOT STATUS
Host     : https://www.nxtindia.me
Runtime  : Node.js v21
Latency  : ${latency}ms
WS Ping  : ${self.ws.ping}ms
Uptime   : ${uptime}
Status   : ONLINE 🟢
\`\`\``);
                break;
              }

              case 'userinfo': {
                const target = parseUser(message, args) || message.author;
                const member = message.guild?.members.cache.get(target.id);
                const roles = member?.roles.cache
                  .filter(r => r.id !== message.guild?.id)
                  .map(r => r.name).join(', ') || 'None';
                const createdAt = target.createdAt.toUTCString();
                const joinedAt = member?.joinedAt?.toUTCString() || 'N/A';
                await message.channel.send(`\`\`\`
👤 USER INFO
─────────────────────────
Tag      : ${target.tag}
ID       : ${target.id}
Bot      : ${target.bot ? 'Yes' : 'No'}
Created  : ${createdAt}
Joined   : ${joinedAt}
Roles    : ${roles}
Avatar   : ${target.displayAvatarURL({ dynamic: true })}
─────────────────────────
\`\`\``);
                break;
              }

              case 'guildinfo': {
                if (!message.guild) {
                  await message.channel.send("❌ This command only works in a server.");
                  break;
                }
                const guild = message.guild;
                const owner = await guild.fetchOwner().catch(() => null);
                const channels = guild.channels.cache.size;
                const roles = guild.roles.cache.size;
                const emojis = guild.emojis.cache.size;
                const boosts = guild.premiumSubscriptionCount || 0;
                await message.channel.send(`\`\`\`
🏠 SERVER INFO
─────────────────────────
Name     : ${guild.name}
ID       : ${guild.id}
Owner    : ${owner?.user.tag || 'Unknown'}
Members  : ${guild.memberCount}
Channels : ${channels}
Roles    : ${roles}
Emojis   : ${emojis}
Boosts   : ${boosts}
Created  : ${guild.createdAt.toUTCString()}
─────────────────────────
\`\`\``);
                break;
              }

              // ── SPAM ─────────────────────────────────────────
              case 'spam': {
                const msgText = args.join(' ');
                if (!msgText) { await message.channel.send("Usage: *spam <text>"); break; }
                if (spamTask) clearInterval(spamTask);
                spamActive = true;
                let sentCount = 0;
                spamTask = setInterval(() => {
                  if (sentCount >= 100000 || !spamActive) {
                    clearInterval(spamTask);
                    spamTask = null;
                    spamActive = false;
                    return;
                  }
                  message.channel.send(msgText).catch(() => {});
                  sentCount++;
                }, 900);
                await confirmAction(message);
                break;
              }

              case 'stopspam': {
                spamActive = false;
                if (spamTask) { clearInterval(spamTask); spamTask = null; }
                await confirmAction(message);
                break;
              }

              case 'spam2': {
                // *spam2 <count> <text>
                const count = parseInt(args[0]);
                const msgText = args.slice(1).join(' ');
                if (!count || !msgText) { await message.channel.send("Usage: *spam2 <count> <text>"); break; }
                let sent = 0;
                const task = setInterval(() => {
                  if (sent >= count) { clearInterval(task); return; }
                  message.channel.send(msgText).catch(() => {});
                  sent++;
                }, 900);
                await confirmAction(message);
                break;
              }

              case 'fs': {
                // *fs <count> <text> — fast spam
                const count = parseInt(args[0]);
                const msgText = args.slice(1).join(' ');
                if (!count || !msgText) { await message.channel.send("Usage: *fs <count> <text>"); break; }
                for (let i = 0; i < count; i++) {
                  await message.channel.send(msgText).catch(() => {});
                }
                break;
              }

              case 'loop': {
                // *loop <count> <text>
                const count = parseInt(args[0]);
                const msgText = args.slice(1).join(' ');
                if (!count || !msgText) { await message.channel.send("Usage: *loop <count> <text>"); break; }
                for (let i = 0; i < count; i++) {
                  await message.channel.send(msgText).catch(() => {});
                  await new Promise(r => setTimeout(r, 500));
                }
                break;
              }

              case 'ladder': {
                // *ladder word1 word2 word3 — sends increasing ladder
                if (!args.length) { await message.channel.send("Usage: *ladder <word1> <word2> ..."); break; }
                let result = '';
                for (let i = 0; i < args.length; i++) {
                  result += args.slice(0, i + 1).join(' ') + '\n';
                }
                await message.channel.send(result).catch(() => {});
                break;
              }

              case 'massdm': {
                const msgText = args.join(' ');
                if (!msgText) { await message.channel.send("Usage: *massdm <text>"); break; }
                if (!message.guild) { await message.channel.send("❌ Only works in a server."); break; }
                const members = message.guild.members.cache.filter(m => !m.user.bot && m.id !== self.user.id);
                let sent = 0, failed = 0;
                await message.channel.send(`📨 Starting mass DM to ${members.size} members...`);
                for (const [, member] of members) {
                  try {
                    await member.send(msgText);
                    sent++;
                  } catch {
                    failed++;
                  }
                  await new Promise(r => setTimeout(r, 1000));
                }
                await message.channel.send(`✅ Mass DM done. Sent: ${sent} | Failed: ${failed}`);
                break;
              }

              case 'outlast': {
                const user = parseUser(message, args);
                if (!user) { await message.channel.send("Usage: *outlast @user"); break; }
                if (outlastTask) clearInterval(outlastTask);
                outlastActive = true;
                outlastTask = setInterval(async () => {
                  if (!outlastActive) return;
                  const msgs = await message.channel.messages.fetch({ limit: 5 }).catch(() => null);
                  if (!msgs) return;
                  const last = msgs.first();
                  if (last && last.author.id !== self.user.id) {
                    await message.channel.send('\u200b').catch(() => {});
                  }
                }, 1000);
                await confirmAction(message);
                break;
              }

              case 'outlaststop': {
                outlastActive = false;
                if (outlastTask) { clearInterval(outlastTask); outlastTask = null; }
                await confirmAction(message);
                break;
              }

              // ── PRESSURE ──────────────────────────────────────
              case 'autopressure': {
                const user = parseUser(message, args);
                if (user) {
                  if (pressureTasks.has(user.id)) clearInterval(pressureTasks.get(user.id));
                  pressureActive.set(user.id, true);
                  const interval = setInterval(() => {
                    if (!pressureActive.get(user.id)) return;
                    const word = roastList.length ? getRandomElement(roastList) : 'madarchod';
                    message.channel.send(`> # ${word} ${user}`).catch(() => {});
                  }, 100);
                  pressureTasks.set(user.id, interval);
                  await message.delete().catch(() => {});
                }
                break;
              }

              case 'stoppressure': {
                for (const [id] of pressureTasks) pressureActive.set(id, false);
                for (const [, interval] of pressureTasks) clearInterval(interval);
                pressureTasks.clear();
                await message.channel.send("Pressure stopped.");
                break;
              }

              case 'stopap': {
                for (const [id] of pressureTasks) pressureActive.set(id, false);
                for (const [, interval] of pressureTasks) clearInterval(interval);
                pressureTasks.clear();
                await message.delete().catch(() => {});
                break;
              }

              // ── GROUP CHAT ────────────────────────────────────
              case 'gcpressure': {
                const msgText = args.join(' ');
                let counter = 0;
                if (gcPressureTasks.has(message.channel.id)) clearInterval(gcPressureTasks.get(message.channel.id));
                gcPressureActive.set(message.channel.id, true);
                const interval = setInterval(() => {
                  if (!gcPressureActive.get(message.channel.id)) return;
                  message.channel.send(msgText).catch(() => {});
                  if (message.channel.type === 'GROUP_DM') {
                    message.channel.setName(`mintgram.live ${counter++}`).catch(() => {});
                  }
                }, 500);
                gcPressureTasks.set(message.channel.id, interval);
                await confirmAction(message);
                break;
              }

              case 'stopgcpressure': {
                gcPressureActive.set(message.channel.id, false);
                const interval = gcPressureTasks.get(message.channel.id);
                if (interval) { clearInterval(interval); gcPressureTasks.delete(message.channel.id); }
                await confirmAction(message);
                break;
              }

              case 'gc1': {
                const user = parseUser(message, args);
                if (user) {
                  if (gc1Tasks.has(user.id)) clearInterval(gc1Tasks.get(user.id));
                  gc1Active.set(user.id, true);
                  let counter = 0;
                  const interval = setInterval(() => {
                    if (!gc1Active.get(user.id)) return;
                    const word = roastList.length ? getRandomElement(roastList) : 'madarchod';
                    message.channel.send(`${user} ${word} \`\`\`\n${counter++}\n\`\`\``).catch(() => {});
                  }, 500);
                  gc1Tasks.set(user.id, interval);
                  await confirmAction(message);
                }
                break;
              }

              case 'stopgc1': {
                for (const [id] of gc1Tasks) gc1Active.set(id, false);
                for (const [, interval] of gc1Tasks) clearInterval(interval);
                gc1Tasks.clear();
                await confirmAction(message);
                break;
              }

              case 'gc2': {
                const user = parseUser(message, args);
                if (user) {
                  if (gc2Tasks.has(user.id)) clearInterval(gc2Tasks.get(user.id));
                  gc2Active.set(user.id, true);
                  let counter = 0;
                  const interval = setInterval(() => {
                    if (!gc2Active.get(user.id)) return;
                    const word = roastList.length ? getRandomElement(roastList) : 'madarchod';
                    message.channel.send(`${user} ${word}`).then(m => m.pin().catch(() => {})).catch(() => {});
                    if (message.channel.type === 'GROUP_DM') message.channel.setName(`get your own at mintgram.live ${counter++}`).catch(() => {});
                  }, 500);
                  gc2Tasks.set(user.id, interval);
                  await confirmAction(message);
                }
                break;
              }

              case 'stopgc2': {
                for (const [id] of gc2Tasks) gc2Active.set(id, false);
                for (const [, interval] of gc2Tasks) clearInterval(interval);
                gc2Tasks.clear();
                await confirmAction(message);
                break;
              }

              case 'gcn': {
                const name = args.join(' ');
                if (!name) { await message.channel.send("Usage: *gcn <name>"); break; }
                let count = 1;
                if (nameChangeTask) clearInterval(nameChangeTask);
                gcnActive = true;
                nameChangeTask = setInterval(() => {
                  if (!gcnActive) return;
                  message.channel.setName(`${name} ${count++}`).catch(() => {});
                }, 500);
                await message.channel.send(`Started changing the channel name to '${name} 1'.`);
                break;
              }

              case 'stopgcn': {
                gcnActive = false;
                if (nameChangeTask) { clearInterval(nameChangeTask); nameChangeTask = null; }
                await message.channel.send("Stopped changing the channel name.");
                break;
              }

              case 'gcpfp': {
                const channelId = args[0];
                if (!channelId) { await message.channel.send("Usage: *gcpfp <channel_id>"); break; }
                const ch = self.channels.cache.get(channelId);
                if (!ch) { await message.channel.send("❌ Channel not found."); break; }
                const iconURL = ch.iconURL?.({ dynamic: true });
                if (iconURL) {
                  await message.channel.send(`🖼️ GC PFP: ${iconURL}`);
                } else {
                  await message.channel.send("❌ No profile picture found for that channel.");
                }
                break;
              }

              // ── EXILE ─────────────────────────────────────────
              case 'exile': {
                const user = parseUser(message, args);
                const fixedWords = ["Teri maa ki bhosda chud gayi", "madarchod", "teri maa ka bhosda ka andar mera lund", "teri maa gb road ki randi", "madarchod teri maa ki bur ma hathi ka lund", "randi ka pilla madarchod"];
                if (user) {
                  exileUsers.add(user.id);
                  config.exile_users = Array.from(exileUsers);
                  saveConfig(config);
                  await message.channel.send(`${user.tag} has been exiled.`);
                  await message.channel.send(`# <@${user.id}> ${getRandomElement(fixedWords)}`);
                }
                break;
              }

              case 'stopexile': {
                const user = parseUser(message, args);
                if (user) {
                  exileUsers.delete(user.id);
                  config.exile_users = Array.from(exileUsers);
                  saveConfig(config);
                  await confirmAction(message);
                }
                break;
              }

              case 'insult': {
                const user = parseUser(message, args);
                if (!user) { await message.channel.send("Usage: *insult @user"); break; }
                const insults = roastList.length ? roastList : ["madarchod", "chutiya", "bhosdike", "randi ka bacha"];
                await message.channel.send(`# <@${user.id}> ${getRandomElement(insults)}`);
                break;
              }

              case 'insult2': {
                const user = parseUser(message, args);
                if (!user) { await message.channel.send("Usage: *insult2 @user"); break; }
                const hindi = hindiInsults.length ? hindiInsults : ["teri maa ki aankh", "behen ke laude", "gaandu", "chut ke daay"];
                await message.channel.send(`# <@${user.id}> ${getRandomElement(hindi)}`);
                break;
              }

              // ── AUTO FEATURES ─────────────────────────────────
              case 'mimic': {
                const user = parseUser(message, args);
                if (user) {
                  mimicUser = user.id;
                  config.mimic_user = mimicUser;
                  saveConfig(config);
                  await confirmAction(message);
                }
                break;
              }

              case 'stopmimic': {
                mimicUser = null;
                config.mimic_user = null;
                saveConfig(config);
                await confirmAction(message);
                break;
              }

              case 'autoreaction': {
                const user = parseUser(message, args);
                const emoji = args[args.length - 1];
                if (user && emoji) {
                  autoReactions.set(user.id, emoji);
                  await message.channel.send(`✅ Will auto-react to ${user.tag} with ${emoji}`);
                } else if (args[0] === 'me' && emoji) {
                  autoReactions.set(self.user.id, emoji);
                  await message.channel.send(`✅ Will auto-react to your messages with ${emoji}`);
                } else {
                  await message.channel.send("Usage: *autoreaction @user <emoji>");
                }
                break;
              }

              case 'stopautoreaction': {
                const user = parseUser(message, args);
                if (user) {
                  autoReactions.delete(user.id);
                  await message.channel.send(`❌ Stopped auto-reacting to ${user.tag}`);
                } else if (args[0] === 'me') {
                  autoReactions.delete(self.user.id);
                  await message.channel.send(`❌ Stopped auto-reacting to your messages`);
                }
                break;
              }

              case 'reactionoff': {
                autoReactions.clear();
                await confirmAction(message);
                break;
              }

              case 'autobold': {
                autoBold = true; config.auto_bold = true; saveConfig(config);
                await confirmAction(message); break;
              }
              case 'stopautobold': {
                autoBold = false; config.auto_bold = false; saveConfig(config);
                await confirmAction(message); break;
              }
              case 'autostrong': {
                autoStrong = true; config.auto_strong = true; saveConfig(config);
                await confirmAction(message); break;
              }
              case 'stopautostrong': {
                autoStrong = false; config.auto_strong = false; saveConfig(config);
                await confirmAction(message); break;
              }
              case 'autoitalic': {
                autoItalic = true; config.auto_italic = true; saveConfig(config);
                await confirmAction(message); break;
              }
              case 'stopautoitalic': {
                autoItalic = false; config.auto_italic = false; saveConfig(config);
                await confirmAction(message); break;
              }
              case 'autolines': {
                autoLines = true; config.auto_lines = true; saveConfig(config);
                await confirmAction(message); break;
              }
              case 'stopautolines': {
                autoLines = false; config.auto_lines = false; saveConfig(config);
                await confirmAction(message); break;
              }
              case 'autodark': {
                autoDark = true; config.auto_dark = true; saveConfig(config);
                await confirmAction(message); break;
              }
              case 'stopautodark': {
                autoDark = false; config.auto_dark = false; saveConfig(config);
                await confirmAction(message); break;
              }
              case 'autospoil': {
                autoSpoil = true; config.auto_spoil = true; saveConfig(config);
                await confirmAction(message); break;
              }
              case 'stopautospoil': {
                autoSpoil = false; config.auto_spoil = false; saveConfig(config);
                await confirmAction(message); break;
              }

              // ── UTILITY ───────────────────────────────────────
              case 'purge':
              case 'c': {
                const limit = parseInt(args[0]) || 10;
                const fetched = await message.channel.messages.fetch({ limit: 100 }).catch(() => null);
                if (!fetched) break;
                const mine = fetched.filter(m => m.author.id === self.user.id).first(limit);
                for (const m of mine) {
                  await m.delete().catch(() => {});
                  await new Promise(r => setTimeout(r, 300));
                }
                break;
              }

              case 'pfp': {
                const target = parseUser(message, args) || message.author;
                const url = target.displayAvatarURL({ dynamic: true, size: 4096 });
                await message.channel.send(`🖼️ **${target.tag}'s Avatar:**\n${url}`);
                break;
              }

              case 'banner': {
                const target = parseUser(message, args) || message.author;
                const fetched = await self.users.fetch(target.id, { force: true }).catch(() => null);
                if (!fetched) { await message.channel.send("❌ Could not fetch user."); break; }
                const bannerURL = fetched.bannerURL({ dynamic: true, size: 4096 });
                if (bannerURL) {
                  await message.channel.send(`🖼️ **${target.tag}'s Banner:**\n${bannerURL}`);
                } else {
                  await message.channel.send(`❌ ${target.tag} has no banner.`);
                }
                break;
              }

              case 'members': {
                if (!message.guild) { await message.channel.send("❌ Server only command."); break; }
                const memberList = message.guild.members.cache
                  .map(m => `${m.user.tag} (${m.id})`)
                  .join('\n');
                const chunks = memberList.match(/[\s\S]{1,1900}/g) || [memberList];
                for (const chunk of chunks) {
                  await message.channel.send(`\`\`\`\n${chunk}\n\`\`\``).catch(() => {});
                }
                break;
              }

              case 'serverid': {
                const invite = args[0];
                if (!invite) { await message.channel.send("Usage: *serverid <invite_code>"); break; }
                const code = invite.replace('https://discord.gg/', '').replace('discord.gg/', '');
                const inv = await self.fetchInvite(code).catch(() => null);
                if (!inv) { await message.channel.send("❌ Invalid invite or couldn't fetch."); break; }
                await message.channel.send(`\`\`\`
🔗 INVITE INFO
─────────────────
Server  : ${inv.guild?.name || 'Unknown'}
ID      : ${inv.guild?.id || 'Unknown'}
Members : ${inv.memberCount || 'Unknown'}
─────────────────
\`\`\``);
                break;
              }

              case 'username': {
                const newName = args.join(' ');
                if (!newName) { await message.channel.send("Usage: *username <new name>"); break; }
                await self.user.setUsername(newName).catch(async (e) => {
                  await message.channel.send(`❌ Failed: ${e.message}`);
                });
                await message.channel.send(`✅ Username changed to **${newName}**`);
                break;
              }

              case 'bio': {
                const bioText = args.join(' ');
                await self.user.edit({ bio: bioText }).catch(async (e) => {
                  await message.channel.send(`❌ Failed: ${e.message}`);
                });
                await message.channel.send(`✅ Bio updated.`);
                break;
              }

              case 'avatar': {
                const url = args[0];
                if (!url) { await message.channel.send("Usage: *avatar <image_url>"); break; }
                await self.user.setAvatar(url).catch(async (e) => {
                  await message.channel.send(`❌ Failed: ${e.message}`);
                });
                await message.channel.send(`✅ Avatar updated.`);
                break;
              }

              case 'react': {
                // *react <message_id> <emoji>
                const msgId = args[0];
                const emoji = args[1];
                if (!msgId || !emoji) { await message.channel.send("Usage: *react <message_id> <emoji>"); break; }
                const target = await message.channel.messages.fetch(msgId).catch(() => null);
                if (!target) { await message.channel.send("❌ Message not found."); break; }
                await target.react(emoji).catch(async (e) => {
                  await message.channel.send(`❌ Failed: ${e.message}`);
                });
                break;
              }

              case 'typefake': {
                const seconds = parseInt(args[0]) || 5;
                await message.channel.sendTyping().catch(() => {});
                let elapsed = 0;
                const interval = setInterval(async () => {
                  elapsed++;
                  if (elapsed >= seconds) { clearInterval(interval); return; }
                  await message.channel.sendTyping().catch(() => {});
                }, 1000);
                break;
              }

              case 'getmsg': {
                const msgId = args[0];
                if (!msgId) { await message.channel.send("Usage: *getmsg <message_id>"); break; }
                const target = await message.channel.messages.fetch(msgId).catch(() => null);
                if (!target) { await message.channel.send("❌ Message not found."); break; }
                await message.channel.send(`\`\`\`
Author  : ${target.author.tag}
ID      : ${target.id}
Time    : ${target.createdAt.toUTCString()}
Content : ${target.content || '[No text content]'}
\`\`\``);
                break;
              }

              case 'searchmsg': {
                const term = args.join(' ');
                if (!term) { await message.channel.send("Usage: *searchmsg <term>"); break; }
                const fetched = await message.channel.messages.fetch({ limit: 100 }).catch(() => null);
                if (!fetched) break;
                const found = fetched.filter(m => m.content.toLowerCase().includes(term.toLowerCase()));
                if (!found.size) { await message.channel.send(`❌ No messages found containing: "${term}"`); break; }
                const results = found.map(m => `[${m.author.tag}]: ${m.content.slice(0, 100)}`).join('\n');
                const chunks = results.match(/[\s\S]{1,1900}/g) || [results];
                for (const chunk of chunks) {
                  await message.channel.send(`\`\`\`\n${chunk}\n\`\`\``).catch(() => {});
                }
                break;
              }

              case 'webhook': {
                const text = args.join(' ');
                if (!text) { await message.channel.send("Usage: *webhook <text>"); break; }
                if (!message.guild) { await message.channel.send("❌ Server only."); break; }
                const webhooks = await message.channel.fetchWebhooks().catch(() => null);
                let wh = webhooks?.first();
                if (!wh) {
                  wh = await message.channel.createWebhook('Bot Webhook').catch(() => null);
                }
                if (!wh) { await message.channel.send("❌ Could not create/find webhook."); break; }
                await wh.send(text).catch(async (e) => {
                  await message.channel.send(`❌ Failed: ${e.message}`);
                });
                break;
              }

              case 'clone': {
                const user = parseUser(message, args);
                if (!user) { await message.channel.send("Usage: *clone @user"); break; }
                const fetched = await self.users.fetch(user.id, { force: true }).catch(() => null);
                if (!fetched) { await message.channel.send("❌ Could not fetch user."); break; }
                // Save original info for unclone
                clonedOriginalUsername = self.user.username;
                clonedOriginalAvatar = self.user.displayAvatarURL({ format: 'png', size: 256 });
                const avatarURL = fetched.displayAvatarURL({ format: 'png', size: 256 });
                await self.user.setUsername(fetched.username).catch(() => {});
                await self.user.setAvatar(avatarURL).catch(() => {});
                await message.channel.send(`✅ Cloned **${fetched.tag}**`);
                break;
              }

              case 'unclone': {
                if (!clonedOriginalUsername) { await message.channel.send("❌ Nothing to unclone."); break; }
                await self.user.setUsername(clonedOriginalUsername).catch(() => {});
                if (clonedOriginalAvatar) await self.user.setAvatar(clonedOriginalAvatar).catch(() => {});
                clonedOriginalUsername = null;
                clonedOriginalAvatar = null;
                await message.channel.send(`✅ Restored original profile.`);
                break;
              }

              case 'delchannels': {
                if (!message.guild) { await message.channel.send("❌ Server only."); break; }
                const channels = message.guild.channels.cache.filter(c => c.id !== message.channel.id);
                await message.channel.send(`⚠️ Deleting ${channels.size} channels...`);
                for (const [, ch] of channels) {
                  await ch.delete().catch(() => {});
                  await new Promise(r => setTimeout(r, 300));
                }
                await message.channel.send(`✅ Done.`);
                break;
              }

              case 'reversemsg': {
                const msgId = args[0];
                if (!msgId) { await message.channel.send("Usage: *reversemsg <message_id>"); break; }
                const target = await message.channel.messages.fetch(msgId).catch(() => null);
                if (!target || !target.content) { await message.channel.send("❌ Message not found or empty."); break; }
                const reversed = target.content.split('').reverse().join('');
                await message.channel.send(reversed);
                break;
              }

              case 'fakemsg': {
                // *fakemsg @user <text>
                const user = parseUser(message, args);
                const text = args.slice(1).join(' ');
                if (!user || !text) { await message.channel.send("Usage: *fakemsg @user <text>"); break; }
                const fetched = await self.users.fetch(user.id, { force: true }).catch(() => null);
                if (!fetched) { await message.channel.send("❌ Could not fetch user."); break; }
                const avatarURL = fetched.displayAvatarURL({ format: 'png', size: 64 });
                // Use webhook to send as the target user
                if (!message.guild) { await message.channel.send("❌ Server only."); break; }
                const webhooks = await message.channel.fetchWebhooks().catch(() => null);
                let wh = webhooks?.first();
                if (!wh) {
                  wh = await message.channel.createWebhook('Fake Msg').catch(() => null);
                }
                if (!wh) { await message.channel.send("❌ Could not create webhook."); break; }
                await wh.send({ content: text, username: fetched.username, avatarURL }).catch(async (e) => {
                  await message.channel.send(`❌ Failed: ${e.message}`);
                });
                break;
              }

              // ── INFO ─────────────────────────────────────────
                case 'info': {
                  await message.reply(
                    `📘 **About This Project**

                This automation system is developed and maintained by
                **NXTINDIA**.

                🛠️ **Create your own setup:**
                https://nxtindia.me.live
                _(We are actively working on more features.)_

                ☕ **Support development:**
                https://discord.gg/TNjUK58nBJ

                Thank you for using our software.`
                  );
                  break;
                }

              case 'help': {
                const helpText = `
╔════════════════════════════════════════════════════════════════════╗
║                     📚 ALL SelfBot Commands                        ║
║              Copyright © 2024 NovaLabs • mintgram.live             ║
╚════════════════════════════════════════════════════════════════════╝

Commands are owner-only. Use prefix: ${prefix}

═══════════════════════════════════════════════════════════════════════
🔧 CORE COMMANDS
═══════════════════════════════════════════════════════════════════════
• ${prefix}ping                  - Check bot latency & uptime
• ${prefix}help                  - Show this help menu
• ${prefix}info                  - About NovaLabs & mintgram.live
• ${prefix}userinfo [@user]      - Get user information
• ${prefix}guildinfo             - Get server information

═══════════════════════════════════════════════════════════════════════
🔄 AUTO FEATURES
═══════════════════════════════════════════════════════════════════════
• ${prefix}autobold        / ${prefix}stopautobold     - Auto-bold messages
• ${prefix}autostrong      / ${prefix}stopautostrong   - Auto-strong messages
• ${prefix}autoitalic      / ${prefix}stopautoitalic   - Auto-italic messages
• ${prefix}autolines       / ${prefix}stopautolines    - Auto-add underline
• ${prefix}autodark        / ${prefix}stopautodark     - Auto-code block messages
• ${prefix}autospoil       / ${prefix}stopautospoil    - Auto-spoiler messages
• ${prefix}autoreaction @user <emoji> / ${prefix}stopautoreaction - Auto-react
• ${prefix}reactionoff             - Stop all auto-reactions

═══════════════════════════════════════════════════════════════════════
🎯 TARGET COMMANDS
═══════════════════════════════════════════════════════════════════════
• ${prefix}exile @user     / ${prefix}stopexile   - Auto-insult user
• ${prefix}mimic @user     / ${prefix}stopmimic   - Mimic user's messages
• ${prefix}insult @user              - Insult mentioned user
• ${prefix}insult2 @user             - Hindi insult
• ${prefix}autopressure @user        - Pressure user with insults
• ${prefix}stoppressure              - Stop all pressure
• ${prefix}stopap                    - Delete + stop pressure

═══════════════════════════════════════════════════════════════════════
💥 SPAM & RAID
═══════════════════════════════════════════════════════════════════════
• ${prefix}spam <text>     / ${prefix}stopspam    - Spam text
• ${prefix}spam2 <#> <text>          - Limited spam
• ${prefix}outlast @user   / ${prefix}outlaststop - Outlast user
• ${prefix}fs <#> <text>             - Fast spam messages
• ${prefix}loop <#> <text>           - Loop messages
• ${prefix}ladder <w1> <w2>...       - Ladder messages
• ${prefix}massdm <text>             - Mass DM all server members

═══════════════════════════════════════════════════════════════════════
👥 GROUP CHAT
═══════════════════════════════════════════════════════════════════════
• ${prefix}gcpressure <text> / ${prefix}stopgcpressure - Spam + rename GC
• ${prefix}gc1 @user         / ${prefix}stopgc1        - GC spam with counter
• ${prefix}gc2 @user         / ${prefix}stopgc2        - GC spam + pin + rename
• ${prefix}gcn <name>        / ${prefix}stopgcn        - Auto-rename channel
• ${prefix}gcpfp <id>                - Get GC profile picture

═══════════════════════════════════════════════════════════════════════
🔗 LINK MANAGEMENT
═══════════════════════════════════════════════════════════════════════
• ${prefix}linkstore <name> <url>    - Save link
• ${prefix}linkdelete <name>         - Delete link
• ${prefix}linkshow                  - List all links
• ${prefix}<linkname>                - Send saved link

═══════════════════════════════════════════════════════════════════════
🛠️ UTILITY
═══════════════════════════════════════════════════════════════════════
• ${prefix}purge <#>                 - Delete your messages
• ${prefix}pfp [@user]               - Get user avatar
• ${prefix}banner [@user]            - Get user banner
• ${prefix}serverid <invite>         - Get server ID from invite
• ${prefix}members                   - List server members
• ${prefix}username <name>           - Change username
• ${prefix}bio <text>                - Set bio
• ${prefix}avatar <url>              - Change avatar
• ${prefix}react <msg_id> <emoji>    - React to message
• ${prefix}typefake <sec>            - Fake typing
• ${prefix}getmsg <msg_id>           - Get message content
• ${prefix}searchmsg <term>          - Search messages in channel
• ${prefix}webhook <text>            - Send via webhook
• ${prefix}clone @user    / ${prefix}unclone - Clone profile
• ${prefix}delchannels               - Delete all other channels
• ${prefix}reversemsg <msg_id>       - Reverse message text
• ${prefix}fakemsg @user <text>      - Fake message as user

═══════════════════════════════════════════════════════════════════════
💡 TIPS
• Use @mention or user ID for user commands
• Links auto-send when typing ${prefix}linkname
• Auto-features only apply to your own messages
• Confirm style: words / reactions / delete

═══════════════════════════════════════════════════════════════════════
🔗 Website: https://mintgram.live
☕ Support: https://www.buymeacoffee.com/novalabs
═══════════════════════════════════════════════════════════════════════`;

                const chunks = helpText.match(/[\s\S]{1,1900}/g) || [helpText];
                for (const chunk of chunks) {
                  await message.channel.send(`\`\`\`${chunk}\`\`\``).catch(() => {});
                }
                break;
              }

            } // end switch
          } catch (error) {
            console.error(`Error in ${self.user?.tag}:`, error);
          }
        });

        if (msg.type === "STOP") {
          const client = clients.get(token);
          if (client) {
            console.log(`Stopping bot: ${client.user?.tag}`);
            if (spamTask) clearInterval(spamTask);
            if (outlastTask) clearInterval(outlastTask);
            if (nameChangeTask) clearInterval(nameChangeTask);
            if (m16Task) clearInterval(m16Task);
            if (uziTask) clearInterval(uziTask);
            if (ak47Task) clearInterval(ak47Task);
            if (alTask) clearInterval(alTask);
            for (const [, interval] of pressureTasks) clearInterval(interval);
            for (const [, interval] of gcPressureTasks) clearInterval(interval);
            for (const [, interval] of gc1Tasks) clearInterval(interval);
            for (const [, interval] of gc2Tasks) clearInterval(interval);
            clearInterval(statsInterval);
            client.destroy();
            clients.delete(token);
          }
        }

      } // end START

    } catch (err) {
      console.error("Worker error:", err);
    }
  });
}

startWorker();
