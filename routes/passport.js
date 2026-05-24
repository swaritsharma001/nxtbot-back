import passport from "passport";

import {
  Strategy as DiscordStrategy
} from "passport-discord";

import {
  genrateToken
} from "../jwt/jwt.js";

import users from "../mongo/user.js";

passport.serializeUser(
  (user, done) => {
    done(null, user);
  }
);

passport.deserializeUser(
  (obj, done) => {
    done(null, obj);
  }
);

passport.use(

  new DiscordStrategy(
    {
      clientID:
        process.env.CLIENT_ID,

      clientSecret:
        process.env.CLIENT_SECRET,

      callbackURL:
        process.env.CALLBACK_URL,

      scope: [
        "identify",
        "email",
        "guilds",
      ],
    },

    async (
      accessToken,
      refreshToken,
      profile,
      done
    ) => {

      try {

        let existingUser =
          await users.findOne({
            Id: profile.id,
          });

        if (!existingUser) {

          existingUser =
            await users.create({

              Id: profile.id,

              username:
                profile.username,

              pic:
                profile.avatar,

            });

        } else {

          existingUser.username =
            profile.username;

          existingUser.pic =
            profile.avatar;

          await existingUser.save();
        }

        const tokenData =
          await genrateToken({

            id: existingUser.Id,

            username:
              existingUser.username,

            avatar:
              existingUser.pic,

          });

        existingUser.token =
          tokenData;

        await existingUser.save();

        

        return done(null, {

          id: existingUser.Id,

          username:
            existingUser.username,

          avatar:
            existingUser.pic,

          token:
            existingUser.token,

        });

      } catch (err) {

        console.log(err);

        return done(err, null);

      }
    }
  )
);

export default passport;