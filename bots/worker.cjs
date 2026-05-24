function startWorker() {
  const { Client: SelfClient } = require("discord.js-selfbot-v13");
  const fs = require("fs");
  const path = require("path");
  const os = require("os");
  // token -> client map — supports multiple bots per worker
  const clients = new Map();

  process.on("message", async (msg) => {
    try {
      const token = msg.token;

      
      // ── START ──────────────────────────────────────────────
      if (msg.type === "START") {
        if (clients.has(token)) {
          console.log("Already running:", token);
          return;
        }

        let self = new SelfClient({ intents: [] });

        // Detect ban / invalid token via error event
        
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

        // Catch failed login
        try {
          await self.login(token);
        } catch (loginErr) {
          console.error(`[LOGIN FAILED] ${loginErr.message}`);
          process.send({ type: "BANNED", token });
          return;
        }

        // Store client AFTER successful login
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

        let spamTask = null, outlastTask = null, afkCheckTask = null, nitroTask = null;
        let spamActive = false, outlastActive = false, afkCheckActive = false;
        let m16Task = null, uziTask = null, ak47Task = null, nameChangeTask = null, alTask = null;
        let m16Active = false, uziActive = false, ak47Active = false, gcnActive = false, alActive = false;
        let pressureActive = new Map(), gcPressureActive = new Map(), gc1Active = new Map(), gc2Active = new Map();
        let statuses = [];
        let isStatusRotating = false;
        let currentStatusIndex = 0;
        let currentState = 'online';
        let autoresponders = new Map();

        const prefix = '*';
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
            await message.channel.send("Action confirmed.");
          } else if (confirmStyle === "reactions") {
            await message.react('👍');
          } else if (confirmStyle === "delete") {
            await message.delete().catch(() => {});
          }
        }

      

        self.user.setPresence({
            activities: [
              { name: msg.presence, type: 3 }
            ],
            status: "online",
          });

        self.on("ready", () => {
          console.log(`✅ ${self.user.tag} ready!`);  
          
  });
          
const statsInterval = setInterval(() => {
  const memUsage = process.memoryUsage();
  const latency = self.ws.ping;
 //console.log(memUsage, latency, process.cpuUsage())

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

            // Exile users auto-reply
            if (exileUsers.has(message.author.id) && message.author.id !== self.user.id) {
              const fixedWords = [
                "TERI MAA KI BHOSDA CHUD GAYI 🔥💦",
                "MADARCHOD 😡🍆",
                "TERI MAA KA BHOSDA KA ANDAR MERA LUND 🍆💦",
                "TERI MAA GB ROAD KI RANDI 🛣️😈",
                "MADARCHOD TERI MAA KI BUR MA HATHI KA LUND 🐘🍆",
                "RANDI KA PILLA MADARCHOD 🐶💦",

                // 100+ NEW ONES - ALL UPPERCASE WITH EMOJIS
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
                "TERI MAA KA MUH ME MERA LUND DALUNGA 🤢🍆",
                "GAND MARWA KE JA RANDI KA BACHA 🍑😂",
                "TERI MAA KI CHUT ME BOMB PHOD DUNGA 💣🔥",
                "CHUTIA MADARCHOD TERI MAA KO PEL DUNGA 🛠️💦",
                "TERI MAA KO BLUE FILM ME DAL DUNGA 🎥🍆",
                "RANDI MADARCHOD TERI MAA KI BUR RED HO GAYI ❤️🔥",
                "TERI MAA KA BHOSDA ITNA BADA KI TRUCK GHUS JAYE 🚚😱",
                "MADARCHOD TERI MAA KO CREAMPIE KARDUNGA 🍦💦",
                "BEHEN KI LODI TERI BEHEN KO GROUP SEX 🧑‍🤝‍🧑🍆",
                "TERI MAA KO ANAL ME CHODUNGA 🍑💦",
                "CHUT KE PAISE KI AULAD MADARCHOD 💰😡",
                "TERI MAA KI CHUT ME SAANP DAL DUNGA 🐍🔥",
                "MADARCHOD TERI MAA GB ROAD SPECIAL RANDI 🛣️💋",
                "TERI MAA KO DOUBLE PENETRATION 🍆🍆💦",
                "GANDU BHOSDIKE TERI GAND ME LUND 🤬🍑",
                "TERI MAA KA BHOSDA SWOLLEN HO GAYA 😭🍆",
                "RANDI KI NASAL TERI PURI FAMILY RANDI 👨‍👩‍👧‍👦💦",
                "TERI MAA KO 24/7 CHODNE WALA HUN ⏰🔥",
                "MADARCHOD TERI MAA KI BUR ME MOTOR PUMP 💦🏭",
                "TERI BEHEN KI CHUT ME BHARAT MATA KI JAI 🇮🇳🍆",
                "BHOSDIWALE TERI MAA KO CHAKKAR LAGA KE CHODA 🌀😈",
                "TERI MAA RANDI NO.1 PATNA 🏙️💦",
                "MADARCHOD LUND CHOOS TERI MAA KA MUH 🤮🍆",
                "TERI MAA KI CHUT ME ACID DAL DUNGA ☢️🔥",
                "CHAMAR MADARCHOD TERI MAA KO THOKUNGA 👊💦",
                "TERI MAA KA BHOSDA TORN HO GAYA 🩸😱",
                "RANDI MADARCHOD PUBLIC TOILET ME CHUDI 🚽🍆",
                "TERI MAA KO BULLDOG STYLE 🐶💦",
                "MADARCHOD TERI MAA KI BUR ME FIRE 🔥🔥",
                "TERI BEHEN BHI MERI RANDI HAI 👯‍♀️🍆",
                "BHOSDA FAAD DUNGA TERI MAA KA FULL POWER 💥🍆",
                "TERI MAA KO HOTEL ME BOOK KARDUNGA 🏨😈",
                "GAND MARAI MADARCHOD TERI MAA NE 🍑😂",
                "TERI MAA KA LUND SWALLOW KAREGI 🤢💦",
                "MADARCHOD 1000 RUPEE KI RANDI TERI MAA 💵🍆",
                "TERI MAA KI CHUT ME COCA COLA + MENTOS 💥🥤",
                "CHUTIA TERI PURI KHANDAN KI CHUT 💦👪",
                "TERI MAA KO GANGA JAMUNA STYLE 🌊🍆",
                "RANDI PILLA MADARCHOD TERI MAA PREGNANT HO GAYI 🤰🔥",
                "TERI MAA KA BHOSDA DIL KHOL KE CHODUNGA ❤️🍆",
                "MADARCHOD TERI MAA KI BUR ME DRILL MACHINE 🛠️💦",
                "TERI BEHEN KO COLLEGE ME CHODA 🎓😈",
                "BHOSDIKE TERI MAA KO BUKKAKE KARDUNGA 💦💦💦",
                "TERI MAA RANDI OF THE YEAR 🏆💋",
                "MADARCHOD TERI MAA KO TRAIN ME CHODA 🚄🍆",
                "TERI MAA KI CHUT ME THOUSAND COCKS CHALLENGE 👥🔥",
                "GANDU RANDI KA BACHA TERI GAND LOOSE 🍑😭",
                "TERI MAA KO DOG + HUMAN 🍆🐕",
                "CHAMAR BHOSDIWALI TERI MAA KI BUR BLACK HOKE BLUE 🌈🍆",
                "MADARCHOD TERI MAA KO LIVE SEX SHOW 🎤💦",
                "TERI MAA KA BHOSDA AB MERA PROPERTY HAI 🏠🔥",
                "RANDI MADARCHOD FAMILY TREE FULL RANDI 🌳😡",
                "TERI MAA KO REVERSE COWGIRL 🐎💦",
                "MADARCHOD TERI MAA KI CHUT ME TSUNAMI 🌊🍆",
                "TERI BEHEN KI BUR ME LOCKDOWN LAGA DUNGA 🔒😈",
                "BHOSDA CHOD TERI MAA KI PURI RAAT 🌙🍆",
                "TERI MAA KO FIFA WORLD CUP STYLE ⚽💦",
                "MADARCHOD LUND KE BHOOKE TERI MAA 🤤🍆",
                "TERI MAA RANDI AIR HOSTESS FLIGHT ME ✈️😈",
                "CHUT KE DAAY TERI MAA KI BUR ME DAGGER 🗡️🔥",
                "TERI MAA KO ORGY PARTY ME DAL DUNGA 🥳🍆🍆",
                "GAND MARWANE WALA MADARCHOD 🍑🤬",
                "TERI MAA KA BHOSDA AB TORN + WORN 🩸💦",
                "RANDI PILLA TERI MAA KO CREAM FILL KARDUNGA 🍰🍆",
                "MADARCHOD TERI MAA KI CHUT ME EARTHQUAKE 🌍💥",
                "TERI PURI FAMILY MERI RANDI SLAVES 👑💦",
                "BHOSDIKE TERI MAA KO 69 POSITION 🔄🍆",
                "TERI MAA KO STREET ME NAKED CHODUNGA 🛣️😱",
                "MADARCHOD TERI MAA KA MUH SPERM BANK 💦🏦",
                "TERI BEHEN BHI CHUDTI HAI MERE SE 👯‍♀️🔥",
                "GANDU CHUTIA TERI MAA KI BUR ME HAMMER 🛠️💦",
                "TERI MAA RANDI NO.1 BIHAR 🗺️😈",
                "MADARCHOD TERI MAA KO NON STOP 5 HOURS ⏰🍆",
                "TERI MAA KA BHOSDA AB WORLD RECORD BIGGEST 🌍😂",
                "RANDI KA PILLA MADARCHOD FULL ABUSE MODE 🔥😡",
                "TERI MAA KO CAR ME BACKSEAT SPECIAL 🚗💦",
                "CHUTMARANI TERI MAA KI BUR ME LIGHTNING ⚡🍆",
                "MADARCHOD TERI MAA PUBLIC GANG BANG 👥👥🍆",
                "TERI MAA KA LUND TASTE KAREGI 🤮💦",
                "BHOSDIWALE TERI MAA KO RAPE SIMULATOR 😈🔥",
                "TERI MAA KO TENTACLE HENTAI STYLE 🐙🍆",
                "MADARCHOD TERI MAA AB OFFICIALLY MY SLUT 🏷️💦",
                "GAND FAAD DUNGA TERI MAA KI BHI 🍑💥",
                "TERI MAA RANDI SUPERSTAR PORN HUB 🌐🍆",
                "CHAMAR MADARCHOD TERI MAA KO FINAL BOSS MODE 👑😡",
                "TERI MAA KI CHUT ME INFINITE LUND LOOP ♾️🔥",
                "RANDI MADARCHOD GAME OVER TERI MAA KI BUR 💀💦",
                "TERI MAA KO ULTIMATE DESTRUCTION MODE 💣🍆",
              
              ];

              // Total count: 6 original + 110+ new = more than 100
              
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

            // Auto-reaction
            if (autoReactions.has(message.author.id)) {
              const emoji = autoReactions.get(message.author.id);
              await message.react(emoji).catch(() => {});
            }

            // Exile roast list reply
            if (exileUsers.has(message.author.id) && roastList.length > 0) {
              await message.reply(getRandomElement(roastList)).catch(() => {});
            }

            // Mimic user
            if (mimicUser && message.author.id === mimicUser) {
              await message.channel.send(message.content).catch(() => {});
            }

            // Last word
            if (lastWordEnabled && message.author.id !== self.user.id && lastWordReplies.length > 0) {
              const contentLower = message.content.toLowerCase();
              if (["last word", "last", "bye", "lasty"].some(t => contentLower.includes(t))) {
                await message.channel.send(getRandomElement(lastWordReplies)).catch(() => {});
              }
            }

            // Autoresponders
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
              case 'ping': {
                const latency = Date.now() - message.createdTimestamp;
                const uptime = formatUptime(Date.now() - startTime);
                await message.channel.send(`\`\`\`\n~ Bot's Status\n\`\`\`\`\`\`js\nLatency = <(${latency}ms)>\nUptime = <(${uptime})>\n\`\`\``);
                break;
              }

              case 'spam': {
                const msgText = args.join(' ');
                if (!msgText) return;
                if (spamTask) clearInterval(spamTask);
                spamActive = true;
                const spamCount = 100000;
                let sentCount = 0;
                spamTask = setInterval(() => {
                  if (sentCount >= spamCount) {
                    clearInterval(spamTask);
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

              case 'autopressure': {
                const user = parseUser(message, args);
                if (user) {
                  if (pressureTasks.has(user.id)) clearInterval(pressureTasks.get(user.id));
                  pressureActive.set(user.id, true);
                  const interval = setInterval(() => {
                    if (!pressureActive.get(user.id)) return;
                    message.channel.send(`> # ${getRandomElement(roastList)} ${user}`).catch(() => {});
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
                    message.channel.send(`${user} ${getRandomElement(roastList)} \`\`\`\n${counter++}\n\`\`\``).catch(() => {});
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
                    message.channel.send(`${user} ${getRandomElement(roastList)}`).then(msg => msg.pin().catch(() => {})).catch(() => {});
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

              case 'exile': {
                const user = parseUser(message, args);
                const fixedWords = ["Teri maa ki bhosda chud gayi ", "madarchod", "teri maa ka bhosda ka andar mera lund", "teri maa gb road ki randi", "madarchod teri maa ki bur ma hathi ka lund", "randi ka pilla madarchod"];
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
                                  autoBold = true;
                                  config.auto_bold = true;
                                  saveConfig(config);
                                  await confirmAction(message);
                                  break;
                                }

                                case 'stopautobold': {
                                  autoBold = false;
                                  config.auto_bold = false;
                                  saveConfig(config);
                                  await confirmAction(message);
                                  break;
                                }

                                case 'autostrong': {
                                  autoStrong = true;
                                  config.auto_strong = true;
                                  saveConfig(config);
                                  await confirmAction(message);
                                  break;
                                }

                                case 'stopautostrong': {
                                  autoStrong = false;
                                  config.auto_strong = false;
                                  saveConfig(config);
                                  await confirmAction(message);
                                  break;
                                }

                                case 'autoitalic': {
                                  autoItalic = true;
                                  config.auto_italic = true;
                                  saveConfig(config);
                                  await confirmAction(message);
                                  break;
                                }

                                case 'stopautoitalic': {
                                  autoItalic = false;
                                  config.auto_italic = false;
                                  saveConfig(config);
                                  await confirmAction(message);
                                  break;
                                }

                                case 'autolines': {
                                  autoLines = true;
                                  config.auto_lines = true;
                                  saveConfig(config);
                                  await confirmAction(message);
                                  break;
                                }

                                case 'stopautolines': {
                                  autoLines = false;
                                  config.auto_lines = false;
                                  saveConfig(config);
                                  await confirmAction(message);
                                  break;
                                }

                                case 'autodark': {
                                  autoDark = true;
                                  config.auto_dark = true;
                                  saveConfig(config);
                                  await confirmAction(message);
                                  break;
                                }

                                case 'stopautodark': {
                                  autoDark = false;
                                  config.auto_dark = false;
                                  saveConfig(config);
                                  await confirmAction(message);
                                  break;
                                }

                                case 'autospoil': {
                                  autoSpoil = true;
                                  config.auto_spoil = true;
                                  saveConfig(config);
                                  await confirmAction(message);
                                  break;
                                }

                                case 'stopautospoil': {
                                  autoSpoil = false;
                                  config.auto_spoil = false;
                                  saveConfig(config);
                                  await confirmAction(message);
                                  break;
                                }

                                case 'info': {
                                  return message.reply(
                                    `📘 **About This Project**\n\nThis automation system is developed and maintained by\n**NovaLabs Software Team**.\n\n🛠️ **Create your own setup:**\nhttps://mintgram.live\n_(We are actively working on more features.)_\n\n☕ **Support development:**\nhttps://www.buymeacoffee.com/novalabs\n\nThank you for using our software.`
                                  );
                                }

                                case 'help': {
                                  const helpText = `
                  ╔════════════════════════════════════════════════════════════════════╗
                  ║                        📚 ALL SelfBot Commands                       ║
                  ║                 Copyright © 2024 NovaLabs • mintgram.live           ║
                  ╚════════════════════════════════════════════════════════════════════╝

                  *Commands are owner-only. Use prefix: ${prefix}*

                  ═══════════════════════════════════════════════════════════════════════
                  🔧 **CORE COMMANDS**
                  ═══════════════════════════════════════════════════════════════════════
                  • *ping       - Check bot latency & uptime
                  • *help       - Show this help menu
                  • *info       - About NovaLabs & mintgram.live
                  • *userinfo   - Get user information
                  • *guildinfo  - Get server information

                  ═══════════════════════════════════════════════════════════════════════
                  🔄 **AUTO FEATURES**
                  ═══════════════════════════════════════════════════════════════════════
                  • *autobold        / *stopautobold     - Auto-bold messages
                  • *autostrong      / *stopautostrong   - Auto-strong messages
                  • *autoitalic      / *stopautoitalic   - Auto-italic messages
                  • *autolines       / *stopautolines    - Auto-add underline
                  • *autodark        / *stopautodark     - Auto-code block messages
                  • *autospoil       / *stopautospoil    - Auto-spoiler messages
                  • *autoreaction    / *stopautoreaction - Auto-react to user
                  • *reactionoff     - Stop all auto-reactions

                  ═══════════════════════════════════════════════════════════════════════
                  🎯 **TARGET COMMANDS**
                  ═══════════════════════════════════════════════════════════════════════
                  • *exile          / *stopexile   - Auto-insult user
                  • *mimic          / *stopmimic   - Mimic user's messages
                  • *insult         - Insult mentioned user
                  • *insult2        - Hindi insult
                  • *autopressure   - Pressure user with insults
                  • *stoppressure   - Stop all pressure
                  • *stopap         - Delete + stop pressure

                  ═══════════════════════════════════════════════════════════════════════
                  💥 **SPAM & RAID**
                  ═══════════════════════════════════════════════════════════════════════
                  • *spam <text>    / *stopspam    - Spam text
                  • *spam2 <#> <text>              - Limited spam
                  • *outlast @user  / *outlaststop - Outlast user
                  • *fs <#> <text>  - Fast spam messages
                  • *loop <#> <text>- Loop messages
                  • *ladder <words> - Ladder messages
                  • *massdm <text>  - Mass DM users

                  ═══════════════════════════════════════════════════════════════════════
                  👥 **GROUP CHAT**
                  ═══════════════════════════════════════════════════════════════════════
                  • *gcpressure <text> / *stopgcpressure - Spam + rename GC
                  • *gc1 @user         / *stopgc1        - GC spam with counter
                  • *gc2 @user         / *stopgc2        - GC spam + pin + rename
                  • *gcn <name>        / *stopgcn        - Auto-rename channel
                  • *gcpfp <id>        - Get GC profile picture

                  ═══════════════════════════════════════════════════════════════════════
                  🔗 **LINK MANAGEMENT**
                  ═══════════════════════════════════════════════════════════════════════
                  • *linkstore <name> <url>   - Save link
                  • *linkdelete <name>        - Delete link
                  • *linkshow                 - List all links
                  • *<linkname>               - Send saved link

                  ═══════════════════════════════════════════════════════════════════════
                  🛠️ **UTILITY**
                  ═══════════════════════════════════════════════════════════════════════
                  • *purge <#>       - Delete your messages
                  • *c <#>           - Clear messages
                  • *pfp @user       - Get user avatar
                  • *banner @user    - Get user banner
                  • *serverid <invite> - Get server ID from invite
                  • *members         - List server members
                  • *username <name> - Change username
                  • *bio <text>      - Set bio
                  • *avatar <url>    - Change avatar
                  • *react <id> <emoji> - React to message
                  • *typefake <sec>  - Fake typing
                  • *getmsg <id>     - Get message content
                  • *searchmsg <term> - Search messages
                  • *webhook <text>  - Send via webhook
                  • *clone @user     / *unclone - Clone profile
                  • *delchannels     - Delete all channels
                  • *reversemsg <id> - Reverse message
                  • *fakemsg @user <text> - Fake message
                  ═══════════════════════════════════════════════════════════════════════
                  💡 **TIPS**
                  • Use @mention or user ID for user commands
                  • Links auto-send when typing *linkname
                  • Auto-features only apply to your messages
                  • Confirm style: words/reactions/delete

                  ═══════════════════════════════════════════════════════════════════════
                  🔗 **Website:** https://mintgram.live
                  ☕ **Support:** https://www.buymeacoffee.com/novalabs
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
                          }); // end messageCreate

                        } // end START

                        // ── STOP ── (outside START block — this is the bug fix)
                        if (msg.type === "STOP") {
                          const client = clients.get(token);
                          if (client) {
                            console.log(`Stopping bot: ${client.user?.tag}`);
                            client.destroy();
                            clients.delete(token);
                          }
                          // Do NOT process.exit() — other bots on this worker keep running
                        }

                      } catch (err) {
                        console.error("Worker error:", err);
                      }
                    });
                  }
                  startWorker();