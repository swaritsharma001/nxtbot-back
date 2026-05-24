import mongoose from "mongoose";

const botSchema = new mongoose.Schema({
  username: { type: String, required: true },

  isBanned: { type: Boolean, default: false },

  // 🔑 bot auth token
  token: { type: String, required: true, unique: true },

  // 👤 owner reference
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  // 🟢 runtime status (optional but useful)
  isRunning: { type: Boolean, default: false },

  lastActive: { type: Date, default: Date.now },

  presence: {
    type: String,
    default: "NXT BOT INDIA"
  },
  presencePic: {
    type: String
  },
  prefix: {
    type: String,
    default: "*"
  }
});

const Bot = mongoose.model("Bot", botSchema);

export default Bot;