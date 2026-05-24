import express from "express";
import passport from "./passport.js";
import cookieSession from "cookie-session";
import { verifyToken } from "../jwt/jwt.js"

const router = express.Router();


router.use(passport.initialize());
router.use(passport.session());

/**
 * Login Route
 */
router.get(
  "/login",
  passport.authenticate("discord", {
    scope: ["identify", "email", "guilds"],
  })
);

/**
 * Discord Callback
 */
router.get(
  "/callback",
  passport.authenticate("discord", {
    failureRedirect: "/",
    session: true,
  }),
  async (req, res) => {
    try {
      const frontend = process.env.FRONTEND_URL;

      const redirectUrl = `${frontend}?token=${req.user.token}`;

      res.redirect(redirectUrl);
    } catch (err) {
      console.error(err);
      res.status(500).send("Authentication failed");
    }
  }
);

/**
 * Logout
 */
router.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);

    req.session = null;

    res.redirect("/");
  });
});

router.get("/user", verifyToken, (req, res) => {
 // console.log("au5h",req.user)
  res.send(req.user);
});

export default router;
