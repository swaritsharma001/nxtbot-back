import 'dotenv/config'
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  Id: { type: String, required: true },
  username: { type: String, required: true },
  pic: { type: String },
  isPremium: { type: Boolean, default: false },

  // 👇 user ke bots ka reference
  bots: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bot",
    },
  ],
});

const User = mongoose.model("User", userSchema);

export default User;