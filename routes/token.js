import router from "express";
import { verifyToken } from "../jwt/jwt.js";
import User from "../mongo/user.js";
import Bot from "../mongo/bot.js";
import { verifyDiscordToken, startBot, stopBot, getBotStats , changeAdver, sendUtr} from "../bots/index.js";
import Utr from "../mongo/utr.js"
const route = router.Router();

route.post("/token", verifyToken, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    const users = await User.findOne({ _id: userId });
    if (!users) return res.status(404).send({ success: false, message: "User not found" });

    const isValid = await verifyDiscordToken(token);
    if (!isValid) return res.status(400).send({ success: false, message: "INVALID TOKEN" });

    const username = isValid.username;

    if (!users.isPremium) {
      const bots = await Bot.find({ owner: users._id });
      if (bots.length >= 2) {
        return res.status(403).send({
          success: false,
          message: "BUY PREMIUM TO ADD MORE BOTS JUST IN RS 100.",
        });
      }
    }

    const existingBot = await Bot.findOne({ token });
    if (existingBot) return res.status(400).send({ success: false, message: "BOT ALREADY EXISTS" });

    const newBot = await Bot.create({
      username,
      token,
      owner: users._id,
      isRunning: false,
      isBanned: false,
    });

    users.bots.push(newBot._id);
    await users.save();

    return res.status(200).send({ success: true, message: "Bot created successfully", bot: newBot });
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
});

route.get("/bots", verifyToken, async (req, res) => {
  try {
    const users = await User.findOne({ _id: req.user.id }); // id not _id
    if (!users) return res.status(404).send({ success: false, message: "User not found" });

    const bots = await Bot.find({ owner: users._id });

    const datasend = bots.map((bot) => {
      const stats = getBotStats(bot.token); // ✅ moved inside map, bot is defined here
      //console.log("data",stats)
      return {
        _id: bot._id,
        username: bot.username,
        isRunning: bot.isRunning,
        isBanned: bot.isBanned,
        lastActive: bot.lastActive,
        ramUsage: bot.isRunning ? stats.ramUsage : "fetching",
        cpuUsage: bot.isRunning ? stats.cpuUsage : "fetching",
        latency: bot.isRunning ? stats.latency : null,
      };
    });

    res.send(datasend);
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
});

route.post("/start", verifyToken, async (req, res) => {
  
  try {
    const users = await User.findOne({ _id: req.user.id });
    if (!users) return res.status(404).send({ success: false, message: "User not found-start error" });

    const { id } = req.body;
    const bot = await Bot.findOne({ _id: id, owner: users._id });

    if (!bot) return res.status(404).send({ success: false, message: "BOT NOT FOUND" });
    if (bot.isBanned) return res.status(403).send({ success: false, message: "BOT IS BANNED. CONTACT SUPPORT." });
    if (bot.isRunning) return res.status(400).send({ success: false, message: "BOT ALREADY RUNNING" });

    await startBot(bot.token);

    bot.isRunning = true;
    bot.lastActive = new Date();
    await bot.save();

    res.send({ success: true, message: "BOT STARTED" });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
});

route.post("/stop", verifyToken, async (req, res) => {
  try {
    const users = await User.findOne({ _id: req.user.id });
    if (!users) return res.status(404).send({ success: false, message: "User not found" });

    const { id } = req.body;
    const bot = await Bot.findOne({ _id: id, owner: users._id });

    if (!bot) return res.status(404).send({ success: false, message: "BOT NOT FOUND" });
    if (!bot.isRunning) return res.status(400).send({ success: false, message: "BOT ALREADY STOPPED" });

    await stopBot(bot.token);

    bot.isRunning = false;
    bot.lastActive = new Date();
    await bot.save();

    res.send({ success: true, message: "BOT STOPPED" });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
});



route.post("/delete", verifyToken, async (req, res) => {
  try {
    const { id } = req.body;
    const userId = req.user.id;

    if (!id) return res.status(400).send({ success: false, message: "Bot ID is required" });

    const bot = await Bot.findOne({ _id: id, owner: userId });
    if (!bot) return res.status(404).send({ success: false, message: "Bot not found" });

    if (bot.isRunning) await stopBot(bot.token);

    await Bot.findOneAndDelete({ _id: id, owner: userId });

    await User.findByIdAndUpdate(userId, { $pull: { bots: bot._id } });

    res.status(200).send({ success: true, message: "Bot deleted successfully" });
  } catch (err) {
    res.status(500).send({ success: false, message: err.message });
  }
});

route.post("/utr", verifyToken, async (req,res)=>{
  const {utr} = req.body;
  const userId = req.user.id;

  if(!utr) return res.status(404).send({message: "Please post a utr number"})

  const utrs = await Utr.create({
    utr: utr,
    userId: userId
  })
  const user = await User.findOne({ _id: userId})
  sendUtr(user.Id, utr)
  res.status(200).send({message: "Utr added Please wait"})
})

route.post("/presence", verifyToken, async (req, res) => {
  const { id, presence } = req.body;
  //console.log(id, presence)
  const userId = req.user.id;

  try {
    if (!id || !presence) {
      return res.status(400).send({ success: false, message: "Bot ID and presence are required" });
    }

    const user = await User.findOne({ _id: userId });
    if (!user) return res.status(404).send({ success: false, message: "User not found" });

    if (!user.isPremium) {
      return res.status(403).send({ success: false, message: "BUY PREMIUM TO UPDATE PRESENCE. JUST RS 100." });
    }

    const bot = await Bot.findOne({ _id: id, owner: userId });
    if (!bot) return res.status(404).send({ success: false, message: "Bot not found" });

    await Bot.findOneAndUpdate({ _id: id, owner: userId }, { presence });

    if (bot.isRunning) {
      changeAdver(bot.token, presence);
    }

    return res.status(200).send({ success: true, message: "Presence updated. Restart bot to apply changes." });
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
});

route.post("/prefix", verifyToken, async (req, res) => {
  const { id, prefix } = req.body;
  
  const userId = req.user.id;

  try {
    if (!id || !prefix) {
      return res.status(400).send({ success: false, message: "Bot ID and prefix are required" });
    }

    const user = await User.findOne({ _id: userId });
    if (!user) return res.status(404).send({ success: false, message: "User not found" });

    if (!user.isPremium) {
      return res.status(403).send({ success: false, message: "BUY PREMIUM TO UPDATE prefix. JUST RS 100." });
    }

    const bot = await Bot.findOne({ _id: id, owner: userId });
    if (!bot) return res.status(404).send({ success: false, message: "Bot not found" });

    await Bot.findOneAndUpdate({ _id: id, owner: userId }, { prefix });

    return res.status(200).send({ success: true, message: "prefix updated. Restart bot to apply changes." });
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
});

export default route;