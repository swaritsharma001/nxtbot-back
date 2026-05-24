import express from "express"
import cors from "cors"
import session from "express-session"
import rateLimit from "express-rate-limit"
import authRoute from "./routes/auth.js"
import { connect } from "./mongo/connect.js"
import tokenRoute from "./routes/token.js"
import { restoreRunningSessions } from "./bots/index.js"

const app = express()

connect()
restoreRunningSessions()

// Rate Limiters
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: "Too many requests, please try again later." }
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // auth routes pe strict limit
  message: { success: false, message: "Too many login attempts, please try again later." }
})

// Middlewares
app.use(cors())
app.use(express.json())
app.use(session({
  secret: process.env.SESSION_SECRET || "your_secret_key",
  resave: false,
  saveUninitialized: false,
}))

// Rate limit apply
app.use(globalLimiter)
app.use("/auth", authLimiter, authRoute)
app.use("/core", tokenRoute)

app.listen(5000, () => {
  console.log("Server running on port 5000")
})

export default app